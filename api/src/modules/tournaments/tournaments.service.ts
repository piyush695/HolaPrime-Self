import { query, queryOne, withTransaction } from '../../db/index.js';
import { getPlatformAdapter } from '../../platform/platform.service.js';
import type { PlatformType } from '../../platform/adapter.interface.js';

// ── Tournament CRUD ───────────────────────────────────────────────────────────
export async function listTournaments() {
  return query(`
    SELECT t.*,
      (SELECT COUNT(*) FROM tournament_entries te WHERE te.tournament_id = t.id) AS total_entries,
      (SELECT COUNT(*) FROM tournament_entries te WHERE te.tournament_id = t.id AND te.status = 'fee_paid') AS paid_entries
    FROM tournaments t
    ORDER BY t.created_at DESC
  `);
}

export async function getTournament(id: string) {
  const t = await queryOne(`SELECT * FROM tournaments WHERE id = $1`, [id]);
  if (!t) return null;

  const entries = await query(`
    SELECT te.*, u.email, u.first_name, u.last_name, u.country_code,
           ta.platform, ta.platform_account_id, ta.current_balance, ta.starting_balance
    FROM tournament_entries te
    JOIN users u ON u.id = te.user_id
    LEFT JOIN trading_accounts ta ON ta.id = te.account_id
    WHERE te.tournament_id = $1
    ORDER BY te.global_rank ASC NULLS LAST, te.phase1_return DESC NULLS LAST
  `, [id]);

  const countries = await query(
    'SELECT * FROM tournament_countries WHERE tournament_id = $1 ORDER BY country_name',
    [id],
  );

  const bracket = await query(`
    SELECT tb.*,
      e1.user_id AS seed1_user_id, u1.first_name AS s1_first, u1.last_name AS s1_last,
      u1.country_code AS s1_country,
      e2.user_id AS seed2_user_id, u2.first_name AS s2_first, u2.last_name AS s2_last,
      u2.country_code AS s2_country
    FROM tournament_bracket tb
    LEFT JOIN tournament_entries e1 ON e1.id = tb.seed1_entry_id
    LEFT JOIN users u1 ON u1.id = e1.user_id
    LEFT JOIN tournament_entries e2 ON e2.id = tb.seed2_entry_id
    LEFT JOIN users u2 ON u2.id = e2.user_id
    WHERE tb.tournament_id = $1
    ORDER BY
      CASE tb.round WHEN 'r64' THEN 1 WHEN 'r32' THEN 2 WHEN 'r16' THEN 3
        WHEN 'qf' THEN 4 WHEN 'sf' THEN 5 WHEN 'final' THEN 6 ELSE 7 END,
      tb.match_number
  `, [id]);

  return { ...t, entries, countries, bracket };
}

export async function createTournament(data: {
  name: string; slug: string; entryFee?: number; prizePool?: number;
  phase1Start?: string; phase1End?: string; phase2Start?: string; phase2End?: string;
  bracketStart?: string; finalEnd?: string;
  phase1MinReturn?: number; topPerCountry?: number; bracketSize?: number;
  rules?: Record<string, unknown>; prizes?: unknown[];
}, adminId: string): Promise<string> {
  const [t] = await query<{ id: string }>(`
    INSERT INTO tournaments
      (name, slug, status, entry_fee, prize_pool,
       phase1_start, phase1_end, phase2_start, phase2_end,
       bracket_start, final_end, rules, prizes, created_by)
    VALUES ($1,$2,'draft',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING id
  `, [
    data.name, data.slug, data.entryFee ?? 15, data.prizePool ?? 100000,
    data.phase1Start, data.phase1End, data.phase2Start, data.phase2End,
    data.bracketStart, data.finalEnd,
    JSON.stringify(data.rules ?? {}), JSON.stringify(data.prizes ?? []),
    adminId,
  ]);
  return t.id;
}

// ── Phase 2 champion selection ────────────────────────────────────────────────
// For each country, find the highest Phase 2 ranked trader → mark as champion
export async function selectCountryChampions(tournamentId: string): Promise<void> {
  await withTransaction(async (client) => {
    // Get all Phase 2 entries sorted by global rank
    const entries = await client.query(`
      SELECT te.*, u.country_code
      FROM tournament_entries te
      JOIN users u ON u.id = te.user_id
      WHERE te.tournament_id = $1
        AND te.phase2_rank IS NOT NULL
      ORDER BY te.phase2_rank ASC
    `, [tournamentId]);

    const champByCountry = new Map<string, string>(); // country_code -> entry_id

    for (const e of entries.rows) {
      if (!champByCountry.has(e.country_code)) {
        champByCountry.set(e.country_code, e.id);
      }
    }

    // Mark champions
    for (const [, entryId] of champByCountry) {
      await client.query(`
        UPDATE tournament_entries
        SET is_country_champion = true,
            status = CASE WHEN status = 'phase2' THEN 'bracket' ELSE status END
        WHERE id = $1
      `, [entryId]);
    }

    // Update tournament_countries table
    for (const [countryCode, entryId] of champByCountry) {
      await client.query(`
        UPDATE tournament_countries
        SET champion_id = $1
        WHERE tournament_id = $2 AND country_code = $3
      `, [entryId, tournamentId, countryCode]);
    }
  });
}

// ── Bracket generation ────────────────────────────────────────────────────────
const ROUNDS = ['r64', 'r32', 'r16', 'qf', 'sf', 'final'];
const ROUND_SIZES: Record<string, number> = {
  r64: 64, r32: 32, r16: 16, qf: 8, sf: 4, final: 2,
};

export async function generateBracket(tournamentId: string): Promise<void> {
  const tournament = await queryOne<{
    id: string; bracket_size: number;
  }>('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
  if (!tournament) throw new Error('Tournament not found');

  // Get country champions sorted by phase2_rank (seeding)
  const champions = await query<{
    id: string; phase2_rank: number; phase2_return: number;
    user_id: string; country_code: string;
  }>(`
    SELECT te.*, u.country_code
    FROM tournament_entries te
    JOIN users u ON u.id = te.user_id
    WHERE te.tournament_id = $1
      AND te.is_country_champion = true
    ORDER BY te.phase2_rank ASC NULLS LAST, te.phase2_return DESC NULLS LAST
  `, [tournamentId]);

  if (champions.length < 2) throw new Error('Not enough champions to generate bracket');

  // Assign seeds
  await withTransaction(async (client) => {
    for (let i = 0; i < champions.length; i++) {
      await client.query(
        'UPDATE tournament_entries SET bracket_seed = $1 WHERE id = $2',
        [i + 1, champions[i].id],
      );
    }

    // Generate R64 matches: seed 1 vs 64, 2 vs 63... etc
    // Tier 1 (1-16) vs Tier 4 (49-64), Tier 2 (17-32) vs Tier 3 (33-48)
    const size  = Math.min(champions.length, tournament.bracket_size);
    const half  = size / 2;
    let   match = 1;

    // First generate Tier 1 vs Tier 4 matches (seeds 1-16 vs 49-64)
    for (let i = 0; i < 16 && i < size / 4; i++) {
      const s1 = champions[i];
      const s2 = champions[size - 1 - i];
      if (!s1 || !s2) continue;
      await client.query(`
        INSERT INTO tournament_bracket
          (tournament_id, round, match_number, seed1_entry_id, seed2_entry_id, status)
        VALUES ($1, 'r64', $2, $3, $4, 'pending')
        ON CONFLICT (tournament_id, round, match_number) DO NOTHING
      `, [tournamentId, match++, s1.id, s2.id]);
    }

    // Then Tier 2 vs Tier 3 (seeds 17-32 vs 33-48)
    for (let i = 16; i < 32 && i < half; i++) {
      const s1 = champions[i];
      const s2 = champions[half - 1 - (i - 16)];
      if (!s1 || !s2) continue;
      await client.query(`
        INSERT INTO tournament_bracket
          (tournament_id, round, match_number, seed1_entry_id, seed2_entry_id, status)
        VALUES ($1, 'r64', $2, $3, $4, 'pending')
        ON CONFLICT (tournament_id, round, match_number) DO NOTHING
      `, [tournamentId, match++, s1.id, s2.id]);
    }

    // Create empty placeholders for subsequent rounds
    const rounds = ['r32','r16','qf','sf','final'];
    let prevSize = 32;
    for (const round of rounds) {
      const roundMatches = prevSize / 2;
      for (let m = 1; m <= roundMatches; m++) {
        await client.query(`
          INSERT INTO tournament_bracket (tournament_id, round, match_number, status)
          VALUES ($1, $2, $3, 'pending')
          ON CONFLICT (tournament_id, round, match_number) DO NOTHING
        `, [tournamentId, round, m]);
      }
      prevSize = roundMatches;
    }

    await client.query(`
      UPDATE tournaments SET status = 'bracket' WHERE id = $1
    `, [tournamentId]);
  });
}

// ── Match management ──────────────────────────────────────────────────────────
export async function startMatch(matchId: string, adminId: string): Promise<void> {
  const match = await queryOne<{
    id: string; tournament_id: string; round: string;
    seed1_entry_id: string; seed2_entry_id: string;
  }>('SELECT * FROM tournament_bracket WHERE id = $1', [matchId]);
  if (!match) throw new Error('Match not found');

  const tournament = await queryOne<{
    id: string; name: string;
  }>('SELECT * FROM tournaments WHERE id = $1', [match.tournament_id]);

  // Get both players
  const [e1, e2] = await Promise.all([
    queryOne<{ user_id: string }>('SELECT * FROM tournament_entries WHERE id = $1', [match.seed1_entry_id]),
    queryOne<{ user_id: string }>('SELECT * FROM tournament_entries WHERE id = $1', [match.seed2_entry_id]),
  ]);
  if (!e1 || !e2) throw new Error('Missing entries');

  await withTransaction(async (client) => {
    await client.query(`
      UPDATE tournament_bracket
      SET status = 'active', starts_at = NOW(),
          ends_at = NOW() + INTERVAL '3 days'
      WHERE id = $1
    `, [matchId]);
  });
}

export async function resolveMatch(matchId: string, winnerEntryId: string, adminId: string): Promise<void> {
  await withTransaction(async (client) => {
    const match = await client.query(
      'SELECT * FROM tournament_bracket WHERE id = $1', [matchId],
    );
    if (!match.rows[0]) throw new Error('Match not found');
    const m = match.rows[0];

    const loserEntryId = m.seed1_entry_id === winnerEntryId
      ? m.seed2_entry_id : m.seed1_entry_id;

    await client.query(`
      UPDATE tournament_bracket
      SET winner_entry_id = $1, status = 'completed', updated_at = NOW()
      WHERE id = $2
    `, [winnerEntryId, matchId]);

    // Mark loser as eliminated
    await client.query(`
      UPDATE tournament_entries SET status = 'eliminated' WHERE id = $1
    `, [loserEntryId]);

    // Advance winner to next round
    const NEXT: Record<string, string> = {
      r64:'r32', r32:'r16', r16:'qf', qf:'sf', sf:'final',
    };
    const nextRound = NEXT[m.round as string];
    if (nextRound) {
      const nextMatchNum = Math.ceil(m.match_number / 2);
      const slot         = m.match_number % 2 === 1 ? 'seed1_entry_id' : 'seed2_entry_id';
      await client.query(`
        UPDATE tournament_bracket
        SET ${slot} = $1
        WHERE tournament_id = $2 AND round = $3 AND match_number = $4
      `, [winnerEntryId, m.tournament_id, nextRound, nextMatchNum]);
    } else {
      // Final — mark champion
      await client.query(`
        UPDATE tournament_entries SET status = 'champion' WHERE id = $1
      `, [winnerEntryId]);
      await client.query(`
        UPDATE tournaments SET status = 'completed' WHERE id = $1
      `, [m.tournament_id]);
    }
  });
}

export async function getTournamentStats() {
  const [stats] = await query<Record<string, string>>(`
    SELECT
      COUNT(*) AS total_tournaments,
      COUNT(*) FILTER (WHERE status = 'registration') AS in_registration,
      COUNT(*) FILTER (WHERE status IN ('phase1','phase2')) AS in_qualifying,
      COUNT(*) FILTER (WHERE status = 'bracket') AS in_bracket,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed,
      COALESCE(SUM(prize_pool),0) AS total_prize_pool
    FROM tournaments
  `);
  return stats;
}

export async function getLeaderboard(tournamentId: string, phase: string) {
  const col  = phase === 'phase1' ? 'phase1_return' : 'phase2_return';
  const rank = phase === 'phase1' ? 'phase1_rank'   : 'phase2_rank';

  return query(`
    SELECT te.${col} AS return_pct, te.${rank} AS rank,
           te.is_country_champion, te.status, te.bracket_seed,
           u.first_name, u.last_name, u.country_code, u.email
    FROM tournament_entries te
    JOIN users u ON u.id = te.user_id
    WHERE te.tournament_id = $1
      AND te.${col} IS NOT NULL
    ORDER BY te.${col} DESC NULLS LAST
    LIMIT 100
  `, [tournamentId]);
}
