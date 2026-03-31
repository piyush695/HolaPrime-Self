import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '../../db/index.js';
import { clearAdapterCache } from '../../platform/platform.service.js';

// Mask sensitive values for display (show last 4 chars only)
function maskValue(key: string, val: string): string {
  if (!val) return '';
  const sensitive = ['key','secret','password','token','pass','apikey'];
  if (sensitive.some(s => key.toLowerCase().includes(s)) && val.length > 8) {
    return '••••••••' + val.slice(-4);
  }
  return val;
}

export async function integrationsHubRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (req, reply) => app.authenticate(req, reply));

  // GET all integrations
  app.get('/', async (_req, reply) => {
    const rows = await query(`
      SELECT service, label, is_active, last_tested, test_result, updated_at,
        credentials::text as raw_creds
      FROM integration_credentials ORDER BY service
    `);
    // Return: real non-sensitive values visible, sensitive fields returned as masked
    // but ALSO return a credentialStatus map so frontend knows what's set
    const safe = (rows as any[]).map(r => {
      const creds = typeof r.raw_creds === 'string' ? JSON.parse(r.raw_creds) : r.raw_creds ?? {};
      const masked: Record<string,string> = {};
      const credentialStatus: Record<string, boolean> = {}; // true = has value
      for (const [k, v] of Object.entries(creds)) {
        const strVal = String(v ?? '');
        credentialStatus[k] = strVal.length > 0;
        masked[k] = maskValue(k, strVal);
      }
      const hasAnyCreds = Object.values(credentialStatus).some(Boolean);
      return {
        service: r.service, label: r.label, is_active: r.is_active,
        last_tested: r.last_tested, test_result: r.test_result,
        updated_at: r.updated_at,
        credentials: masked,          // masked for display
        credentialStatus,             // true/false per field
        hasCredentials: hasAnyCreds,  // quick check if anything is set
      };
    });
    return reply.send(safe);
  });

  // GET single integration schema (field definitions for the form)
  app.get('/schema', async (_req, reply) => {
    const SCHEMAS: Record<string, { key: string; label: string; type: 'text'|'password'|'url'|'select'; options?: string[]; placeholder: string; required: boolean; hint?: string }[]> = {
      stripe: [
        { key:'secretKey',     label:'Secret Key',        type:'password', placeholder:'sk_live_...', required:true, hint:'From Stripe Dashboard > Developers > API Keys' },
        { key:'publishableKey',label:'Publishable Key',   type:'text',     placeholder:'pk_live_...', required:true },
        { key:'webhookSecret', label:'Webhook Secret',    type:'password', placeholder:'whsec_...',   required:false, hint:'From Stripe > Webhooks > signing secret' },
      ],
      paypal: [
        { key:'clientId',     label:'Client ID',          type:'text',     placeholder:'App client ID',     required:true },
        { key:'clientSecret', label:'Client Secret',      type:'password', placeholder:'App client secret', required:true },
        { key:'webhookId',    label:'Webhook ID',         type:'text',     placeholder:'Webhook ID',        required:false },
        { key:'env',          label:'Environment',        type:'select',   placeholder:'',                  required:true, options:['production','sandbox'] },
      ],
      nowpayments: [
        { key:'apiKey',      label:'API Key',             type:'password', placeholder:'Your NOWPayments API key', required:true },
        { key:'ipnSecret',   label:'IPN Secret',          type:'password', placeholder:'IPN callback secret',      required:true },
        { key:'defaultCoin', label:'Default Coin',        type:'select',   placeholder:'',                         required:false, options:['USDTTRC20','USDTERC20','BTC','ETH','USDC'] },
      ],
      flutterwave: [
        { key:'secretKey',     label:'Secret Key',        type:'password', placeholder:'FLWSECK_TEST-...', required:true },
        { key:'publicKey',     label:'Public Key',        type:'text',     placeholder:'FLWPUBK_TEST-...',  required:true },
        { key:'encryptionKey', label:'Encryption Key',    type:'password', placeholder:'Encryption key',    required:true },
        { key:'webhookSecret', label:'Webhook Hash',      type:'password', placeholder:'Webhook hash',      required:false },
      ],
      razorpay: [
        { key:'keyId',         label:'Key ID',            type:'text',     placeholder:'rzp_live_...', required:true },
        { key:'keySecret',     label:'Key Secret',        type:'password', placeholder:'Key secret',   required:true },
        { key:'webhookSecret', label:'Webhook Secret',    type:'password', placeholder:'Webhook secret', required:false },
      ],
      skrill: [
        { key:'merchantEmail', label:'Merchant Email',    type:'text',     placeholder:'merchant@holaprime.com', required:true },
        { key:'secretWord',    label:'Secret Word',       type:'password', placeholder:'Your Skrill secret word', required:true },
        { key:'merchantId',    label:'Merchant ID',       type:'text',     placeholder:'Your Skrill merchant ID', required:false },
      ],
      neteller: [
        { key:'clientId',     label:'Client ID',          type:'text',     placeholder:'Client ID',     required:true },
        { key:'clientSecret', label:'Client Secret',      type:'password', placeholder:'Client Secret', required:true },
        { key:'env',          label:'Environment',        type:'select',   placeholder:'', required:true, options:['production','test'] },
      ],
      bank_transfer: [
        { key:'bankName',      label:'Bank Name',         type:'text',     placeholder:'Barclays Bank', required:true },
        { key:'accountName',   label:'Account Name',      type:'text',     placeholder:'Hola Prime Ltd', required:true },
        { key:'accountNumber', label:'Account Number',    type:'text',     placeholder:'12345678',      required:true },
        { key:'sortCode',      label:'Sort Code',         type:'text',     placeholder:'20-00-00',      required:false },
        { key:'swiftBic',      label:'SWIFT/BIC',         type:'text',     placeholder:'BARCGB22',      required:false },
        { key:'iban',          label:'IBAN',              type:'text',     placeholder:'GB82WEST12345698765432', required:false },
        { key:'instructions',  label:'Payment Instructions', type:'text',  placeholder:'Please include your order ID as reference', required:false },
      ],
      sumsub: [
        { key:'appToken',    label:'App Token',           type:'password', placeholder:'Your Sumsub app token',   required:true, hint:'From Sumsub Dashboard > Developers > API' },
        { key:'secretKey',   label:'Secret Key',          type:'password', placeholder:'Your Sumsub secret key',  required:true },
        { key:'levelName',   label:'KYC Level Name',      type:'text',     placeholder:'basic-kyc-level',         required:true, hint:'From Sumsub > Verification Levels' },
        { key:'webhookSecret', label:'Webhook Secret',    type:'password', placeholder:'Webhook signing secret',  required:false },
      ],
      smtp: [
        { key:'host',      label:'SMTP Host',             type:'text',     placeholder:'smtp.sendgrid.net', required:true },
        { key:'port',      label:'SMTP Port',             type:'text',     placeholder:'587',               required:true },
        { key:'user',      label:'SMTP Username',         type:'text',     placeholder:'apikey',            required:true },
        { key:'pass',      label:'SMTP Password',         type:'password', placeholder:'SMTP password or API key', required:true },
        { key:'from',      label:'From Email',            type:'text',     placeholder:'noreply@holaprime.com', required:true },
        { key:'fromName',  label:'From Name',             type:'text',     placeholder:'Hola Prime',        required:true },
      ],
      sendgrid: [
        { key:'apiKey',   label:'SendGrid API Key',       type:'password', placeholder:'SG.xxxxxxx',       required:true, hint:'From SendGrid > Settings > API Keys' },
        { key:'from',     label:'From Email',             type:'text',     placeholder:'noreply@holaprime.com', required:true },
        { key:'fromName', label:'From Name',              type:'text',     placeholder:'Hola Prime',        required:true },
      ],
      mailmodo: [
        { key:'apiKey',  label:'Mailmodo API Key',        type:'password', placeholder:'Your Mailmodo API key', required:true },
        { key:'from',    label:'From Email',              type:'text',     placeholder:'noreply@holaprime.com', required:true },
      ],
      mt5: [
        { key:'apiUrl',          label:'MT5 API URL',     type:'url',      placeholder:'https://your-mt5-bridge.com', required:true, hint:'URL of your MT5 HTTP bridge/manager API' },
        { key:'apiKey',          label:'API Key',         type:'password', placeholder:'Your MT5 API key',            required:true },
        { key:'server',          label:'Server Name',     type:'text',     placeholder:'YourBroker-Server',           required:true },
        { key:'managerLogin',    label:'Manager Login',   type:'text',     placeholder:'12345',                       required:false },
        { key:'managerPassword', label:'Manager Password',type:'password', placeholder:'Manager password',            required:false },
      ],
      ctrader: [
        { key:'clientId',     label:'Client ID',          type:'text',     placeholder:'Your cTrader client ID',     required:true },
        { key:'clientSecret', label:'Client Secret',      type:'password', placeholder:'Your cTrader client secret', required:true },
        { key:'accountId',    label:'Account ID',         type:'text',     placeholder:'Your account ID',            required:true },
        { key:'env',          label:'Environment',        type:'select',   placeholder:'', required:true, options:['demo','live'] },
      ],
      dxtrade: [
        { key:'apiUrl',    label:'DXTrade API URL',       type:'url',      placeholder:'https://your.dxtrade.instance', required:true },
        { key:'apiKey',    label:'API Key',               type:'password', placeholder:'Your DXTrade API key',          required:true },
        { key:'brokerName',label:'Broker Name',           type:'text',     placeholder:'YourBrokerName',                required:false },
      ],
      matchtrader: [
        { key:'apiUrl',  label:'API URL',                 type:'url',      placeholder:'https://your-matchtrader.com', required:true },
        { key:'apiKey',  label:'API Key',                 type:'password', placeholder:'Your MatchTrader API key',     required:true },
        { key:'brokerId',label:'Broker ID',               type:'text',     placeholder:'Your broker identifier',       required:false },
      ],
      tradovate: [
        { key:'username',   label:'Username',             type:'text',     placeholder:'Your Tradovate username',   required:true },
        { key:'password',   label:'Password',             type:'password', placeholder:'Your Tradovate password',   required:true },
        { key:'appId',      label:'App ID',               type:'text',     placeholder:'Your application ID',       required:true },
        { key:'cid',        label:'Client ID',            type:'text',     placeholder:'Your client ID',            required:true },
        { key:'secret',     label:'App Secret',           type:'password', placeholder:'Your app secret',           required:true },
        { key:'env',        label:'Environment',          type:'select',   placeholder:'', required:true, options:['demo','live'] },
      ],
      whatsapp: [
        { key:'phoneId',    label:'Phone Number ID',      type:'text',     placeholder:'Your Meta phone number ID', required:true, hint:'From Meta Developer Portal > WhatsApp > Phone Numbers' },
        { key:'token',      label:'Access Token',         type:'password', placeholder:'Permanent access token',    required:true },
        { key:'verifyToken',label:'Webhook Verify Token', type:'text',     placeholder:'Any custom string you choose', required:true },
      ],
    };
    return reply.send(SCHEMAS);
  });

  // PATCH credentials for a service
  app.patch('/:service', async (req, reply) => {
    const { service } = req.params as { service: string };
    const { credentials, is_active } = req.body as { credentials?: Record<string,string>; is_active?: boolean };
    const admin = (req as any).admin;

    const existing = await queryOne<{ credentials: any }>('SELECT credentials FROM integration_credentials WHERE service=$1', [service]);
    if (!existing) return reply.status(404).send({ error: 'Integration not found' });

    // Merge — don't overwrite masked values (those weren't changed)
    const current = typeof existing.credentials === 'string' ? JSON.parse(existing.credentials) : existing.credentials ?? {};
    const merged: Record<string,string> = { ...current };
    if (credentials) {
      for (const [k, v] of Object.entries(credentials)) {
        // If the value is masked (starts with ••••), keep the original
        if (typeof v === 'string' && v.startsWith('••••')) continue;
        merged[k] = v;
      }
    }

    await query(
      'UPDATE integration_credentials SET credentials=$1, is_active=$2, updated_by=$3, updated_at=NOW() WHERE service=$4',
      [JSON.stringify(merged), is_active ?? false, admin.id, service]
    );

    // Clear adapter cache so next use re-loads
    if (['mt5','ctrader','dxtrade','matchtrader','tradovate'].includes(service)) {
      clearAdapterCache(service as any);
    }

    await query('INSERT INTO admin_audit_log (admin_id,action,entity_type,new_data) VALUES ($1,$2,$3,$4)',
      [admin.id, 'integration.update', 'integration', JSON.stringify({ service, is_active })]);

    return reply.send({ ok: true });
  });

  // POST test connection
  app.post('/:service/test', async (req, reply) => {
    const { service } = req.params as { service: string };
    const start = Date.now();
    
    const row = await queryOne<{ credentials: any; is_active: boolean }>(
      'SELECT credentials, is_active FROM integration_credentials WHERE service=$1', [service]
    );
    if (!row) return reply.status(404).send({ error: 'Integration not found' });

    const creds = typeof row.credentials === 'string' ? JSON.parse(row.credentials) : row.credentials ?? {};
    let result: { ok: boolean; message: string; latency_ms?: number } = { ok: false, message: 'Not configured' };

    try {
      if (service === 'stripe') {
        if (!creds.secretKey) throw new Error('Secret key not configured');
        const res = await fetch('https://api.stripe.com/v1/account', {
          headers: { Authorization: `Bearer ${creds.secretKey}` }
        });
        const data = await res.json() as any;
        if (data.error) throw new Error(data.error.message);
        result = { ok: true, message: `Connected to Stripe account: ${data.email ?? data.id}`, latency_ms: Date.now()-start };
      } else if (service === 'nowpayments') {
        if (!creds.apiKey) throw new Error('API key not configured');
        const res = await fetch('https://api.nowpayments.io/v1/status', {
          headers: { 'x-api-key': creds.apiKey }
        });
        const data = await res.json() as any;
        result = { ok: data.message === 'OK', message: data.message === 'OK' ? 'NOWPayments API connected' : data.message, latency_ms: Date.now()-start };
      } else if (service === 'sumsub') {
        if (!creds.appToken) throw new Error('App token not configured');
        result = { ok: true, message: 'Sumsub credentials saved. Test by submitting a KYC request.', latency_ms: Date.now()-start };
      } else if (service === 'smtp' || service === 'sendgrid') {
        if (!creds.host && !creds.apiKey) throw new Error('SMTP host or API key not configured');
        result = { ok: true, message: 'Email credentials saved. Use "Send Test" on email templates to verify.', latency_ms: Date.now()-start };
      } else if (service === 'paypal') {
        if (!creds.clientId) throw new Error('Client ID not configured');
        const base = creds.env === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
        const auth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
        const res = await fetch(`${base}/v1/oauth2/token`, {
          method:'POST', headers:{ Authorization:`Basic ${auth}`, 'Content-Type':'application/x-www-form-urlencoded' },
          body:'grant_type=client_credentials'
        });
        const data = await res.json() as any;
        if (data.error) throw new Error(data.error_description ?? data.error);
        result = { ok: true, message: `PayPal connected (${creds.env})`, latency_ms: Date.now()-start };
      } else {
        // Generic — just verify fields are filled
        const requiredEmpty = Object.entries(creds).filter(([, v]) => !v).length;
        if (requiredEmpty > 0) throw new Error(`${requiredEmpty} required field(s) are empty`);
        result = { ok: true, message: 'Credentials saved. Connection will be verified when first used.', latency_ms: Date.now()-start };
      }
    } catch (e: any) {
      result = { ok: false, message: e.message ?? 'Connection test failed', latency_ms: Date.now()-start };
    }

    // Save test result
    await query(
      'UPDATE integration_credentials SET last_tested=NOW(), test_result=$1 WHERE service=$2',
      [JSON.stringify(result), service]
    );

    return reply.send(result);
  });
}
