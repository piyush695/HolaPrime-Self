import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  PageHeader, Card, Table, Pagination, StatusBadge,
  StatCard, Select, Spinner,
} from '../components/ui.js';

const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:2 }).format(v);

export default function Payments() {
  const [page,   setPage]   = useState(1);
  const [status, setStatus] = useState('');
  const [type,   setType]   = useState('');

  const { data: stats } = useQuery({
    queryKey: ['payment-stats'],
    queryFn:  () => api.get('/payments/stats').then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['payments', page, status, type],
    queryFn:  () => api.get('/payments', { params:{ page, limit:25, status, type } }).then(r => r.data),
    placeholderData: (prev) => prev,
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
    { key:'type',   label:'Type',   width:130,
      render: (r: any) => <span style={{ color:'#CCD2E3', textTransform:'capitalize' }}>{r.type.replace(/_/g,' ')}</span> },
    { key:'amount', label:'Amount', width:120,
      render: (r: any) => (
        <span style={{ fontWeight:700, color: r.type==='payout'?'#8B5CF6':'#38BA82' }}>
          {r.type==='payout'?'-':'+'}{fmt$(parseFloat(r.amount))}
        </span>
      ),
    },
    { key:'method', label:'Method', width:120,
      render: (r: any) => <span style={{ color:'#878FA4', textTransform:'capitalize' }}>{r.method?.replace(/_/g,' ')}</span> },
    { key:'provider_reference', label:'Reference', width:160,
      render: (r: any) => <span style={{ fontFamily:'monospace', fontSize:11, color:'#878FA4' }}>{r.provider_reference ?? '—'}</span> },
    { key:'status', label:'Status', width:120, render:(r: any) => <StatusBadge status={r.status} /> },
    { key:'created_at', label:'Date', width:130,
      render: (r: any) => <span style={{ color:'#878FA4', fontSize:12 }}>{new Date(r.created_at).toLocaleString()}</span> },
  ];

  return (
    <>
      <PageHeader title="Payments" sub="All transactions across all payment methods" />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Total Revenue"    value={stats?.total_revenue ? fmt$(parseFloat(stats.total_revenue)) : '—'} color="#38BA82" />
        <StatCard label="Total Payouts"    value={stats?.total_payouts ? fmt$(parseFloat(stats.total_payouts)) : '—'} color="#8B5CF6" />
        <StatCard label="This Month"       value={stats?.revenue_this_month ? fmt$(parseFloat(stats.revenue_this_month)) : '—'} color="#F5B326" />
        <StatCard label="Pending"          value={stats?.pending_count ?? '—'} color="#EB5454" />
      </div>

      <Card>
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          <Select value={status} onChange={v => { setStatus(v); setPage(1); }}
            options={['pending','processing','completed','failed','refunded']
              .map(s => ({ value:s, label:s }))}
            placeholder="All statuses" style={{ width:150 }} />
          <Select value={type} onChange={v => { setType(v); setPage(1); }}
            options={['challenge_fee','payout','refund','adjustment']
              .map(t => ({ value:t, label:t.replace(/_/g,' ') }))}
            placeholder="All types" style={{ width:160 }} />
        </div>
        {isLoading
          ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
          : <>
              <Table columns={columns} data={data?.payments ?? []} />
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
