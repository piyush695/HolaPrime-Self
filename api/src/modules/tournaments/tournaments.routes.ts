import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  listTournaments, getTournament, createTournament,
  selectCountryChampions, generateBracket,
  startMatch, resolveMatch, getTournamentStats, getLeaderboard,
} from './tournaments.service.js';

export async function tournamentRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', app.authenticate);

  app.get('/stats', async (_req, reply) => reply.send(await getTournamentStats()));
  app.get('/',      async (_req, reply) => reply.send(await listTournaments()));

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const t = await getTournament(id);
    if (!t) return reply.status(404).send({ error: 'Not found' });
    return reply.send(t);
  });

  app.post('/', async (req, reply) => {
    const id = await createTournament(
      req.body as Parameters<typeof createTournament>[0],
      (req as any).admin.id,
    );
    return reply.status(201).send({ id });
  });

  app.get('/:id/leaderboard', async (req, reply) => {
    const { id } = req.params as { id: string };
    const q      = req.query as { phase?: string };
    return reply.send(await getLeaderboard(id, q.phase ?? 'phase2'));
  });

  app.post('/:id/select-champions', async (req, reply) => {
    const { id } = req.params as { id: string };
    await selectCountryChampions(id);
    return reply.send({ ok: true });
  });

  app.post('/:id/generate-bracket', async (req, reply) => {
    const { id } = req.params as { id: string };
    await generateBracket(id);
    return reply.send({ ok: true });
  });

  app.post('/matches/:matchId/start', async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    await startMatch(matchId, (req as any).admin.id);
    return reply.send({ ok: true });
  });

  app.post('/matches/:matchId/resolve', async (req, reply) => {
    const { matchId }     = req.params as { matchId: string };
    const { winnerEntryId } = z.object({ winnerEntryId: z.string().uuid() }).parse(req.body);
    await resolveMatch(matchId, winnerEntryId, (req as any).admin.id);
    return reply.send({ ok: true });
  });
}
