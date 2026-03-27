import { useState, useEffect } from 'react';
import { A, api, inp, sel, Card, Btn, Pill, Toggle } from './_shared.js';
export default function PromoCodes() {
  const [codes, setCodes] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({code:'',description:'',discount_type:'percentage',discount_value:'',min_purchase:'',max_uses:'',valid_until:'',enabled:true});
  useEffect(() => { api('/api/v1/promo-codes').then(d=>setCodes(Array.isArray(d)?d:[])); }, []);
  const up = (k: string) => (e: any) => setForm(p=>({...p,[k]:e.target.value}));
  async function create(e: any) {
    e.preventDefault();
    await api('/api/v1/promo-codes', { method:'POST', body:JSON.stringify({...form,discount_value:parseFloat(form.discount_value),min_purchase:form.min_purchase?parseFloat(form.min_purchase):0,max_uses:form.max_uses?parseInt(form.max_uses):null,valid_until:form.valid_until||null}) });
    api('/api/v1/promo-codes').then(d=>setCodes(Array.isArray(d)?d:[])); setShow(false);
  }
  async function toggleCode(id: string, enabled: boolean) { await api(`/api/v1/promo-codes/${id}`,{method:'PATCH',body:JSON.stringify({enabled})}); setCodes(c=>c.map(x=>x.id===id?{...x,enabled}:x)); }
  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:A.white,marginBottom:4}}>Promo Codes</h1><p style={{fontSize:13,color:A.txtB}}>Create and manage discount codes. Validated at checkout in real time.</p></div>
        <Btn onClick={()=>setShow(s=>!s)}>{show?'× Cancel':'+ Create Code'}</Btn>
      </div>
      {show && <Card style={{marginBottom:20}}>
        <div style={{fontSize:14,fontWeight:700,color:A.white,marginBottom:16}}>New Promo Code</div>
        <form onSubmit={create}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:12}}>
            {[{l:'Code',k:'code',ph:'SUMMER25',req:true},{l:'Description',k:'description',ph:'Summer sale'},{l:'Discount Value',k:'discount_value',ph:'20',req:true,type:'number'}].map(f=>(
              <div key={f.k}><label style={{fontSize:11,color:A.txtB,display:'block',marginBottom:5}}>{f.l}</label>
              <input type={(f as any).type||'text'} required={!!(f as any).req} value={(form as any)[f.k]} onChange={up(f.k)} placeholder={f.ph} style={inp} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/></div>
            ))}
            <div><label style={{fontSize:11,color:A.txtB,display:'block',marginBottom:5}}>Type</label>
              <select value={form.discount_type} onChange={up('discount_type')} style={sel}><option value="percentage">Percentage (%)</option><option value="fixed">Fixed ($)</option></select></div>
            <div><label style={{fontSize:11,color:A.txtB,display:'block',marginBottom:5}}>Max Uses</label><input type="number" value={form.max_uses} onChange={up('max_uses')} placeholder="Unlimited" style={inp}/></div>
            <div><label style={{fontSize:11,color:A.txtB,display:'block',marginBottom:5}}>Valid Until</label><input type="datetime-local" value={form.valid_until} onChange={up('valid_until')} style={inp}/></div>
          </div>
          <Btn>Create Promo Code</Btn>
        </form>
      </Card>}
      <Card style={{padding:0,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead><tr style={{background:A.surf2}}>{['Code','Discount','Uses','Valid Until','Status','Toggle'].map(h=><th key={h} style={{padding:'10px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:A.txtC,letterSpacing:'.08em',borderBottom:`1px solid ${A.bord}`}}>{h}</th>)}</tr></thead>
          <tbody>{codes.map(c=>(
            <tr key={c.id} style={{borderBottom:`1px solid ${A.bord}`}}>
              <td style={{padding:'11px 16px'}}><code style={{fontSize:13,fontWeight:800,color:A.blueL}}>{c.code}</code></td>
              <td style={{padding:'11px 16px',fontSize:13,fontWeight:700,color:A.green}}>{c.discount_type==='percentage'?`${c.discount_value}%`:`$${c.discount_value}`}</td>
              <td style={{padding:'11px 16px',fontSize:13,color:A.txtB}}>{c.used_count}/{c.max_uses??'∞'}</td>
              <td style={{padding:'11px 16px',fontSize:12,color:A.txtC}}>{c.valid_until?new Date(c.valid_until).toLocaleDateString():'No expiry'}</td>
              <td style={{padding:'11px 16px'}}><Pill label={c.enabled?'Active':'Inactive'} color={c.enabled?A.green:A.red}/></td>
              <td style={{padding:'11px 16px'}}><Toggle checked={c.enabled} onChange={(v: boolean)=>toggleCode(c.id,v)}/></td>
            </tr>
          ))}</tbody>
        </table>
        {codes.length===0&&<div style={{textAlign:'center',padding:40,color:A.txtC}}>No promo codes yet</div>}
      </Card>
    </div>
  );
}
