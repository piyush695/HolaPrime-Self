import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { PageHeader, Card, Btn } from '../../components/ui.js';

const inp: React.CSSProperties = {
  width:'100%', background:'rgba(255,255,255,.05)', color:'#F5F8FF',
  border:'1px solid #353947', borderRadius:8, padding:'9px 12px',
  fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box',
};

type Tab = 'overview' | 'sendgrid' | 'mailmodo' | 'smtp';

// ── Shared saved/edit card wrapper ────────────────────────────────────────────
function ProviderCard({
  icon, title, desc, saved, onEdit, onSave, saving, error, testResult,
  children, saveLabel = 'Save Configuration',
}: any) {
  return (
    <div>
      <div style={{ padding:'14px 20px', background:'rgba(63,143,224,.06)', border:'1px solid rgba(63,143,224,.15)', borderRadius:10, marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#60A9F0', marginBottom:4 }}>{icon} {title}</div>
        <div style={{ fontSize:12, color:'#8892B0', lineHeight:1.6 }}>{desc}</div>
      </div>

      {/* Saved confirmation banner */}
      {saved && (
        <div style={{ padding:'14px 18px', background:'rgba(56,186,130,.08)', border:'1px solid rgba(56,186,130,.25)', borderRadius:10, marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:20 }}>✅</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#38BA82' }}>Credentials saved</div>
              <div style={{ fontSize:11, color:'#8892B0', marginTop:2 }}>Configuration is active and will be used for all outgoing emails</div>
            </div>
          </div>
          <Btn onClick={onEdit} variant="secondary" style={{ padding:'6px 16px', fontSize:12 }}>✏️ Edit</Btn>
        </div>
      )}

      {/* Form fields */}
      {!saved && (
        <div>
          <div style={{ display:'grid', gap:14, marginBottom:16 }}>{children}</div>

          {testResult && (
            <div style={{ padding:'10px 14px', borderRadius:8, fontSize:13, fontWeight:600, marginBottom:14,
              background: testResult.ok ? 'rgba(56,186,130,.1)' : 'rgba(255,76,106,.1)',
              color:      testResult.ok ? '#38BA82' : '#FF4C6A',
              border:     `1px solid ${testResult.ok ? 'rgba(56,186,130,.3)' : 'rgba(255,76,106,.3)'}` }}>
              {testResult.ok ? '✅' : '❌'} {testResult.message}
              {testResult.latencyMs && <span style={{ color:'#64748B', fontWeight:400, marginLeft:8 }}>{testResult.latencyMs}ms</span>}
            </div>
          )}

          {error && (
            <div style={{ padding:'10px 14px', borderRadius:8, fontSize:13, color:'#FF4C6A', marginBottom:14,
              background:'rgba(255,76,106,.1)', border:'1px solid rgba(255,76,106,.3)' }}>
              ❌ {error}
            </div>
          )}

          <Btn onClick={onSave} disabled={saving}>{saving ? '⏳ Saving…' : saveLabel}</Btn>
        </div>
      )}
    </div>
  );
}

// ── SendGrid panel ────────────────────────────────────────────────────────────
function SendGridPanel() {
  const [form, setForm] = useState({ apiKey:'', fromEmail:'support@holaprime.com', fromName:'Hola Prime', testRecipient:'' });
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  // Load existing credentials on mount
  useEffect(() => {
    api.get('/integrations-hub').then((res: any) => {
      const sg = (res.data as any[]).find((i: any) => i.service === 'sendgrid');
      if (sg) {
        const hasKey = sg.credentialStatus?.apiKey || sg.credentialStatus?.api_key;
        // Load non-sensitive values (from_email, from_name)
        const creds = sg.credentials ?? {};
        setForm(p => ({
          ...p,
          fromEmail: !String(creds.from_email ?? creds.from ?? '').startsWith('••••')
            ? (creds.from_email ?? creds.from ?? p.fromEmail)
            : p.fromEmail,
          fromName: !String(creds.from_name ?? creds.fromName ?? '').startsWith('••••')
            ? (creds.from_name ?? creds.fromName ?? p.fromName)
            : p.fromName,
          apiKey: '', // never pre-fill password fields
        }));
        if (hasKey) { setSaved(true); setEditing(false); }
        else { setSaved(false); setEditing(true); }
      } else {
        setEditing(true);
      }
      setLoaded(true);
    }).catch(() => { setEditing(true); setLoaded(true); });
  }, []);

  function f(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function test() {
    if (!form.apiKey) { setError('Enter your SendGrid API key first'); return; }
    if (!form.testRecipient) { setError('Enter a test recipient email'); return; }
    setError(''); setTesting(true); setTestResult(null);
    try {
      const r = await api.post('/settings/email/test-sendgrid', form);
      setTestResult(r.data);
    } catch(e: any) { setTestResult({ ok:false, message: e?.response?.data?.error ?? e.message }); }
    setTesting(false);
  }

  async function save() {
    if (!form.apiKey) { setError('SendGrid API key is required'); return; }
    if (!form.fromEmail) { setError('From email is required'); return; }
    setError(''); setSaving(true);
    try {
      await api.patch('/integrations-hub/sendgrid', {
        credentials: { api_key: form.apiKey, from_email: form.fromEmail, from_name: form.fromName },
        is_active: true,
      });
      await api.post('/settings/email/reload-config', {}).catch(() => {});
      setSaved(true); setEditing(false); setTestResult(null);
    } catch(e: any) { setError(e?.response?.data?.error ?? e.message ?? 'Save failed'); }
    setSaving(false);
  }

  if (!loaded) return <div style={{ color:'#64748B', padding:20, fontSize:13 }}>Loading…</div>;

  return (
    <ProviderCard
      icon="📧" title="SendGrid — Transactional Email"
      desc="Used for: OTP codes, admin invites, password resets, KYC events, challenge events, payout notifications."
      saved={saved && !editing} onEdit={() => { setSaved(true); setEditing(true); }}
      onSave={save} saving={saving} error={error} testResult={testResult}
      saveLabel="Save SendGrid Config">
      <div>
        <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:5, fontWeight:700 }}>
          SendGrid API Key *
          <a href="https://app.sendgrid.com/settings/api_keys" target="_blank"
            style={{ color:'#3F8FE0', fontSize:10, marginLeft:8 }}>Get key ↗</a>
        </label>
        <input type="password" value={form.apiKey} onChange={e => f('apiKey', e.target.value)}
          placeholder={saved ? '••••••••••••• (enter new key to update)' : 'SG.xxxxxxxxxxxxxxxx'}
          style={inp} autoComplete="off" />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div>
          <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:5, fontWeight:700 }}>From Email *</label>
          <input value={form.fromEmail} onChange={e => f('fromEmail', e.target.value)}
            placeholder="support@holaprime.com" style={inp} />
        </div>
        <div>
          <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:5, fontWeight:700 }}>From Name</label>
          <input value={form.fromName} onChange={e => f('fromName', e.target.value)}
            placeholder="Hola Prime" style={inp} />
        </div>
      </div>
      <div>
        <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:5, fontWeight:700 }}>Test Recipient (optional)</label>
        <div style={{ display:'flex', gap:10 }}>
          <input value={form.testRecipient} onChange={e => f('testRecipient', e.target.value)}
            placeholder="your@email.com" style={{ ...inp, flex:1 }} />
          <Btn variant="secondary" onClick={test} disabled={testing || !form.apiKey} style={{ whiteSpace:'nowrap' }}>
            {testing ? '⏳ Sending…' : '📤 Send Test'}
          </Btn>
        </div>
      </div>
    </ProviderCard>
  );
}

// ── Mailmodo panel ────────────────────────────────────────────────────────────
function MailmodoPanel() {
  const [form, setForm] = useState({ apiKey:'' });
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get('/integrations-hub').then((res: any) => {
      const mm = (res.data as any[]).find((i: any) => i.service === 'mailmodo');
      if (mm?.credentialStatus?.api_key || mm?.credentialStatus?.apiKey) {
        setSaved(true); setEditing(false);
      } else {
        setEditing(true);
      }
      setLoaded(true);
    }).catch(() => { setEditing(true); setLoaded(true); });
  }, []);

  async function test() {
    if (!form.apiKey) { setError('Enter your Mailmodo API key first'); return; }
    setError(''); setTesting(true); setTestResult(null);
    try {
      const r = await api.post('/settings/email/test-mailmodo', { apiKey: form.apiKey });
      setTestResult(r.data);
    } catch(e: any) { setTestResult({ ok:false, message: e?.response?.data?.error ?? e.message }); }
    setTesting(false);
  }

  async function save() {
    if (!form.apiKey) { setError('Mailmodo API key is required'); return; }
    setError(''); setSaving(true);
    try {
      await api.patch('/integrations-hub/mailmodo', {
        credentials: { api_key: form.apiKey },
        is_active: true,
      });
      await api.post('/settings/email/reload-config', {}).catch(() => {});
      setSaved(true); setEditing(false); setTestResult(null);
    } catch(e: any) { setError(e?.response?.data?.error ?? e.message ?? 'Save failed'); }
    setSaving(false);
  }

  if (!loaded) return <div style={{ color:'#64748B', padding:20, fontSize:13 }}>Loading…</div>;

  return (
    <ProviderCard
      icon="📊" title="Mailmodo — Campaigns & Journey Automation"
      desc="Used for: bulk email campaigns, AMP interactive emails, re-engagement sequences, win-back flows, newsletters."
      saved={saved && !editing} onEdit={() => { setSaved(true); setEditing(true); }}
      onSave={save} saving={saving} error={error} testResult={testResult}
      saveLabel="Save Mailmodo Config">
      <div>
        <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:5, fontWeight:700 }}>
          Mailmodo API Key *
          <a href="https://manage.mailmodo.com/auth/login" target="_blank"
            style={{ color:'#3F8FE0', fontSize:10, marginLeft:8 }}>Dashboard ↗</a>
        </label>
        <input type="password" value={form.apiKey} onChange={e => setForm({ apiKey: e.target.value })}
          placeholder={saved ? '••••••••••••• (enter new key to update)' : 'mm_api_xxxxxxxx'}
          style={inp} autoComplete="off" />
      </div>
      <div>
        <Btn variant="secondary" onClick={test} disabled={testing || !form.apiKey} style={{ width:'fit-content' }}>
          {testing ? '⏳ Testing…' : '🔍 Test Connection'}
        </Btn>
      </div>
      <div style={{ padding:'14px 18px', background:'rgba(255,255,255,.03)', borderRadius:10, border:'1px solid #252D3D', fontSize:12, color:'#8892B0' }}>
        <div style={{ fontWeight:700, color:'#F5F8FF', marginBottom:8 }}>Campaign ID Mapping</div>
        <div style={{ lineHeight:1.7 }}>
          Set these as environment variables in <strong style={{ color:'#F5F8FF' }}>Cloud Run → holaprime-admin → Variables & Secrets</strong>:
        </div>
        <div style={{ marginTop:8, display:'grid', gap:4 }}>
          {[
            ['MAILMODO_CAMPAIGN_WIN_BACK',     'Win-back campaign'],
            ['MAILMODO_CAMPAIGN_REENGAGEMENT', 'Re-engagement sequence'],
            ['MAILMODO_CAMPAIGN_NEWSLETTER',   'Monthly newsletter'],
          ].map(([key, label]) => (
            <div key={key} style={{ display:'flex', gap:8, alignItems:'center' }}>
              <code style={{ fontSize:10, color:'#60A9F0', background:'rgba(63,143,224,.1)', padding:'2px 6px', borderRadius:4 }}>{key}</code>
              <span style={{ color:'#64748B', fontSize:11 }}>→ {label}</span>
            </div>
          ))}
        </div>
      </div>
    </ProviderCard>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EmailSettings() {
  const [tab, setTab] = useState<Tab>('overview');

  const ROUTING = [
    { type:'OTP & Verification codes',   provider:'SendGrid', color:'#3F8FE0' },
    { type:'Admin invites',              provider:'SendGrid', color:'#3F8FE0' },
    { type:'Password resets',            provider:'SendGrid', color:'#3F8FE0' },
    { type:'KYC approved/rejected',      provider:'SendGrid', color:'#3F8FE0' },
    { type:'Challenge passed/breached',  provider:'SendGrid', color:'#3F8FE0' },
    { type:'Payout approved/rejected',   provider:'SendGrid', color:'#3F8FE0' },
    { type:'Bulk campaigns',             provider:'Mailmodo', color:'#38BA82' },
    { type:'Re-engagement sequences',    provider:'Mailmodo', color:'#38BA82' },
    { type:'Win-back flows',             provider:'Mailmodo', color:'#38BA82' },
    { type:'Fallback (SendGrid down)',   provider:'SMTP',     color:'#F5B326' },
  ];

  return (
    <>
      <PageHeader title="Email Configuration"
        sub="SendGrid for transactional · Mailmodo for campaigns · SMTP as fallback" />

      <div style={{ display:'flex', gap:0, marginBottom:24, borderBottom:'1px solid #353947' }}>
        {([
          { id:'overview',  label:'📊 Routing Overview' },
          { id:'sendgrid',  label:'📧 SendGrid' },
          { id:'mailmodo',  label:'📊 Mailmodo' },
          { id:'smtp',      label:'🔌 SMTP Fallback' },
        ] as { id: Tab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'10px 20px', fontSize:13, fontWeight: tab===t.id ? 700 : 400,
            color: tab===t.id ? '#F5F8FF' : '#878FA4',
            background:'none', border:'none', cursor:'pointer',
            borderBottom: tab===t.id ? '2px solid #3F8FE0' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
            {[
              { label:'SendGrid', role:'Transactional', desc:'OTP, invites, account events', color:'#3F8FE0', icon:'📧' },
              { label:'Mailmodo', role:'Campaigns & Journeys', desc:'Bulk, AMP, automation', color:'#38BA82', icon:'📊' },
              { label:'SMTP',    role:'Fallback', desc:'Auto-fallback if SendGrid down', color:'#F5B326', icon:'🔌' },
            ].map(p => (
              <div key={p.label} style={{ background:'#161B27', border:`1px solid ${p.color}33`, borderRadius:12, padding:20 }}>
                <div style={{ fontSize:24, marginBottom:8 }}>{p.icon}</div>
                <div style={{ fontSize:15, fontWeight:800, color:p.color }}>{p.label}</div>
                <div style={{ fontSize:12, fontWeight:700, color:'#F5F8FF', margin:'4px 0 2px' }}>{p.role}</div>
                <div style={{ fontSize:11, color:'#64748B' }}>{p.desc}</div>
              </div>
            ))}
          </div>
          <Card>
            <div style={{ fontSize:11, fontWeight:700, color:'#64748B', marginBottom:14, textTransform:'uppercase', letterSpacing:'.05em' }}>
              Email Type → Provider Routing
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #252D3D' }}>
                  {['Email Type','Provider'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#64748B', fontWeight:700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROUTING.map((r, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #1E2535' }}>
                    <td style={{ padding:'10px 12px', color:'#D8E0F0' }}>{r.type}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20,
                        background:`${r.color}15`, color:r.color, border:`1px solid ${r.color}33` }}>
                        {r.provider}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'sendgrid' && <Card><SendGridPanel /></Card>}
      {tab === 'mailmodo' && <Card><MailmodoPanel /></Card>}
      {tab === 'smtp' && (
        <Card>
          <div style={{ padding:'14px 20px', background:'rgba(245,179,38,.06)', border:'1px solid rgba(245,179,38,.2)', borderRadius:10, marginBottom:16 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#F5B326', marginBottom:4 }}>🔌 SMTP — Fallback Only</div>
            <div style={{ fontSize:12, color:'#8892B0', lineHeight:1.6 }}>
              SMTP is used automatically if SendGrid is not configured. Configure SMTP providers in{' '}
              <strong style={{ color:'#F5F8FF' }}>Integrations Hub → Email</strong> — select SMTP and enter your host, port, username, and password.
            </div>
          </div>
          <div style={{ padding:'12px 16px', background:'rgba(255,255,255,.03)', borderRadius:8, border:'1px solid #252D3D', fontSize:13, color:'#8892B0' }}>
            Supported providers: SendGrid SMTP, Mailgun, AWS SES, SMTP2GO, Custom SMTP server.
          </div>
        </Card>
      )}
    </>
  );
}
