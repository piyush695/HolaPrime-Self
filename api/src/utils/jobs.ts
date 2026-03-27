import PgBoss from 'pg-boss';
import { config } from '../config/index.js';
import { syncAccountBalance } from '../modules/challenges/challenges.service.js';
import { syncAccountFull } from '../modules/trading-sync/trading-sync.service.js';
import { scanAllActiveAccounts } from '../modules/risk/risk.service.js';
import { deliverWebhook } from '../modules/webhooks/webhooks.service.js';
import { query } from '../db/index.js';

// ── Single pg-boss instance — uses the same Postgres DB, no Redis needed ──────
let boss: PgBoss;

export function getBoss(): PgBoss {
  if (!boss) throw new Error('pg-boss not started — call startWorkers() first');
  return boss;
}

// ── Job enqueue helpers (used by other modules) ───────────────────────────────

export async function addEmailJob(data: {
  to: string; subject: string; html: string;
  campaignId?: string; contactId?: string;
}): Promise<void> {
  await getBoss().send('email-send', data, {
    retryLimit:   3,
    retryDelay:   5,
    retryBackoff: true,
  });
}

export async function addWebhookJob(data: {
  endpointId: string; url: string; secret: string;
  headers: Record<string, string>; event: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  await getBoss().send('webhook-deliver', data, {
    retryLimit:   4,
    retryDelay:   10,
    retryBackoff: true,   // 10s → 20s → 40s → 80s
  });
}

export async function addSyncJob(accountId: string): Promise<void> {
  await getBoss().send('account-sync', { accountId }, {
    retryLimit: 2,
    retryDelay: 30,
  });
}

export async function addReportJob(definitionId: string, triggeredBy?: string): Promise<void> {
  await getBoss().send('report-run', { definitionId, triggeredBy }, {
    retryLimit: 1,
  });
}

// ── Start pg-boss and register all workers ────────────────────────────────────
export async function startWorkers(): Promise<void> {
  boss = new PgBoss({
    connectionString: config.db.url,
    max:              10,       // max DB connections for pg-boss
    monitorStateIntervalSeconds: 30,
  });

  boss.on('error', (err) => console.error('[pg-boss error]', err));

  await boss.start();
  console.log('[jobs] pg-boss started (Postgres-backed, no Redis required)');

  // ── Balance sync ───────────────────────────────────────────────────────────
  await boss.work('account-sync', { teamSize: 10 }, async (jobs) => {
    await Promise.allSettled(
      jobs.map(job => syncAccountBalance((job.data as any).accountId)),
    );
  });

  // ── Full account sync (Phase 5 — balance + positions) ────────────────────
  await boss.work('account-sync-full', { teamSize: 10 }, async (jobs) => {
    await Promise.allSettled(
      jobs.map(job => syncAccountFull((job.data as any).accountId)),
    );
  });

  // ── Risk scan ──────────────────────────────────────────────────────────────
  await boss.work('risk-scan', { teamSize: 1 }, async () => {
    await scanAllActiveAccounts();
  });

  // ── Email send ─────────────────────────────────────────────────────────────
  await boss.work('email-send', { teamSize: 5 }, async (jobs) => {
    await Promise.allSettled(
      jobs.map(async (job) => {
        const { to, subject, html, campaignId } = job.data as any;
        const { sendEmail } = await import('../modules/campaigns/campaigns.service.js');
        const { messageId } = await sendEmail({ to, subject, html });
        if (campaignId) {
          await query(
            `UPDATE campaign_sends
             SET status = 'sent', sent_at = NOW(), provider_id = $1
             WHERE campaign_id = $2 AND email = $3`,
            [messageId, campaignId, to],
          );
        }
      }),
    );
  });

  // ── Webhook delivery ───────────────────────────────────────────────────────
  await boss.work('webhook-deliver', { teamSize: 20 }, async (jobs) => {
    await Promise.allSettled(
      jobs.map(async (job) => {
        const data = job.data as any;
        await deliverWebhook({ ...data, attempt: 1 });
      }),
    );
  });

  // ── Report generation ──────────────────────────────────────────────────────
  await boss.work('report-run', { teamSize: 3 }, async (jobs) => {
    await Promise.allSettled(
      jobs.map(async (job) => {
        const { definitionId, triggeredBy } = job.data as any;
        const { generateReport } = await import('../modules/reports/reports.service.js');

        try {
          const defs = await query('SELECT * FROM report_definitions WHERE id = $1', [definitionId]);
          if (!defs[0]) return;
          const d = defs[0] as any;
          const result = await generateReport({ type: d.type, format: d.format, triggeredBy });

          await query(
            `UPDATE report_definitions SET last_run_at = NOW() WHERE id = $1`,
            [definitionId],
          );
          console.log(`[report] ${d.name} completed — ${Array.isArray((result.data as any).rows) ? (result.data as any).rows.length : '?'} rows`);
        } catch (err) {
          console.error(`[report] ${definitionId} failed:`, err);
        }
      }),
    );
  });

  // ── Lead score refresh ─────────────────────────────────────────────────────
  await boss.work('lead-score-refresh', { teamSize: 1 }, async () => {
    const { refreshAllScores } = await import('../modules/crm/crm.service.js');
    await refreshAllScores();
  });

  // ── Cohort rebuild ─────────────────────────────────────────────────────────
  await boss.work('cohort-rebuild', { teamSize: 1 }, async () => {
    const { buildCohortTable } = await import('../modules/retention/retention.service.js');
    await buildCohortTable();
  });

  console.log('[jobs] All workers registered');
}

// ── Register recurring/scheduled jobs ────────────────────────────────────────
export async function scheduleRecurringJobs(): Promise<void> {
  const b = getBoss();

  const jobDefs = [
    { name: 'risk-scan-all',           cron: '*/5 * * * *' },
    { name: 'lead-score-refresh-cron', cron: '0 */6 * * *' },
    { name: 'cohort-rebuild-cron',     cron: '0 3 * * *'   },
  ];

  // pg-boss v10+ requires queues to exist before scheduling
  for (const j of jobDefs) {
    try { await b.createQueue(j.name); } catch { /* already exists - fine */ }
    try { await b.schedule(j.name, j.cron, {}, { tz: 'UTC' }); } catch (e: any) {
      console.warn(`[jobs] Could not schedule ${j.name}:`, e.message);
    }
  }

  // Register schedule handlers
  await b.work('risk-scan-all', async () => {
    await scanAllActiveAccounts();
  });

  await b.work('lead-score-refresh-cron', async () => {
    const { refreshAllScores } = await import('../modules/crm/crm.service.js');
    await refreshAllScores();
  });

  await b.work('cohort-rebuild-cron', async () => {
    const { buildCohortTable } = await import('../modules/retention/retention.service.js');
    await buildCohortTable();
  });

  // Queue sync jobs for all active accounts (every 15 min each)
  const activeAccounts = await query<{ id: string }>(
    `SELECT id FROM trading_accounts
     WHERE status = 'active' AND platform_account_id IS NOT NULL LIMIT 500`,
  );

  // Schedule each account — pg-boss deduplicates by name so safe to re-run on restart
  for (const account of activeAccounts) {
    await b.schedule(`sync-account-${account.id}`, '*/15 * * * *', { accountId: account.id }, {
      tz: 'UTC',
    });
    await b.work(`sync-account-${account.id}`, async (jobs) => {
      await Promise.allSettled(
        jobs.map(job => syncAccountBalance((job.data as any).accountId)),
      );
    });
  }

  console.log(`[jobs] Scheduled jobs registered (${activeAccounts.length} account syncs)`);
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
export async function stopWorkers(): Promise<void> {
  if (boss) {
    await boss.stop();
    console.log('[jobs] pg-boss stopped');
  }
}
