import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, Card, CardHeader, Btn, StatCard, Spinner,
} from '../../components/ui.js';

const inp: React.CSSProperties = {
  width:'100%', background:'rgba(255,255,255,.05)', color:'#F5F8FF',
  border:'1px solid #353947', borderRadius:8, padding:'9px 12px',
  fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box',
};
const sel: React.CSSProperties = { ...inp, cursor:'pointer' };

type Provider = 'sendgrid' | 'mailmodo' | 'smtp';
type Tab = 'overview' | 'sendgrid' | 'mailmodo' | 'smtp';

function ProviderBadge({ status }: { status: 'active' | 'fallback' | 'not_configured' }) {
  const map = {
    active:         { label:'Active', bg:'rgba(56,186,130,.15)', color:'#38BA82', border:'rgba(56,186,130,.3)' },
    fallback:       { label:'Fallback', bg:'rgba(245,179,38,.15)', color:'#F5B326', border:'rgba(245,179,38,.3)' },
    not_configured: { label:'Not Configured', bg:'rgba(79,86,105,.15)', color:'#64748B', border:'rgba(79,86,105,.3)' },
  };
  const s = map[status];
  return <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>{s.label}</span>;
}

function SendGridPanel({ onSave }: { onSave: () => void }) {
  const [form, setForm] = useState({ apiKey:'', fromEmail:'noreply@holaprime.com', fromName:'Hola Prime', testRecipient:'' });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  function f(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function test() {
    if (!form.apiKey) { alert('Enter API key first'); return; }
    if (!form.testRecipient) { alert('Enter a test recipient email'); return; }
    setTesting(true); setTestResult(null);
    try {
      const r = await api.post('/settings/email/test-sendgrid', form);
      setTestResult(r.data);
    } catch(e: any) {
      setTestResult({ ok: false, message: e.message });
    }
    setTesting(false);
  }

  async function save() {
    if (!form.apiKey) { alert('API key is required'); return; }
    setSaving(true);
    try {
      // Save to integration_credentials via integrations hub
      await api.patch('/integrations-hub/sendgrid', {
        api_key:    form.apiKey,
        from_email: form.fromEmail,
        from_name:  form.fromName,
        enabled:    true,
      });
      await api.post('/settings/email/reload-config', {});
      onSave();
    } catch(e: any) {
      alert('Save failed: ' + e.message);
    }
    setSaving(false);
  }

  return (
    <div>
      <div style={{ padding:'14px 20px', background:'rgba(63,143,224,.08)', border:'1px solid rgba(63,143,224,.2)', borderRadius:10, marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#60A9F0', marginBottom:4 }}>📧 SendGrid — Transactional Email</div>
        <div style={{ fontSize:12, color:'#8892B0', lineHeight:1.6 }}>
          Used for: OTP codes, admin invites, password resets, KYC approvals/rejections, challenge events, payout notifications.<br/>
          These are 1:1 time-critical emails triggered by platform actions.
        </div>
      </div>

      <div style={{ display:'grid', gap:14, marginBottom:16 }}>
        <div>
          <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:6, fontWeight:700 }}>
            SendGrid API Key * <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" style={{ color:'#3F8FE0', fontSize:10, marginLeft:8 }}>Get key ↗</a>
          </label>
          <input type="password" value={form.apiKey} onChange={e => f('apiKey', e.target.value)}
            placeholder="SG.xxxxxxxxxxxxxxxxxxxxxxxx" style={inp} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:6, fontWeight:700 }}>From Email *</label>
            <input value={form.fromEmail} onChange={e => f('fromEmail', e.target.value)}
              placeholder="noreply@holaprime.com" style={inp} />
          </div>
          <div>
            <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:6, fontWeight:700 }}>From Name</label>
            <input value={form.fromName} onChange={e => f('fromName', e.target.value)}
              placeholder="Hola Prime" style={inp} />
          </div>
        </div>
        <div>
          <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:6, fontWeight:700 }}>Test Recipient Email</label>
          <div style={{ display:'flex', gap:10 }}>
            <input value={form.testRecipient} onChange={e => f('testRecipient', e.target.value)}
              placeholder="your@email.com" style={{ ...inp, flex:1 }} />
            <Btn variant="secondary" onClick={test} disabled={testing || !form.apiKey}>
              {testing ? '⏳ Sending…' : '📤 Send Test'}
            </Btn>
          </div>
        </div>
        {testResult && (
          <div style={{ padding:'10px 14px', borderRadius:8, fontSize:13, fontWeight:600,
            background: testResult.ok ? 'rgba(56,186,130,.1)' : 'rgba(255,76,106,.1)',
            color:      testResult.ok ? '#38BA82' : '#FF4C6A',
            border:     `1px solid ${testResult.ok ? 'rgba(56,186,130,.3)' : 'rgba(255,76,106,.3)'}` }}>
            {testResult.ok ? '✅' : '❌'} {testResult.message}
            {testResult.latencyMs && <span style={{ color:'#64748B', fontWeight:400, marginLeft:8 }}>{testResult.latencyMs}ms</span>}
          </div>
        )}
      </div>
      <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save SendGrid Config'}</Btn>
    </div>
  );
}

function MailmodoPanel({ onSave }: { onSave: () => void }) {
  const [form, setForm] = useState({ apiKey:'', testRecipient:'' });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  function f(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function test() {
    if (!form.apiKey) { alert('Enter API key first'); return; }
    setTesting(true); setTestResult(null);
    try {
      const r = await api.post('/settings/email/test-mailmodo', { apiKey: form.apiKey });
      setTestResult(r.data);
    } catch(e: any) {
      setTestResult({ ok: false, message: e.message });
    }
    setTesting(false);
  }

  async function save() {
    setSaving(true);
    try {
      await api.patch('/integrations-hub/mailmodo', { api_key: form.apiKey, enabled: true });
      await api.post('/settings/email/reload-config', {});
      onSave();
    } catch(e: any) { alert('Save failed: ' + e.message); }
    setSaving(false);
  }

  return (
    <div>
      <div style={{ padding:'14px 20px', background:'rgba(56,186,130,.08)', border:'1px solid rgba(56,186,130,.2)', borderRadius:10, marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#38BA82', marginBottom:4 }}>📊 Mailmodo — Campaigns & Journey Automation</div>
        <div style={{ fontSize:12, color:'#8892B0', lineHeight:1.6 }}>
          Used for: bulk email campaigns, AMP interactive emails, re-engagement sequences, win-back flows, newsletters.<br/>
          Configure campaign IDs in Mailmodo dashboard → Transactional → Trigger Info, then map them below.
        </div>
      </div>

      <div style={{ display:'grid', gap:14, marginBottom:16 }}>
        <div>
          <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:6, fontWeight:700 }}>
            Mailmodo API Key * <a href="https://manage.mailmodo.com/auth/login" target="_blank" style={{ color:'#3F8FE0', fontSize:10, marginLeft:8 }}>Mailmodo Dashboard ↗</a>
          </label>
          <input type="password" value={form.apiKey} onChange={e => f('apiKey', e.target.value)}
            placeholder="mm_api_xxxxxxxxxxxxxxxx" style={inp} />
        </div>
        <div>
          <Btn variant="secondary" onClick={test} disabled={testing || !form.apiKey} style={{ marginBottom:0 }}>
            {testing ? '⏳ Testing…' : '🔍 Test Connection'}
          </Btn>
        </div>
        {testResult && (
          <div style={{ padding:'10px 14px', borderRadius:8, fontSize:13, fontWeight:600,
            background: testResult.ok ? 'rgba(56,186,130,.1)' : 'rgba(255,76,106,.1)',
            color:      testResult.ok ? '#38BA82' : '#FF4C6A',
            border:     `1px solid ${testResult.ok ? 'rgba(56,186,130,.3)' : 'rgba(255,76,106,.3)'}` }}>
            {testResult.ok ? '✅ Connected successfully' : '❌ ' + testResult.message}
            {testResult.latencyMs && <span style={{ color:'#64748B', fontWeight:400, marginLeft:8 }}>{testResult.latencyMs}ms</span>}
          </div>
        )}

        {/* Campaign ID mapping */}
        <div style={{ marginTop:8, padding:'16px 20px', background:'rgba(255,255,255,.03)', borderRadius:10, border:'1px solid #252D3D' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#8892B0', marginBottom:14, textTransform:'uppercase', letterSpacing:'.05em' }}>
            Campaign ID Mapping <span style={{ color:'#4F5669', fontWeight:400, textTransform:'none' }}>(from Mailmodo → Transactional)</span>
          </div>
          <div style={{ display:'grid', gap:10 }}>
            {[
              { key:'MAILMODO_CAMPAIGN_WIN_BACK',       label:'Win-back campaign' },
              { key:'MAILMODO_CAMPAIGN_REENGAGEMENT',   label:'Re-engagement sequence' },
              { key:'MAILMODO_CAMPAIGN_NEWSLETTER',     label:'Monthly newsletter' },
              { key:'MAILMODO_CAMPAIGN_BROADCAST',      label:'General broadcast' },
            ].map(({ key, label }) => (
              <div key={key} style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:10, alignItems:'center' }}>
                <div style={{ fontSize:12, color:'#8892B0' }}>{label}</div>
                <input placeholder={`Set ${key} in env`} style={{ ...inp, fontSize:11, padding:'6px 10px' }} readOnly
                  defaultValue={''} title={`Add ${key}=<campaign_id> to your environment variables in Cloud Run`} />
              </div>
            ))}
          </div>
          <div style={{ marginTop:10, fontSize:11, color:'#4F5669' }}>
            💡 Set these as environment variables in Cloud Run → holaprime-admin → Edit & Deploy → Variables & Secrets
          </div>
        </div>
      </div>
      <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Mailmodo Config'}</Btn>
    </div>
  );
}

function SmtpPanel() {
  return (
    <div>
      <div style={{ padding:'14px 20px', background:'rgba(245,179,38,.08)', border:'1px solid rgba(245,179,38,.2)', borderRadius:10, marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#F5B326', marginBottom:4 }}>🔌 SMTP — Fallback</div>
        <div style={{ fontSize:12, color:'#8892B0', lineHeight:1.6 }}>
          SMTP is used as a fallback if SendGrid is not configured. Configure SMTP providers in{' '}
          <strong style={{ color:'#F5F8FF' }}>Settings → SMTP Configurations</strong> or the Integrations Hub.
        </div>
      </div>
      <div style={{ padding:16, background:'rgba(255,255,255,.03)', borderRadius:10, border:'1px solid #252D3D', fontSize:13, color:'#8892B0' }}>
        Supported fallback SMTP providers: SendGrid SMTP, Mailgun, AWS SES, SMTP2GO, Custom SMTP.<br/><br/>
        SMTP configs are managed in the <strong style={{ color:'#F5F8FF' }}>Email / SMTP</strong> section of Settings.
      </div>
    </div>
  );
}

export default function EmailSettings() {
  const [tab, setTab] = useState<Tab>('overview');
  const qc = useQueryClient();

  const ROUTING = [
    { type:'OTP & Verification codes',    provider:'SendGrid', reason:'Time-critical, must deliver instantly', color:'#3F8FE0' },
    { type:'Admin invites',               provider:'SendGrid', reason:'One-time credential delivery',          color:'#3F8FE0' },
    { type:'Password resets',             provider:'SendGrid', reason:'Security-critical, no delay acceptable', color:'#3F8FE0' },
    { type:'KYC approved/rejected',       provider:'SendGrid', reason:'Transactional account event',           color:'#3F8FE0' },
    { type:'Challenge purchased/passed',  provider:'SendGrid', reason:'Account event trigger',                 color:'#3F8FE0' },
    { type:'Breach notifications',        provider:'SendGrid', reason:'Account event trigger',                 color:'#3F8FE0' },
    { type:'Payout approved/rejected',    provider:'SendGrid', reason:'Financial event, high priority',        color:'#3F8FE0' },
    { type:'Bulk campaigns',              provider:'Mailmodo', reason:'Campaign management, AMP support',      color:'#38BA82' },
    { type:'Re-engagement sequences',     provider:'Mailmodo', reason:'Journey automation built in Mailmodo',  color:'#38BA82' },
    { type:'Win-back flows',              provider:'Mailmodo', reason:'Behavioural trigger journeys',          color:'#38BA82' },
    { type:'Newsletters',                 provider:'Mailmodo', reason:'Bulk broadcast with segmentation',      color:'#38BA82' },
    { type:'Fallback (if SendGrid down)', provider:'SMTP',     reason:'Auto fallback, zero-config',            color:'#F5B326' },
  ];

  return (
    <>
      <PageHeader title="Email Configuration" sub="SendGrid for transactional · Mailmodo for campaigns · SMTP as fallback" />

      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, marginBottom:24, borderBottom:'1px solid #353947' }}>
        {([
          { id:'overview',  label:'📊 Routing Overview' },
          { id:'sendgrid',  label:'📧 SendGrid' },
          { id:'mailmodo',  label:'📊 Mailmodo' },
          { id:'smtp',      label:'🔌 SMTP Fallback' },
        ] as { id: Tab, label: string }[]).map(t => (
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
              { label:'SMTP', role:'Fallback', desc:'Auto-fallback if SendGrid down', color:'#F5B326', icon:'🔌' },
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
            <div style={{ fontSize:12, fontWeight:700, color:'#64748B', marginBottom:16, textTransform:'uppercase', letterSpacing:'.05em' }}>
              Email Type → Provider Routing Rules
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #252D3D' }}>
                  {['Email Type','Provider','Reason'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', color:'#64748B', fontWeight:700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROUTING.map((r, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #1E2535' }}>
                    <td style={{ padding:'10px 12px', color:'#D8E0F0', fontWeight:600 }}>{r.type}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20,
                        background:`${r.color}15`, color:r.color, border:`1px solid ${r.color}33` }}>
                        {r.provider}
                      </span>
                    </td>
                    <td style={{ padding:'10px 12px', color:'#64748B', fontSize:11 }}>{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'sendgrid' && (
        <Card><SendGridPanel onSave={() => qc.invalidateQueries({ queryKey:['settings'] })} /></Card>
      )}

      {tab === 'mailmodo' && (
        <Card><MailmodoPanel onSave={() => qc.invalidateQueries({ queryKey:['settings'] })} /></Card>
      )}

      {tab === 'smtp' && (
        <Card><SmtpPanel /></Card>
      )}
    </>
  );
}
