import { useState, useEffect } from 'react';
import { A, api, sel, Card, Pill, Toggle } from './_shared.js';
export default function CountryControls() {
  const [countries, setCountries] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('all');
  const [saving, setSaving] = useState<string|null>(null);
  useEffect(() => { api('/api/v1/country-controls').then(d=>setCountries(Array.isArray(d)?d:[])); }, []);
  async function patch(code: string, data: any) {
    setSaving(code);
    await api(`/api/v1/country-controls/${code}`,{method:'PATCH',body:JSON.stringify(data)});
    setCountries(c=>c.map(x=>x.country_code===code?{...x,...data}:x));
    setSaving(null);
  }
  const TIER_COL: any = {standard:A.green,enhanced:A.gold,restricted:A.red};
  const filtered = countries.filter(c=>(tier==='all'||c.risk_tier===tier)&&(c.country_name?.toLowerCase().includes(search.toLowerCase())||c.country_code?.toLowerCase().includes(search.toLowerCase())));
  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <div style={{marginBottom:24}}><h1 style={{fontSize:22,fontWeight:800,color:A.white,marginBottom:4}}>Country Controls</h1><p style={{fontSize:13,color:A.txtB}}>Toggle registration, payouts, and KYC per country. Instant effect.</p></div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:18}}>
        {[{l:'Open',val:countries.filter(c=>c.registration).length,col:A.green},{l:'Enhanced',val:countries.filter(c=>c.risk_tier==='enhanced').length,col:A.gold},{l:'Restricted',val:countries.filter(c=>c.risk_tier==='restricted').length,col:A.red}].map(s=>(
          <Card key={s.l}><div style={{fontSize:22,fontWeight:800,color:s.col}}>{s.val}</div><div style={{fontSize:11,color:A.txtC}}>{s.l}</div></Card>
        ))}
      </div>
      <div style={{display:'flex',gap:10,marginBottom:16}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search countries…" style={{width:220,background:'rgba(255,255,255,.05)',color:A.white,border:`1px solid ${A.bord}`,borderRadius:8,padding:'8px 12px',fontSize:13,outline:'none',fontFamily:'inherit'}} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
        {['all','standard','enhanced','restricted'].map(t=><button key={t} onClick={()=>setTier(t)} style={{padding:'7px 14px',borderRadius:20,border:`1px solid ${tier===t?A.blue:A.bord}`,background:tier===t?'rgba(63,143,224,.15)':'transparent',color:tier===t?A.blueL:A.txtB,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
      </div>
      <Card style={{padding:0,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{background:A.surf2}}>{['Country','Code','Risk Tier','Registration','Payouts','KYC Required'].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:A.txtC,borderBottom:`1px solid ${A.bord}`}}>{h}</th>)}</tr></thead>
          <tbody>{filtered.map(c=>(
            <tr key={c.country_code} style={{borderBottom:`1px solid ${A.bord}`,opacity:saving===c.country_code?0.6:1}}>
              <td style={{padding:'10px 14px',fontSize:13,color:A.white,fontWeight:600}}>{c.country_name}</td>
              <td style={{padding:'10px 14px'}}><code style={{fontSize:12,color:A.blueL}}>{c.country_code}</code></td>
              <td style={{padding:'10px 14px'}}>
                <select value={c.risk_tier} onChange={e=>patch(c.country_code,{...c,risk_tier:e.target.value})} style={{...sel,width:'auto',padding:'4px 10px',fontSize:12,color:TIER_COL[c.risk_tier]||A.txtB}}>
                  <option value="standard">Standard</option><option value="enhanced">Enhanced</option><option value="restricted">Restricted</option>
                </select>
              </td>
              <td style={{padding:'10px 14px'}}><Toggle checked={c.registration} onChange={(v:boolean)=>patch(c.country_code,{...c,registration:v})}/></td>
              <td style={{padding:'10px 14px'}}><Toggle checked={c.payouts} onChange={(v:boolean)=>patch(c.country_code,{...c,payouts:v})}/></td>
              <td style={{padding:'10px 14px'}}><Toggle checked={c.kyc_required} onChange={(v:boolean)=>patch(c.country_code,{...c,kyc_required:v})}/></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
}
