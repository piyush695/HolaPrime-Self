import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { PageHeader, Card, CardHeader, Btn, Input, Spinner, Badge, Empty } from '../../components/ui.js';

const PROVIDERS = [
  { value:'sendgrid', label:'SendGrid' },
  { value:'ses',      label:'AWS SES' },
  { value:'mailgun',  label:'Mailgun' },
  { value:'smtp2go',  label:'SMTP2GO' },
  { value:'custom',   label:'Custom SMTP' },
];

export default function EmailSettings() {
  const [tab, setTab]           = useState<'smtp'|'mailmodo'>('mailmodo');
  const [showNew, setShowNew]   = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting]   = useState(false);
  const [newCfg, setNewCfg]     = useState({
    name:'', provider:'sendgrid', host:'', port:'587',
    username:'', password:'', apiKey:'',
    fromEmail:'', fromName:'Hola Prime', isDefault:false,
  });
  const qc = useQueryClient();

  const { data: smtpConfigs, isLoading } = useQuery({
    queryKey: ['smtp-configs'],
    queryFn:  () => api.get('/smtp').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: () => api.post('/smtp', {
      ...newCfg,
      port: parseInt(newCfg.port),
      isDefault: newCfg.isDefault,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['smtp-configs'] }); setShowNew(false); },
  });

  const setDefault = useMutation({
    mutationFn: (id: string) => api.post(`/smtp/${id}/set-default`),
    onSuccess: () => qc.invalidateQueries({ queryKey:['smtp-configs'] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/smtp/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey:['smtp-configs'] }),
  });

  const runTest = async () => {
    if (!testEmail) return;
    setTesting(true);
    try {
      const res = await api.post('/smtp/test', {
        ...newCfg,
        port:          parseInt(newCfg.port),
        testRecipient: testEmail,
      });
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({ ok: false, message: err.response?.data?.error ?? String(err) });
    } finally {
      setTesting(false);
    }
  };

  const MAILMODO_CAMPAIGNS = [
    { env:'MAILMODO_CAMPAIGN_WELCOME',             label:'Welcome email' },
    { env:'MAILMODO_CAMPAIGN_KYC_APPROVED',        label:'KYC approved' },
    { env:'MAILMODO_CAMPAIGN_KYC_REJECTED',        label:'KYC rejected' },
    { env:'MAILMODO_CAMPAIGN_CHALLENGE_PURCHASED', label:'Challenge purchased' },
    { env:'MAILMODO_CAMPAIGN_ACCOUNT_PASSED',      label:'Account passed' },
    { env:'MAILMODO_CAMPAIGN_ACCOUNT_BREACHED',    label:'Account breached' },
    { env:'MAILMODO_CAMPAIGN_PAYOUT_APPROVED',     label:'Payout approved' },
    { env:'MAILMODO_CAMPAIGN_PASSWORD_RESET',      label:'Password reset' },
  ];

  return (
    <>
      <PageHeader title="Email Settings" sub="Mailmodo campaigns and SMTP configuration" />

      <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:'1px solid #353947' }}>
        {[{id:'mailmodo',label:'Mailmodo (Primary)'},{id:'smtp',label:'SMTP Fallback'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            padding:'10px 20px', fontSize:13, fontWeight:tab===t.id?700:400,
            color:tab===t.id?'#F5F8FF':'#878FA4', background:'none', border:'none',
            cursor:'pointer', borderBottom:tab===t.id?'2px solid #3F8FE0':'2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Mailmodo tab */}
      {tab === 'mailmodo' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <Card>
            <CardHeader title="Mailmodo Setup" />
            <div style={{ fontSize:13, color:'#878FA4', marginBottom:16, lineHeight:1.6 }}>
              Mailmodo sends your transactional emails using pre-built AMP/HTML campaigns.
              <ol style={{ marginTop:8, marginLeft:16, display:'flex', flexDirection:'column', gap:4 }}>
                <li>Set <code style={{ color:'#3F8FE0' }}>MAILMODO_API_KEY</code> in your <code>.env</code></li>
                <li>Create a campaign in Mailmodo for each email type below</li>
                <li>Copy the Campaign ID from <strong>Transactional → Trigger Info</strong></li>
                <li>Paste the Campaign ID in the corresponding <code>.env</code> variable</li>
              </ol>
            </div>

            <div style={{ padding:'12px', background:'#252931', borderRadius:8, marginBottom:14 }}>
              <div style={{ fontSize:11, color:'#4F5669', marginBottom:6 }}>API KEY ENV VAR</div>
              <code style={{ fontSize:13, color:'#3F8FE0' }}>MAILMODO_API_KEY=your_api_key_from_mailmodo</code>
            </div>

            <div style={{ fontSize:11, color:'#4F5669', letterSpacing:'0.06em', marginBottom:10 }}>
              CAMPAIGN ID VARIABLES (in .env)
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {MAILMODO_CAMPAIGNS.map(c => (
                <div key={c.env} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:'#252931', borderRadius:6 }}>
                  <span style={{ fontSize:12, color:'#CCD2E3' }}>{c.label}</span>
                  <code style={{ fontSize:11, color:'#878FA4' }}>{c.env}</code>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="How Mailmodo Works" />
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { step:'1', title:'Create template', body:'In Mailmodo, go to Templates and create an email for each trigger type. Use AMP or HTML — your choice.' },
                { step:'2', title:'Create campaign', body:'Go to Campaigns → New Campaign → Transactional. Link your template and set the trigger type.' },
                { step:'3', title:'Get campaign ID', body:'Open the campaign → Integration tab → copy the ID from the API endpoint URL.' },
                { step:'4', title:'Set in .env', body:'Paste the campaign ID as the value for the corresponding MAILMODO_CAMPAIGN_* variable.' },
                { step:'5', title:'Test it', body:'Register a test account in your trader portal. The welcome email will fire automatically.' },
              ].map(s => (
                <div key={s.step} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', background:'#162F4F', border:'1px solid #3F8FE044', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#3F8FE0', flexShrink:0 }}>{s.step}</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:'#CCD2E3' }}>{s.title}</div>
                    <div style={{ fontSize:12, color:'#878FA4', marginTop:2 }}>{s.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* SMTP tab */}
      {tab === 'smtp' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontSize:13, color:'#878FA4' }}>
              SMTP is used as fallback when Mailmodo campaign IDs are not set, and for bulk campaign sends.
            </div>
            <Btn onClick={() => setShowNew(!showNew)}>
              {showNew ? 'Cancel' : '+ Add SMTP Config'}
            </Btn>
          </div>

          {showNew && (
            <Card style={{ marginBottom:16 }}>
              <CardHeader title="New SMTP Configuration" />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <div style={{ fontSize:12, color:'#878FA4', marginBottom:4 }}>Name</div>
                  <Input value={newCfg.name} onChange={v => setNewCfg(p => ({ ...p, name:v }))} placeholder="e.g. SendGrid Production" style={{ width:'100%' }} />
                </div>
                <div>
                  <div style={{ fontSize:12, color:'#878FA4', marginBottom:4 }}>Provider</div>
                  <select value={newCfg.provider} onChange={e => setNewCfg(p => ({ ...p, provider:e.target.value }))}
                    style={{ width:'100%', background:'#252931', color:'#F5F8FF', border:'1px solid #353947', borderRadius:6, padding:'7px 10px', fontSize:13, outline:'none', fontFamily:'inherit' }}>
                    {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:12, color:'#878FA4', marginBottom:4 }}>From Email</div>
                  <Input value={newCfg.fromEmail} onChange={v => setNewCfg(p => ({ ...p, fromEmail:v }))} placeholder="noreply@holaprime.com" style={{ width:'100%' }} />
                </div>

                {newCfg.provider === 'custom' || newCfg.provider === 'ses' || newCfg.provider === 'mailgun' ? (
                  <>
                    <div>
                      <div style={{ fontSize:12, color:'#878FA4', marginBottom:4 }}>SMTP Host</div>
                      <Input value={newCfg.host} onChange={v => setNewCfg(p => ({ ...p, host:v }))} placeholder="smtp.example.com" style={{ width:'100%' }} />
                    </div>
                    <div>
                      <div style={{ fontSize:12, color:'#878FA4', marginBottom:4 }}>Port</div>
                      <Input value={newCfg.port} onChange={v => setNewCfg(p => ({ ...p, port:v }))} placeholder="587" style={{ width:'100%' }} />
                    </div>
                    <div>
                      <div style={{ fontSize:12, color:'#878FA4', marginBottom:4 }}>Username</div>
                      <Input value={newCfg.username} onChange={v => setNewCfg(p => ({ ...p, username:v }))} style={{ width:'100%' }} />
                    </div>
                    <div>
                      <div style={{ fontSize:12, color:'#878FA4', marginBottom:4 }}>Password</div>
                      <Input type="password" value={newCfg.password} onChange={v => setNewCfg(p => ({ ...p, password:v }))} style={{ width:'100%' }} />
                    </div>
                  </>
                ) : (
                  <div style={{ gridColumn:'1/-1' }}>
                    <div style={{ fontSize:12, color:'#878FA4', marginBottom:4 }}>API Key</div>
                    <Input type="password" value={newCfg.apiKey} onChange={v => setNewCfg(p => ({ ...p, apiKey:v }))} placeholder="SG.xxxx or key-xxxx" style={{ width:'100%' }} />
                  </div>
                )}

                {/* Test section */}
                <div style={{ gridColumn:'1/-1', padding:'12px', background:'#252931', borderRadius:8 }}>
                  <div style={{ fontSize:12, color:'#878FA4', marginBottom:8 }}>Test before saving</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <Input value={testEmail} onChange={setTestEmail} placeholder="your@email.com" style={{ flex:1 }} />
                    <Btn size="sm" variant="secondary" onClick={runTest} disabled={testing || !testEmail}>
                      {testing ? 'Sending…' : 'Send Test'}
                    </Btn>
                  </div>
                  {testResult && (
                    <div style={{ marginTop:8, padding:'8px 10px', background:testResult.ok?'#123B26':'#3D1313', borderRadius:6, fontSize:12, color:testResult.ok?'#38BA82':'#EB5454' }}>
                      {testResult.ok ? `✓ Test email sent (${testResult.latencyMs}ms)` : `✗ ${testResult.message}`}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <Btn variant="primary" disabled={!newCfg.name || !newCfg.fromEmail || save.isPending} onClick={() => save.mutate()}>Save</Btn>
                <Btn variant="secondary" onClick={() => setShowNew(false)}>Cancel</Btn>
              </div>
            </Card>
          )}

          {isLoading ? <Spinner /> : (smtpConfigs ?? []).length === 0 ? (
            <Empty icon="📧" message="No SMTP configurations" sub="Add one above as a fallback for Mailmodo" />
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {(smtpConfigs ?? []).map((cfg: any) => (
                <Card key={cfg.id}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                        <span style={{ fontSize:14, fontWeight:700, color:'#F5F8FF' }}>{cfg.name}</span>
                        {cfg.is_default && <Badge label="Default" variant="blue" />}
                        <Badge label={cfg.is_active ? 'active' : 'inactive'} variant={cfg.is_active ? 'green' : 'default'} />
                      </div>
                      <div style={{ fontSize:12, color:'#878FA4' }}>
                        {cfg.provider} · {cfg.from_email}
                        {cfg.host && ` · ${cfg.host}:${cfg.port}`}
                      </div>
                      {cfg.last_test_at && (
                        <div style={{ fontSize:11, color: cfg.last_test_ok ? '#38BA82' : '#EB5454', marginTop:2 }}>
                          Last test: {cfg.last_test_ok ? '✓ OK' : '✗ Failed'} · {new Date(cfg.last_test_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      {!cfg.is_default && (
                        <Btn size="sm" variant="secondary" onClick={() => setDefault.mutate(cfg.id)}>
                          Set Default
                        </Btn>
                      )}
                      <Btn size="sm" variant="danger" onClick={() => del.mutate(cfg.id)}>Delete</Btn>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
