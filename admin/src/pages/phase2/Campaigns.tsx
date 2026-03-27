import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, Card, CardHeader, StatCard, Table,
  Pagination, Btn, Spinner, Badge, StatusBadge, Empty,
} from '../../components/ui.js';

const TYPE_COL: Record<string,string> = { email:'blue', whatsapp:'green', sms:'teal', push:'purple' };
const fmt = (n: number, d: number) => d > 0 ? (n/d*100).toFixed(1)+'%' : '—';

export default function Campaigns() {
  const [page,   setPage]   = useState(1);
  const [status, setStatus] = useState('');
  const [view,   setView]   = useState<'campaigns'|'templates'>('campaigns');
  const [selected, setSelected] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);
  const [newCamp, setNewCamp] = useState({ name:'', type:'email', templateId:'' });
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['campaign-stats'],
    queryFn:  () => api.get('/campaigns/stats').then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', page, status],
    queryFn:  () => api.get('/campaigns', { params:{ page, limit:25, status } }).then(r => r.data),
    placeholderData: (prev) => prev,
    enabled: view === 'campaigns',
  });

  const { data: templates } = useQuery({
    queryKey: ['email-templates'],
    queryFn:  () => api.get('/campaigns/templates').then(r => r.data),
    enabled: view === 'templates' || showNew,
  });

  const { data: detail } = useQuery({
    queryKey: ['campaign-detail', selected?.id],
    queryFn:  () => selected ? api.get(`/campaigns/${selected.id}`).then(r => r.data) : null,
    enabled:  !!selected,
  });

  const createCampaign = useMutation({
    mutationFn: (data: typeof newCamp) => api.post('/campaigns', data),
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
      alert(`Campaign launched! ${res.data.queued} sends queued.`);
    },
  });

  const campaignColumns = [
    {
      key:'name', label:'Campaign',
      render: (r: any) => (
        <div>
          <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.name}</div>
          {r.template_name && <div style={{ fontSize:11, color:'#4F5669' }}>{r.template_name}</div>}
        </div>
      ),
    },
    { key:'type', label:'Type', width:90,
      render: (r: any) => <Badge label={r.type} variant={TYPE_COL[r.type] as any ?? 'default'} /> },
    { key:'status', label:'Status', width:120, render: (r: any) => <StatusBadge status={r.status} /> },
    { key:'sent_count', label:'Sent', width:80,
      render: (r: any) => <span style={{ color:'#CCD2E3' }}>{parseInt(r.sent_count ?? '0').toLocaleString()}</span> },
    { key:'open_rate', label:'Open Rate', width:100,
      render: (r: any) => <span style={{ color:'#38BA82', fontWeight:600 }}>{fmt(parseInt(r.open_count ?? '0'), parseInt(r.sent_count ?? '0'))}</span> },
    { key:'click_rate', label:'Click Rate', width:100,
      render: (r: any) => <span style={{ color:'#3F8FE0', fontWeight:600 }}>{fmt(parseInt(r.click_count ?? '0'), parseInt(r.sent_count ?? '0'))}</span> },
    { key:'scheduled_at', label:'Scheduled', width:130,
      render: (r: any) => r.scheduled_at
        ? <span style={{ color:'#878FA4', fontSize:11 }}>{new Date(r.scheduled_at).toLocaleString()}</span>
        : <span style={{ color:'#4F5669', fontSize:11 }}>—</span> },
    { key:'actions', label:'', width:100,
      render: (r: any) => <Btn size="sm" onClick={() => setSelected(r)}>View</Btn> },
  ];

  const templateColumns = [
    { key:'name', label:'Template',
      render: (r: any) => (
        <div>
          <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.name}</div>
          <div style={{ fontSize:11, color:'#4F5669' }}>{r.subject}</div>
        </div>
      ),
    },
    { key:'category', label:'Category', width:120,
      render: (r: any) => <Badge label={r.category} variant="teal" /> },
    { key:'is_active', label:'Status', width:80,
      render: (r: any) => <Badge label={r.is_active ? 'active' : 'inactive'} variant={r.is_active ? 'green' : 'default'} /> },
    { key:'version', label:'Version', width:80,
      render: (r: any) => <span style={{ color:'#878FA4' }}>v{r.version}</span> },
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
            {view === 'templates' && <Btn variant="secondary">+ New Template</Btn>}
            {view === 'campaigns' && <Btn onClick={() => setShowNew(true)}>+ New Campaign</Btn>}
          </div>
        }
      />

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Total Campaigns" value={stats?.total_campaigns ?? '—'} />
        <StatCard label="Running"         value={stats?.running         ?? '—'} color="#38BA82" />
        <StatCard label="Total Sent"      value={stats?.total_sent ? parseInt(stats.total_sent).toLocaleString() : '—'} color="#3F8FE0" />
        <StatCard label="Total Opens"     value={stats?.total_opens ? parseInt(stats.total_opens).toLocaleString() : '—'} color="#F5B326" />
        <StatCard label="Avg Open Rate"   value={stats?.avg_open_rate ? stats.avg_open_rate + '%' : '—'} color="#8B5CF6" />
      </div>

      {/* Tab switcher */}
      <div style={{ display:'flex', gap:0, marginBottom:16, borderBottom:'1px solid #353947' }}>
        {[{ id:'campaigns', label:'Campaigns' }, { id:'templates', label:'Email Templates' }].map(t => (
          <button key={t.id} onClick={() => setView(t.id as any)} style={{
            padding:'10px 18px', fontSize:13, fontWeight: view===t.id ? 700 : 400,
            color: view===t.id ? '#F5F8FF' : '#878FA4',
            background:'none', border:'none', cursor:'pointer',
            borderBottom: view===t.id ? '2px solid #3F8FE0' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* New campaign modal */}
      {showNew && (
        <div style={{ position:'fixed', inset:0, background:'#00000088', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#1C1F27', border:'1px solid #353947', borderRadius:12, padding:24, width:440 }}>
            <div style={{ fontWeight:700, color:'#F5F8FF', marginBottom:16 }}>Create Campaign</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <div style={{ fontSize:12, color:'#878FA4', marginBottom:4 }}>Campaign Name</div>
                <input value={newCamp.name} onChange={e => setNewCamp(p => ({ ...p, name:e.target.value }))}
                  placeholder="e.g. April Re-Engagement"
                  style={{ width:'100%', background:'#252931', color:'#F5F8FF', border:'1px solid #353947', borderRadius:6, padding:'8px 10px', fontSize:13, outline:'none' }} />
              </div>
              <div>
                <div style={{ fontSize:12, color:'#878FA4', marginBottom:4 }}>Type</div>
                <select value={newCamp.type} onChange={e => setNewCamp(p => ({ ...p, type:e.target.value }))}
                  style={{ width:'100%', background:'#252931', color:'#F5F8FF', border:'1px solid #353947', borderRadius:6, padding:'8px 10px', fontSize:13, outline:'none' }}>
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>
              {newCamp.type === 'email' && (
                <div>
                  <div style={{ fontSize:12, color:'#878FA4', marginBottom:4 }}>Template</div>
                  <select value={newCamp.templateId} onChange={e => setNewCamp(p => ({ ...p, templateId:e.target.value }))}
                    style={{ width:'100%', background:'#252931', color:'#F5F8FF', border:'1px solid #353947', borderRadius:6, padding:'8px 10px', fontSize:13, outline:'none' }}>
                    <option value="">Select a template…</option>
                    {(templates ?? []).map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <Btn variant="primary"
                disabled={!newCamp.name || createCampaign.isPending}
                onClick={() => createCampaign.mutate(newCamp)}>
                Create Campaign
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
                <div style={{ fontSize:16, fontWeight:700, color:'#F5F8FF' }}>{detail.name}</div>
                <StatusBadge status={detail.status} />
              </div>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'#878FA4', fontSize:20, cursor:'pointer' }}>×</button>
            </div>

            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
              {[
                { l:'Sent',           v:detail.sendStats?.total_sends ?? 0, c:'#CCD2E3' },
                { l:'Delivered',      v:detail.sendStats?.delivered   ?? 0, c:'#CCD2E3' },
                { l:'Opened',         v:detail.sendStats?.opened      ?? 0, c:'#38BA82' },
                { l:'Clicked',        v:detail.sendStats?.clicked     ?? 0, c:'#3F8FE0' },
                { l:'Bounced',        v:detail.sendStats?.bounced     ?? 0, c:'#EB5454' },
                { l:'Unsubscribed',   v:detail.sendStats?.unsubscribed ?? 0, c:'#F5B326' },
              ].map(s => (
                <div key={s.l} style={{ padding:'10px', background:'#252931', borderRadius:6 }}>
                  <div style={{ fontSize:10, color:'#4F5669' }}>{s.l}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:s.c }}>{s.v}</div>
                </div>
              ))}
            </div>

            {detail.status === 'draft' && (
              <div style={{ padding:'12px', background:'#123B26', border:'1px solid #38BA8244', borderRadius:8, marginBottom:16 }}>
                <div style={{ fontSize:13, color:'#38BA82', fontWeight:600, marginBottom:4 }}>Ready to Launch</div>
                <div style={{ fontSize:12, color:'#9CAABF', marginBottom:10 }}>
                  This will queue emails to all subscribed contacts who are not unsubscribed.
                </div>
                <Btn variant="primary" onClick={() => launchCampaign.mutate(detail.id)} disabled={launchCampaign.isPending}>
                  {launchCampaign.isPending ? 'Launching…' : '🚀 Launch Campaign'}
                </Btn>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'campaigns' && (
        <Card>
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            {['','draft','scheduled','running','completed','cancelled'].map(s => (
              <button key={s} onClick={() => { setStatus(s); setPage(1); }} style={{
                padding:'4px 12px', borderRadius:5, fontSize:12, fontWeight:600,
                cursor:'pointer', border:'1px solid',
                background: status===s ? '#3F8FE0' : '#252931',
                color:      status===s ? '#fff' : '#878FA4',
                borderColor: status===s ? '#3F8FE0' : '#353947',
              }}>{s || 'All'}</button>
            ))}
          </div>
          {isLoading
            ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
            : <>
                <Table columns={campaignColumns} data={data?.campaigns ?? []} />
                {data && <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} />}
              </>
          }
        </Card>
      )}

      {view === 'templates' && (
        <Card>
          {!templates?.length
            ? <Empty icon="📧" message="No templates yet" sub="Create your first email template to start sending campaigns" />
            : <Table columns={templateColumns} data={templates ?? []} />
          }
        </Card>
      )}
    </>
  );
}
