import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, Card, StatCard, Table,
  Pagination, Btn, Spinner, Badge, StatusBadge, Empty,
} from '../../components/ui.js';

const TYPE_COL: Record<string,string> = { email:'blue', whatsapp:'green', sms:'teal', push:'purple' };
const fmt = (n: number, d: number) => d > 0 ? (n/d*100).toFixed(1)+'%' : '—';

const STARTER_HTML = {
  blank: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#ffffff">
  <h1 style="color:#111827">Hi {{first_name}},</h1>
  <p style="color:#374151;line-height:1.7">Your message here.</p>
  <div style="text-align:center;margin:32px 0">
    <a href="{{cta_url}}" style="display:inline-block;background:#3F8FE0;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700">
      {{cta_text}}
    </a>
  </div>
  <p style="color:#9CA3AF;font-size:12px">Hola Prime Markets · <a href="#">Unsubscribe</a></p>
</div>`,
  dark: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0B1120;color:#F1F5F9;border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#1B3A6B,#0B1120);padding:32px;text-align:center">
    <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:2px">HOLA PRIME</div>
  </div>
  <div style="padding:32px">
    <h1 style="font-size:22px;font-weight:800;margin:0 0 16px">Hi {{first_name}}!</h1>
    <p style="color:#94A3B8;line-height:1.7;font-size:15px">Your message here.</p>
    <div style="text-align:center;margin:28px 0">
      <a href="{{cta_url}}" style="display:inline-block;background:#3F8FE0;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700">
        {{cta_text}}
      </a>
    </div>
  </div>
  <div style="padding:16px 32px;border-top:1px solid #1E2535;text-align:center">
    <p style="color:#475569;font-size:12px;margin:0">Hola Prime Markets · <a href="#" style="color:#3F8FE0">Unsubscribe</a></p>
  </div>
</div>`,
  otp: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0B1120;color:#F1F5F9;border-radius:16px;padding:40px;text-align:center">
  <div style="font-size:20px;font-weight:800;margin-bottom:8px">Verification Code</div>
  <p style="color:#94A3B8;font-size:14px;margin-bottom:24px">Enter this code to verify your identity</p>
  <div style="background:#1C2A3A;border-radius:12px;padding:24px;margin:0 auto 24px;display:inline-block;min-width:200px">
    <div style="font-size:40px;font-weight:900;letter-spacing:12px;color:#4F8CF7">{{otp}}</div>
  </div>
  <p style="color:#94A3B8;font-size:13px">Expires in 10 minutes. Do not share this code.</p>
</div>`,
};

const inp: React.CSSProperties = { width:'100%',background:'#252931',color:'#F5F8FF',border:'1px solid #353947',borderRadius:6,padding:'8px 10px',fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box' };
const sel: React.CSSProperties = { ...inp, cursor:'pointer' };

function TemplateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: any) => void }) {
  const [form, setForm] = useState({ name:'', subject:'', html_body:'', text_body:'', variables:'' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  function f(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  function detectVars(html: string) {
    return [...new Set((html.match(/\{\{(\w+)\}\}/g) ?? []).map(m => m.slice(2,-2)))].join(', ');
  }

  async function save() {
    setError('');
    if (!form.name)       { setError('Template name is required'); return; }
    if (!form.subject)    { setError('Subject line is required'); return; }
    if (!form.html_body)  { setError('HTML body is required — pick a starter template below or write your own'); return; }
    setSaving(true);
    try {
      const vars = form.variables.split(',').map(v => v.trim()).filter(Boolean);
      // POST to email-templates route (same table, correct API)
      const created = await fetch('/api/v1/email-templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${JSON.parse(localStorage.getItem('hp-admin-auth-v2') ?? '{}').state?.accessToken ?? ''}`,
        },
        body: JSON.stringify({
          key: form.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 60) + '_' + Date.now().toString(36),
          label: form.name,
          subject: form.subject,
          html_body: form.html_body,
          text_body: form.text_body,
          variables: vars,
        }),
      });
      const data = await created.json();
      if (!created.ok) { setError(data?.error ?? `Error ${created.status}`); setSaving(false); return; }
      onCreated(data);
    } catch(e: any) {
      setError(e.message ?? 'Failed to create template');
    }
    setSaving(false);
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'#00000099', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#1C1F27', border:'1px solid #353947', borderRadius:14, width:640, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 80px rgba(0,0,0,.6)' }}>
        <div style={{ padding:'20px 24px', borderBottom:'1px solid #353947', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:16, fontWeight:800, color:'#F5F8FF' }}>Create Email Template</div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#878FA4', fontSize:22, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        <div style={{ padding:24 }}>
          {/* Starter templates */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, color:'#878FA4', fontWeight:700, marginBottom:10, textTransform:'uppercase', letterSpacing:'.05em' }}>
              Start from a template
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {[
                { id:'blank', label:'📄 Blank', desc:'Simple white layout' },
                { id:'dark', label:'🌙 Dark Branded', desc:'Hola Prime dark theme' },
                { id:'otp', label:'🔐 OTP / Code', desc:'Verification code email' },
              ].map(t => (
                <button key={t.id} onClick={() => {
                  f('html_body', STARTER_HTML[t.id as keyof typeof STARTER_HTML]);
                  setForm(p => ({ ...p, variables: detectVars(STARTER_HTML[t.id as keyof typeof STARTER_HTML]) }));
                }} style={{
                  padding:'10px 12px', borderRadius:8, border:'1px solid #353947',
                  background:'#252931', cursor:'pointer', textAlign:'left',
                  transition:'border-color .15s',
                }}
                  onMouseEnter={e => (e.currentTarget as any).style.borderColor='#3F8FE0'}
                  onMouseLeave={e => (e.currentTarget as any).style.borderColor='#353947'}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#F5F8FF', marginBottom:2 }}>{t.label}</div>
                  <div style={{ fontSize:11, color:'#878FA4' }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:11, color:'#878FA4', display:'block', marginBottom:5, fontWeight:700 }}>Template Name *</label>
              <input value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. Challenge Passed" style={inp} />
            </div>
            <div>
              <label style={{ fontSize:11, color:'#878FA4', display:'block', marginBottom:5, fontWeight:700 }}>Subject Line *</label>
              <input value={form.subject} onChange={e => f('subject', e.target.value)} placeholder="Hi {{first_name}}, you passed! 🎉" style={inp} />
            </div>
          </div>

          <div style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
              <label style={{ fontSize:11, color:'#878FA4', fontWeight:700 }}>HTML Body *</label>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => setPreview(false)} style={{ padding:'3px 10px', borderRadius:5, border:'1px solid', fontSize:11, fontWeight:700, cursor:'pointer', background: !preview?'#3F8FE0':'#252931', color: !preview?'#fff':'#878FA4', borderColor: !preview?'#3F8FE0':'#353947' }}>Code</button>
                <button onClick={() => setPreview(true)} style={{ padding:'3px 10px', borderRadius:5, border:'1px solid', fontSize:11, fontWeight:700, cursor:'pointer', background: preview?'#3F8FE0':'#252931', color: preview?'#fff':'#878FA4', borderColor: preview?'#3F8FE0':'#353947' }}>Preview</button>
              </div>
            </div>
            {preview
              ? <div style={{ border:'1px solid #353947', borderRadius:8, padding:16, minHeight:200, background:'#fff' }} dangerouslySetInnerHTML={{ __html: form.html_body }} />
              : <textarea value={form.html_body} onChange={e => f('html_body', e.target.value)} rows={10}
                  style={{ ...inp, resize:'vertical', fontFamily:'monospace', fontSize:12 }} />}
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:11, color:'#878FA4', display:'block', marginBottom:5, fontWeight:700 }}>Plain Text Body <span style={{ color:'#4F5669', fontWeight:400 }}>(optional — fallback for email clients that don&apos;t support HTML)</span></label>
            <textarea value={form.text_body} onChange={e => f('text_body', e.target.value)} rows={3}
              style={{ ...inp, resize:'vertical', fontSize:12 }} placeholder="Hi {{first_name}}, your message in plain text here." />
          </div>

          <div style={{ marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
              <label style={{ fontSize:11, color:'#878FA4', fontWeight:700 }}>Variables <span style={{ color:'#4F5669', fontWeight:400 }}>(comma separated)</span></label>
              {form.html_body && (
                <button onClick={() => f('variables', detectVars(form.html_body))}
                  style={{ padding:'3px 10px', borderRadius:5, border:'1px solid #3F8FE0', background:'rgba(63,143,224,.1)', color:'#60A9F0', fontSize:11, cursor:'pointer', fontWeight:700 }}>
                  Auto-detect from HTML
                </button>
              )}
            </div>
            <input value={form.variables} onChange={e => f('variables', e.target.value)}
              placeholder="first_name, challenge_name, cta_url" style={inp} />
            {form.variables && (
              <div style={{ marginTop:6, display:'flex', gap:6, flexWrap:'wrap' }}>
                {form.variables.split(',').map(v => v.trim()).filter(Boolean).map(v => (
                  <code key={v} style={{ fontSize:11, background:'rgba(63,143,224,.15)', color:'#60A9F0', padding:'2px 8px', borderRadius:4 }}>
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div style={{ padding:'10px 14px', background:'rgba(255,76,106,.1)', border:'1px solid rgba(255,76,106,.3)', borderRadius:8, fontSize:13, color:'#FF4C6A', marginBottom:14 }}>
              ❌ {error}
            </div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <Btn onClick={save} disabled={saving}>{saving ? '⏳ Creating…' : 'Create Template'}</Btn>
            <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Campaigns() {
  const [page, setPage]     = useState(1);
  const [status, setStatus] = useState('');
  const [view, setView]     = useState<'campaigns'|'templates'>('campaigns');
  const [selected, setSelected] = useState<any>(null);
  const [showNew, setShowNew]   = useState(false);
  const [showNewTmpl, setShowNewTmpl] = useState(false);
  const [newCamp, setNewCamp] = useState({ name:'', type:'email', templateId:'' });
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['campaign-stats'],
    queryFn: () => api.get('/campaigns/stats').then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', page, status],
    queryFn: () => api.get('/campaigns', { params:{ page, limit:25, status } }).then(r => r.data),
    placeholderData: prev => prev,
    enabled: view === 'campaigns',
  });

  const { data: templates, refetch: refetchTemplates } = useQuery({
    queryKey: ['campaign-email-templates'],
    queryFn: () => api.get('/campaigns/templates').then(r => r.data),
    enabled: view === 'templates' || showNew,
  });

  const { data: detail } = useQuery({
    queryKey: ['campaign-detail', selected?.id],
    queryFn: () => selected ? api.get(`/campaigns/${selected.id}`).then(r => r.data) : null,
    enabled: !!selected,
  });

  const createCampaign = useMutation({
    mutationFn: (d: typeof newCamp) => api.post('/campaigns', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['campaigns'] });
      setShowNew(false);
      setNewCamp({ name:'', type:'email', templateId:'' });
    },
  });

  const launchCampaign = useMutation({
    mutationFn: (id: string) => api.post(`/campaigns/${id}/launch`),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey:['campaigns'] });
      qc.invalidateQueries({ queryKey:['campaign-detail', selected?.id] });
      alert(`Campaign launched! ${res.data?.queued ?? 0} sends queued.`);
    },
  });

  const campaignColumns = [
    { key:'name', label:'Campaign',
      render: (r: any) => (
        <div>
          <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.name}</div>
          {r.template_name && <div style={{ fontSize:11, color:'#4F5669' }}>{r.template_name}</div>}
        </div>
      ),
    },
    { key:'type', label:'Type', width:90, render: (r: any) => <Badge label={r.type} variant={(TYPE_COL[r.type] ?? 'default') as any} /> },
    { key:'status', label:'Status', width:120, render: (r: any) => <StatusBadge status={r.status} /> },
    { key:'sent_count', label:'Sent', width:80,
      render: (r: any) => <span style={{ color:'#CCD2E3' }}>{parseInt(r.sent_count ?? '0').toLocaleString()}</span> },
    { key:'open_rate', label:'Open Rate', width:100,
      render: (r: any) => <span style={{ color:'#38BA82', fontWeight:600 }}>{fmt(parseInt(r.open_count ?? '0'), parseInt(r.sent_count ?? '0'))}</span> },
    { key:'click_rate', label:'Click Rate', width:100,
      render: (r: any) => <span style={{ color:'#3F8FE0', fontWeight:600 }}>{fmt(parseInt(r.click_count ?? '0'), parseInt(r.sent_count ?? '0'))}</span> },
    { key:'actions', label:'', width:80,
      render: (r: any) => <Btn size="sm" onClick={() => setSelected(r)}>View</Btn> },
  ];

  const templateColumns = [
    { key:'name', label:'Template',
      render: (r: any) => (
        <div>
          <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.name ?? r.label}</div>
          <div style={{ fontSize:11, color:'#4F5669' }}>{r.subject}</div>
        </div>
      ),
    },
    { key:'key', label:'Key', width:180,
      render: (r: any) => <code style={{ fontSize:11, color:'#60A9F0' }}>{r.key}</code> },
    { key:'is_active', label:'Status', width:90,
      render: (r: any) => <Badge label={r.is_active || r.enabled ? 'active' : 'inactive'} variant={(r.is_active || r.enabled) ? 'green' : 'default'} /> },
    { key:'updated_at', label:'Updated', width:120,
      render: (r: any) => <span style={{ color:'#878FA4', fontSize:11 }}>{new Date(r.updated_at).toLocaleDateString()}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Campaigns"
        sub="Email campaigns, WhatsApp broadcasts, and message templates"
        action={
          <div style={{ display:'flex', gap:8 }}>
            {view === 'templates' && <Btn onClick={() => setShowNewTmpl(true)}>+ New Template</Btn>}
            {view === 'campaigns' && <Btn onClick={() => setShowNew(true)}>+ New Campaign</Btn>}
          </div>
        }
      />

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Total Campaigns"  value={stats?.total_campaigns ?? '—'} />
        <StatCard label="Running"          value={stats?.running         ?? '—'} color="#38BA82" />
        <StatCard label="Total Sent"       value={stats?.total_sent ? parseInt(stats.total_sent).toLocaleString() : '—'} color="#3F8FE0" />
        <StatCard label="Total Opens"      value={stats?.total_opens ? parseInt(stats.total_opens).toLocaleString() : '—'} color="#F5B326" />
        <StatCard label="Avg Open Rate"    value={stats?.avg_open_rate ? stats.avg_open_rate + '%' : '—'} color="#8B5CF6" />
      </div>

      {/* Tab switcher */}
      <div style={{ display:'flex', gap:0, marginBottom:16, borderBottom:'1px solid #353947' }}>
        {[{ id:'campaigns', label:'Campaigns' },{ id:'templates', label:'Email Templates' }].map(t => (
          <button key={t.id} onClick={() => setView(t.id as any)} style={{
            padding:'10px 18px', fontSize:13, fontWeight: view===t.id ? 700 : 400,
            color: view===t.id ? '#F5F8FF' : '#878FA4',
            background:'none', border:'none', cursor:'pointer',
            borderBottom: view===t.id ? '2px solid #3F8FE0' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* New template modal */}
      {showNewTmpl && (
        <TemplateModal
          onClose={() => setShowNewTmpl(false)}
          onCreated={() => { refetchTemplates(); setShowNewTmpl(false); }}
        />
      )}

      {/* New campaign modal */}
      {showNew && (
        <div style={{ position:'fixed', inset:0, background:'#00000088', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#1C1F27', border:'1px solid #353947', borderRadius:12, padding:24, width:440 }}>
            <div style={{ fontWeight:700, color:'#F5F8FF', fontSize:16, marginBottom:16 }}>Create Campaign</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <div style={{ fontSize:12, color:'#878FA4', marginBottom:4, fontWeight:700 }}>Campaign Name</div>
                <input value={newCamp.name} onChange={e => setNewCamp(p => ({ ...p, name:e.target.value }))}
                  placeholder="e.g. April Re-Engagement" style={inp} />
              </div>
              <div>
                <div style={{ fontSize:12, color:'#878FA4', marginBottom:4, fontWeight:700 }}>Type</div>
                <select value={newCamp.type} onChange={e => setNewCamp(p => ({ ...p, type:e.target.value }))} style={sel}>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
              {newCamp.type === 'email' && (
                <div>
                  <div style={{ fontSize:12, color:'#878FA4', marginBottom:4, fontWeight:700 }}>
                    Email Template
                    <button onClick={() => { setShowNew(false); setShowNewTmpl(true); }}
                      style={{ marginLeft:8, padding:'2px 8px', borderRadius:4, border:'1px solid #3F8FE0', background:'rgba(63,143,224,.1)', color:'#60A9F0', fontSize:10, cursor:'pointer' }}>
                      + Create new template
                    </button>
                  </div>
                  <select value={newCamp.templateId} onChange={e => setNewCamp(p => ({ ...p, templateId:e.target.value }))} style={sel}>
                    <option value="">Select a template…</option>
                    {(templates ?? []).map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name ?? t.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:20 }}>
              <Btn disabled={!newCamp.name || createCampaign.isPending}
                onClick={() => createCampaign.mutate(newCamp)}>
                {createCampaign.isPending ? 'Creating…' : 'Create Campaign'}
              </Btn>
              <Btn variant="secondary" onClick={() => setShowNew(false)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Campaign detail modal */}
      {selected && detail && (
        <div style={{ position:'fixed', inset:0, background:'#00000088', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#1C1F27', border:'1px solid #353947', borderRadius:12, padding:24, width:560, maxHeight:'80vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <div>
                <div style={{ fontSize:16, fontWeight:700, color:'#F5F8FF', marginBottom:6 }}>{detail.name}</div>
                <StatusBadge status={detail.status} />
              </div>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'#878FA4', fontSize:22, cursor:'pointer' }}>×</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
              {[
                { l:'Sent',         v:detail.sendStats?.total_sends  ?? 0, c:'#CCD2E3' },
                { l:'Delivered',    v:detail.sendStats?.delivered    ?? 0, c:'#CCD2E3' },
                { l:'Opened',       v:detail.sendStats?.opened       ?? 0, c:'#38BA82' },
                { l:'Clicked',      v:detail.sendStats?.clicked      ?? 0, c:'#3F8FE0' },
                { l:'Bounced',      v:detail.sendStats?.bounced      ?? 0, c:'#EB5454' },
                { l:'Unsubscribed', v:detail.sendStats?.unsubscribed ?? 0, c:'#F5B326' },
              ].map(s => (
                <div key={s.l} style={{ padding:10, background:'#252931', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'#4F5669' }}>{s.l}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:s.c }}>{s.v}</div>
                </div>
              ))}
            </div>
            {detail.status === 'draft' && (
              <div style={{ padding:12, background:'#123B26', border:'1px solid #38BA8244', borderRadius:8 }}>
                <div style={{ fontSize:13, color:'#38BA82', fontWeight:600, marginBottom:4 }}>Ready to Launch</div>
                <div style={{ fontSize:12, color:'#9CAABF', marginBottom:10 }}>
                  This will queue emails to all subscribed contacts who have not unsubscribed.
                </div>
                <Btn onClick={() => launchCampaign.mutate(detail.id)} disabled={launchCampaign.isPending}>
                  {launchCampaign.isPending ? 'Launching…' : '🚀 Launch Campaign'}
                </Btn>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {view === 'campaigns' && (
        <Card>
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            {['','draft','scheduled','running','completed','cancelled'].map(s => (
              <button key={s} onClick={() => { setStatus(s); setPage(1); }} style={{
                padding:'4px 12px', borderRadius:5, fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid',
                background: status===s ? '#3F8FE0' : '#252931',
                color: status===s ? '#fff' : '#878FA4',
                borderColor: status===s ? '#3F8FE0' : '#353947',
              }}>{s || 'All'}</button>
            ))}
          </div>
          {isLoading
            ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
            : <>
                <Table columns={campaignColumns} data={data?.campaigns ?? []} />
                {data && <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} />}
              </>}
        </Card>
      )}

      {view === 'templates' && (
        <Card>
          {!templates?.length
            ? <Empty icon="📧" message="No email templates yet" sub="Click '+ New Template' above to create your first one" />
            : <Table columns={templateColumns} data={templates ?? []} />}
        </Card>
      )}
    </>
  );
}
