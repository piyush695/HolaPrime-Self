import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, Card, Table, Pagination, StatCard,
  Input, Select, Btn, Spinner, Badge, Empty,
} from '../../components/ui.js';

const SOURCE_OPTIONS = [
  'organic','paid_search','paid_social','affiliate','referral','direct','email','whatsapp','partner',
].map(s => ({ value:s, label:s.replace(/_/g,' ') }));

const STATUS_OPTIONS = [
  'new','contacted','qualified','demo_scheduled','converted','lost',
].map(s => ({ value:s, label:s.replace(/_/g,' ') }));

const STATUS_COL: Record<string,string> = {
  new:'blue', contacted:'teal', qualified:'purple',
  demo_scheduled:'gold', converted:'green', lost:'default',
};

export default function CRM() {
  const [page,   setPage]   = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [noteBody, setNoteBody] = useState('');
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['crm-stats'],
    queryFn:  () => api.get('/crm/stats').then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['crm-contacts', page, search, status, source],
    queryFn:  () => api.get('/crm/contacts', { params:{ page, limit:25, search, status, source } }).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const { data: detail } = useQuery({
    queryKey:  ['crm-contact', selected?.id],
    queryFn:   () => selected ? api.get(`/crm/contacts/${selected.id}`).then(r => r.data) : null,
    enabled:   !!selected,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, s }: { id:string; s:string }) =>
      api.patch(`/crm/contacts/${id}/status`, { status: s }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['crm-contacts'] }); qc.invalidateQueries({ queryKey:['crm-stats'] }); },
  });

  const addNote = useMutation({
    mutationFn: ({ id, body }: { id:string; body:string }) =>
      api.post(`/crm/contacts/${id}/notes`, { body }),
    onSuccess: () => { qc.invalidateQueries({ queryKey:['crm-contact', selected?.id] }); setNoteBody(''); },
  });

  const columns = [
    {
      key:'contact', label:'Contact',
      render: (r: any) => (
        <div>
          <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.first_name} {r.last_name}</div>
          <div style={{ fontSize:11, color:'#4F5669' }}>{r.email}</div>
          {r.phone && <div style={{ fontSize:11, color:'#4F5669' }}>{r.phone}</div>}
        </div>
      ),
    },
    { key:'source', label:'Source', width:120,
      render: (r: any) => <Badge label={r.source} variant="blue" /> },
    { key:'status', label:'Stage', width:140,
      render: (r: any) => <Badge label={r.status.replace(/_/g,' ')} variant={STATUS_COL[r.status] as any ?? 'default'} /> },
    { key:'score', label:'Score', width:70,
      render: (r: any) => (
        <span style={{ fontWeight:700, color: r.score>=70?'#EB5454':r.score>=40?'#F5B326':'#38BA82', fontSize:14 }}>
          {r.score}
        </span>
      ),
    },
    { key:'user_status', label:'KYC', width:100,
      render: (r: any) => r.kyc_status
        ? <Badge label={r.kyc_status} variant={r.kyc_status==='approved'?'green':r.kyc_status==='rejected'?'red':'gold'} />
        : <span style={{ color:'#4F5669', fontSize:11 }}>—</span>
    },
    { key:'activity_count', label:'Activities', width:90,
      render: (r: any) => <span style={{ color:'#878FA4' }}>{r.activity_count}</span> },
    { key:'created_at', label:'Added', width:110,
      render: (r: any) => <span style={{ color:'#878FA4', fontSize:11 }}>{new Date(r.created_at).toLocaleDateString()}</span> },
  ];

  return (
    <>
      <PageHeader title="CRM" sub="Lead pipeline and contact management" />

      {/* Funnel stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Total Leads"   value={stats?.stats?.total_contacts  ?? '—'} />
        <StatCard label="New"           value={stats?.stats?.new_leads       ?? '—'} color="#3F8FE0" />
        <StatCard label="Qualified"     value={stats?.stats?.qualified       ?? '—'} color="#8B5CF6" />
        <StatCard label="Hot (score≥70)" value={stats?.stats?.hot_leads      ?? '—'} color="#EB5454" />
        <StatCard label="Converted"     value={stats?.stats?.converted       ?? '—'} color="#38BA82" />
        <StatCard label="Avg Score"     value={stats?.stats?.avg_score       ?? '—'} color="#F5B326" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap:16 }}>
        <Card>
          {/* Filters */}
          <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
            <Input placeholder="Search name, email, phone…" value={search}
              onChange={v => { setSearch(v); setPage(1); }} style={{ flex:1, minWidth:180 }} />
            <Select value={status} onChange={v => { setStatus(v); setPage(1); }}
              options={STATUS_OPTIONS} placeholder="All stages" style={{ width:150 }} />
            <Select value={source} onChange={v => { setSource(v); setPage(1); }}
              options={SOURCE_OPTIONS} placeholder="All sources" style={{ width:140 }} />
          </div>

          {isLoading
            ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
            : <>
                <Table columns={columns} data={data?.contacts ?? []} onRowClick={setSelected} />
                {data && <Pagination page={data.page} pages={data.pages} total={data.total} limit={data.limit} onChange={setPage} />}
              </>
          }
        </Card>

        {/* Contact detail panel */}
        {selected && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <Card style={{ position:'sticky', top:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                <span style={{ fontWeight:700, color:'#F5F8FF' }}>Contact Detail</span>
                <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'#878FA4', fontSize:18, cursor:'pointer' }}>×</button>
              </div>

              {detail && (
                <>
                  <div style={{ padding:'12px', background:'#252931', borderRadius:8, marginBottom:12 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:'#F5F8FF' }}>
                      {detail.first_name} {detail.last_name}
                    </div>
                    <div style={{ fontSize:12, color:'#878FA4', marginTop:2 }}>{detail.email}</div>
                    {detail.phone && <div style={{ fontSize:12, color:'#878FA4' }}>{detail.phone}</div>}
                    <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                      <Badge label={detail.source} variant="blue" />
                      <Badge label={detail.status.replace(/_/g,' ')} variant={STATUS_COL[detail.status] as any ?? 'default'} />
                      <span style={{ fontSize:13, fontWeight:700, color: detail.score>=70?'#EB5454':detail.score>=40?'#F5B326':'#38BA82' }}>
                        Score: {detail.score}
                      </span>
                    </div>
                  </div>

                  {/* Quick stats */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
                    {[
                      { l:'Accounts',   v:detail.account_count ?? 0 },
                      { l:'Total Spent', v:detail.total_spent ? `$${parseFloat(detail.total_spent).toFixed(0)}` : '$0' },
                      { l:'KYC',        v:detail.kyc_status ?? 'N/A' },
                      { l:'Activities', v:detail.activities?.length ?? 0 },
                    ].map(s => (
                      <div key={s.l} style={{ padding:'8px 10px', background:'#252931', borderRadius:6 }}>
                        <div style={{ fontSize:10, color:'#4F5669' }}>{s.l}</div>
                        <div style={{ fontSize:13, fontWeight:600, color:'#CCD2E3' }}>{s.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Stage change */}
                  <Select
                    value={detail.status}
                    onChange={v => updateStatus.mutate({ id: detail.id, s: v })}
                    options={STATUS_OPTIONS}
                    style={{ width:'100%', marginBottom:12 }}
                  />

                  {/* Add note */}
                  <div style={{ marginBottom:12 }}>
                    <textarea
                      value={noteBody}
                      onChange={e => setNoteBody(e.target.value)}
                      placeholder="Add a note…"
                      rows={2}
                      style={{ width:'100%', background:'#252931', color:'#F5F8FF', border:'1px solid #353947', borderRadius:6, padding:'8px', fontSize:12, resize:'vertical', marginBottom:6 }}
                    />
                    <Btn size="sm" variant="primary" disabled={noteBody.length < 2}
                      onClick={() => addNote.mutate({ id: detail.id, body: noteBody })}>
                      Add Note
                    </Btn>
                  </div>

                  {/* Activity feed */}
                  <div style={{ fontSize:11, fontWeight:700, color:'#4F5669', letterSpacing:'0.06em', marginBottom:8 }}>
                    RECENT ACTIVITY
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:260, overflowY:'auto' }}>
                    {(detail.activities ?? []).slice(0, 20).map((a: any) => (
                      <div key={a.id} style={{ padding:'7px 10px', background:'#252931', borderRadius:6 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                          <span style={{ fontSize:11, fontWeight:600, color: a.type==='note'?'#3F8FE0':a.type==='status_change'?'#F5B326':'#878FA4' }}>
                            {a.type.replace(/_/g,' ')}
                          </span>
                          <span style={{ fontSize:10, color:'#4F5669' }}>{new Date(a.created_at).toLocaleDateString()}</span>
                        </div>
                        {a.body && <div style={{ fontSize:11, color:'#CCD2E3', lineHeight:1.4 }}>{a.body}</div>}
                      </div>
                    ))}
                    {(detail.activities ?? []).length === 0 && <Empty icon="📋" message="No activities yet" />}
                  </div>
                </>
              )}
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
