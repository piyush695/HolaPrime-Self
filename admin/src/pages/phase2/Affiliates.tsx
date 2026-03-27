import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, Card, CardHeader, Table, Pagination, StatCard,
  Input, Select, Btn, Spinner, Badge, Empty,
} from '../../components/ui.js';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(v);

const TOOLTIP_STYLE = {
  background:'#1C1F27', border:'1px solid #353947',
  borderRadius:6, fontSize:12, color:'#CCD2E3',
};

export default function Affiliates() {
  const [page,   setPage]   = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [selected, setSelected] = useState<any>(null);
  const [newLink, setNewLink] = useState({ name:'', url:'', campaign:'' });
  const [showNewAff, setShowNewAff] = useState(false);
  const [newAff, setNewAff] = useState({ email:'', firstName:'', lastName:'', company:'', commissionValue:'20' });
  const [createdLink, setCreatedLink] = useState<any>(null);
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['aff-stats'],
    queryFn:  () => api.get('/affiliates/stats').then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['affiliates', page, search, status],
    queryFn:  () => api.get('/affiliates', { params:{ page, limit:25, search, status } }).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const { data: detail } = useQuery({
    queryKey: ['affiliate-detail', selected?.id],
    queryFn:  () => selected ? api.get(`/affiliates/${selected.id}`).then(r => r.data) : null,
    enabled:  !!selected,
  });

  const createAffiliate = useMutation({
    mutationFn: (data: typeof newAff) =>
      api.post('/affiliates', {
        email:           data.email,
        firstName:       data.firstName,
        lastName:        data.lastName,
        company:         data.company,
        commissionType:  'percentage',
        commissionValue: parseFloat(data.commissionValue),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['affiliates'] });
      qc.invalidateQueries({ queryKey:['aff-stats'] });
      setShowNewAff(false);
      setNewAff({ email:'', firstName:'', lastName:'', company:'', commissionValue:'20' });
    },
  });

  const createLink = useMutation({
    mutationFn: ({ id, ...data }: { id:string; name:string; destinationUrl:string; utmCampaign?:string }) =>
      api.post(`/affiliates/${id}/links`, data),
    onSuccess: (res: any) => {
      setCreatedLink(res.data);
      qc.invalidateQueries({ queryKey:['affiliate-detail', selected?.id] });
    },
  });

  const columns = [
    {
      key: 'name', label: 'Affiliate',
      render: (r: any) => (
        <div>
          <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.first_name} {r.last_name}</div>
          <div style={{ fontSize:11, color:'#4F5669' }}>{r.email}</div>
          {r.company && <div style={{ fontSize:11, color:'#4F5669' }}>{r.company}</div>}
        </div>
      ),
    },
    { key:'code', label:'Code', width:120,
      render: (r: any) => (
        <code style={{ fontSize:12, background:'#252931', padding:'3px 7px', borderRadius:4, color:'#3F8FE0' }}>
          {r.code}
        </code>
      ),
    },
    { key:'commission', label:'Commission', width:120,
      render: (r: any) => (
        <span style={{ color:'#F5B326', fontWeight:600 }}>
          {r.commission_value}{r.commission_type === 'percentage' ? '%' : ' USD'}
        </span>
      ),
    },
    { key:'total_clicks', label:'Clicks', width:80,
      render: (r: any) => <span style={{ color:'#878FA4' }}>{(r.total_clicks ?? 0).toLocaleString()}</span> },
    { key:'total_referrals', label:'Referrals', width:90,
      render: (r: any) => <span style={{ color:'#CCD2E3', fontWeight:600 }}>{r.total_referrals}</span> },
    { key:'total_earned', label:'Earned', width:100,
      render: (r: any) => <span style={{ color:'#38BA82', fontWeight:700 }}>{fmt$(parseFloat(r.total_earned ?? '0'))}</span> },
    { key:'pending_balance', label:'Pending', width:100,
      render: (r: any) => <span style={{ color:'#8B5CF6', fontWeight:700 }}>{fmt$(parseFloat(r.pending_balance ?? '0'))}</span> },
    { key:'status', label:'Status', width:90,
      render: (r: any) => <Badge label={r.status} variant={r.status === 'active' ? 'green' : 'default'} /> },
  ];

  return (
    <>
      <PageHeader
        title="Affiliates"
        sub="Partner tracking, link generation, and commission management"
        action={<Btn onClick={() => setShowNewAff(true)}>+ New Affiliate</Btn>}
      />

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Total Affiliates"   value={stats?.stats?.total_affiliates ?? '—'} />
        <StatCard label="Active"             value={stats?.stats?.active           ?? '—'} color="#38BA82" />
        <StatCard label="Total Referrals"    value={stats?.stats?.total_referrals  ?? '—'} color="#3F8FE0" />
        <StatCard label="Commissions Earned" value={stats?.stats?.total_commissions ? fmt$(parseFloat(stats.stats.total_commissions)) : '—'} color="#F5B326" />
        <StatCard label="Pending Payout"     value={stats?.stats?.pending_balance  ? fmt$(parseFloat(stats.stats.pending_balance)) : '—'} color="#8B5CF6" />
      </div>

      {/* New affiliate modal */}
      {showNewAff && (
        <div style={{ position:'fixed', inset:0, background:'#00000088', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#1C1F27', border:'1px solid #353947', borderRadius:12, padding:24, width:440 }}>
            <div style={{ fontWeight:700, color:'#F5F8FF', marginBottom:16 }}>Add New Affiliate</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[
                { key:'firstName', label:'First Name' },
                { key:'lastName',  label:'Last Name' },
                { key:'email',     label:'Email' },
                { key:'company',   label:'Company (optional)' },
                { key:'commissionValue', label:'Commission %' },
              ].map(f => (
                <div key={f.key}>
                  <div style={{ fontSize:12, color:'#878FA4', marginBottom:4 }}>{f.label}</div>
                  <Input
                    value={(newAff as any)[f.key]}
                    onChange={v => setNewAff(p => ({ ...p, [f.key]: v }))}
                    style={{ width:'100%' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <Btn variant="primary"
                disabled={!newAff.email || !newAff.firstName || createAffiliate.isPending}
                onClick={() => createAffiliate.mutate(newAff)}>
                Create Affiliate
              </Btn>
              <Btn variant="secondary" onClick={() => setShowNewAff(false)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      {/* Created link modal */}
      {createdLink && (
        <div style={{ position:'fixed', inset:0, background:'#00000088', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#1C1F27', border:'1px solid #353947', borderRadius:12, padding:24, width:480 }}>
            <div style={{ fontWeight:700, color:'#38BA82', marginBottom:8 }}>✓ Link Created</div>
            <div style={{ padding:'10px 14px', background:'#252931', borderRadius:6, marginBottom:16 }}>
              <code style={{ fontSize:12, color:'#3F8FE0', wordBreak:'break-all' }}>{createdLink.fullUrl}</code>
            </div>
            <div style={{ fontSize:12, color:'#878FA4', marginBottom:16 }}>
              Copy this link and give it to your affiliate. All clicks and conversions will be tracked automatically.
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <Btn variant="primary" onClick={() => { navigator.clipboard.writeText(createdLink.fullUrl); }}>Copy URL</Btn>
              <Btn variant="secondary" onClick={() => setCreatedLink(null)}>Close</Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap:16 }}>
        <Card>
          <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
            <Input placeholder="Search name, email, code…" value={search}
              onChange={v => { setSearch(v); setPage(1); }} style={{ flex:1, minWidth:160 }} />
            <Select value={status} onChange={v => { setStatus(v); setPage(1); }}
              options={['active','pending','suspended','terminated'].map(s => ({ value:s, label:s }))}
              placeholder="All statuses" style={{ width:140 }} />
          </div>
          {isLoading
            ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
            : <>
                <Table columns={columns} data={data?.affiliates ?? []} onRowClick={setSelected} />
                {data && <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} />}
              </>
          }
        </Card>

        {/* Affiliate detail panel */}
        {selected && detail && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <Card>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:'#F5F8FF' }}>{detail.first_name} {detail.last_name}</div>
                  <div style={{ fontSize:12, color:'#878FA4' }}>{detail.email}</div>
                  <code style={{ fontSize:11, background:'#252931', padding:'2px 6px', borderRadius:4, color:'#3F8FE0', marginTop:4, display:'inline-block' }}>{detail.code}</code>
                </div>
                <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'#878FA4', fontSize:18, cursor:'pointer' }}>×</button>
              </div>

              {/* Quick stats */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                {[
                  { l:'Referrals',   v:detail.total_referrals, c:'#CCD2E3' },
                  { l:'Earned',      v:fmt$(parseFloat(detail.total_earned ?? '0')), c:'#38BA82' },
                  { l:'Paid Out',    v:fmt$(parseFloat(detail.total_paid ?? '0')), c:'#878FA4' },
                  { l:'Pending',     v:fmt$(parseFloat(detail.pending_balance ?? '0')), c:'#8B5CF6' },
                ].map(s => (
                  <div key={s.l} style={{ padding:'8px 10px', background:'#252931', borderRadius:6 }}>
                    <div style={{ fontSize:10, color:'#4F5669' }}>{s.l}</div>
                    <div style={{ fontSize:14, fontWeight:700, color:s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>

              {/* Click trend */}
              {detail.clickTrend?.length > 0 && (
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, color:'#4F5669', marginBottom:6 }}>CLICKS — LAST 30 DAYS</div>
                  <ResponsiveContainer width="100%" height={80}>
                    <AreaChart data={detail.clickTrend} margin={{ top:0, right:0, left:0, bottom:0 }}>
                      <Area type="monotone" dataKey="clicks" stroke="#3F8FE0" fill="#162F4F" strokeWidth={1.5} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Links */}
              <div style={{ fontSize:11, fontWeight:700, color:'#4F5669', letterSpacing:'0.06em', marginBottom:8 }}>
                TRACKING LINKS ({detail.links?.length ?? 0})
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
                {(detail.links ?? []).map((l: any) => (
                  <div key={l.id} style={{ padding:'8px 10px', background:'#252931', borderRadius:6, border:'1px solid #353947' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'#CCD2E3' }}>{l.name}</span>
                      <div style={{ display:'flex', gap:8, fontSize:11, color:'#878FA4' }}>
                        <span>👆 {l.clicks}</span>
                        <span>✓ {l.conversions}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:10, color:'#4F5669', marginTop:2, fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      /ref/{l.slug}
                    </div>
                  </div>
                ))}
              </div>

              {/* Generate new link */}
              <div style={{ fontSize:11, fontWeight:700, color:'#4F5669', letterSpacing:'0.06em', marginBottom:8 }}>GENERATE LINK</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <Input placeholder="Link name (e.g. Instagram Bio)" value={newLink.name}
                  onChange={v => setNewLink(p => ({ ...p, name:v }))} style={{ width:'100%' }} />
                <Input placeholder="Destination URL" value={newLink.url}
                  onChange={v => setNewLink(p => ({ ...p, url:v }))} style={{ width:'100%' }} />
                <Input placeholder="UTM Campaign (optional)" value={newLink.campaign}
                  onChange={v => setNewLink(p => ({ ...p, campaign:v }))} style={{ width:'100%' }} />
                <Btn variant="primary" size="sm"
                  disabled={!newLink.name || !newLink.url || createLink.isPending}
                  onClick={() => createLink.mutate({
                    id: selected.id,
                    name: newLink.name,
                    destinationUrl: newLink.url,
                    utmCampaign: newLink.campaign || undefined,
                  })}>
                  Generate Tracking Link
                </Btn>
              </div>
            </Card>

            {/* Recent conversions */}
            <Card>
              <CardHeader title="Recent Conversions" />
              {detail.recentConversions?.length === 0
                ? <Empty icon="🔗" message="No conversions yet" />
                : detail.recentConversions?.slice(0, 8).map((c: any) => (
                  <div key={c.id} style={{ padding:'7px 0', borderBottom:'1px solid #35394722', display:'flex', justifyContent:'space-between' }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:'#F5F8FF' }}>{c.first_name} {c.last_name}</div>
                      <div style={{ fontSize:11, color:'#4F5669' }}>{c.email}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#38BA82' }}>{fmt$(parseFloat(c.commission))}</div>
                      <div style={{ fontSize:10, color:'#4F5669' }}>{new Date(c.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))
              }
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
