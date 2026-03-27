import { useState, useEffect } from 'react';
import { A, api, inp, Card, Btn } from './_shared.js';
export default function EmailTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [form, setForm] = useState<any>({subject:'',html_body:''});
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  useEffect(() => { api('/api/v1/email-templates').then(d=>setTemplates(Array.isArray(d)?d:[])); }, []);
  function selectTmpl(t: any) { setSel(t); setForm({subject:t.subject,html_body:t.html_body}); setEditing(false); }
  async function save() { await api(`/api/v1/email-templates/${sel.key}`,{method:'PATCH',body:JSON.stringify(form)}); setTemplates(ts=>ts.map(t=>t.key===sel.key?{...t,...form}:t)); setEditing(false); setSaved(true); setTimeout(()=>setSaved(false),2000); }
  async function sendTest() { if(!testEmail)return; await api(`/api/v1/email-templates/${sel.key}/test`,{method:'POST',body:JSON.stringify({email:testEmail})}); alert(`Test sent to ${testEmail}`); }
  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <div style={{marginBottom:20}}><h1 style={{fontSize:22,fontWeight:800,color:A.white,marginBottom:4}}>Email Templates</h1><p style={{fontSize:13,color:A.txtB}}>Edit all transactional emails sent to traders. Changes apply to all future sends.</p></div>
      <div style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:20}}>
        <div>{templates.map(t=>(
          <div key={t.key} onClick={()=>selectTmpl(t)} style={{padding:'12px 14px',borderRadius:10,marginBottom:6,cursor:'pointer',background:sel?.key===t.key?'rgba(63,143,224,.15)':A.surf,border:`1px solid ${sel?.key===t.key?A.blue:A.bord}`,transition:'all .15s'}} onMouseEnter={e=>(e.currentTarget as any).style.borderColor=A.blue} onMouseLeave={e=>(e.currentTarget as any).style.borderColor=sel?.key===t.key?A.blue:A.bord}>
            <div style={{fontSize:13,fontWeight:700,color:A.white,marginBottom:2}}>{t.label}</div>
            <div style={{fontSize:11,color:A.txtC,fontFamily:'monospace'}}>{t.key}</div>
          </div>
        ))}</div>
        {sel?(
          <Card>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div><h2 style={{fontSize:15,fontWeight:700,color:A.white,marginBottom:6}}>{sel.label}</h2><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{(sel.variables||[]).map((v:string)=><code key={v} style={{fontSize:10,background:A.surf2,padding:'2px 8px',borderRadius:4,color:A.blueL}}>{`{{${v}}}`}</code>)}</div></div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {saved&&<span style={{fontSize:12,color:A.green}}>✓ Saved</span>}
                {!editing&&<Btn onClick={()=>setEditing(true)} variant="ghost" style={{padding:'6px 12px',fontSize:12}}>✏️ Edit</Btn>}
                {editing&&<><Btn onClick={()=>setEditing(false)} variant="ghost" style={{padding:'6px 12px',fontSize:12}}>Cancel</Btn><Btn onClick={save} style={{padding:'6px 12px',fontSize:12}}>Save</Btn></>}
              </div>
            </div>
            <div style={{marginBottom:12}}><label style={{fontSize:11,color:A.txtB,display:'block',marginBottom:5}}>Subject</label>
              {editing?<input value={form.subject} onChange={e=>setForm((p:any)=>({...p,subject:e.target.value}))} style={inp} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>:<div style={{padding:'10px 14px',background:A.surf2,borderRadius:8,fontSize:13,color:A.txtA}}>{form.subject}</div>}
            </div>
            <div style={{marginBottom:12}}><label style={{fontSize:11,color:A.txtB,display:'block',marginBottom:5}}>HTML Body</label>
              {editing?<textarea value={form.html_body} onChange={e=>setForm((p:any)=>({...p,html_body:e.target.value}))} rows={10} style={{...inp,resize:'vertical',fontFamily:'monospace',fontSize:12}} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>:<div style={{padding:'12px',background:A.surf2,borderRadius:8,fontSize:12,color:A.txtB,fontFamily:'monospace',maxHeight:180,overflow:'auto'}} dangerouslySetInnerHTML={{__html:form.html_body}}/>}
            </div>
            <div style={{display:'flex',gap:10,alignItems:'center',paddingTop:14,borderTop:`1px solid ${A.bord}`}}>
              <input value={testEmail} onChange={e=>setTestEmail(e.target.value)} placeholder="test@example.com" style={{...inp,width:220}} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
              <Btn onClick={sendTest} variant="ghost" style={{padding:'8px 16px',fontSize:12}}>📧 Send Test</Btn>
            </div>
          </Card>
        ):<Card><div style={{textAlign:'center',padding:60,color:A.txtC}}>Select a template to edit</div></Card>}
      </div>
    </div>
  );
}
