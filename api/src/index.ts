import Fastify from 'fastify';
import cors          from '@fastify/cors';
import helmet        from '@fastify/helmet';
import jwt           from '@fastify/jwt';
import rateLimit     from '@fastify/rate-limit';
import multipart     from '@fastify/multipart';
import { config }    from './config/index.js';
import { pool, checkConnection } from './db/index.js';
import { authMiddleware }      from './middleware/auth.middleware.js';
// Phase 1
import { authRoutes }          from './modules/auth/auth.routes.js';
import { userRoutes }          from './modules/users/users.routes.js';
import { kycRoutes }           from './modules/kyc/kyc.routes.js';
import { challengeRoutes }     from './modules/challenges/challenges.routes.js';
import { paymentRoutes }       from './modules/payments/payments.routes.js';
import { riskRoutes }          from './modules/risk/risk.routes.js';
import { dashboardRoutes }     from './modules/dashboard/dashboard.routes.js';
// Phase 2
import { crmRoutes }           from './modules/crm/crm.routes.js';
import { attributionRoutes }   from './modules/attribution/attribution.routes.js';
import { affiliateRoutes }     from './modules/affiliates/affiliates.routes.js';
import { whatsappRoutes }      from './modules/whatsapp/whatsapp.routes.js';
import { campaignRoutes }      from './modules/campaigns/campaigns.routes.js';
import { retentionRoutes }     from './modules/retention/retention.routes.js';
// Phase 3
import { settingsRoutes }      from './modules/settings/settings.routes.js';
import { webhookRoutes }       from './modules/webhooks/webhooks.routes.js';
import { reportsRoutes }       from './modules/reports/reports.routes.js';
import { tournamentRoutes }    from './modules/tournaments/tournaments.routes.js';
import { traderRoutes }        from './modules/trader/trader.routes.js';
// Phase 4
import { gatewayRoutes }       from './modules/payments-gateway/gateway.routes.js';
import { sumsubRoutes }        from './modules/kyc-providers/sumsub.routes.js';
import { smtpRoutes }          from './modules/settings/smtp.routes.js';
import { integrationsRoutes }  from './modules/integrations/integrations.routes.js';
import { productsRoutes }      from './modules/products/products.routes.js';
// Phase 5
import { auditRoutes }         from './modules/audit/audit.routes.js';
import { permissionsRoutes }   from './modules/permissions/permissions.routes.js';
import { payoutsRoutes }       from './modules/payouts/payouts.routes.js';
import { tradingSyncRoutes }   from './modules/trading-sync/trading-sync.routes.js';
import { pixelsRoutes }         from './modules/pixels/pixels.routes.js';
import { startWorkers, scheduleRecurringJobs, stopWorkers } from './utils/jobs.js';
import { featureFlagsRoutes }     from './modules/feature-flags/feature-flags.routes.js';
import { siteContentRoutes }      from './modules/site-content/site-content.routes.js';
import { promoCodesRoutes }       from './modules/promo-codes/promo-codes.routes.js';
import { countryControlsRoutes }  from './modules/country-controls/country-controls.routes.js';
import { payoutRulesRoutes }      from './modules/payout-rules/payout-rules.routes.js';
import { emailTemplatesRoutes }   from './modules/email-templates/email-templates.routes.js';
import { faqRoutes }              from './modules/faq/faq.routes.js';
import { testimonialsRoutes }     from './modules/testimonials/testimonials.routes.js';
import { blogRoutes }             from './modules/blog/blog.routes.js';
import { supportRoutes }          from './modules/support/support.routes.js';
import { ipBlocklistRoutes }      from './modules/ip-blocklist/ip-blocklist.routes.js';
import { analyticsRoutes }        from './modules/analytics/analytics.routes.js';
import { integrationsHubRoutes }  from './modules/integrations/integrations-hub.routes.js';
import { marketingRoutes }         from './modules/marketing/marketing.routes.js';
import { utmRoutes }              from './modules/utm/utm.routes.js';
import { otpRoutes }              from './modules/otp/otp.routes.js';

const app = Fastify({
  logger: {
    level: config.env === 'production' ? 'info' : 'debug',
    transport: config.env !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

async function bootstrap(): Promise<void> {
  await app.register(helmet, { global: true });
  await app.register(cors, {
    origin: [config.frontendUrl, 'http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  });
  // Global rate limit
  await app.register(rateLimit, {
    max: config.security.rateLimitMax,
    timeWindow: config.security.rateLimitWindow,
    skipOnError: true,
    keyGenerator: (req) => {
      return req.headers['x-forwarded-for'] as string ?? req.ip ?? 'unknown';
    },
    keyGenerator: (req) => `${req.ip}-${req.headers.authorization?.slice(0,20) ?? ''}`,
  });
  await app.register(jwt, {
    secret: config.jwt.secret,
    // expiresIn NOT set globally — each token embeds its own exp in the payload
  });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(authMiddleware);

  // ── Phase 1 routes ─────────────────────────────────────────────────────────
  await app.register(dashboardRoutes,  { prefix: '/api/v1/dashboard'  });
  await app.register(authRoutes,       { prefix: '/api/v1/auth'       });
  await app.register(userRoutes,       { prefix: '/api/v1/users'      });
  await app.register(kycRoutes,        { prefix: '/api/v1/kyc'        });
  await app.register(challengeRoutes,  { prefix: '/api/v1/challenges' });
  await app.register(paymentRoutes,    { prefix: '/api/v1/payments'   });
  await app.register(riskRoutes,       { prefix: '/api/v1/risk'       });
  // ── Phase 2 routes ─────────────────────────────────────────────────────────
  await app.register(crmRoutes,        { prefix: '/api/v1/crm'        });
  await app.register(attributionRoutes,{ prefix: '/api/v1/attribution'});
  await app.register(affiliateRoutes,  { prefix: '/api/v1/affiliates' });
  await app.register(whatsappRoutes,   { prefix: '/api/v1/whatsapp'   });
  await app.register(campaignRoutes,   { prefix: '/api/v1/campaigns'  });
  await app.register(retentionRoutes,  { prefix: '/api/v1/retention'  });
  // ── Phase 3 routes ─────────────────────────────────────────────────────────
  await app.register(settingsRoutes,   { prefix: '/api/v1/settings'   });
  await app.register(webhookRoutes,    { prefix: '/api/v1/webhooks'   });
  await app.register(reportsRoutes,    { prefix: '/api/v1/reports'    });
  await app.register(tournamentRoutes, { prefix: '/api/v1/tournaments'});
  await app.register(traderRoutes,     { prefix: '/api/v1/trader'     });
  // ── Phase 4 routes ─────────────────────────────────────────────────────────
  await app.register(gatewayRoutes,    { prefix: '/api/v1/payments-gateway' });
  await app.register(featureFlagsRoutes,    { prefix: '/api/v1/feature-flags'    });
  await app.register(siteContentRoutes,     { prefix: '/api/v1/site-content'      });
  await app.register(promoCodesRoutes,      { prefix: '/api/v1/promo-codes'       });
  await app.register(countryControlsRoutes, { prefix: '/api/v1/country-controls'  });
  await app.register(payoutRulesRoutes,     { prefix: '/api/v1/payout-rules'      });
  await app.register(emailTemplatesRoutes,  { prefix: '/api/v1/email-templates'   });
  await app.register(faqRoutes,             { prefix: '/api/v1/faq'               });
  await app.register(testimonialsRoutes,    { prefix: '/api/v1/testimonials'      });
  await app.register(blogRoutes,            { prefix: '/api/v1/blog'              });
  await app.register(supportRoutes,         { prefix: '/api/v1/support'           });
  await app.register(ipBlocklistRoutes,     { prefix: '/api/v1/ip-blocklist'      });
  await app.register(analyticsRoutes,       { prefix: '/api/v1/analytics'         });
  await app.register(sumsubRoutes,     { prefix: '/api/v1/sumsub'    });
  await app.register(smtpRoutes,       { prefix: '/api/v1/smtp'      });
  await app.register(integrationsRoutes, { prefix: '/api/v1/integrations' });
  await app.register(productsRoutes,     { prefix: '/api/v1/products'   });
  // ── Phase 5 routes ─────────────────────────────────────────────────────────
  await app.register(auditRoutes,        { prefix: '/api/v1/audit'        });
  await app.register(permissionsRoutes,  { prefix: '/api/v1/permissions'  });
  await app.register(payoutsRoutes,      { prefix: '/api/v1/payouts'      });
  await app.register(tradingSyncRoutes,  { prefix: '/api/v1/trading-sync' });
  await app.register(pixelsRoutes,       { prefix: '/api/v1/pixels'       });

  // ── Health ─────────────────────────────────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok', version: '5.0.0', env: config.env,
    db: await checkConnection() ? 'connected' : 'disconnected',
    ts: new Date().toISOString(),
  }));

  app.setErrorHandler((err, req, reply) => {
    const status = (err as any).statusCode ?? (err as any).status ?? 500;
    
    // Always log the real error
    if (status >= 500) {
      app.log.error({ err, url: req.url, method: req.method }, 'Internal error');
    }

    // Zod validation
    if (err.name === 'ZodError') {
      const issues = (err as any).issues ?? [];
      const msg = issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ');
      return reply.status(400).send({ error: msg || 'Validation failed' });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return reply.status(401).send({ error: 'Session expired. Please sign in again.' });
    }

    // Always return the real error message (helpful during setup)
    return reply.status(status).send({ 
      error: err.message || 'Internal server error',
      code: status,
    });
  });

  // Start listening FIRST so Cloud Run health check passes immediately
  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`Hola Prime API v5.0 listening on :${config.port}`);

  // DB check and jobs run AFTER port is open (non-blocking)
  checkConnection().then(dbOk => {
    if (!dbOk) {
      console.error('[startup] WARNING: Database connection failed. Check DATABASE_URL secret.');
    } else {
      app.log.info('[startup] Database connected successfully');
    }
  });

  if (config.env !== 'test') {
    setTimeout(async () => {
      try {
        startWorkers();
        await scheduleRecurringJobs();
      } catch (err) {
        app.log.warn({ err }, 'pg-boss scheduling failed — continuing without background jobs.');
      }
    }, 5000); // 5 second delay to let DB settle
  }
}

bootstrap().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  app.log.info('SIGTERM — shutting down');
  await stopWorkers();
  await app.close();
  await pool.end();
  process.exit(0);
});
