import type { FastifyInstance } from 'fastify';
import {
  listProducts, getProduct, createProduct, updateProduct,
  archiveProduct, duplicateProduct,
  getPhaseLabels, updatePhaseLabel,
  getStatusLabels, updateStatusLabel,
} from './products.service.js';

export async function productsRoutes(app: FastifyInstance): Promise<void> {
  // ── Public: active products (for trader portal) ───────────────────────────
  app.get('/public', async (_req, reply) => {
    const products = await listProducts(false);
    // Only expose active ones, strip internal fields
    const safe = (products as any[])
      .filter((p: any) => p.status === 'active')
      .map((p: any) => ({
        id: p.id, name: p.name, slug: p.slug,
        description: p.description, shortTagline: p.short_tagline,
        accountSize: p.account_size, fee: p.fee, currency: p.currency,
        platform: p.platform, phases: p.phases, leverage: p.leverage,
        instrumentsAllowed: p.instruments_allowed,
        newsTradingAllowed: p.news_trading_allowed,
        weekendHoldingAllowed: p.weekend_holding_allowed,
        scalingPlan: p.scaling_plan, profitSplit: p.profit_split,
        payoutFrequency: p.payout_frequency,
        badgeText: p.badge_text, badgeColor: p.badge_color,
        icon: p.icon, highlight: p.highlight, isFeatured: p.is_featured,
        features: p.features, refundPolicy: p.refund_policy,
        sortOrder: p.sort_order,
      }));
    return reply.send(safe);
  });

  // ── Public: labels (for trader portal to render phase/status correctly) ───
  app.get('/labels', async (_req, reply) => {
    const [phases, statuses] = await Promise.all([getPhaseLabels(), getStatusLabels()]);
    return reply.send({ phases, statuses });
  });

  // ── Admin routes ──────────────────────────────────────────────────────────
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.endsWith('/public') || req.url.endsWith('/labels')) return;
    return app.authenticate(req, reply);
  });

  app.get('/', async (_req, reply) =>
    reply.send(await listProducts(true)),
  );

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = await getProduct(id);
    if (!p) return reply.status(404).send({ error: 'Not found' });
    return reply.send(p);
  });

  app.post('/', async (req, reply) => {
    const id = await createProduct(req.body as any, (req as any).admin.id);
    return reply.status(201).send({ id });
  });

  app.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await updateProduct(id, req.body as any, (req as any).admin.id);
    return reply.send({ ok: true });
  });

  app.post('/:id/archive', async (req, reply) => {
    const { id } = req.params as { id: string };
    await archiveProduct(id, (req as any).admin.id);
    return reply.send({ ok: true });
  });

  app.post('/:id/duplicate', async (req, reply) => {
    const { id }    = req.params as { id: string };
    const newId     = await duplicateProduct(id, (req as any).admin.id);
    return reply.status(201).send({ id: newId });
  });

  // ── Labels CRUD ───────────────────────────────────────────────────────────
  app.get('/phase-labels',  async (_req, reply) => reply.send(await getPhaseLabels()));
  app.get('/status-labels', async (_req, reply) => reply.send(await getStatusLabels()));

  app.patch('/phase-labels/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    await updatePhaseLabel(key, req.body as any);
    return reply.send({ ok: true });
  });

  app.patch('/status-labels/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    await updateStatusLabel(key, req.body as any);
    return reply.send({ ok: true });
  });
}
