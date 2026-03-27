import { useState, useEffect } from 'react';
import { A, api, Card, Btn, Pill } from './_shared.js';

export default function AnalyticsDashboard() {
  const [overview, setOverview] = useState<any>(null);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [passRates, setPassRates] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any>(null);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [health, setHealth] = useState<any[]>([]);
  const [fraud, setFraud] = useState<any[]>([]);
  const [period, setPeriod] = useState('30d');
  const [tab, setTab] = useState<'overview'|'revenue'|'payouts'|'health'|'fraud'>('overview');

  useEffect(() => {
    api('/api/v1/analytics/overview').then(setOverview);
    api(`/api/v1/analytics/revenue?period=${period}`).then(d => setRevenue(Array.isArray(d)?d:[]));
    api('/api/v1/analytics/pass-rates').then(d => setPassRates(Array.isArray(d)?d:[]));
    api('/api/v1/analytics/payouts').then(setPayouts);
    api('/api/v1/analytics/cohorts').then(d => setCohorts(Array.isArray(d)?d:[]));
    api('/api/v1/analytics/platform-health').then(d => setHealth(Array.isArray(d)?d:[]));
    api('/api/v1/analytics/fraud-flags').then(d => setFraud(Array.isArray(d)?d:[]));
  }, [period]);

  const HEALTH_COL: any = { ok:A.green, degraded:A.gold, down:A.red };

  const kpis = overview ? [
    { label:'Total Traders',     val:parseInt(overview.users?.total||0).toLocaleString(),    sub:`+${overview.users?.last_30||0} this month`,     icon:'👥', color:A.blue },
    { label:'Revenue All Time',  val:`$${parseFloat(overview.revenue?.all_time||0).toLocaleString()}`, sub:`$${parseFloat(overview.revenue?.last_30||0).toFixed(0)} last 30d`, icon:'💰', color:A.green },
    { label:'Total Paid Out',    val:`$${parseFloat(overview.payouts?.total_amount||0).toLocaleString()}`, sub:`${overview.payouts?.total||0} payouts total`, icon:'💸', color:A.gold },
    { label:'Avg Payout Time',   val:`${Math.round(overview.payouts?.avg_minutes||0)}m`,    sub:'Target: < 60 minutes',                            icon:'⚡', color:A.orange },
  ] : [];

  const tabs = ['overview','revenue','payouts','health','fraud'] as const;

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:A.white }}>Analytics</h1>
        <div style={{ display:'flex', gap:8 }}>
          {(['7d','30d','90d','1y'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding:'6px 16px',borderRadius:20,border:`1px solid ${period===p?A.blue:A.bord}`,background:period===p?'rgba(63,143,224,.15)':'transparent',color:period===p?A.blueL:A.txtB,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit' }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {kpis.map(s => (
          <Card key={s.label}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
              <span style={{ fontSize:26 }}>{s.icon}</span>
              <Pill label={period} color={A.txtC}/>
            </div>
            <div style={{ fontSize:26,fontWeight:800,color:s.color,marginBottom:3 }}>{s.val}</div>
            <div style={{ fontSize:11,color:A.txtC }}>{s.label}</div>
            <div style={{ fontSize:11,color:A.txtB,marginTop:2 }}>{s.sub}</div>
          </Card>
        ))}
        {!overview && [1,2,3,4].map(i => <Card key={i}><div style={{ height:80,background:A.surf2,borderRadius:8,animation:'pulse 1.5s infinite' }}/></Card>)}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex',gap:2,marginBottom:20,background:A.surf2,borderRadius:10,padding:4,width:'fit-content' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding:'7px 20px',borderRadius:8,border:'none',background:tab===t?A.blue:'transparent',color:tab===t?'#fff':A.txtB,fontFamily:'inherit',fontSize:12,fontWeight:600,cursor:'pointer',textTransform:'capitalize' }}>
            {t==='health'?'Platform Health':t}
            {t==='fraud'&&fraud.length>0?` (${fraud.length})`:''}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab==='overview' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <Card>
            <div style={{ fontSize:14,fontWeight:700,color:A.white,marginBottom:16 }}>Pass Rates by Challenge</div>
            {passRates.length===0 && <div style={{ color:A.txtC,fontSize:13 }}>No challenge data yet</div>}
            {passRates.map(r => (
              <div key={r.product} style={{ marginBottom:14 }}>
                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:5 }}>
                  <span style={{ fontSize:13,color:A.txtA }}>{r.product}</span>
                  <span style={{ fontSize:13,fontWeight:700,color:parseFloat(r.pass_rate)>50?A.green:A.gold }}>{r.pass_rate}%</span>
                </div>
                <div style={{ height:6,background:A.surf2,borderRadius:3,overflow:'hidden' }}>
                  <div style={{ width:`${Math.min(parseFloat(r.pass_rate)||0,100)}%`,height:'100%',background:`linear-gradient(90deg,${A.blue},${A.green})`,borderRadius:3,transition:'width .6s' }}/>
                </div>
                <div style={{ fontSize:11,color:A.txtC,marginTop:3 }}>{r.passed}/{r.total} traders passed</div>
              </div>
            ))}
          </Card>
          <Card>
            <div style={{ fontSize:14,fontWeight:700,color:A.white,marginBottom:16 }}>Top Countries by Traders</div>
            {cohorts.slice(0,10).map((c,i) => (
              <div key={c.country_code} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${A.bord}` }}>
                <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                  <span style={{ fontSize:11,color:A.txtC,minWidth:20 }}>#{i+1}</span>
                  <span style={{ fontSize:13,fontWeight:600,color:A.white }}>{c.country_code}</span>
                </div>
                <div style={{ display:'flex',gap:14 }}>
                  <span style={{ fontSize:12,color:A.blue,fontWeight:600 }}>{c.traders} traders</span>
                  <span style={{ fontSize:12,color:A.green }}>{c.kyc_approved} KYC</span>
                </div>
              </div>
            ))}
            {cohorts.length===0 && <div style={{ color:A.txtC,fontSize:13 }}>No trader data yet</div>}
          </Card>
        </div>
      )}

      {/* Revenue tab */}
      {tab==='revenue' && (
        <Card style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${A.bord}` }}>
            <div style={{ fontSize:14,fontWeight:700,color:A.white }}>Revenue Timeline — last {period}</div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:A.surf2 }}>
                  {['Date','Orders','Revenue'].map(h => <th key={h} style={{ padding:'10px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:A.txtC,borderBottom:`1px solid ${A.bord}` }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {[...revenue].reverse().map((r: any) => (
                  <tr key={r.date} style={{ borderBottom:`1px solid ${A.bord}` }}
                    onMouseEnter={e=>(e.currentTarget as any).style.background='rgba(255,255,255,.02)'}
                    onMouseLeave={e=>(e.currentTarget as any).style.background=''}>
                    <td style={{ padding:'10px 16px',fontSize:13,color:A.txtB }}>{new Date(r.date).toLocaleDateString()}</td>
                    <td style={{ padding:'10px 16px',fontSize:13,color:A.txtA }}>{r.orders}</td>
                    <td style={{ padding:'10px 16px',fontSize:14,fontWeight:700,color:A.green }}>${parseFloat(r.revenue||0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {revenue.length===0 && <div style={{ textAlign:'center',padding:40,color:A.txtC }}>No revenue data for this period</div>}
          </div>
        </Card>
      )}

      {/* Payouts tab */}
      {tab==='payouts' && payouts && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <Card style={{ padding:0,overflow:'hidden' }}>
            <div style={{ padding:'14px 18px',borderBottom:`1px solid ${A.bord}` }}><div style={{ fontSize:14,fontWeight:700,color:A.white }}>Payout Timeline</div></div>
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead><tr style={{ background:A.surf2 }}>{['Date','Count','Amount','Avg Time'].map(h=><th key={h} style={{ padding:'9px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:A.txtC,borderBottom:`1px solid ${A.bord}` }}>{h}</th>)}</tr></thead>
              <tbody>{(payouts.timeline||[]).slice(-14).reverse().map((r: any)=>(
                <tr key={r.date} style={{ borderBottom:`1px solid ${A.bord}` }}>
                  <td style={{ padding:'9px 14px',fontSize:12,color:A.txtB }}>{new Date(r.date).toLocaleDateString()}</td>
                  <td style={{ padding:'9px 14px',fontSize:12,color:A.txtA }}>{r.count}</td>
                  <td style={{ padding:'9px 14px',fontSize:13,fontWeight:700,color:A.green }}>${parseFloat(r.amount||0).toLocaleString()}</td>
                  <td style={{ padding:'9px 14px',fontSize:12,color:A.blue }}>{Math.round(r.avg_minutes||0)}m</td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
          <Card>
            <div style={{ fontSize:14,fontWeight:700,color:A.white,marginBottom:16 }}>By Payment Method</div>
            {(payouts.methods||[]).map((m: any) => (
              <div key={m.payment_method} style={{ display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:`1px solid ${A.bord}` }}>
                <span style={{ fontSize:13,color:A.txtA }}>{m.payment_method||'Unknown'}</span>
                <div style={{ display:'flex',gap:16 }}>
                  <span style={{ fontSize:12,color:A.txtC }}>{m.count}×</span>
                  <span style={{ fontSize:13,fontWeight:700,color:A.green }}>${parseFloat(m.amount||0).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Platform Health */}
      {tab==='health' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
          {health.length===0 && (
            <Card style={{ gridColumn:'1/-1' }}>
              <div style={{ textAlign:'center',padding:40,color:A.txtC }}>No platform health data yet. Health checks run automatically every 5 minutes.</div>
            </Card>
          )}
          {health.map(h => (
            <Card key={h.platform} style={{ borderTop:`2px solid ${HEALTH_COL[h.status]||A.txtC}` }}>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14 }}>
                <div style={{ fontSize:16,fontWeight:700,color:A.white }}>{h.platform?.toUpperCase()}</div>
                <Pill label={h.status} color={HEALTH_COL[h.status]||A.txtC}/>
              </div>
              <div style={{ fontSize:28,fontWeight:800,color:HEALTH_COL[h.status]||A.txtC,marginBottom:6 }}>
                {h.response_ms?`${h.response_ms}ms`:'—'}
              </div>
              {h.error_msg && <div style={{ fontSize:11,color:A.red,marginBottom:6 }}>{h.error_msg}</div>}
              <div style={{ fontSize:11,color:A.txtC }}>Last: {h.checked_at?new Date(h.checked_at).toLocaleTimeString():'Never'}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Fraud Flags */}
      {tab==='fraud' && (
        <Card style={{ padding:0,overflow:'hidden' }}>
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead><tr style={{ background:A.surf2 }}>{['Trader','Flag Type','Details','Date','Action'].map(h=><th key={h} style={{ padding:'11px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:A.txtC,borderBottom:`1px solid ${A.bord}` }}>{h}</th>)}</tr></thead>
            <tbody>{fraud.map(f=>(
              <tr key={f.id} style={{ borderBottom:`1px solid ${A.bord}` }}>
                <td style={{ padding:'11px 16px',fontSize:13,color:A.white }}>{f.first_name} {f.last_name}<div style={{ fontSize:11,color:A.txtC }}>{f.email}</div></td>
                <td style={{ padding:'11px 16px' }}><Pill label={f.flag_type} color={A.orange}/></td>
                <td style={{ padding:'11px 16px',fontSize:12,color:A.txtB,maxWidth:200 }}>{JSON.stringify(f.details).slice(0,100)}</td>
                <td style={{ padding:'11px 16px',fontSize:12,color:A.txtC }}>{new Date(f.created_at).toLocaleDateString()}</td>
                <td style={{ padding:'11px 16px' }}>
                  <div style={{ display:'flex',gap:6 }}>
                    <Btn onClick={()=>api(`/api/v1/analytics/fraud-flags/${f.id}`,{method:'PATCH',body:JSON.stringify({status:'dismissed'})}).then(()=>setFraud(fl=>fl.filter(x=>x.id!==f.id)))} variant="ghost" style={{ padding:'5px 10px',fontSize:11 }}>Dismiss</Btn>
                    <Btn onClick={()=>api(`/api/v1/analytics/fraud-flags/${f.id}`,{method:'PATCH',body:JSON.stringify({status:'actioned'})}).then(()=>setFraud(fl=>fl.filter(x=>x.id!==f.id)))} variant="danger" style={{ padding:'5px 10px',fontSize:11 }}>Action</Btn>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
          {fraud.length===0 && <div style={{ textAlign:'center',padding:48,color:A.txtC }}>✅ No open fraud flags</div>}
        </Card>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}`}</style>
    </div>
  );
}
