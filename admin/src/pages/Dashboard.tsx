import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { api } from '../lib/api.js';
import { StatCard, Card, CardHeader, StatusBadge, Spinner } from '../components/ui.js';

const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(v);

const fmtN = (v: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits:0 }).format(v);

const TOOLTIP_STYLE = {
  background:'#1C1F27', border:'1px solid #353947',
  borderRadius:6, fontSize:12, color:'#CCD2E3',
};

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  () => api.get('/dashboard').then(r => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:400 }}>
      <Spinner size={32} />
    </div>
  );

  const d = data!;
  const u = d.users;
  const a = d.accounts;
  const p = d.payments;
  const r = d.risk;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Critical alert bar ─────────────────────────────────────────── */}
      {parseInt(r?.critical_events ?? '0') > 0 && (
        <div style={{
          padding:'10px 16px', background:'#3D1313',
          border:'1px solid #EB545444', borderRadius:8,
          display:'flex', alignItems:'center', gap:10, fontSize:13,
        }}>
          <span style={{ fontSize:18 }}>🚨</span>
          <span style={{ color:'#EB5454', fontWeight:700 }}>
            {r.critical_events} critical risk event{parseInt(r.critical_events)>1?'s':''} require attention
          </span>
          <a href="/risk" style={{ marginLeft:'auto', color:'#EB5454', fontSize:12 }}>
            View all →
          </a>
        </div>
      )}

      {/* ── Top stat row ───────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        <StatCard icon="👥" label="Total Users"       value={fmtN(parseInt(u?.total_users ?? '0'))}    sub={`+${u?.new_today ?? 0} today`}          color="#3F8FE0" />
        <StatCard icon="📊" label="Active Accounts"   value={fmtN(parseInt(a?.active ?? '0'))}         sub={`${a?.breached ?? 0} breached`}          color="#38BA82" />
        <StatCard icon="💰" label="Revenue This Month" value={fmt$(parseFloat(p?.revenue_this_month ?? '0'))}  sub={`${p?.transactions_this_month ?? 0} txns`} color="#F5B326" />
        <StatCard icon="💸" label="Total Payouts"     value={fmt$(parseFloat(p?.total_payouts ?? '0'))} sub="all time"                                color="#8B5CF6" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        <StatCard icon="🪪" label="KYC Approved"   value={fmtN(parseInt(u?.kyc_approved ?? '0'))}  color="#38BA82" />
        <StatCard icon="🏦" label="Funded Accounts" value={fmtN(parseInt(a?.funded ?? '0'))}       color="#F5B326" />
        <StatCard icon="⚠️" label="Open Risk Events" value={r?.open_events ?? '0'}                  color="#EB5454" />
        <StatCard icon="📈" label="New Users/Month"  value={u?.new_this_month ?? '0'}               color="#14B8A6" />
      </div>

      {/* ── Revenue trend ──────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
        <Card>
          <CardHeader title="Revenue vs Payouts" sub="Last 12 months" />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={d.revenueTrend} margin={{ top:4, right:4, left:0, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#35394733" />
              <XAxis dataKey="month" tick={{ fill:'#4F5669', fontSize:10 }} tickLine={false} />
              <YAxis tick={{ fill:'#4F5669', fontSize:10 }} tickLine={false} axisLine={false}
                tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v:number) => fmt$(v)} />
              <Area type="monotone" dataKey="revenue" stroke="#3F8FE0" fill="#162F4F" strokeWidth={2} name="Revenue" />
              <Area type="monotone" dataKey="payouts"  stroke="#8B5CF6" fill="#2D1B6933" strokeWidth={2} name="Payouts" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader title="Platform Distribution" sub="Active accounts" />
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:8 }}>
            {d.platformDist.map((pl: { platform:string; count:string }) => {
              const total = d.platformDist.reduce((s: number, p: any) => s + parseInt(p.count), 0);
              const pct   = total > 0 ? Math.round(parseInt(pl.count) / total * 100) : 0;
              const PCOL: Record<string,string> = { mt5:'#3F8FE0', ctrader:'#38BA82', matchtrader:'#F5B326', ninjatrader:'#8B5CF6', tradovate:'#14B8A6' };
              return (
                <div key={pl.platform}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                    <span style={{ color:'#CCD2E3', textTransform:'capitalize' }}>{pl.platform}</span>
                    <span style={{ color:'#878FA4' }}>{pl.count} ({pct}%)</span>
                  </div>
                  <div style={{ height:5, background:'#252931', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background: PCOL[pl.platform] ?? '#878FA4', borderRadius:3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Account creation trend ─────────────────────────────────────── */}
      <Card>
        <CardHeader title="Account Activity" sub="Accounts created vs breached — last 30 days" />
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={d.accountTrend} margin={{ top:4, right:4, left:0, bottom:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#35394733" />
            <XAxis dataKey="day" tick={{ fill:'#4F5669', fontSize:10 }} tickLine={false}
              tickFormatter={v => v.slice(5)} />
            <YAxis tick={{ fill:'#4F5669', fontSize:10 }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="count"    fill="#3F8FE0" name="Created"  radius={[3,3,0,0]} />
            <Bar dataKey="breached" fill="#EB5454" name="Breached" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* ── Bottom: Recent risk + payments ────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Card>
          <CardHeader title="Recent Risk Events" sub="Unacknowledged" action={<a href="/risk" style={{ fontSize:12, color:'#3F8FE0' }}>View all →</a>} />
          {d.recentRisk.length === 0
            ? <div style={{ textAlign:'center', padding:'24px', color:'#4F5669', fontSize:13 }}>✅ No open events</div>
            : d.recentRisk.map((e: any) => (
              <div key={e.id} style={{ padding:'8px 0', borderBottom:'1px solid #35394722', display:'flex', gap:10, alignItems:'flex-start' }}>
                <span style={{ fontSize:16, flexShrink:0 }}>
                  {e.severity === 'critical' ? '🚨' : e.severity === 'warning' ? '⚠️' : 'ℹ️'}
                </span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'#CCD2E3', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {e.message}
                  </div>
                  <div style={{ fontSize:11, color:'#4F5669', marginTop:2 }}>
                    {e.email} · {new Date(e.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          }
        </Card>

        <Card>
          <CardHeader title="Recent Payments" action={<a href="/payments" style={{ fontSize:12, color:'#3F8FE0' }}>View all →</a>} />
          {d.recentPayments.map((p: any) => (
            <div key={p.id} style={{ padding:'8px 0', borderBottom:'1px solid #35394722', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'#CCD2E3' }}>
                  {p.first_name} {p.last_name}
                </div>
                <div style={{ fontSize:11, color:'#4F5669' }}>
                  {p.type.replace(/_/g,' ')} · {new Date(p.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:13, fontWeight:700, color: p.type === 'payout' ? '#8B5CF6' : '#38BA82' }}>
                  {p.type === 'payout' ? '-' : '+'}{fmt$(parseFloat(p.amount))}
                </div>
                <StatusBadge status={p.status} />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
