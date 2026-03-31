import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

const C = {
  bg:'#0F1117', surf:'#161B27', surf2:'#1C2333', bord:'#252D3D',
  blue:'#3F8FE0', blueL:'#60A9F0', white:'#F5F8FF', txtA:'#D8E0F0',
  txtB:'#8892B0', txtC:'#4F5669', green:'#38BA82', red:'#FF4C6A',
  gold:'#F5B326', purple:'#A78BFA',
};

const fmt$ = (v: any) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v)||0);
const fmtN = (v: any) => new Intl.NumberFormat('en-US').format(Number(v)||0);
const fmtPct = (v: any) => `${(Number(v)||0).toFixed(1)}%`;
const pctChange = (cur: number, prev: number) => prev === 0 ? 0 : ((cur - prev) / prev * 100);

function KPICard({ label, value, prev, format = 'number', color = C.blue }: any) {
  const cur = Number(value) || 0;
  const p = Number(prev) || 0;
  const chg = pctChange(cur, p);
  const up = chg >= 0;
  const fmt = format === 'currency' ? fmt$ : format === 'pct' ? fmtPct : fmtN;
  return (
    <div style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 11, color: C.txtC, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color }}>{ format === 'currency' ? fmt$(cur) : format === 'pct' ? fmtPct(cur) : fmtN(cur)}</div>
      {p > 0 && (
        <div style={{ fontSize: 12, color: up ? C.green : C.red, marginTop: 6, fontWeight: 700 }}>
          {up ? '▲' : '▼'} {Math.abs(chg).toFixed(1)}% vs prev period
        </div>
      )}
    </div>
  );
}

function Tabs({ tabs, active, onChange }: any) {
  return (
    <div style={{ display: 'flex', gap: 4, background: C.surf2, borderRadius: 10, padding: 4, marginBottom: 24, flexWrap: 'wrap' }}>
      {tabs.map((t: any) => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
          background: active === t.id ? C.blue : 'transparent',
          color: active === t.id ? '#fff' : C.txtB, transition: 'all .15s',
        }}>{t.label}</button>
      ))}
    </div>
  );
}

function CohortHeatmap({ data, metric, maxVal }: any) {
  if (!data?.length) return <div style={{ color: C.txtC, padding: 40, textAlign: 'center' }}>No cohort data yet</div>;
  const cols = ['Cohort','Users','M0','M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11'];
  const metricKey = metric === 'revenue' ? '_revenue' : '_users';
  const baseKey = metric === 'revenue' ? 'm0_revenue' : 'm0_users';

  function cellBg(val: number, base: number) {
    if (!val || !base) return C.surf2;
    const ratio = val / base;
    if (metric === 'revenue') {
      if (ratio >= 0.5) return '#0D3B2B'; if (ratio >= 0.25) return '#0D2B1A'; return '#1C2333';
    }
    if (ratio >= 0.5) return '#0D3B2B'; if (ratio >= 0.3) return '#362A0A'; if (ratio >= 0.1) return '#3D1313'; return '#1C2333';
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>{cols.map(c => (
            <th key={c} style={{ padding: '8px 10px', textAlign: c === 'Cohort' ? 'left' : 'right',
              color: C.txtC, fontWeight: 700, borderBottom: `1px solid ${C.bord}`, whiteSpace: 'nowrap' }}>{c}</th>
          ))}</tr>
        </thead>
        <tbody>
          {data.map((row: any) => {
            const base = Number(row[baseKey]) || 1;
            return (
              <tr key={row.cohort} style={{ borderBottom: `1px solid ${C.bord}` }}>
                <td style={{ padding: '8px 10px', color: C.white, fontWeight: 700 }}>{row.cohort}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: C.txtA }}>{fmtN(row.cohort_size)}</td>
                {Array.from({ length: 12 }, (_, i) => {
                  const val = Number(row[`m${i}${metricKey}`]) || 0;
                  return (
                    <td key={i} style={{ padding: '6px 10px', textAlign: 'right',
                      background: cellBg(val, base), borderRadius: 4,
                      color: val > 0 ? (metric === 'revenue' ? C.green : C.blueL) : C.txtC }}>
                      {val > 0 ? (metric === 'revenue' ? fmt$(val) : fmtN(val)) : '—'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NewUserCohort({ data, days }: any) {
  const [metric, setMetric] = useState<'purchasers'|'revenue'>('purchasers');
  if (!data?.length) return <div style={{ color: C.txtC, padding: 40, textAlign: 'center' }}>No new user data yet</div>;

  const shownDays = Math.min(days, 14);

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['purchasers','revenue'] as const).map(m => (
          <button key={m} onClick={() => setMetric(m)} style={{
            padding: '6px 14px', borderRadius: 20, border: `1px solid ${metric === m ? C.blue : C.bord}`,
            background: metric === m ? 'rgba(63,143,224,.15)' : 'transparent',
            color: metric === m ? C.blueL : C.txtB, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>{m === 'purchasers' ? 'Purchasers' : 'Revenue'}</button>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 10px', textAlign: 'left', color: C.txtC, fontWeight: 700, borderBottom: `1px solid ${C.bord}` }}>Date</th>
              <th style={{ padding: '8px 10px', textAlign: 'right', color: C.txtC, fontWeight: 700, borderBottom: `1px solid ${C.bord}` }}>New Users</th>
              {Array.from({ length: shownDays + 1 }, (_, d) => (
                <th key={d} style={{ padding: '8px 10px', textAlign: 'right', color: C.txtC, fontWeight: 700, borderBottom: `1px solid ${C.bord}` }}>D{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 30).map((row: any) => (
              <tr key={row.cohort_date} style={{ borderBottom: `1px solid ${C.bord}` }}>
                <td style={{ padding: '8px 10px', color: C.white, fontWeight: 700 }}>
                  {new Date(row.cohort_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right', color: C.txtA }}>{fmtN(row.new_users)}</td>
                {Array.from({ length: shownDays + 1 }, (_, d) => {
                  const val = Number(row[`d${d}_${metric}`]) || 0;
                  const base = Number(row.new_users) || 1;
                  const ratio = metric === 'purchasers' ? val / base : val / (Number(row.d0_revenue) || 1);
                  let bg = C.surf2;
                  if (val > 0) {
                    if (ratio >= 0.5) bg = '#0D3B2B';
                    else if (ratio >= 0.2) bg = '#362A0A';
                    else bg = '#1C2333';
                  }
                  return (
                    <td key={d} style={{ padding: '6px 10px', textAlign: 'right', background: bg, borderRadius: 4,
                      color: val > 0 ? (metric === 'revenue' ? C.green : C.blueL) : C.txtC }}>
                      {val > 0 ? (metric === 'revenue' ? fmt$(val) : fmtN(val)) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RepeatActivity({ period }: { period: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['repeat-activity', period],
    queryFn: () => api.get(`/retention/repeat-activity?period=${period}&periods=30`).then(r => r.data),
  });
  const { data: cmp } = useQuery({
    queryKey: ['period-comparison', period],
    queryFn: () => api.get(`/retention/period-comparison?period=${period}`).then(r => r.data),
  });

  if (isLoading) return <div style={{ color: C.txtC, padding: 40, textAlign: 'center' }}>Loading…</div>;
  const rows = data?.rows ?? [];
  const cur = cmp?.current ?? {};
  const prev = cmp?.previous ?? {};

  const periodLabel = period === 'weekly' ? 'WoW' : period === 'monthly' ? 'MoM' : 'DoD';

  return (
    <div>
      {/* Period comparison KPIs */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 12, color: C.txtC, marginBottom: 12, fontWeight: 700 }}>
          {periodLabel} COMPARISON — Current vs Previous {period === 'daily' ? 'Day' : period === 'weekly' ? 'Week' : 'Month'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
          <KPICard label="Users" value={cur.users} prev={prev.users} color={C.blue} />
          <KPICard label="Orders" value={cur.orders} prev={prev.orders} color={C.purple} />
          <KPICard label="Revenue" value={cur.revenue} prev={prev.revenue} format="currency" color={C.green} />
          <KPICard label="AOV" value={cur.aov} prev={prev.aov} format="currency" color={C.gold} />
          <KPICard label="ARPU" value={cur.arpu ?? (Number(cur.revenue||0)/Math.max(Number(cur.users||1),1))} prev={Number(prev.revenue||0)/Math.max(Number(prev.users||1),1)} format="currency" color={C.blueL} />
        </div>
      </div>

      {/* Trend table */}
      <div style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.bord}`, background: C.surf2 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.txtB, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Monthly'} Activity Trend
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.surf2 }}>
                {['Period','Users','Repeat Users','Repeat Rate','Orders','Revenue','AOV','ARPU'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Period' ? 'left' : 'right',
                    color: C.txtC, fontWeight: 700, borderBottom: `1px solid ${C.bord}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any, i: number) => {
                const prev = rows[i + 1];
                const revChg = prev ? pctChange(Number(row.revenue), Number(prev.revenue)) : 0;
                return (
                  <tr key={String(row.period)} style={{ borderBottom: `1px solid ${C.bord}` }}>
                    <td style={{ padding: '10px 14px', color: C.white, fontWeight: 700 }}>
                      {period === 'daily'
                        ? new Date(row.period).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })
                        : period === 'weekly'
                        ? `W${new Date(row.period).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}`
                        : new Date(row.period).toLocaleDateString('en-GB', { month:'short', year:'numeric' })}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: C.txtA }}>{fmtN(row.users)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: C.blueL }}>{fmtN(row.repeat_users)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <span style={{ color: Number(row.repeat_rate) >= 30 ? C.green : Number(row.repeat_rate) >= 10 ? C.gold : C.red, fontWeight: 700 }}>
                        {fmtPct(row.repeat_rate)}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: C.txtA }}>{fmtN(row.orders)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <span style={{ color: C.green, fontWeight: 700 }}>{fmt$(row.revenue)}</span>
                      {prev && revChg !== 0 && (
                        <span style={{ fontSize: 10, color: revChg > 0 ? C.green : C.red, marginLeft: 6 }}>
                          {revChg > 0 ? '▲' : '▼'}{Math.abs(revChg).toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: C.gold }}>{fmt$(row.aov)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: C.purple }}>{fmt$(row.arpu)}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: C.txtC }}>No activity data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Retention() {
  const [tab, setTab] = useState<'overview'|'dod'|'wow'|'mom'|'new-users'|'revenue-cohort'|'churn'|'winback'>('overview');
  const [cohortMetric, setCohortMetric] = useState<'revenue'|'users'>('revenue');
  const [newUserDays, setNewUserDays] = useState('14');
  // queryClient available if needed for cache invalidation

  const { data: stats } = useQuery({
    queryKey: ['retention-stats'],
    queryFn: () => api.get('/retention/stats').then(r => r.data),
  });

  const { data: revCohort, isLoading: revLoading } = useQuery({
    queryKey: ['revenue-cohort'],
    queryFn: () => api.get('/retention/revenue-cohort').then(r => r.data),
    enabled: tab === 'revenue-cohort',
  });

  const { data: newUserData, isLoading: newLoading } = useQuery({
    queryKey: ['new-user-cohort', newUserDays],
    queryFn: () => api.get(`/retention/new-user-cohort?days=${newUserDays}`).then(r => r.data),
    enabled: tab === 'new-users',
  });

  const { data: churnRisk } = useQuery({
    queryKey: ['churn-risk'],
    queryFn: () => api.get('/retention/churn-risk').then(r => r.data),
    enabled: tab === 'churn',
  });

  const { data: winback } = useQuery({
    queryKey: ['win-back'],
    queryFn: () => api.get('/retention/win-back').then(r => r.data),
    enabled: tab === 'winback',
  });

  const rebuild = useMutation({ mutationFn: () => api.post('/retention/rebuild-cohorts') });

  const s = stats?.stats?.[0] ?? {};
  const funnelData = stats?.conversionRates?.[0] ?? {};
  const FUNNEL = [
    { key: 'registrations', label: 'Registered', color: C.blue },
    { key: 'purchased_challenge', label: 'Purchased', color: C.purple },
    { key: 'passed_challenge', label: 'Passed', color: C.gold },
    { key: 'funded', label: 'Funded', color: C.green },
  ];

  const RISK_COLOR: Record<string, string> = { high: C.red, medium: C.gold, low: C.green };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 4 }}>Retention & Cohort Analysis</h1>
          <p style={{ fontSize: 13, color: C.txtB }}>Track trader activity, repeat behaviour, and revenue cohorts across every time dimension.</p>
        </div>
        <button onClick={() => rebuild.mutate()} disabled={rebuild.isPending}
          style={{ padding: '8px 18px', borderRadius: 8, border: `1px solid ${C.bord}`, background: C.surf2,
            color: C.txtA, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {rebuild.isPending ? '⟳ Rebuilding…' : '⟳ Rebuild Cohorts'}
        </button>
      </div>

      {/* Overview KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Active Traders', val: s.total_active_traders, color: C.blue },
          { label: 'Active Last 7 Days', val: s.active_last_7d, color: C.green },
          { label: 'Active Last 30 Days', val: s.active_last_30d, color: C.gold },
          { label: 'No Active Account', val: s.no_active_account, color: C.red },
        ].map(k => (
          <div key={k.label} style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: C.txtC, marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: k.color }}>{fmtN(k.val ?? 0)}</div>
          </div>
        ))}
      </div>

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: '📊 Overview Funnel' },
          { id: 'dod', label: '📅 Day-on-Day' },
          { id: 'wow', label: '📆 Week-on-Week' },
          { id: 'mom', label: '🗓️ Month-on-Month' },
          { id: 'new-users', label: '🆕 New User D0→D30' },
          { id: 'revenue-cohort', label: '💰 Revenue Cohort' },
          { id: 'churn', label: '⚠️ Churn Risk' },
          { id: 'winback', label: '🔄 Win-back' },
        ]}
      />

      {/* Overview funnel */}
      {tab === 'overview' && (
        <div>
          <div style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.txtB, marginBottom: 20 }}>90-DAY LIFECYCLE FUNNEL</div>
            {FUNNEL.map((stage, i) => {
              const val = Number(funnelData[stage.key]) || 0;
              const total = Number(funnelData.registrations) || 1;
              const pct = (val / total * 100).toFixed(1);
              const barW = val / total * 100;
              return (
                <div key={stage.key} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.white }}>
                      {i + 1}. {stage.label}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: stage.color }}>
                      {fmtN(val)} <span style={{ color: C.txtC, fontWeight: 400 }}>({pct}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 8, background: C.surf2, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barW}%`, background: stage.color, borderRadius: 4, transition: 'width .5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DoD / WoW / MoM */}
      {tab === 'dod' && <RepeatActivity period="daily" />}
      {tab === 'wow' && <RepeatActivity period="weekly" />}
      {tab === 'mom' && <RepeatActivity period="monthly" />}

      {/* New User Cohort D0→D30 */}
      {tab === 'new-users' && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: C.txtB, fontWeight: 700 }}>Days to track:</div>
            {['7','14','30'].map(d => (
              <button key={d} onClick={() => setNewUserDays(d)} style={{
                padding: '6px 16px', borderRadius: 20, border: `1px solid ${newUserDays === d ? C.blue : C.bord}`,
                background: newUserDays === d ? 'rgba(63,143,224,.15)' : 'transparent',
                color: newUserDays === d ? C.blueL : C.txtB, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>D{d}</button>
            ))}
          </div>
          <div style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 12, color: C.txtB, marginBottom: 16, fontWeight: 700 }}>
              NEW USER COHORT — First activity from D0 (registration day) through D{newUserDays}
            </div>
            {newLoading
              ? <div style={{ color: C.txtC, padding: 40, textAlign: 'center' }}>Loading…</div>
              : <NewUserCohort data={newUserData?.rows} days={parseInt(newUserDays)} />}
          </div>
        </div>
      )}

      {/* Revenue Cohort Heatmap */}
      {tab === 'revenue-cohort' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['revenue','users'] as const).map(m => (
              <button key={m} onClick={() => setCohortMetric(m)} style={{
                padding: '6px 16px', borderRadius: 20, border: `1px solid ${cohortMetric === m ? C.blue : C.bord}`,
                background: cohortMetric === m ? 'rgba(63,143,224,.15)' : 'transparent',
                color: cohortMetric === m ? C.blueL : C.txtB, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>{m === 'revenue' ? '💰 Revenue' : '👤 Users'}</button>
            ))}
          </div>
          <div style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 12, color: C.txtB, marginBottom: 16, fontWeight: 700 }}>
              REVENUE COHORT HEATMAP — M0 through M11 by registration month
            </div>
            {revLoading
              ? <div style={{ color: C.txtC, padding: 40, textAlign: 'center' }}>Loading…</div>
              : <CohortHeatmap data={revCohort?.rows} metric={cohortMetric} />}
          </div>
        </div>
      )}

      {/* Churn Risk */}
      {tab === 'churn' && (
        <div style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.bord}`, background: C.surf2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>Churn Risk — Active Traders Inactive 7+ Days</div>
            <div style={{ fontSize: 12, color: C.txtC }}>{churnRisk?.length ?? 0} traders at risk</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.surf2 }}>
                {['Trader','Platform','Account Size','Return %','Last Active','Days Inactive','Risk'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Trader' ? 'left' : 'right', color: C.txtC, fontWeight: 700, borderBottom: `1px solid ${C.bord}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(churnRisk ?? []).map((r: any) => (
                <tr key={r.account_id} style={{ borderBottom: `1px solid ${C.bord}` }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 700, color: C.white }}>{r.first_name} {r.last_name}</div>
                    <div style={{ fontSize: 11, color: C.txtC }}>{r.email}</div>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: C.blueL }}>{r.platform}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: C.gold, fontWeight: 700 }}>{fmt$(r.account_size)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <span style={{ color: Number(r.return_pct) >= 0 ? C.green : C.red, fontWeight: 700 }}>
                      {Number(r.return_pct) >= 0 ? '+' : ''}{Number(r.return_pct || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: C.txtA }}>
                    {r.last_active_date ? new Date(r.last_active_date).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: C.txtA, fontWeight: 700 }}>{r.days_inactive}d</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                      background: `${RISK_COLOR[r.churn_risk]}18`, color: RISK_COLOR[r.churn_risk],
                      border: `1px solid ${RISK_COLOR[r.churn_risk]}44` }}>
                      {r.churn_risk?.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
              {!churnRisk?.length && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: C.txtC }}>No traders at churn risk right now</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Win-back */}
      {tab === 'winback' && (
        <div style={{ background: C.surf, border: `1px solid ${C.bord}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.bord}`, background: C.surf2, display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>Win-back Candidates — Lapsed in Last 180 Days</div>
            <div style={{ fontSize: 12, color: C.txtC }}>{winback?.length ?? 0} candidates</div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.surf2 }}>
                {['Trader','Country','Total Accounts','Passed','Breached','Last Account','Days Since'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Trader' || h === 'Country' ? 'left' : 'right', color: C.txtC, fontWeight: 700, borderBottom: `1px solid ${C.bord}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(winback ?? []).map((r: any) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${C.bord}` }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 700, color: C.white }}>{r.first_name} {r.last_name}</div>
                    <div style={{ fontSize: 11, color: C.txtC }}>{r.email}</div>
                  </td>
                  <td style={{ padding: '10px 14px', color: C.txtA }}>{r.country_code}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: C.txtA }}>{r.total_accounts}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: C.green, fontWeight: 700 }}>{r.passed_accounts}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: C.red }}>{r.breached_accounts}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: C.txtA }}>
                    {r.last_account_date ? new Date(r.last_account_date).toLocaleDateString('en-GB') : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: C.gold, fontWeight: 700 }}>{r.days_since_last_account}d</td>
                </tr>
              ))}
              {!winback?.length && (
                <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: C.txtC }}>No win-back candidates right now</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
