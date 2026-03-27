import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  PageHeader, Card, Table, Pagination, StatusBadge,
  StatCard, Input, Select, Badge, Spinner,
} from '../components/ui.js';

const PLATFORMS = ['mt5','ctrader','matchtrader','ninjatrader','tradovate'];

const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(v);

export default function Accounts() {
  const [page,     setPage]     = useState(1);
  const [status,   setStatus]   = useState('');
  const [platform, setPlatform] = useState('');
  const [phase,    setPhase]    = useState('');

  const { data: stats } = useQuery({
    queryKey: ['account-stats'],
    queryFn:  () => api.get('/challenges/accounts/stats').then(r => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['accounts', page, status, platform, phase],
    queryFn:  () => api.get('/challenges/accounts', {
      params: { page, limit:25, status, platform, phase },
    }).then(r => r.data),
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
    { key:'product_name', label:'Product', width:140,
      render: (r: any) => <span style={{ color:'#CCD2E3' }}>{r.product_name}</span> },
    { key:'platform', label:'Platform', width:110,
      render: (r: any) => <Badge label={r.platform} variant="blue" /> },
    { key:'phase', label:'Phase', width:110,
      render: (r: any) => <Badge label={r.phase} variant={r.phase==='funded'?'gold':r.phase==='verification'?'teal':'blue'} /> },
    { key:'account_size', label:'Size', width:90,
      render: (r: any) => <span style={{ color:'#F5B326', fontWeight:600 }}>{fmt$(parseFloat(r.account_size))}</span> },
    {
      key:'balance', label:'Balance / Return', width:160,
      render: (r: any) => {
        const bal = parseFloat(r.current_balance ?? r.starting_balance);
        const start = parseFloat(r.starting_balance);
        const pct   = start > 0 ? ((bal - start) / start * 100).toFixed(2) : '0.00';
        const pos   = parseFloat(pct) >= 0;
        return (
          <div>
            <div style={{ fontWeight:600, color:'#CCD2E3' }}>{fmt$(bal)}</div>
            <div style={{ fontSize:11, color: pos ? '#38BA82' : '#EB5454' }}>
              {pos ? '+' : ''}{pct}%
            </div>
          </div>
        );
      },
    },
    { key:'status', label:'Status', width:120,
      render: (r: any) => <StatusBadge status={r.status} /> },
    { key:'platform_account_id', label:'Login', width:100,
      render: (r: any) => <span style={{ fontFamily:'monospace', color:'#878FA4', fontSize:11 }}>{r.platform_account_id ?? '—'}</span> },
    { key:'created_at', label:'Created', width:110,
      render: (r: any) => <span style={{ color:'#878FA4', fontSize:11 }}>{new Date(r.created_at).toLocaleDateString()}</span> },
  ];

  return (
    <>
      <PageHeader title="Trading Accounts" sub="All challenge and funded accounts" />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Total"        value={stats?.total       ?? '—'} />
        <StatCard label="Active"       value={stats?.active      ?? '—'} color="#38BA82" />
        <StatCard label="Breached"     value={stats?.breached    ?? '—'} color="#EB5454" />
        <StatCard label="Funded"       value={stats?.funded      ?? '—'} color="#F5B326" />
        <StatCard label="Total Notional" value={stats?.total_notional ? fmt$(parseFloat(stats.total_notional)) : '—'} color="#8B5CF6" />
      </div>

      <Card>
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          <Select value={status}   onChange={v => { setStatus(v);   setPage(1); }}
            options={['active','pending','breached','passed','funded','failed','closed']
              .map(s => ({ value:s, label:s }))}
            placeholder="All statuses" style={{ width:140 }} />
          <Select value={platform} onChange={v => { setPlatform(v); setPage(1); }}
            options={PLATFORMS.map(p => ({ value:p, label:p }))}
            placeholder="All platforms" style={{ width:140 }} />
          <Select value={phase}    onChange={v => { setPhase(v);    setPage(1); }}
            options={['evaluation','verification','funded'].map(p => ({ value:p, label:p }))}
            placeholder="All phases" style={{ width:140 }} />
        </div>

        {isLoading
          ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
          : <>
              <Table columns={columns} data={data?.accounts ?? []} />
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
