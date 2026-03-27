import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, Card, CardHeader, Table, StatCard, Btn, Select, Spinner, StatusBadge, Empty,
} from '../../components/ui.js';

const REPORT_TYPES = [
  { value:'revenue',    label:'Revenue Report' },
  { value:'users',      label:'User Acquisition Report' },
  { value:'risk',       label:'Risk & Breaches Report' },
  { value:'affiliates', label:'Affiliate Performance Report' },
];

const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(v);

function RevenuePreview({ data }: { data: any }) {
  const s = data.summary;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
        <StatCard label="Total Fees"      value={s?.total_fees    ? fmt$(parseFloat(s.total_fees))    : '$0'} color="#38BA82" />
        <StatCard label="Total Payouts"   value={s?.total_payouts ? fmt$(parseFloat(s.total_payouts)) : '$0'} color="#8B5CF6" />
        <StatCard label="Total Refunds"   value={s?.total_refunds ? fmt$(parseFloat(s.total_refunds)) : '$0'} color="#EB5454" />
        <StatCard label="Transactions"    value={s?.total_transactions ?? '0'} />
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr style={{ borderBottom:'1px solid #353947' }}>
              {['Date','Type','Method','Transactions','Amount','Fees','Payouts'].map(h=>(
                <th key={h} style={{ padding:'6px 10px', color:'#4F5669', fontWeight:700, textAlign:'left' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data.rows ?? []).slice(0,20).map((r: any, i: number) => (
              <tr key={i} style={{ borderBottom:'1px solid #35394722' }}>
                <td style={{ padding:'6px 10px', color:'#878FA4' }}>{r.date}</td>
                <td style={{ padding:'6px 10px', color:'#CCD2E3' }}>{r.type?.replace(/_/g,' ')}</td>
                <td style={{ padding:'6px 10px', color:'#878FA4' }}>{r.method}</td>
                <td style={{ padding:'6px 10px', color:'#CCD2E3' }}>{r.transactions}</td>
                <td style={{ padding:'6px 10px', color:'#38BA82', fontWeight:600 }}>{fmt$(parseFloat(r.total_amount ?? '0'))}</td>
                <td style={{ padding:'6px 10px', color:'#F5B326' }}>{fmt$(parseFloat(r.fees ?? '0'))}</td>
                <td style={{ padding:'6px 10px', color:'#8B5CF6' }}>{fmt$(parseFloat(r.payouts ?? '0'))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserPreview({ data }: { data: any }) {
  return (
    <div>
      <div style={{ fontSize:13, fontWeight:700, color:'#F5F8FF', marginBottom:10 }}>Top Countries</div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
        {(data.topCountries ?? []).slice(0,10).map((c:any) => (
          <div key={c.country_code} style={{ padding:'6px 12px', background:'#252931', borderRadius:6, border:'1px solid #353947' }}>
            <span style={{ fontSize:12, color:'#CCD2E3', fontWeight:600 }}>{c.country_code}</span>
            <span style={{ fontSize:12, color:'#878FA4', marginLeft:6 }}>{c.users}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Reports() {
  const [type,   setType]   = useState('revenue');
  const [from,   setFrom]   = useState(() => new Date(Date.now() - 30*86400000).toISOString().split('T')[0]);
  const [to,     setTo]     = useState(() => new Date().toISOString().split('T')[0]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const { data: definitions } = useQuery({
    queryKey: ['report-definitions'],
    queryFn:  () => api.get('/reports/definitions').then(r => r.data),
  });

  const { data: runs } = useQuery({
    queryKey: ['report-runs'],
    queryFn:  () => api.get('/reports/runs').then(r => r.data),
  });

  const runReport = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/generate', { params:{ type, from, to, format:'json' } });
      setResult({ type, data: res.data });
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = async () => {
    const res = await api.get('/reports/generate', {
      params: { type, from, to, format:'csv' },
      responseType: 'blob',
    });
    const url  = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href  = url;
    link.download = `${type}-report-${from}-${to}.csv`;
    link.click();
  };

  const runCols = [
    { key:'report_name', label:'Report', render:(r:any) => <span style={{ color:'#F5F8FF', fontWeight:600 }}>{r.report_name ?? 'Ad-hoc'}</span> },
    { key:'status',      label:'Status',   width:110, render:(r:any) => <StatusBadge status={r.status} /> },
    { key:'row_count',   label:'Rows',     width:80,  render:(r:any) => <span style={{ color:'#878FA4' }}>{r.row_count ?? '—'}</span> },
    { key:'created_at',  label:'Run At',   width:140, render:(r:any) => <span style={{ color:'#878FA4', fontSize:11 }}>{new Date(r.created_at).toLocaleString()}</span> },
    { key:'duration',    label:'Duration', width:90,
      render:(r:any) => {
        if (!r.started_at || !r.completed_at) return <span style={{ color:'#4F5669' }}>—</span>;
        const ms = new Date(r.completed_at).getTime() - new Date(r.started_at).getTime();
        return <span style={{ color:'#878FA4' }}>{(ms/1000).toFixed(1)}s</span>;
      },
    },
  ];

  return (
    <>
      <PageHeader title="Reports" sub="Generate, download, and schedule business reports" />

      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:16 }}>
        {/* Report builder */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <Card>
            <CardHeader title="Generate Report" />
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div>
                <div style={{ fontSize:11, color:'#878FA4', marginBottom:4 }}>Report Type</div>
                <Select value={type} onChange={setType} options={REPORT_TYPES} style={{ width:'100%' }} />
              </div>
              <div>
                <div style={{ fontSize:11, color:'#878FA4', marginBottom:4 }}>From</div>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                  style={{ width:'100%', background:'#252931', color:'#F5F8FF', border:'1px solid #353947', borderRadius:6, padding:'7px 10px', fontSize:13, outline:'none' }} />
              </div>
              <div>
                <div style={{ fontSize:11, color:'#878FA4', marginBottom:4 }}>To</div>
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                  style={{ width:'100%', background:'#252931', color:'#F5F8FF', border:'1px solid #353947', borderRadius:6, padding:'7px 10px', fontSize:13, outline:'none' }} />
              </div>
              <Btn variant="primary" onClick={runReport} disabled={loading} style={{ width:'100%' }}>
                {loading ? 'Generating…' : '▶ Run Report'}
              </Btn>
              <Btn variant="secondary" onClick={downloadCSV} style={{ width:'100%' }}>
                ⬇ Download CSV
              </Btn>
            </div>
          </Card>

          <Card>
            <CardHeader title="Recent Runs" />
            {!runs ? <Spinner /> : (runs ?? []).length === 0
              ? <Empty icon="📊" message="No runs yet" />
              : <Table columns={runCols} data={(runs ?? []).slice(0,8)} />
            }
          </Card>
        </div>

        {/* Report preview */}
        <Card>
          {!result ? (
            <Empty icon="📊" message="Select a report type and click Run" sub="Results will appear here" />
          ) : (
            <>
              <CardHeader
                title={REPORT_TYPES.find(t => t.value === result.type)?.label ?? 'Report'}
                sub={`${from} → ${to}`}
              />
              {result.type === 'revenue'    && <RevenuePreview data={result.data} />}
              {result.type === 'users'      && <UserPreview    data={result.data} />}
              {result.type === 'risk'       && (
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#F5F8FF', marginBottom:8 }}>Breach Summary</div>
                  <Table
                    columns={[
                      { key:'breach_type', label:'Breach Type', render:(r:any) => <span style={{ color:'#EB5454' }}>{r.breach_type?.replace(/_/g,' ')}</span> },
                      { key:'count', label:'Count', width:80 },
                      { key:'total_notional', label:'Total Notional', width:130, render:(r:any) => <span style={{ color:'#F5B326' }}>{fmt$(parseFloat(r.total_notional ?? '0'))}</span> },
                    ]}
                    data={result.data.breach_summary ?? []}
                  />
                </div>
              )}
              {result.type === 'affiliates' && (
                <Table
                  columns={[
                    { key:'name', label:'Affiliate', render:(r:any) => <span style={{ color:'#F5F8FF', fontWeight:600 }}>{r.first_name} {r.last_name}</span> },
                    { key:'conversions', label:'Conversions', width:110 },
                    { key:'commissions_earned', label:'Commissions', width:120, render:(r:any) => <span style={{ color:'#38BA82', fontWeight:700 }}>{fmt$(parseFloat(r.commissions_earned ?? '0'))}</span> },
                    { key:'unique_referrals', label:'Referrals', width:90 },
                  ]}
                  data={result.data.rows ?? []}
                />
              )}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
