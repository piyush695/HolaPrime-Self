import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  PageHeader, Card, Table, Pagination, StatusBadge,
  Select, Btn, Spinner, Badge,
} from '../components/ui.js';

const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:2 }).format(v);

export default function Payouts() {
  const [page,   setPage]   = useState(1);
  const [status, setStatus] = useState('pending');
  const [rejectId, setRejectId] = useState<string|null>(null);
  const [reason,   setReason]   = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['payout-requests', page, status],
    queryFn:  () => api.get('/payments/payouts', { params:{ page, limit:25, status } }).then(r => r.data),
    placeholderData: (prev) => prev,
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/payments/payouts/${id}/approve`),
    onSuccess:  () => qc.invalidateQueries({ queryKey:['payout-requests'] }),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id:string; reason:string }) =>
      api.post(`/payments/payouts/${id}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['payout-requests'] });
      setRejectId(null); setReason('');
    },
  });

  const columns = [
    {
      key:'trader', label:'Trader',
      render: (r: any) => (
        <div>
          <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.first_name} {r.last_name}</div>
          <div style={{ fontSize:11, color:'#4F5669' }}>{r.email}</div>
        </div>
      ),
    },
    { key:'platform', label:'Platform', width:110,
      render: (r: any) => <Badge label={r.platform} variant="blue" /> },
    { key:'period', label:'Period', width:160,
      render: (r: any) => (
        <span style={{ color:'#878FA4', fontSize:12 }}>
          {new Date(r.period_start).toLocaleDateString()} → {new Date(r.period_end).toLocaleDateString()}
        </span>
      ),
    },
    { key:'amount', label:'Amount', width:100,
      render: (r: any) => <span style={{ fontWeight:700, color:'#8B5CF6' }}>{fmt$(parseFloat(r.amount))}</span> },
    { key:'trader_amount', label:'Trader Gets', width:110,
      render: (r: any) => (
        <div>
          <div style={{ fontWeight:700, color:'#38BA82' }}>{fmt$(parseFloat(r.trader_amount))}</div>
          <div style={{ fontSize:10, color:'#4F5669' }}>{r.profit_split_pct}% split</div>
        </div>
      ),
    },
    { key:'method', label:'Method', width:120,
      render: (r: any) => <span style={{ color:'#CCD2E3', textTransform:'capitalize' }}>{r.withdrawal_method?.replace(/_/g,' ')}</span> },
    { key:'status', label:'Status', width:110, render: (r: any) => <StatusBadge status={r.status} /> },
    {
      key:'actions', label:'', width:160,
      render: (r: any) => r.status === 'pending' ? (
        <div style={{ display:'flex', gap:6 }}>
          <Btn size="sm" variant="primary"
            onClick={() => approve.mutate(r.id)}
            disabled={approve.isPending}>
            ✓ Approve
          </Btn>
          <Btn size="sm" variant="danger"
            onClick={() => { setRejectId(r.id); setReason(''); }}>
            ✗
          </Btn>
        </div>
      ) : null,
    },
  ];

  return (
    <>
      <PageHeader title="Payout Requests" sub="Trader withdrawal and profit-share requests" />

      {/* Reject modal */}
      {rejectId && (
        <div style={{
          position:'fixed', inset:0, background:'#00000088', zIndex:100,
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <div style={{
            background:'#1C1F27', border:'1px solid #353947',
            borderRadius:12, padding:24, width:420,
          }}>
            <div style={{ fontWeight:700, color:'#F5F8FF', marginBottom:12 }}>Reject Payout Request</div>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Reason for rejection (visible to trader)…"
              rows={4}
              style={{
                width:'100%', background:'#252931', color:'#F5F8FF',
                border:'1px solid #353947', borderRadius:6,
                padding:'8px', fontSize:13, resize:'vertical', marginBottom:12,
              }}
            />
            <div style={{ display:'flex', gap:8 }}>
              <Btn variant="danger"
                onClick={() => reject.mutate({ id:rejectId, reason })}
                disabled={reason.length < 5 || reject.isPending}>
                Confirm Rejection
              </Btn>
              <Btn variant="secondary" onClick={() => setRejectId(null)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      <Card>
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          {['pending','approved','processing','paid','rejected','on_hold'].map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(1); }} style={{
              padding:'5px 12px', borderRadius:5, fontSize:12, fontWeight:600,
              cursor:'pointer', border:'1px solid',
              background: status===s ? '#3F8FE0' : '#252931',
              color:      status===s ? '#fff' : '#878FA4',
              borderColor: status===s ? '#3F8FE0' : '#353947',
            }}>{s.replace(/_/g,' ')}</button>
          ))}
        </div>
        {isLoading
          ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
          : <>
              <Table columns={columns} data={data?.requests ?? []} />
              {data && (
                <Pagination page={data.page} pages={data.pages}
                  total={data.total} limit={data.limit} onChange={setPage} />
              )}
            </>
        }
      </Card>
    </>
  );
}
