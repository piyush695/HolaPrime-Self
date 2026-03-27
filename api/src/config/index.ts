import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Load .env from current working dir, then fall back to parent (root) dir
dotenvConfig({ path: resolve(process.cwd(), '.env') });
dotenvConfig({ path: resolve(process.cwd(), '..', '.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  env:  optional('NODE_ENV', 'development') as 'development' | 'production' | 'test',
  port: parseInt(optional('PORT', '3001'), 10),
  frontendUrl: optional('FRONTEND_URL', 'http://localhost:5173'),

  db: {
    url: required('DATABASE_URL'),
    poolMin: 2,
    poolMax: 20,
  },


  jwt: {
    secret:         optional('JWT_SECRET', 'dev_secret'),
    refreshSecret:  optional('JWT_REFRESH_SECRET', 'dev_refresh'),
    expiry:         optional('JWT_EXPIRY', '15m'),
    refreshExpiry:  optional('JWT_REFRESH_EXPIRY', '7d'),
  },

  gcp: {
    projectId: optional('GCP_PROJECT_ID', ''),
    bucket:    optional('GCS_BUCKET', 'holaprime-kyc-dev'),
  },

  email: {
    sendgridKey: optional('SENDGRID_API_KEY', ''),
    from:        optional('EMAIL_FROM', 'noreply@holaprime.com'),
  },

  whatsapp: {
    phoneId:     optional('WHATSAPP_PHONE_ID', ''),
    token:       optional('WHATSAPP_TOKEN', ''),
    verifyToken: optional('WHATSAPP_VERIFY_TOKEN', ''),
  },

  platforms: {
    mt5: {
      apiUrl: optional('MT5_API_URL', ''),
      apiKey: optional('MT5_API_KEY', ''),
      server: optional('MT5_SERVER', ''),
    },
    ctrader: {
      clientId:     optional('CTRADER_CLIENT_ID', ''),
      clientSecret: optional('CTRADER_CLIENT_SECRET', ''),
      accountId:    optional('CTRADER_ACCOUNT_ID', ''),
      env:          optional('CTRADER_ENV', 'demo') as 'demo' | 'live',
    },
    matchtrader: {
      apiUrl:   optional('MATCHTRADER_API_URL', 'https://api.matchtrader.com'),
      apiKey:   optional('MATCHTRADER_API_KEY', ''),
      brokerId: optional('MATCHTRADER_BROKER_ID', ''),
    },
    ninjatrader: {
      apiUrl:        optional('NINJATRADER_API_URL', ''),
      apiKey:        optional('NINJATRADER_API_KEY', ''),
      accountNumber: optional('NINJATRADER_ACCOUNT_NUMBER', ''),
    },
    tradovate: {
      apiUrl:     optional('TRADOVATE_API_URL', 'https://demo.tradovateapi.com/v1'),
      username:   optional('TRADOVATE_USERNAME', ''),
      password:   optional('TRADOVATE_PASSWORD', ''),
      appId:      optional('TRADOVATE_APP_ID', ''),
      appVersion: optional('TRADOVATE_APP_VERSION', '1.0'),
    },
  },

  stripe: {
    secretKey:     optional('STRIPE_SECRET_KEY', ''),
    webhookSecret: optional('STRIPE_WEBHOOK_SECRET', ''),
  },

  security: {
    bcryptRounds: parseInt(optional('BCRYPT_ROUNDS', '12'), 10),
    rateLimitMax:    parseInt(optional('RATE_LIMIT_MAX', '100'), 10),
    rateLimitWindow: parseInt(optional('RATE_LIMIT_WINDOW', '60000'), 10),
  },

  affiliates: {
    cookieDays: parseInt(optional('AFFILIATE_COOKIE_DAYS', '30'), 10),
  },
} as const;
