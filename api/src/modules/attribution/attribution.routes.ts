import type { FastifyInstance } from 'fastify';
import {
  trackEvent, getChannelReport, getAttributionStats,
} from './attribution.service.js';

export async function attributionRoutes(app: FastifyInstance): Promise<void> {
  // Public tracking endpoint (no auth — called from frontend/landing pages)
  app.post('/track', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    // Fire and forget
    trackEvent({
      anonymousId: body.anonymousId as string,
      userId:      body.userId      as string,
      sessionId:   body.sessionId   as string,
      eventName:   body.event       as string ?? 'page_view',
      pageUrl:     body.url         as string,
      referrer:    body.referrer    as string,
      utmSource:   body.utm_source  as string,
      utmMedium:   body.utm_medium  as string,
      utmCampaign: body.utm_campaign as string,
      utmTerm:     body.utm_term    as string,
      utmContent:  body.utm_content as string,
      gclid:       body.gclid       as string,
      fbclid:      body.fbclid      as string,
      ttclid:      body.ttclid      as string,
      countryCode: (req.headers['cf-ipcountry'] as string)?.slice(0, 2),
      ipAddress:   req.ip,
      deviceType:  /mobile/i.test(req.headers['user-agent'] ?? '') ? 'mobile' : 'desktop',
    }).catch(console.error);
    return reply.status(204).send();
  });

  // Admin routes below — require auth
  app.addHook('onRequest', async (req, reply) => {
    if (req.method === 'POST' && req.url.endsWith('/track')) return;
    return app.authenticate(req, reply);
  });

  app.get('/stats', async (_req, reply) =>
    reply.send(await getAttributionStats()),
  );

  app.get('/channel-report', async (req, reply) => {
    const q   = req.query as Record<string, string>;
    const to  = q.to   ? new Date(q.to)   : new Date();
    const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 86400000);
    return reply.send(await getChannelReport(from, to));
  });
}
