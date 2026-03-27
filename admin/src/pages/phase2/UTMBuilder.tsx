import { useState, useEffect } from 'react';
import { A, api, inp, sel, Card, Btn, Pill } from '../ops/_shared.js';

const SOURCES = ['google','facebook','instagram','tiktok','twitter','linkedin','bing','youtube','email','whatsapp','affiliate','organic','direct','newsletter','podcast','other'];
const MEDIUMS = ['cpc','cpm','email','social','affiliate','organic','seo','banner','video','push','sms','qr','influencer','referral','other'];

const PLATFORM_ICONS: Record<string,string> = {
  google:'🔵',facebook:'🟦',instagram:'🟣',tiktok:'⬛',twitter:'🐦',linkedin:'🔷',
  bing:'🟩',youtube:'🔴',email:'📧',whatsapp:'💬',affiliate:'🔗',organic:'🌿',direct:'➡️',other:'🌐',
};

const EMPTY_FORM = {
  name:'', destination_url:'https://', utm_source:'google', utm_medium:'cpc',
  utm_campaign:'', utm_term:'', utm_content:'', utm_id:'',
  custom_params:{} as Record<string,string>, tags:[] as string[], notes:'', short_code:''
};

export default function UTMBuilder() {
  const [links, setLinks] = useState<any[]>([]);
  const [form, setForm] = useState({...EMPTY_FORM});
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);
  const [copied, setCopied] = useState<string|null>(null);
  const [search, setSearch] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customVal, setCustomVal] = useState('');
  const [activeTab, setActiveTab] = useState<'builder'|'clicks'|'campaigns'>('builder');
  const [clicks, setClicks] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [campForm, setCampForm] = useState({name:'',platform:'google',utm_campaign:'',budget:'',status:'active',notes:''});
  const [showCampForm, setShowCampForm] = useState(false);

  useEffect(() => {
    api('/api/v1/utm').then(d=>setLinks(Array.isArray(d)?d:[]));
    api('/api/v1/utm/clicks?limit=200').then(d=>setClicks(Array.isArray(d)?d:[]));
    api('/api/v1/utm/campaigns').then(d=>setCampaigns(Array.isArray(d)?d:[]));
  }, []);

  const up = (k: string) => (v: any) => setForm(f=>({...f,[k]:v}));

  function buildPreview(): string {
    try {
      const url = new URL(form.destination_url||'https://holaprime.com');
      const p: Record<string,string> = {
        utm_source: form.utm_source,
        utm_medium: form.utm_medium,
        utm_campaign: form.utm_campaign,
      };
      if (form.utm_term)    p.utm_term    = form.utm_term;
      if (form.utm_content) p.utm_content = form.utm_content;
      if (form.utm_id)      p.utm_id      = form.utm_id;
      for (const [k,v] of Object.entries(form.custom_params)) {
        if (k&&v) p[k]=v;
      }
      for (const [k,v] of Object.entries(p)) { if(v) url.searchParams.set(k,v); }
      return url.toString();
    } catch { return ''; }
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id); setTimeout(()=>setCopied(null),2000);
  }

  async function save() {
    if(!form.name||!form.utm_source||!form.utm_medium||!form.utm_campaign) return;
    if(editId) {
      await api(`/api/v1/utm/${editId}`, {method:'PATCH', body:JSON.stringify(form)});
      api('/api/v1/utm').then(d=>setLinks(Array.isArray(d)?d:[]));
    } else {
      const row = await api('/api/v1/utm', {method:'POST', body:JSON.stringify(form)});
      if(row?.id) setLinks(l=>[row,...l]);
    }
    setShowForm(false); setEditId(null); setForm({...EMPTY_FORM});
  }

  async function deleteLink(id: string) {
    await api(`/api/v1/utm/${id}`, {method:'DELETE'});
    setLinks(l=>l.filter(x=>x.id!==id));
  }

  async function saveCampaign() {
    const row = await api('/api/v1/utm/campaigns', {method:'POST', body:JSON.stringify(campForm)});
    if(row?.id) setCampaigns(c=>[{...campForm,...row},  ...c]);
    setShowCampForm(false); setCampForm({name:'',platform:'google',utm_campaign:'',budget:'',status:'active',notes:''});
  }

  const filtered = links.filter(l=>
    l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.utm_campaign?.toLowerCase().includes(search.toLowerCase()) ||
    l.utm_source?.toLowerCase().includes(search.toLowerCase())
  );

  const CHANNEL_COLORS: Record<string,string> = {
    google_ads:'#4285F4',meta_ads:'#1877F2',tiktok_ads:'#010101',
    twitter_ads:'#1DA1F2',linkedin_ads:'#0A66C2',bing_ads:'#008373',
    email:'#F59E0B',affiliate:'#10B981',organic:'#22C55E',direct:'#94A3B8',paid_other:'#8B5CF6'
  };

  // Click stats by channel
  const channelStats = clicks.reduce((acc: any, c: any) => {
    const ch = c.channel||'direct';
    if(!acc[ch]) acc[ch]={channel:ch,clicks:0,conversions:0};
    acc[ch].clicks++;
    if(c.user_id) acc[ch].conversions++;
    return acc;
  }, {});

  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <div style={{marginBottom:24}}>
        <h1 style={{fontSize:22,fontWeight:800,color:A.white,marginBottom:4}}>Marketing Attribution</h1>
        <p style={{fontSize:13,color:A.txtB}}>Build UTM links, track ad click IDs, and measure campaign performance end-to-end.</p>
      </div>

      {/* Stats bar */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
        {[
          {label:'Total Links',    val:links.length,                                             color:A.blue,  icon:'🔗'},
          {label:'Total Clicks',   val:clicks.length,                                            color:A.green, icon:'👆'},
          {label:'Conversions',    val:clicks.filter(c=>c.user_id).length,                       color:A.gold,  icon:'🎯'},
          {label:'Conv. Rate',     val:`${clicks.length?((clicks.filter(c=>c.user_id).length/clicks.length)*100).toFixed(1):0}%`, color:A.orange, icon:'📊'},
        ].map(s=>(
          <Card key={s.label}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:24}}>{s.icon}</span>
              <div>
                <div style={{fontSize:22,fontWeight:800,color:s.color}}>{s.val}</div>
                <div style={{fontSize:11,color:A.txtC}}>{s.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:2,marginBottom:20,background:A.surf2,borderRadius:10,padding:4,width:'fit-content'}}>
        {(['builder','clicks','campaigns'] as const).map(t=>(
          <button key={t} onClick={()=>setActiveTab(t)}
            style={{padding:'7px 22px',borderRadius:8,border:'none',background:activeTab===t?A.blue:'transparent',color:activeTab===t?'#fff':A.txtB,fontFamily:'inherit',fontSize:12,fontWeight:600,cursor:'pointer',textTransform:'capitalize'}}>
            {t==='builder'?`UTM Builder (${links.length})`:t==='clicks'?`Click IDs (${clicks.length})`:`Campaigns (${campaigns.length})`}
          </button>
        ))}
      </div>

      {/* ── UTM Builder tab ── */}
      {activeTab==='builder' && (
        <div>
          <div style={{display:'flex',gap:12,marginBottom:16,alignItems:'center'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search links…"
              style={{...inp,width:280}} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
            <Btn onClick={()=>{setShowForm(s=>!s);setEditId(null);setForm({...EMPTY_FORM});}} style={{marginLeft:'auto'}}>
              {showForm?'× Cancel':'+ New UTM Link'}
            </Btn>
          </div>

          {/* Create/Edit form */}
          {showForm && (
            <Card style={{marginBottom:20,borderColor:A.blue}}>
              <div style={{fontSize:15,fontWeight:700,color:A.white,marginBottom:18}}>
                {editId?'Edit UTM Link':'Build UTM Link'}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                <div style={{gridColumn:'1/-1'}}>
                  <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>Link Name (internal label) *</label>
                  <input value={form.name} onChange={e=>up('name')(e.target.value)} placeholder="e.g. Google Ads - August Challenge"
                    style={inp} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
                </div>
                <div style={{gridColumn:'1/-1'}}>
                  <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>Destination URL *</label>
                  <input value={form.destination_url} onChange={e=>up('destination_url')(e.target.value)} placeholder="https://holaprime.com/register"
                    style={inp} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
                </div>

                {/* UTM params */}
                {[
                  {l:'Source *',    k:'utm_source',   ph:'google',  opts:SOURCES},
                  {l:'Medium *',    k:'utm_medium',   ph:'cpc',     opts:MEDIUMS},
                  {l:'Campaign *',  k:'utm_campaign', ph:'august_challenge_2025'},
                  {l:'Term',        k:'utm_term',     ph:'prop trading'},
                  {l:'Content',     k:'utm_content',  ph:'banner_v1'},
                  {l:'UTM ID',      k:'utm_id',       ph:'custom_id_123'},
                ].map(f=>(
                  <div key={f.k}>
                    <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>{f.l}</label>
                    {(f as any).opts ? (
                      <div style={{display:'flex',gap:6}}>
                        <select value={(form as any)[f.k]} onChange={e=>up(f.k)(e.target.value)} style={{...sel,flex:'0 0 auto',width:'auto',padding:'10px 10px'}}>
                          {(f as any).opts.map((o: string)=><option key={o} value={o}>{PLATFORM_ICONS[o]??''} {o}</option>)}
                        </select>
                        <input value={(form as any)[f.k]} onChange={e=>up(f.k)(e.target.value)} placeholder={f.ph}
                          style={{...inp,flex:1}} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
                      </div>
                    ) : (
                      <input value={(form as any)[f.k]} onChange={e=>up(f.k)(e.target.value)} placeholder={f.ph}
                        style={inp} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
                    )}
                  </div>
                ))}

                {/* Custom params */}
                <div style={{gridColumn:'1/-1'}}>
                  <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>Custom Parameters</label>
                  <div style={{display:'flex',gap:8,marginBottom:8}}>
                    <input value={customKey} onChange={e=>setCustomKey(e.target.value)} placeholder="param_name"
                      style={{...inp,width:180,fontFamily:'monospace'}}/>
                    <input value={customVal} onChange={e=>setCustomVal(e.target.value)} placeholder="value"
                      style={{...inp,flex:1}}/>
                    <Btn onClick={()=>{if(customKey&&customVal){up('custom_params')({...form.custom_params,[customKey]:customVal});setCustomKey('');setCustomVal('');}}} variant="ghost" style={{padding:'9px 16px'}}>+ Add</Btn>
                  </div>
                  {Object.entries(form.custom_params).map(([k,v])=>(
                    <div key={k} style={{display:'inline-flex',alignItems:'center',gap:6,margin:'0 6px 6px 0',padding:'4px 10px',background:A.surf2,borderRadius:6,border:`1px solid ${A.bord}`}}>
                      <code style={{fontSize:11,color:A.blueL}}>{k}={v as string}</code>
                      <button onClick={()=>{const p={...form.custom_params};delete p[k];up('custom_params')(p);}} style={{background:'none',border:'none',color:A.red,cursor:'pointer',padding:0,fontSize:14}}>×</button>
                    </div>
                  ))}
                </div>

                <div>
                  <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>Short Code (for /go/ redirect)</label>
                  <input value={form.short_code} onChange={e=>up('short_code')(e.target.value)} placeholder="auto-generated if blank"
                    style={{...inp,fontFamily:'monospace'}} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
                </div>
                <div>
                  <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>Notes</label>
                  <input value={form.notes} onChange={e=>up('notes')(e.target.value)} placeholder="Internal notes…"
                    style={inp} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
                </div>
              </div>

              {/* Live preview */}
              {form.utm_campaign && (
                <div style={{marginBottom:14,padding:'12px 14px',background:A.surf2,borderRadius:9,border:`1px solid ${A.bord}`}}>
                  <div style={{fontSize:10,color:A.txtC,marginBottom:6,textTransform:'uppercase',letterSpacing:'.08em'}}>Generated URL Preview</div>
                  <div style={{fontSize:12,color:A.blueL,wordBreak:'break-all',fontFamily:'monospace',lineHeight:1.6}}>{buildPreview()}</div>
                  <button onClick={()=>copy(buildPreview(),'preview')} style={{marginTop:8,fontSize:11,color:copied==='preview'?A.green:A.blue,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:0}}>
                    {copied==='preview'?'✓ Copied!':'📋 Copy URL'}
                  </button>
                </div>
              )}

              <div style={{display:'flex',gap:10}}>
                <Btn onClick={save} disabled={!form.name||!form.utm_campaign}>{editId?'Save Changes':'Create Link'}</Btn>
                <Btn onClick={()=>{setShowForm(false);setEditId(null);}} variant="ghost">Cancel</Btn>
              </div>
            </Card>
          )}

          {/* Links table */}
          <Card style={{padding:0,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:A.surf2}}>
                  {['Name','Source / Medium','Campaign','Clicks','Conv.','URL','Actions'].map(h=>(
                    <th key={h} style={{padding:'11px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:A.txtC,letterSpacing:'.08em',borderBottom:`1px solid ${A.bord}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(link=>(
                  <tr key={link.id} style={{borderBottom:`1px solid ${A.bord}`}}
                    onMouseEnter={e=>(e.currentTarget as any).style.background='rgba(255,255,255,.02)'}
                    onMouseLeave={e=>(e.currentTarget as any).style.background=''}>
                    <td style={{padding:'11px 14px'}}>
                      <div style={{fontSize:13,fontWeight:700,color:A.white}}>{link.name}</div>
                      {link.notes&&<div style={{fontSize:11,color:A.txtD}}>{link.notes}</div>}
                    </td>
                    <td style={{padding:'11px 14px'}}>
                      <div style={{display:'flex',flexDirection:'column',gap:3}}>
                        <Pill label={`${PLATFORM_ICONS[link.utm_source]??''} ${link.utm_source}`} color={CHANNEL_COLORS[link.utm_source]??A.blue}/>
                        <span style={{fontSize:11,color:A.txtC}}>{link.utm_medium}</span>
                      </div>
                    </td>
                    <td style={{padding:'11px 14px',fontSize:13,color:A.txtA,maxWidth:200}}>
                      <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{link.utm_campaign}</div>
                    </td>
                    <td style={{padding:'11px 14px',fontSize:14,fontWeight:700,color:A.green}}>{link.total_clicks}</td>
                    <td style={{padding:'11px 14px',fontSize:13,color:A.txtB}}>{link.conversions}</td>
                    <td style={{padding:'11px 14px',maxWidth:220}}>
                      <div style={{fontSize:11,color:A.blueL,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:'monospace',marginBottom:4}}>
                        {link.full_url?.slice(0,80)}…
                      </div>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>copy(link.full_url,'url_'+link.id)} style={{fontSize:10,color:copied==='url_'+link.id?A.green:A.blue,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:0}}>
                          {copied==='url_'+link.id?'✓ Copied':'📋 Full URL'}
                        </button>
                        {link.short_code&&(
                          <button onClick={()=>copy(`${window.location.origin}/api/v1/utm/go/${link.short_code}`,'short_'+link.id)} style={{fontSize:10,color:copied==='short_'+link.id?A.green:A.txtC,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',padding:0}}>
                            🔗 Short link
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{padding:'11px 14px'}}>
                      <div style={{display:'flex',gap:6}}>
                        <Btn onClick={()=>{setEditId(link.id);setForm({...link,custom_params:link.custom_params??{},tags:link.tags??[],short_code:link.short_code??''});setShowForm(true);}} variant="ghost" style={{padding:'5px 10px',fontSize:11}}>✏️</Btn>
                        <Btn onClick={()=>deleteLink(link.id)} variant="danger" style={{padding:'5px 10px',fontSize:11}}>✗</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length===0&&<div style={{textAlign:'center',padding:40,color:A.txtC}}>No UTM links yet. Create your first one above.</div>}
          </Card>
        </div>
      )}

      {/* ── Click IDs tab ── */}
      {activeTab==='clicks' && (
        <div>
          {/* Channel breakdown */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}}>
            {Object.values(channelStats).sort((a: any,b: any)=>b.clicks-a.clicks).slice(0,8).map((ch: any)=>(
              <Card key={ch.channel} style={{borderLeft:`3px solid ${CHANNEL_COLORS[ch.channel]??A.bord}`}}>
                <div style={{fontSize:12,fontWeight:700,color:A.white,marginBottom:4}}>{ch.channel.replace('_',' ')}</div>
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <div><div style={{fontSize:18,fontWeight:800,color:A.blue}}>{ch.clicks}</div><div style={{fontSize:10,color:A.txtD}}>clicks</div></div>
                  <div><div style={{fontSize:18,fontWeight:800,color:A.green}}>{ch.conversions}</div><div style={{fontSize:10,color:A.txtD}}>converted</div></div>
                </div>
              </Card>
            ))}
          </div>

          <Card style={{padding:0,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:A.surf2}}>
                  {['Click ID','Channel','Source','Campaign','Device','Country','Converted To','Date'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:A.txtC,letterSpacing:'.08em',borderBottom:`1px solid ${A.bord}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clicks.map(c=>(
                  <tr key={c.click_id} style={{borderBottom:`1px solid ${A.bord}`}}>
                    <td style={{padding:'9px 14px'}}>
                      <code style={{fontSize:11,color:A.blueL,background:'rgba(63,143,224,.08)',padding:'2px 6px',borderRadius:4}}>{c.click_id}</code>
                      {c.gclid&&<div style={{fontSize:9,color:A.txtD,marginTop:2}}>gclid: {c.gclid.slice(0,12)}…</div>}
                      {c.fbclid&&<div style={{fontSize:9,color:A.txtD,marginTop:2}}>fbclid: {c.fbclid.slice(0,12)}…</div>}
                    </td>
                    <td style={{padding:'9px 14px'}}><Pill label={c.channel||'direct'} color={CHANNEL_COLORS[c.channel]??A.txtC}/></td>
                    <td style={{padding:'9px 14px',fontSize:12,color:A.txtB}}>{c.utm_source||'—'}</td>
                    <td style={{padding:'9px 14px',fontSize:12,color:A.txtB,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.utm_campaign||'—'}</td>
                    <td style={{padding:'9px 14px',fontSize:12,color:A.txtC}}>{c.device_type||'—'}</td>
                    <td style={{padding:'9px 14px',fontSize:12,color:A.txtC}}>{c.country_code||'—'}</td>
                    <td style={{padding:'9px 14px'}}>
                      {c.user_id ? (
                        <div>
                          <Pill label={c.conversion_event||'signup'} color={A.green}/>
                          <div style={{fontSize:11,color:A.txtC,marginTop:3}}>{c.email}</div>
                        </div>
                      ) : <span style={{color:A.txtD,fontSize:12}}>Not converted</span>}
                    </td>
                    <td style={{padding:'9px 14px',fontSize:11,color:A.txtD}}>{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {clicks.length===0&&<div style={{textAlign:'center',padding:40,color:A.txtC}}>No clicks tracked yet</div>}
          </Card>
        </div>
      )}

      {/* ── Campaigns tab ── */}
      {activeTab==='campaigns' && (
        <div>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
            <Btn onClick={()=>setShowCampForm(s=>!s)}>{showCampForm?'× Cancel':'+ New Campaign'}</Btn>
          </div>

          {showCampForm&&(
            <Card style={{marginBottom:16,borderColor:A.blue}}>
              <div style={{fontSize:14,fontWeight:700,color:A.white,marginBottom:14}}>New Campaign</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:12}}>
                {[{l:'Name',k:'name',ph:'Q3 Google Search'},{l:'UTM Campaign',k:'utm_campaign',ph:'august_challenge'},{l:'Budget ($)',k:'budget',ph:'5000'}].map(f=>(
                  <div key={f.k}>
                    <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>{f.l}</label>
                    <input value={(campForm as any)[f.k]} onChange={e=>setCampForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={inp}/>
                  </div>
                ))}
                <div>
                  <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>Platform</label>
                  <select value={campForm.platform} onChange={e=>setCampForm(p=>({...p,platform:e.target.value}))} style={sel}>
                    {['google','meta','tiktok','twitter','linkedin','bing','email','organic','other'].map(p=><option key={p} value={p}>{PLATFORM_ICONS[p]??''} {p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>Status</label>
                  <select value={campForm.status} onChange={e=>setCampForm(p=>({...p,status:e.target.value}))} style={sel}>
                    <option value="active">Active</option><option value="paused">Paused</option><option value="ended">Ended</option>
                  </select>
                </div>
                <div>
                  <label style={{fontSize:11,color:A.txtC,display:'block',marginBottom:5}}>Notes</label>
                  <input value={campForm.notes} onChange={e=>setCampForm(p=>({...p,notes:e.target.value}))} placeholder="Optional notes" style={inp}/>
                </div>
              </div>
              <Btn onClick={saveCampaign} disabled={!campForm.name}>Create Campaign</Btn>
            </Card>
          )}

          <Card style={{padding:0,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:A.surf2}}>
                  {['Campaign','Platform','Budget','Spend','Clicks','Conv.','Revenue','ROAS','Status'].map(h=>(
                    <th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:A.txtC,letterSpacing:'.08em',borderBottom:`1px solid ${A.bord}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c=>(
                  <tr key={c.id} style={{borderBottom:`1px solid ${A.bord}`}}>
                    <td style={{padding:'10px 14px'}}>
                      <div style={{fontSize:13,fontWeight:700,color:A.white}}>{c.name}</div>
                      <div style={{fontSize:11,color:A.txtD,fontFamily:'monospace'}}>{c.utm_campaign}</div>
                    </td>
                    <td style={{padding:'10px 14px'}}><Pill label={`${PLATFORM_ICONS[c.platform]??''} ${c.platform}`} color={CHANNEL_COLORS[c.platform+'_ads']??A.txtC}/></td>
                    <td style={{padding:'10px 14px',fontSize:13,color:A.txtB}}>{c.budget?`$${parseFloat(c.budget).toLocaleString()}`:'—'}</td>
                    <td style={{padding:'10px 14px',fontSize:13,color:A.txtB}}>{c.spend?`$${parseFloat(c.spend).toLocaleString()}`:'$0'}</td>
                    <td style={{padding:'10px 14px',fontSize:13,color:A.txtA}}>{c.clicks||0}</td>
                    <td style={{padding:'10px 14px',fontSize:13,color:A.green}}>{c.conversions||0}</td>
                    <td style={{padding:'10px 14px',fontSize:13,fontWeight:700,color:A.green}}>{c.revenue?`$${parseFloat(c.revenue).toLocaleString()}`:'$0'}</td>
                    <td style={{padding:'10px 14px',fontSize:13,fontWeight:700,color:c.spend&&c.revenue?(parseFloat(c.revenue)/parseFloat(c.spend))>2?A.green:A.gold:A.txtC}}>
                      {c.spend&&c.revenue?(parseFloat(c.revenue)/parseFloat(c.spend)).toFixed(2)+'x':'—'}
                    </td>
                    <td style={{padding:'10px 14px'}}><Pill label={c.status} color={c.status==='active'?A.green:c.status==='paused'?A.gold:A.txtC}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {campaigns.length===0&&<div style={{textAlign:'center',padding:40,color:A.txtC}}>No campaigns yet</div>}
          </Card>
        </div>
      )}
    </div>
  );
}

const CHANNEL_COLORS: Record<string,string> = {
  google_ads:'#4285F4',meta_ads:'#1877F2',tiktok_ads:'#69C9D0',
  twitter_ads:'#1DA1F2',linkedin_ads:'#0A66C2',bing_ads:'#008373',
  email:'#F59E0B',affiliate:'#10B981',organic:'#22C55E',
  organic_social:'#14B8A6',direct:'#94A3B8',paid_other:'#8B5CF6'
};
