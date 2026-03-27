import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, Card, CardHeader, StatCard, Table, Spinner, Badge, Btn,
} from '../../components/ui.js';

const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(v);

function pct(val: number | null, base: number): string {
  if (val === null || base === 0) return '—';
  return (val / base * 100).toFixed(0) + '%';
}

function retentionColor(val: number | null, base: number): string {
  if (val === null || base === 0) return '#252931';
  const p = val / base;
  if (p >= 0.6) return '#123B26';
  if (p >= 0.4) return '#362A0A';
  if (p >= 0.2) return '#3D1313';
  return '#2E3240';
}

export default function Retention() {
  const [tab, setTab] = useState<'overview'|'cohorts'|'churn'|'winback'>('overview');

  const { data: stats } = useQuery({
    queryKey: ['retention-stats'],
    queryFn:  () => api.get('/retention/stats').then(r => r.data),
  });

  const { data: cohorts, isLoading: cohortsLoading } = useQuery({
    queryKey: ['retention-cohorts'],
    queryFn:  () => api.get('/retention/cohorts').then(r => r.data),
    enabled:  tab === 'cohorts',
  });

  const { data: churnRisk, isLoading: churnLoading } = useQuery({
    queryKey: ['churn-risk'],
    queryFn:  () => api.get('/retention/churn-risk').then(r => r.data),
    enabled:  tab === 'churn',
  });

  const { data: winback, isLoading: winbackLoading } = useQuery({
    queryKey: ['win-back'],
    queryFn:  () => api.get('/retention/win-back').then(r => r.data),
    enabled:  tab === 'winback',
  });

  const rebuildCohorts = useMutation({
    mutationFn: () => api.post('/retention/rebuild-cohorts'),
  });

  const funnelData = stats?.conversionRates?.[0];

  const FUNNEL = [
    { key:'registrations',      label:'Registrations',      color:'#3F8FE0' },
    { key:'kyc_approved',       label:'KYC Approved',       color:'#14B8A6' },
    { key:'purchased_challenge',label:'Purchased Challenge', color:'#F5B326' },
    { key:'passed_challenge',   label:'Passed Challenge',   color:'#8B5CF6' },
    { key:'funded',             label:'Funded Account',     color:'#38BA82' },
  ];

  const churnColumns = [
    { key:'trader', label:'Trader',
      render: (r: any) => (
        <div>
          <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.first_name} {r.last_name}</div>
          <div style={{ fontSize:11, color:'#4F5669' }}>{r.email} · {r.country_code}</div>
        </div>
      ),
    },
    { key:'platform', label:'Platform', width:110, render: (r: any) => <Badge label={r.platform} variant="blue" /> },
    { key:'account_size', label:'Account', width:90,
      render: (r: any) => <span style={{ color:'#F5B326', fontWeight:600 }}>{fmt$(parseFloat(r.account_size))}</span> },
    { key:'return_pct', label:'Return', width:90,
      render: (r: any) => {
        const p = parseFloat(r.return_pct ?? '0');
        return <span style={{ color: p >= 0 ? '#38BA82' : '#EB5454', fontWeight:700 }}>{p >= 0 ? '+' : ''}{p.toFixed(1)}%</span>;
      },
    },
    { key:'days_inactive', label:'Days Inactive', width:110,
      render: (r: any) => <span style={{ color: parseInt(r.days_inactive) >= 30 ? '#EB5454' : '#F5B326', fontWeight:600 }}>{r.days_inactive}d</span> },
    { key:'churn_risk', label:'Risk', width:90,
      render: (r: any) => <Badge label={r.churn_risk} variant={r.churn_risk==='high'?'red':r.churn_risk==='medium'?'gold':'green'} /> },
    { key:'action', label:'', width:100,
      render: (_r: any) => <Btn size="sm" variant="secondary">Reach Out</Btn> },
  ];

  const winbackColumns = [
    { key:'trader', label:'Trader',
      render: (r: any) => (
        <div>
          <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.first_name} {r.last_name}</div>
          <div style={{ fontSize:11, color:'#4F5669' }}>{r.email}</div>
        </div>
      ),
    },
    { key:'total_accounts', label:'Total Accts', width:100,
      render: (r: any) => <span style={{ color:'#CCD2E3', fontWeight:600 }}>{r.total_accounts}</span> },
    { key:'passed_accounts', label:'Passed', width:80,
      render: (r: any) => <span style={{ color:'#38BA82' }}>{r.passed_accounts}</span> },
    { key:'breached_accounts', label:'Breached', width:90,
      render: (r: any) => <span style={{ color:'#EB5454' }}>{r.breached_accounts}</span> },
    { key:'days_since_last_account', label:'Days Inactive', width:110,
      render: (r: any) => <span style={{ color:'#F5B326', fontWeight:600 }}>{r.days_since_last_account}d</span> },
    { key:'action', label:'', width:100,
      render: (_r: any) => <Btn size="sm" variant="primary">Win Back</Btn> },
  ];

  return (
    <>
      <PageHeader
        title="Retention Analytics"
        sub="Cohort analysis, churn risk scoring, and win-back candidates"
        action={
          <Btn variant="secondary" onClick={() => rebuildCohorts.mutate()} disabled={rebuildCohorts.isPending}>
            {rebuildCohorts.isPending ? 'Rebuilding…' : '↻ Rebuild Cohorts'}
          </Btn>
        }
      />

      {/* Top stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Active Traders"   value={stats?.stats?.total_active_traders ?? '—'} color="#38BA82" />
        <StatCard label="Active Last 7d"   value={stats?.stats?.active_last_7d       ?? '—'} color="#3F8FE0" />
        <StatCard label="Active Last 30d"  value={stats?.stats?.active_last_30d      ?? '—'} color="#14B8A6" />
        <StatCard label="No Active Account" value={stats?.stats?.no_active_account   ?? '—'} color="#EB5454" />
      </div>

      {/* Tab nav */}
      <div style={{ display:'flex', gap:0, marginBottom:16, borderBottom:'1px solid #353947' }}>
        {[
          { id:'overview', label:'Overview & Funnel' },
          { id:'cohorts',  label:'Cohort Table' },
          { id:'churn',    label:'Churn Risk' },
          { id:'winback',  label:'Win-Back Candidates' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            padding:'10px 18px', fontSize:13, fontWeight: tab===t.id ? 700 : 400,
            color: tab===t.id ? '#F5F8FF' : '#878FA4',
            background:'none', border:'none', cursor:'pointer',
            borderBottom: tab===t.id ? '2px solid #3F8FE0' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <Card>
          <CardHeader title="Conversion Funnel" sub="Last 90 days — Registration to Funded Account" />
          {funnelData ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {FUNNEL.map((f, i) => {
                const val  = parseInt(funnelData[f.key] ?? '0');
                const base = parseInt(funnelData['registrations'] ?? '1');
                const prev = i > 0 ? parseInt(funnelData[FUNNEL[i-1].key] ?? '1') : base;
                const stepPct = prev > 0 ? (val / prev * 100).toFixed(0) : '—';
                return (
                  <div key={f.key}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:'#CCD2E3' }}>{f.label}</span>
                      <div style={{ display:'flex', gap:16 }}>
                        <span style={{ fontSize:13, fontWeight:700, color:f.color }}>{val.toLocaleString()}</span>
                        <span style={{ fontSize:12, color:'#878FA4' }}>{pct(val, base)} of all</span>
                        {i > 0 && <span style={{ fontSize:12, color:'#4F5669' }}>{stepPct}% from previous</span>}
                      </div>
                    </div>
                    <div style={{ height:8, background:'#252931', borderRadius:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', width: base > 0 ? `${val/base*100}%` : '0%', background:f.color, borderRadius:4, transition:'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <Spinner />}
        </Card>
      )}

      {/* Cohort table */}
      {tab === 'cohorts' && (
        <Card style={{ overflowX:'auto' }}>
          <CardHeader title="Monthly Retention Cohorts" sub="% of cohort still active at N months" />
          {cohortsLoading ? <Spinner /> : (
            <table style={{ borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid #353947' }}>
                  {['Cohort','Size','M0','M1','M2','M3','M6','M12'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', color:'#4F5669', fontWeight:700, textAlign:'center', letterSpacing:'0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(cohorts ?? []).map((c: any) => (
                  <tr key={c.cohort_month} style={{ borderBottom:'1px solid #35394722' }}>
                    <td style={{ padding:'8px 12px', fontWeight:600, color:'#CCD2E3', whiteSpace:'nowrap' }}>{c.cohort_month}</td>
                    <td style={{ padding:'8px 12px', textAlign:'center', color:'#878FA4' }}>{c.cohort_size}</td>
                    {[c.period_0, c.period_1, c.period_2, c.period_3, c.period_6, c.period_12].map((val: number | null, i: number) => (
                      <td key={i} style={{ padding:'8px 14px', textAlign:'center', background: retentionColor(val, c.cohort_size), borderRadius:4 }}>
                        <span style={{ fontWeight:600, color: val === null ? '#4F5669' : '#F5F8FF' }}>
                          {pct(val, c.cohort_size)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Churn risk */}
      {tab === 'churn' && (
        <Card>
          <CardHeader title="Churn Risk — Active Accounts" sub="Traders with active accounts who have not traded recently" />
          {churnLoading ? <Spinner /> : <Table columns={churnColumns} data={churnRisk ?? []} emptyMessage="No churn-risk accounts detected" />}
        </Card>
      )}

      {/* Win-back */}
      {tab === 'winback' && (
        <Card>
          <CardHeader title="Win-Back Candidates" sub="Previously active traders with no current active account in the last 30 days" />
          {winbackLoading ? <Spinner /> : <Table columns={winbackColumns} data={winback ?? []} emptyMessage="No win-back candidates found" />}
        </Card>
      )}
    </>
  );
}
