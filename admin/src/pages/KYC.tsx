import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  PageHeader, Card, Table, Pagination, StatusBadge,
  StatCard, Select, Btn, Spinner, Badge,
} from '../components/ui.js';

export default function KYC() {
  const [page,   setPage]   = useState(1);
  const [status, setStatus] = useState('pending');
  const [selected, setSelected] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['kyc-stats'],
    queryFn:  () => api.get('/kyc/stats').then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['kyc-queue', page, status],
    queryFn:  () => api.get('/kyc/queue', { params:{ page, limit:20, status } }).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['kyc-detail', selected?.id],
    queryFn:  () => selected ? api.get(`/kyc/${selected.id}`).then(r => r.data) : null,
    enabled:  !!selected,
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/kyc/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['kyc-queue'] });
      qc.invalidateQueries({ queryKey:['kyc-stats'] });
      setSelected(null);
    },
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id:string; reason:string }) =>
      api.post(`/kyc/${id}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['kyc-queue'] });
      qc.invalidateQueries({ queryKey:['kyc-stats'] });
      setSelected(null); setShowReject(false); setRejectReason('');
    },
  });

  const getDocUrl = async (submissionId: string, docId: string) => {
    const { data } = await api.get(`/kyc/${submissionId}/documents/${docId}/url`);
    window.open(data.url, '_blank');
  };

  const columns = [
    {
      key:'user', label:'Trader',
      render: (r: any) => (
        <div>
          <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.first_name} {r.last_name}</div>
          <div style={{ fontSize:11, color:'#4F5669' }}>{r.email}</div>
        </div>
      ),
    },
    { key:'country_code', label:'Country', width:80 },
    { key:'doc_count', label:'Docs', width:60,
      render: (r: any) => <Badge label={r.doc_count} variant="blue" /> },
    { key:'status', label:'Status', width:130, render: (r: any) => <StatusBadge status={r.status} /> },
    { key:'created_at', label:'Submitted', width:130,
      render: (r: any) => <span style={{ color:'#878FA4', fontSize:12 }}>{new Date(r.created_at).toLocaleString()}</span> },
    { key:'review', label:'', width:80,
      render: (r: any) => (
        <Btn size="sm" onClick={() => setSelected(r)}>Review</Btn>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="KYC Review" sub="Identity verification queue" />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Total"       value={stats?.total       ?? '—'} />
        <StatCard label="Pending"     value={stats?.pending     ?? '—'} color="#F5B326" />
        <StatCard label="Under Review" value={stats?.under_review ?? '—'} color="#3F8FE0" />
        <StatCard label="Approved"    value={stats?.approved    ?? '—'} color="#38BA82" />
        <StatCard label="Rejected"    value={stats?.rejected    ?? '—'} color="#EB5454" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap:16 }}>
        <Card>
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            {['pending','under_review','approved','rejected'].map(s => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(1); }}
                style={{
                  padding:'5px 12px', borderRadius:5, fontSize:12, fontWeight:600,
                  cursor:'pointer', border:'1px solid',
                  background: status === s ? '#3F8FE0' : '#252931',
                  color:      status === s ? '#fff' : '#878FA4',
                  borderColor: status === s ? '#3F8FE0' : '#353947',
                }}
              >
                {s.replace(/_/g,' ')}
              </button>
            ))}
          </div>
          {isLoading
            ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
            : <>
                <Table columns={columns} data={data?.submissions ?? []}
                  onRowClick={setSelected} />
                {data && (
                  <Pagination page={data.page} pages={data.pages}
                    total={data.total} limit={data.limit} onChange={setPage} />
                )}
              </>
          }
        </Card>

        {/* Detail panel */}
        {selected && (
          <Card style={{ position:'sticky', top:0, height:'fit-content', maxHeight:'calc(100vh - 120px)', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <span style={{ fontWeight:700, color:'#F5F8FF' }}>Submission Review</span>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'#878FA4', fontSize:18, cursor:'pointer' }}>×</button>
            </div>

            {detailLoading ? <Spinner /> : detail && (
              <>
                {/* Trader info */}
                <div style={{ padding:'12px', background:'#252931', borderRadius:8, marginBottom:14 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'#F5F8FF', marginBottom:4 }}>
                    {detail.first_name} {detail.last_name}
                  </div>
                  <div style={{ fontSize:12, color:'#878FA4' }}>{detail.email}</div>
                  <div style={{ fontSize:12, color:'#878FA4', marginTop:2 }}>
                    {detail.country_code} · DOB: {detail.date_of_birth ?? '—'}
                  </div>
                  <div style={{ marginTop:8 }}>
                    <StatusBadge status={detail.status} />
                  </div>
                </div>

                {/* Documents */}
                <div style={{ fontSize:12, fontWeight:700, color:'#4F5669', letterSpacing:'0.06em', marginBottom:8 }}>
                  DOCUMENTS ({detail.documents?.length ?? 0})
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                  {detail.documents?.map((doc: any) => (
                    <div key={doc.id} style={{
                      padding:'8px 12px', background:'#252931', borderRadius:6,
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      border:'1px solid #353947',
                    }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, color:'#CCD2E3' }}>
                          {doc.doc_type.replace(/_/g,' ')}
                        </div>
                        <div style={{ fontSize:11, color:'#4F5669' }}>
                          {doc.file_name} · {(doc.file_size/1024).toFixed(0)}KB
                        </div>
                      </div>
                      <Btn size="sm" variant="secondary"
                        onClick={() => getDocUrl(detail.id, doc.id)}>
                        View 🔗
                      </Btn>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                {(detail.status === 'pending' || detail.status === 'under_review') && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {showReject ? (
                      <>
                        <textarea
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          placeholder="Rejection reason (shown to trader)…"
                          rows={3}
                          style={{
                            width:'100%', background:'#252931', color:'#F5F8FF',
                            border:'1px solid #353947', borderRadius:6,
                            padding:'8px', fontSize:12, resize:'vertical',
                          }}
                        />
                        <div style={{ display:'flex', gap:8 }}>
                          <Btn variant="danger" onClick={() => reject.mutate({ id:detail.id, reason:rejectReason })}
                            disabled={rejectReason.length < 10 || reject.isPending}>
                            Confirm Reject
                          </Btn>
                          <Btn variant="secondary" onClick={() => setShowReject(false)}>Cancel</Btn>
                        </div>
                      </>
                    ) : (
                      <div style={{ display:'flex', gap:8 }}>
                        <Btn variant="primary" onClick={() => approve.mutate(detail.id)}
                          disabled={approve.isPending} style={{ flex:1 }}>
                          ✓ Approve
                        </Btn>
                        <Btn variant="danger" onClick={() => setShowReject(true)} style={{ flex:1 }}>
                          ✗ Reject
                        </Btn>
                      </div>
                    )}
                  </div>
                )}

                {detail.rejection_reason && (
                  <div style={{ marginTop:12, padding:'10px', background:'#3D1313', borderRadius:6, border:'1px solid #EB545433' }}>
                    <div style={{ fontSize:11, color:'#EB5454', fontWeight:700 }}>REJECTION REASON</div>
                    <div style={{ fontSize:12, color:'#CCD2E3', marginTop:4 }}>{detail.rejection_reason}</div>
                  </div>
                )}
              </>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
