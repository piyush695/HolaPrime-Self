import { useState, useEffect, useRef } from 'react';
import { A, api, inp, sel, Card, Btn, Pill, Toggle } from '../ops/_shared.js';

const TRIGGER_EVENTS = [
  { value:'registered',    label:'User Registered',       icon:'👤' },
  { value:'purchased',     label:'Challenge Purchased',   icon:'💳' },
  { value:'passed',        label:'Challenge Passed',       icon:'✅' },
  { value:'breached',      label:'Account Breached',       icon:'💥' },
  { value:'kyc_pending',   label:'KYC Not Submitted',     icon:'🪪' },
  { value:'inactive_7d',   label:'Inactive 7 Days',       icon:'😴' },
  { value:'inactive_30d',  label:'Inactive 30 Days',      icon:'👻' },
];

const CHANNEL_COLORS: Record<string,string> = {
  google_ads:'#4285F4', meta_ads:'#1877F2', tiktok_ads:'#69C9D0',
  twitter_ads:'#1DA1F2', linkedin_ads:'#0A66C2', bing_ads:'#008373',
  email:'#F59E0B', affiliate:'#10B981', organic:'#22C55E', direct:'#94A3B8', paid_other:'#8B5CF6',
};

const FLAG_MAP: Record<string,string> = {
  GB:'🇬🇧',US:'🇺🇸',IN:'🇮🇳',AE:'🇦🇪',DE:'🇩🇪',FR:'🇫🇷',AU:'🇦🇺',CA:'🇨🇦',
  SG:'🇸🇬',ZA:'🇿🇦',NG:'🇳🇬',KE:'🇰🇪',BR:'🇧🇷',MX:'🇲🇽',PK:'🇵🇰',PH:'🇵🇭',
  MY:'🇲🇾',TH:'🇹🇭',NL:'🇳🇱',ES:'🇪🇸',IT:'🇮🇹',PL:'🇵🇱',TR:'🇹🇷',EG:'🇪🇬',
  GH:'🇬🇭',TZ:'🇹🇿',RU:'🇷🇺',JP:'🇯🇵',KR:'🇰🇷',CN:'🇨🇳',ID:'🇮🇩',
};

const BLANK_TRIGGER = {
  name:'', description:'', trigger_event:'registered', delay_hours:0,
  channel:'email', subject:'', message_body:'', enabled:true
};

export default function MarketingDashboard() {
  const [tab, setTab] = useState<'reengagement'|'ltv'|'funnel'|'geo'|'social'>('funnel');
  const [period, setPeriod] = useState('30d');

  // Re-engagement
  const [triggers, setTriggers] = useState<any[]>([]);
  const [trigForm, setTrigForm] = useState<any>({...BLANK_TRIGGER});
  const [trigEditId, setTrigEditId] = useState<string|null>(null);
  const [showTrigForm, setShowTrigForm] = useState(false);
  const [selectedTrig, setSelectedTrig] = useState<any>(null);
  const [trigSends, setTrigSends] = useState<any>(null);
  const [testEmail, setTestEmail] = useState('');

  // LTV
  const [ltv, setLtv] = useState<any>(null);

  // Funnel
  const [funnel, setFunnel] = useState<any>(null);
  const [funnelFrom, setFunnelFrom] = useState(new Date(Date.now()-30*86400000).toISOString().split('T')[0]);
  const [funnelTo, setFunnelTo] = useState(new Date().toISOString().split('T')[0]);
  const [funnelChannel, setFunnelChannel] = useState('');

  // Geo
  const [geo, setGeo] = useState<any>(null);
  const [geoMetric, setGeoMetric] = useState('signups');

  // Social proof
  const [proofItems, setProofItems] = useState<any[]>([]);
  const [proofForm, setProofForm] = useState({event_type:'payout',trader_name:'',trader_country:'',trader_flag:'🌍',amount:'',challenge_name:'',is_verified:true});
  const [showProofForm, setShowProofForm] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Load data based on active tab
  useEffect(() => {
    if (tab === 'reengagement') api('/api/v1/marketing/reengagement').then(d=>setTriggers(Array.isArray(d)?d:[]));
    if (tab === 'ltv') api(`/api/v1/marketing/ltv?period=${period}`).then(setLtv);
    if (tab === 'funnel') api(`/api/v1/marketing/funnel?from=${funnelFrom}&to=${funnelTo}${funnelChannel?`&channel=${funnelChannel}`:''}`).then(setFunnel);
    if (tab === 'geo') api(`/api/v1/marketing/geo?period=${period}`).then(setGeo);
    if (tab === 'social') api('/api/v1/marketing/social-proof').then(d=>setProofItems(Array.isArray(d)?d:[]));
  }, [tab, period, funnelFrom, funnelTo, funnelChannel]);

  async function saveTrigger() {
    if (trigEditId) {
      await api(`/api/v1/marketing/reengagement/${trigEditId}`, {method:'PATCH', body:JSON.stringify(trigForm)});
      setTriggers(t=>t.map(x=>x.id===trigEditId?{...x,...trigForm}:x));
    } else {
      const row = await api('/api/v1/marketing/reengagement', {method:'POST', body:JSON.stringify(trigForm)});
      if (row?.id) setTriggers(t=>[{...trigForm,...row},...t]);
    }
    setShowTrigForm(false); setTrigEditId(null); setTrigForm({...BLANK_TRIGGER});
  }

  async function toggleTrigger(id: string, enabled: boolean) {
    const t = triggers.find(x=>x.id===id);
    await api(`/api/v1/marketing/reengagement/${id}`, {method:'PATCH', body:JSON.stringify({...t,enabled})});
    setTriggers(ts=>ts.map(x=>x.id===id?{...x,enabled}:x));
  }

  async function loadTriggerSends(trig: any) {
    setSelectedTrig(trig);
    const data = await api(`/api/v1/marketing/reengagement/${trig.id}/sends`);
    setTrigSends(data);
  }

  async function generateSocialProof() {
    setGenerating(true);
    await api('/api/v1/marketing/social-proof/generate', {method:'POST', body:JSON.stringify({days:90,anonymise:true})});
    api('/api/v1/marketing/social-proof').then(d=>setProofItems(Array.isArray(d)?d:[]));
    setGenerating(false);
  }

  async function saveProof() {
    const row = await api('/api/v1/marketing/social-proof', {method:'POST', body:JSON.stringify({...proofForm,amount:parseFloat(proofForm.amount)||null})});
    if (row?.id) setProofItems(p=>[{...proofForm,...row}, ...p]);
    setShowProofForm(false);
    setProofForm({event_type:'payout',trader_name:'',trader_country:'',trader_flag:'🌍',amount:'',challenge_name:'',is_verified:true});
  }

  async function toggleProof(id: string, is_visible: boolean) {
    await api(`/api/v1/marketing/social-proof/${id}`, {method:'PATCH', body:JSON.stringify({is_visible})});
    setProofItems(p=>p.map(x=>x.id===id?{...x,is_visible}:x));
  }

  async function deleteProof(id: string) {
    await api(`/api/v1/marketing/social-proof/${id}`, {method:'DELETE'});
    setProofItems(p=>p.filter(x=>x.id!==id));
  }

  const tabs = [
    { key:'funnel',       label:'Conversion Funnel', icon:'📊' },
    { key:'ltv',          label:'LTV by Channel',    icon:'💰' },
    { key:'geo',          label:'Geo Heatmap',        icon:'🌍' },
    { key:'reengagement', label:'Re-engagement',      icon:'🔄' },
    { key:'social',       label:'Social Proof Feed',  icon:'⭐' },
  ] as const;

  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:22,fontWeight:800,color:A.white,marginBottom:4}}>Marketing Intelligence</h1>
        <p style={{fontSize:13,color:A.txtB}}>Re-engagement automation, LTV analysis, conversion funnel, geo heatmap, and social proof.</p>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:6,marginBottom:24,flexWrap:'wrap'}}>
        {tabs.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key as any)}
            style={{display:'flex',alignItems:'center',gap:6,padding:'8px 18px',borderRadius:10,border:`1px solid ${tab===t.key?A.blue:A.bord}`,background:tab===t.key?'rgba(63,143,224,.15)':'transparent',color:tab===t.key?A.white:A.txtB,fontFamily:'inherit',fontSize:13,fontWeight:tab===t.key?700:400,cursor:'pointer',transition:'all .15s'}}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
        {(tab==='ltv'||tab==='geo') && (
          <div style={{marginLeft:'auto',display:'flex',gap:4}}>
            {['7d','30d','90d','1y'].map(p=>(
              <button key={p} onClick={()=>setPeriod(p)}
                style={{padding:'7px 14px',borderRadius:8,border:`1px solid ${period===p?A.blue:A.bord}`,background:period===p?'rgba(63,143,224,.12)':'transparent',color:period===p?A.blueL:A.txtB,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          FEATURE 5 — CONVERSION FUNNEL
      ════════════════════════════════════════════════════════════════════════ */}
      {tab==='funnel' && (
        <div>
          {/* Filters */}
          <Card style={{marginBottom:20,padding:'14px 18px'}}>
            <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <label style={{fontSize:12,color:A.txtC}}>From</label>
                <input type="date" value={funnelFrom} onChange={e=>setFunnelFrom(e.target.value)} style={{...inp,width:150,padding:'8px 12px'}}/>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <label style={{fontSize:12,color:A.txtC}}>To</label>
                <input type="date" value={funnelTo} onChange={e=>setFunnelTo(e.target.value)} style={{...inp,width:150,padding:'8px 12px'}}/>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <label style={{fontSize:12,color:A.txtC}}>Channel</label>
                <select value={funnelChannel} onChange={e=>setFunnelChannel(e.target.value)} style={{...sel,width:'auto',padding:'8px 12px',fontSize:12}}>
                  <option value="">All channels</option>
                  {Object.keys(CHANNEL_COLORS).map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </Card>

          {funnel ? (
            <div>
              {/* Funnel bars */}
              <Card style={{marginBottom:20}}>
                <div style={{fontSize:15,fontWeight:700,color:A.white,marginBottom:20}}>Trader Journey Funnel</div>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {(funnel.funnel ?? []).map((step: any, i: number) => {
                    const maxCount = funnel.funnel[0]?.count || 1;
                    const width = `${(step.count / maxCount) * 100}%`;
                    return (
                      <div key={step.stage}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                          <span style={{fontSize:13,color:A.txtA,fontWeight:500}}>{step.stage}</span>
                          <div style={{display:'flex',gap:16,alignItems:'center'}}>
                            {i>0&&<span style={{fontSize:11,color:A.red}}>-{step.dropoff.toLocaleString()} dropped off</span>}
                            <span style={{fontSize:14,fontWeight:800,color:step.color}}>{step.count.toLocaleString()}</span>
                            <span style={{fontSize:12,color:A.txtC,minWidth:40,textAlign:'right'}}>{step.pct_of_prev}%</span>
                          </div>
                        </div>
                        <div style={{height:10,background:A.surf2,borderRadius:5,overflow:'hidden'}}>
                          <div style={{width,height:'100%',background:`linear-gradient(90deg,${step.color}88,${step.color})`,borderRadius:5,transition:'width .8s'}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
                {/* Daily chart */}
                <Card>
                  <div style={{fontSize:14,fontWeight:700,color:A.white,marginBottom:14}}>Daily Registrations vs Purchases</div>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr style={{background:A.surf2}}>
                        {['Date','Registrations','Purchases','Conv %'].map(h=><th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:11,fontWeight:700,color:A.txtC,borderBottom:`1px solid ${A.bord}`}}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {(funnel.daily??[]).slice(-14).reverse().map((d: any)=>(
                          <tr key={d.date} style={{borderBottom:`1px solid ${A.bord}`}}>
                            <td style={{padding:'8px 12px',fontSize:12,color:A.txtB}}>{new Date(d.date).toLocaleDateString()}</td>
                            <td style={{padding:'8px 12px',fontSize:13,color:A.blue,fontWeight:600}}>{d.registrations}</td>
                            <td style={{padding:'8px 12px',fontSize:13,color:A.green,fontWeight:600}}>{d.purchases}</td>
                            <td style={{padding:'8px 12px',fontSize:12,color:A.gold}}>{d.registrations>0?((d.purchases/d.registrations)*100).toFixed(1):0}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Drop-off reasons */}
                <Card>
                  <div style={{fontSize:14,fontWeight:700,color:A.white,marginBottom:14}}>Account Breach Types</div>
                  {(funnel.dropoffs??[]).length===0&&<div style={{color:A.txtC,fontSize:13}}>No breach data for this period</div>}
                  {(funnel.dropoffs??[]).map((d: any)=>(
                    <div key={d.breach_type} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:`1px solid ${A.bord}`}}>
                      <span style={{fontSize:13,color:A.txtA}}>{d.breach_type?.replace('_',' ')||'Unknown'}</span>
                      <span style={{fontSize:14,fontWeight:700,color:A.red}}>{d.count}</span>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          ) : <Card><div style={{textAlign:'center',padding:40,color:A.txtC}}>Loading funnel data…</div></Card>}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          FEATURE 4 — LTV BY CHANNEL
      ════════════════════════════════════════════════════════════════════════ */}
      {tab==='ltv' && (
        <div>
          {ltv ? (
            <div>
              {/* By channel */}
              <Card style={{marginBottom:20,padding:0,overflow:'hidden'}}>
                <div style={{padding:'14px 18px',borderBottom:`1px solid ${A.bord}`}}>
                  <div style={{fontSize:15,fontWeight:700,color:A.white}}>LTV by Acquisition Channel — last {period}</div>
                </div>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr style={{background:A.surf2}}>
                    {['Channel','Traders','Avg LTV','Total Revenue','Total Payouts','Funded','Margin'].map(h=>(
                      <th key={h} style={{padding:'10px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:A.txtC,letterSpacing:'.08em',borderBottom:`1px solid ${A.bord}`}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(ltv.byChannel??[]).map((c: any)=>{
                      const margin = c.total_revenue > 0 ? ((c.total_revenue - c.total_payouts) / c.total_revenue * 100).toFixed(1) : '—';
                      return (
                        <tr key={c.channel} style={{borderBottom:`1px solid ${A.bord}`}}>
                          <td style={{padding:'11px 16px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <div style={{width:10,height:10,borderRadius:'50%',background:CHANNEL_COLORS[c.channel]??A.txtC,flexShrink:0}}/>
                              <span style={{fontSize:13,fontWeight:600,color:A.white}}>{c.channel}</span>
                            </div>
                          </td>
                          <td style={{padding:'11px 16px',fontSize:13,color:A.txtA}}>{parseInt(c.traders).toLocaleString()}</td>
                          <td style={{padding:'11px 16px',fontSize:13,fontWeight:700,color:A.gold}}>${parseFloat(c.avg_ltv).toFixed(0)}</td>
                          <td style={{padding:'11px 16px',fontSize:13,fontWeight:700,color:A.green}}>${parseFloat(c.total_revenue).toLocaleString()}</td>
                          <td style={{padding:'11px 16px',fontSize:13,color:A.red}}>${parseFloat(c.total_payouts).toLocaleString()}</td>
                          <td style={{padding:'11px 16px',fontSize:13,color:A.blue}}>{c.funded_traders}</td>
                          <td style={{padding:'11px 16px'}}>
                            <span style={{fontSize:13,fontWeight:700,color:parseFloat(margin)>50?A.green:parseFloat(margin)>30?A.gold:A.red}}>{margin}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>

              {/* Top traders + Cohorts grid */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
                <Card style={{padding:0,overflow:'hidden'}}>
                  <div style={{padding:'14px 18px',borderBottom:`1px solid ${A.bord}`}}>
                    <div style={{fontSize:14,fontWeight:700,color:A.white}}>Top Traders by LTV</div>
                  </div>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr style={{background:A.surf2}}>
                      {['Trader','Channel','Spent','Received'].map(h=><th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:10,fontWeight:700,color:A.txtC,borderBottom:`1px solid ${A.bord}`}}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {(ltv.topTraders??[]).slice(0,15).map((t: any)=>(
                        <tr key={t.id} style={{borderBottom:`1px solid ${A.bord}`}}>
                          <td style={{padding:'9px 14px'}}>
                            <div style={{fontSize:12,fontWeight:600,color:A.white}}>{t.first_name} {t.last_name}</div>
                            <div style={{fontSize:10,color:A.txtD}}>{FLAG_MAP[t.country_code]??'🌍'} {t.country_code}</div>
                          </td>
                          <td style={{padding:'9px 14px'}}><Pill label={t.channel||'direct'} color={CHANNEL_COLORS[t.channel]??A.txtC}/></td>
                          <td style={{padding:'9px 14px',fontSize:13,fontWeight:700,color:A.green}}>${parseFloat(t.total_spent||0).toFixed(0)}</td>
                          <td style={{padding:'9px 14px',fontSize:12,color:A.txtB}}>${parseFloat(t.total_received||0).toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>

                <Card style={{padding:0,overflow:'hidden'}}>
                  <div style={{padding:'14px 18px',borderBottom:`1px solid ${A.bord}`}}>
                    <div style={{fontSize:14,fontWeight:700,color:A.white}}>Monthly Revenue Cohorts</div>
                  </div>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr style={{background:A.surf2}}>
                      {['Month','New Traders','M0 Revenue','Avg Order'].map(h=><th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:10,fontWeight:700,color:A.txtC,borderBottom:`1px solid ${A.bord}`}}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {(ltv.cohorts??[]).map((c: any)=>(
                        <tr key={c.cohort_month} style={{borderBottom:`1px solid ${A.bord}`}}>
                          <td style={{padding:'9px 14px',fontSize:12,color:A.white,fontWeight:600}}>{new Date(c.cohort_month).toLocaleDateString('en',{month:'short',year:'numeric'})}</td>
                          <td style={{padding:'9px 14px',fontSize:12,color:A.blue}}>{parseInt(c.traders)}</td>
                          <td style={{padding:'9px 14px',fontSize:13,fontWeight:700,color:A.green}}>${parseFloat(c.revenue_m0||0).toLocaleString()}</td>
                          <td style={{padding:'9px 14px',fontSize:12,color:A.gold}}>${parseFloat(c.avg_order_value||0).toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            </div>
          ) : <Card><div style={{textAlign:'center',padding:40,color:A.txtC}}>Loading LTV data…</div></Card>}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          FEATURE 6 — GEO HEATMAP
      ════════════════════════════════════════════════════════════════════════ */}
      {tab==='geo' && (
        <div>
          <div style={{display:'flex',gap:8,marginBottom:16}}>
            {['signups','purchases','revenue','conv_rate'].map(m=>(
              <button key={m} onClick={()=>setGeoMetric(m)}
                style={{padding:'7px 16px',borderRadius:20,border:`1px solid ${geoMetric===m?A.blue:A.bord}`,background:geoMetric===m?'rgba(63,143,224,.12)':'transparent',color:geoMetric===m?A.blueL:A.txtB,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>
                {m.replace('_',' ')}
              </button>
            ))}
          </div>

          {geo ? (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
              {/* Heatmap bars */}
              <Card>
                <div style={{fontSize:14,fontWeight:700,color:A.white,marginBottom:16}}>Top Countries — {geoMetric.replace('_',' ')}</div>
                {(geo.countries??[]).slice(0,20).map((c: any, i: number)=>{
                  const val = parseFloat(c[geoMetric]??0);
                  const maxVal = Math.max(...(geo.countries??[]).slice(0,20).map((x: any)=>parseFloat(x[geoMetric]??0)));
                  const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                  const displayVal = geoMetric==='revenue'||geoMetric==='payout_amount' ? `$${val.toLocaleString()}` :
                                     geoMetric==='conv_rate' ? `${val}%` : val.toLocaleString();
                  return (
                    <div key={c.country_code} style={{marginBottom:10}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                        <span style={{fontSize:13,color:A.txtA,display:'flex',alignItems:'center',gap:6}}>
                          <span>{FLAG_MAP[c.country_code]??'🌍'}</span>
                          <span>{c.country_code}</span>
                          <span style={{fontSize:10,color:A.txtD}}>#{i+1}</span>
                        </span>
                        <span style={{fontSize:13,fontWeight:700,color:A.blue}}>{displayVal}</span>
                      </div>
                      <div style={{height:6,background:A.surf2,borderRadius:3,overflow:'hidden'}}>
                        <div style={{width:`${pct}%`,height:'100%',background:`linear-gradient(90deg,${A.blueD},${A.blue})`,borderRadius:3,transition:'width .5s'}}/>
                      </div>
                    </div>
                  );
                })}
              </Card>

              {/* Stats table */}
              <Card style={{padding:0,overflow:'hidden'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr style={{background:A.surf2}}>
                    {['Country','Signups','Purchases','Conv %','Revenue'].map(h=>(
                      <th key={h} style={{padding:'10px 12px',textAlign:'left',fontSize:10,fontWeight:700,color:A.txtC,borderBottom:`1px solid ${A.bord}`}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(geo.countries??[]).slice(0,25).map((c: any)=>(
                      <tr key={c.country_code} style={{borderBottom:`1px solid ${A.bord}`}}>
                        <td style={{padding:'9px 12px'}}>
                          <span style={{marginRight:6}}>{FLAG_MAP[c.country_code]??'🌍'}</span>
                          <span style={{fontSize:12,fontWeight:600,color:A.white}}>{c.country_code}</span>
                        </td>
                        <td style={{padding:'9px 12px',fontSize:12,color:A.blue,fontWeight:600}}>{parseInt(c.signups).toLocaleString()}</td>
                        <td style={{padding:'9px 12px',fontSize:12,color:A.txtA}}>{parseInt(c.purchases||0)}</td>
                        <td style={{padding:'9px 12px',fontSize:12,color:parseFloat(c.conv_rate||0)>10?A.green:A.gold}}>{parseFloat(c.conv_rate||0).toFixed(1)}%</td>
                        <td style={{padding:'9px 12px',fontSize:12,fontWeight:600,color:A.green}}>${parseFloat(c.revenue||0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          ) : <Card><div style={{textAlign:'center',padding:40,color:A.txtC}}>Loading geo data…</div></Card>}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          FEATURE 3 — RE-ENGAGEMENT TRIGGERS
      ════════════════════════════════════════════════════════════════════════ */}
      {tab==='reengagement' && (
        <div style={{display:'grid',gridTemplateColumns:selectedTrig?'1fr 1fr':'1fr',gap:20}}>
          <div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:A.white}}>Automation Triggers</div>
                <div style={{fontSize:12,color:A.txtB,marginTop:2}}>{triggers.filter(t=>t.enabled).length} active of {triggers.length} total</div>
              </div>
              <Btn onClick={()=>{setShowTrigForm(s=>!s);setTrigEditId(null);setTrigForm({...BLANK_TRIGGER});}}>
                {showTrigForm?'× Cancel':'+ New Trigger'}
              </Btn>
            </div>

            {showTrigForm && (
              <Card style={{marginBottom:16,borderColor:A.blue}}>
                <div style={{fontSize:13,fontWeight:700,color:A.white,marginBottom:14}}>{trigEditId?'Edit Trigger':'New Trigger'}</div>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div>
                      <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>Name *</label>
                      <input value={trigForm.name} onChange={e=>setTrigForm((f: any)=>({...f,name:e.target.value}))} placeholder="Welcome Series Day 1" style={inp} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
                    </div>
                    <div>
                      <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>Trigger Event *</label>
                      <select value={trigForm.trigger_event} onChange={e=>setTrigForm((f: any)=>({...f,trigger_event:e.target.value}))} style={sel}>
                        {TRIGGER_EVENTS.map(ev=><option key={ev.value} value={ev.value}>{ev.icon} {ev.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>Delay (hours after event)</label>
                      <input type="number" value={trigForm.delay_hours} onChange={e=>setTrigForm((f: any)=>({...f,delay_hours:parseInt(e.target.value)||0}))} style={inp} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
                    </div>
                    <div>
                      <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>Channel</label>
                      <select value={trigForm.channel} onChange={e=>setTrigForm((f: any)=>({...f,channel:e.target.value}))} style={sel}>
                        <option value="email">Email</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="both">Email + WhatsApp</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>Email Subject</label>
                    <input value={trigForm.subject} onChange={e=>setTrigForm((f: any)=>({...f,subject:e.target.value}))} placeholder="Subject line… Use {{first_name}}, {{challenge_name}} etc." style={inp} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
                  </div>
                  <div>
                    <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>Message Body * <span style={{color:A.txtD}}>(HTML for email, plain text for WhatsApp)</span></label>
                    <textarea value={trigForm.message_body} onChange={e=>setTrigForm((f: any)=>({...f,message_body:e.target.value}))} rows={5} placeholder="Available variables: {{first_name}}, {{last_name}}, {{email}}, {{challenge_name}}, {{cta_url}}, {{promo_code}}"
                      style={{...inp,resize:'vertical',fontFamily:'monospace',fontSize:12}} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
                  </div>
                  <div style={{display:'flex',gap:10,alignItems:'center'}}>
                    <Btn onClick={saveTrigger} disabled={!trigForm.name||!trigForm.message_body}>{trigEditId?'Save Changes':'Create Trigger'}</Btn>
                    <Btn onClick={()=>{setShowTrigForm(false);setTrigEditId(null);}} variant="ghost">Cancel</Btn>
                  </div>
                </div>
              </Card>
            )}

            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {triggers.map(t=>{
                const ev = TRIGGER_EVENTS.find(e=>e.value===t.trigger_event);
                return (
                  <Card key={t.id} style={{opacity:t.enabled?1:.6,cursor:'pointer',transition:'all .15s',borderColor:selectedTrig?.id===t.id?A.blue:A.bord}}
                    onClick={()=>loadTriggerSends(t)}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                          <span style={{fontSize:16}}>{ev?.icon??'🔔'}</span>
                          <span style={{fontSize:14,fontWeight:700,color:A.white}}>{t.name}</span>
                          <Pill label={t.channel} color={A.blue}/>
                        </div>
                        <div style={{fontSize:12,color:A.txtB,marginBottom:6}}>{ev?.label} + {t.delay_hours}h delay</div>
                        <div style={{display:'flex',gap:16}}>
                          {[{l:'Sent',v:t.sent_count||0,c:A.blue},{l:'Opened',v:t.open_count||0,c:A.gold},{l:'Converted',v:t.conversion_count||0,c:A.green}].map(s=>(
                            <div key={s.l} style={{textAlign:'center'}}>
                              <div style={{fontSize:16,fontWeight:800,color:s.c}}>{s.v}</div>
                              <div style={{fontSize:10,color:A.txtD}}>{s.l}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <Toggle checked={t.enabled} onChange={(v: boolean)=>toggleTrigger(t.id,v)}/>
                        <Btn onClick={e=>{e.stopPropagation();setTrigEditId(t.id);setTrigForm({...t});setShowTrigForm(true);}} variant="ghost" style={{padding:'5px 10px',fontSize:11}}>✏️</Btn>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Sends detail panel */}
          {selectedTrig && (
            <div>
              <Card style={{marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:A.white}}>{selectedTrig.name}</div>
                    <div style={{fontSize:12,color:A.txtC}}>Recent sends</div>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <input value={testEmail} onChange={e=>setTestEmail(e.target.value)} placeholder="test@example.com" style={{...inp,width:180,padding:'7px 12px',fontSize:12}}/>
                    <Btn onClick={()=>api(`/api/v1/marketing/reengagement/${selectedTrig.id}/test`,{method:'POST',body:JSON.stringify({email:testEmail})})} variant="ghost" style={{padding:'7px 14px',fontSize:12}}>📧 Test</Btn>
                    <button onClick={()=>setSelectedTrig(null)} style={{background:'none',border:'none',color:A.txtC,cursor:'pointer',fontSize:18}}>×</button>
                  </div>
                </div>
                {trigSends?.stats && (
                  <div style={{display:'flex',gap:16}}>
                    {[{l:'Total',v:trigSends.stats.total||0,c:A.blue},{l:'Sent',v:trigSends.stats.sent||0,c:A.txtA},{l:'Opened',v:trigSends.stats.opened||0,c:A.gold},{l:'Converted',v:trigSends.stats.converted||0,c:A.green}].map(s=>(
                      <div key={s.l} style={{textAlign:'center',padding:'8px 14px',background:A.surf2,borderRadius:8}}>
                        <div style={{fontSize:18,fontWeight:800,color:s.c}}>{s.v}</div>
                        <div style={{fontSize:10,color:A.txtD}}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card style={{padding:0,overflow:'hidden',maxHeight:400,overflowY:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead style={{position:'sticky',top:0}}>
                    <tr style={{background:A.surf2}}>
                      {['Trader','Status','Sent','Converted'].map(h=><th key={h} style={{padding:'9px 12px',textAlign:'left',fontSize:10,fontWeight:700,color:A.txtC,borderBottom:`1px solid ${A.bord}`}}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(trigSends?.sends??[]).map((s: any)=>(
                      <tr key={s.id} style={{borderBottom:`1px solid ${A.bord}`}}>
                        <td style={{padding:'8px 12px'}}>
                          <div style={{fontSize:12,fontWeight:600,color:A.white}}>{s.first_name} {s.last_name}</div>
                          <div style={{fontSize:10,color:A.txtD}}>{s.email}</div>
                        </td>
                        <td style={{padding:'8px 12px'}}><Pill label={s.status} color={{sent:A.blue,opened:A.gold,converted:A.green,failed:A.red,queued:A.txtC}[s.status]??A.txtC}/></td>
                        <td style={{padding:'8px 12px',fontSize:11,color:A.txtD}}>{s.sent_at?new Date(s.sent_at).toLocaleDateString():'—'}</td>
                        <td style={{padding:'8px 12px',fontSize:11,color:A.green}}>{s.converted_at?new Date(s.converted_at).toLocaleDateString():'—'}</td>
                      </tr>
                    ))}
                    {(!trigSends?.sends||trigSends.sends.length===0)&&<tr><td colSpan={4} style={{padding:24,textAlign:'center',color:A.txtC,fontSize:12}}>No sends recorded yet</td></tr>}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          FEATURE 8 — SOCIAL PROOF FEED
      ════════════════════════════════════════════════════════════════════════ */}
      {tab==='social' && (
        <div>
          <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center'}}>
            <div>
              <div style={{fontSize:13,color:A.txtB}}>Manage the social proof ticker shown on your landing page. Generate from real payouts or add manually.</div>
            </div>
            <div style={{display:'flex',gap:8,marginLeft:'auto'}}>
              <Btn onClick={generateSocialProof} disabled={generating} variant="ghost" style={{padding:'9px 18px',fontSize:12}}>
                {generating?'⏳ Generating…':'⚡ Auto-generate from Payouts'}
              </Btn>
              <Btn onClick={()=>setShowProofForm(s=>!s)}>{showProofForm?'× Cancel':'+ Add Manual'}</Btn>
            </div>
          </div>

          {/* Live preview widget */}
          <Card style={{marginBottom:16,background:'linear-gradient(135deg,#0B1120,#0F1629)',border:`1px solid ${A.bord}`}}>
            <div style={{fontSize:12,color:A.txtC,marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
              <span>👁️</span> Live preview (what traders see on the landing page)
            </div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {proofItems.filter(p=>p.is_visible).slice(0,5).map(p=>(
                <div key={p.id} style={{padding:'8px 14px',background:'rgba(255,255,255,.04)',border:`1px solid ${A.bord}`,borderRadius:8,fontSize:12,color:A.txtA,display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:16}}>{p.trader_flag??'🌍'}</span>
                  <div>
                    <strong style={{color:A.white}}>{p.trader_name}</strong>
                    {p.amount&&<span style={{color:A.green}}> received <strong>${parseFloat(p.amount).toLocaleString()}</strong></span>}
                    {p.challenge_name&&<div style={{fontSize:10,color:A.txtD}}>{p.challenge_name}</div>}
                  </div>
                  {p.is_verified&&<span style={{fontSize:10,color:A.green}}>✓</span>}
                </div>
              ))}
              {proofItems.filter(p=>p.is_visible).length===0&&<div style={{color:A.txtC,fontSize:13}}>No visible items yet. Generate or add some above.</div>}
            </div>
          </Card>

          {showProofForm&&(
            <Card style={{marginBottom:16,borderColor:A.blue}}>
              <div style={{fontSize:13,fontWeight:700,color:A.white,marginBottom:12}}>Add Social Proof Event</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:12}}>
                {[{l:'Trader Name',k:'trader_name',ph:'James K.'},{l:'Country Code',k:'trader_country',ph:'GB'},{l:'Flag Emoji',k:'trader_flag',ph:'🇬🇧'},{l:'Amount ($)',k:'amount',ph:'4200'},{l:'Challenge Name',k:'challenge_name',ph:'2-Step Prime 10K'}].map(f=>(
                  <div key={f.k}>
                    <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>{f.l}</label>
                    <input value={(proofForm as any)[f.k]} onChange={e=>setProofForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={inp} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
                  </div>
                ))}
                <div>
                  <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>Event Type</label>
                  <select value={proofForm.event_type} onChange={e=>setProofForm(p=>({...p,event_type:e.target.value}))} style={sel}>
                    <option value="payout">Payout Received</option>
                    <option value="challenge_pass">Challenge Passed</option>
                    <option value="funded">Got Funded</option>
                  </select>
                </div>
              </div>
              <div style={{display:'flex',gap:10}}>
                <Btn onClick={saveProof} disabled={!proofForm.trader_name}>Add to Feed</Btn>
                <Btn onClick={()=>setShowProofForm(false)} variant="ghost">Cancel</Btn>
              </div>
            </Card>
          )}

          <Card style={{padding:0,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr style={{background:A.surf2}}>
                {['Trader','Event','Amount','Challenge','Date','Visible','Actions'].map(h=>(
                  <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:A.txtC,letterSpacing:'.08em',borderBottom:`1px solid ${A.bord}`}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {proofItems.slice(0,100).map(p=>(
                  <tr key={p.id} style={{borderBottom:`1px solid ${A.bord}`,opacity:p.is_visible?1:.5}}>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span style={{fontSize:18}}>{p.trader_flag??'🌍'}</span>
                        <div>
                          <div style={{fontSize:13,fontWeight:600,color:A.white}}>{p.trader_name}</div>
                          <div style={{fontSize:10,color:A.txtD}}>{p.trader_country}</div>
                        </div>
                        {p.is_verified&&<span style={{fontSize:10,color:A.green,marginLeft:4}}>✓ verified</span>}
                      </div>
                    </td>
                    <td style={{padding:'10px 14px'}}><Pill label={p.event_type} color={A.green}/></td>
                    <td style={{padding:'10px 14px',fontSize:14,fontWeight:700,color:A.green}}>{p.amount?`$${parseFloat(p.amount).toLocaleString()}`:'—'}</td>
                    <td style={{padding:'10px 14px',fontSize:12,color:A.txtB}}>{p.challenge_name||'—'}</td>
                    <td style={{padding:'10px 14px',fontSize:11,color:A.txtD}}>{new Date(p.occurred_at).toLocaleDateString()}</td>
                    <td style={{padding:'10px 14px'}}><Toggle checked={p.is_visible} onChange={(v: boolean)=>toggleProof(p.id,v)}/></td>
                    <td style={{padding:'10px 14px'}}><Btn onClick={()=>deleteProof(p.id)} variant="danger" style={{padding:'5px 10px',fontSize:11}}>✗</Btn></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {proofItems.length===0&&<div style={{textAlign:'center',padding:40,color:A.txtC}}>No social proof events yet. Click "Auto-generate from Payouts" to populate from real data.</div>}
          </Card>

          {/* Integration snippet */}
          <Card style={{marginTop:20,background:'rgba(63,143,224,.04)',borderColor:'rgba(63,143,224,.2)'}}>
            <div style={{fontSize:13,fontWeight:700,color:A.white,marginBottom:8}}>📋 Landing Page Integration</div>
            <div style={{fontSize:12,color:A.txtB,marginBottom:10}}>Add this to your landing page to show the live social proof ticker:</div>
            <pre style={{fontSize:11,color:A.blueL,background:A.surf2,padding:'12px 14px',borderRadius:8,overflow:'auto',fontFamily:'monospace',lineHeight:1.8}}>{`fetch('/api/v1/marketing/social-proof/public?limit=20')
  .then(r => r.json())
  .then(events => {
    // events: [{ trader_name, amount, challenge_name, trader_flag, occurred_at }]
    // Render your ticker/notification widget here
  });`}</pre>
          </Card>
        </div>
      )}
    </div>
  );
}
