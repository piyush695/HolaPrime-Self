import { useState, useEffect } from 'react';

const A = { bg:'#0F1117',surf:'#161B27',surf2:'#1C2333',bord:'#252D3D',bordL:'#2E3850',blue:'#3F8FE0',blueL:'#60A9F0',blueD:'#1E5FAE',white:'#F5F8FF',txtA:'#D8E0F0',txtB:'#8892B0',txtC:'#4F5669',green:'#38BA82',red:'#FF4C6A',gold:'#F4C430',orange:'#F97316' };
const getToken = () => { try { return JSON.parse(localStorage.getItem('hp-admin-auth')!).state?.accessToken; } catch { return null; } };
const api = (p: string, o?: RequestInit) => fetch(p, { ...o, headers: { 'Content-Type':'application/json', ...(getToken() ? { Authorization:`Bearer ${getToken()}` } : {}), ...(o?.headers ?? {}) } }).then(r => r.json());
const inp: React.CSSProperties = { width:'100%',background:'rgba(255,255,255,.05)',color:A.white,border:`1px solid ${A.bord}`,borderRadius:8,padding:'10px 14px',fontSize:14,outline:'none',fontFamily:'inherit' };
function Card({ children, style = {} }: any) { return <div style={{ background:A.surf,border:`1px solid ${A.bord}`,borderRadius:12,padding:20,...style }}>{children}</div>; }
function Pill({ label, color }: any) { return <span style={{ fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:20,background:`${color}18`,border:`1px solid ${color}44`,color,letterSpacing:'.05em' }}>{label.toUpperCase()}</span>; }
function Toggle({ checked, onChange }: any) {
  return <div onClick={() => onChange(!checked)} style={{ width:44,height:24,borderRadius:12,position:'relative',cursor:'pointer',background:checked?A.blue:A.surf2,border:`1px solid ${checked?A.blue:A.bord}`,transition:'all .2s' }}>
    <div style={{ position:'absolute',top:2,left:checked?22:2,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left .2s',boxShadow:'0 2px 4px rgba(0,0,0,.3)' }}/>
  </div>;
}

export default function FeatureFlags() {
  const [flags, setFlags] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [saving, setSaving] = useState<string|null>(null);
  useEffect(() => { api('/api/v1/feature-flags').then(d => Array.isArray(d) ? setFlags(d) : setFlags([])); }, []);
  async function toggle(key: string, enabled: boolean) {
    setSaving(key);
    await api(`/api/v1/feature-flags/${key}`, { method:'PATCH', body:JSON.stringify({ enabled }) });
    setFlags(f => f.map(x => x.key===key ? {...x,enabled} : x));
    setSaving(null);
  }
  const cats = ['all','trader_portal','payouts','compliance','system','marketing'];
  const filtered = flags.filter(f => (cat==='all'||f.category===cat) && (f.label?.toLowerCase().includes(search.toLowerCase())||f.key?.includes(search.toLowerCase())));
  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22,fontWeight:800,color:A.white,marginBottom:4 }}>Feature Flags</h1>
        <p style={{ fontSize:13,color:A.txtB }}>Toggle any feature on or off site-wide. Changes take effect immediately — no deploy needed.</p>
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20 }}>
        {[{label:'Total',val:flags.length,color:A.blue},{label:'Enabled',val:flags.filter(f=>f.enabled).length,color:A.green},{label:'Disabled',val:flags.filter(f=>!f.enabled).length,color:A.red}].map(s=>(
          <Card key={s.label}><div style={{display:'flex',alignItems:'center',gap:12}}><div style={{fontSize:24,fontWeight:800,color:s.color}}>{s.val}</div><div style={{fontSize:12,color:A.txtC}}>{s.label}</div></div></Card>
        ))}
      </div>
      <div style={{ display:'flex',gap:10,marginBottom:18,flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{...inp,width:220}} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
        {cats.map(c=><button key={c} onClick={()=>setCat(c)} style={{padding:'7px 16px',borderRadius:20,border:`1px solid ${cat===c?A.blue:A.bord}`,background:cat===c?'rgba(63,143,224,.15)':'transparent',color:cat===c?A.blueL:A.txtB,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{c.replace('_',' ')}</button>)}
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12 }}>
        {filtered.map(flag=>(
          <Card key={flag.key} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16}}>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                <span style={{fontSize:14,fontWeight:700,color:A.white}}>{flag.label}</span>
                <Pill label={flag.category?.replace('_',' ')} color={A.txtC}/>
              </div>
              <p style={{fontSize:12,color:A.txtB,marginBottom:8}}>{flag.description}</p>
              <code style={{fontSize:10,color:A.txtC,background:A.surf2,padding:'2px 8px',borderRadius:4}}>{flag.key}</code>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6,flexShrink:0}}>
              {saving===flag.key ? <div style={{width:20,height:20,border:`2px solid ${A.blue}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite'}}/> : <Toggle checked={flag.enabled} onChange={(v: boolean)=>toggle(flag.key,v)}/>}
              <span style={{fontSize:11,color:flag.enabled?A.green:A.red,fontWeight:700}}>{flag.enabled?'ON':'OFF'}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
