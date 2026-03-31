import { useState, useEffect } from 'react';
import { A, api, inp, Card, Btn, Pill } from './_shared.js';

const EMPTY: any = { key:'', label:'', subject:'', html_body:'', text_body:'', variables:'' };

const STARTER_TEMPLATES = [
  { id:'blank', label:'Blank', html:'<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#ffffff">\n  <h1>{{subject_line}}</h1>\n  <p>Hi {{first_name}},</p>\n  <p>Your message here.</p>\n  <p>Best,<br/>Hola Prime Team</p>\n</div>' },
  { id:'dark', label:'Dark (branded)', html:`<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0B1120;color:#F1F5F9;border-radius:16px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#1B3A6B,#0B1120);padding:32px;text-align:center">
    <div style="font-size:24px;font-weight:900;color:#fff;letter-spacing:2px">HOLA PRIME</div>
  </div>
  <div style="padding:32px">
    <h1 style="font-size:22px;font-weight:800;margin:0 0 16px">Hi {{first_name}}!</h1>
    <p style="color:#94A3B8;line-height:1.7;font-size:15px">Your message here.</p>
    <div style="text-align:center;margin:32px 0">
      <a href="{{cta_url}}" style="display:inline-block;background:#3F8FE0;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px">
        {{cta_text}}
      </a>
    </div>
  </div>
  <div style="padding:16px 32px;border-top:1px solid #1E2535;text-align:center">
    <p style="color:#475569;font-size:12px;margin:0">Hola Prime Markets Ltd · <a href="{{support_url}}" style="color:#3F8FE0">Support</a></p>
  </div>
</div>` },
  { id:'otp', label:'OTP / Code', html:`<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0B1120;color:#F1F5F9;border-radius:16px;padding:40px;text-align:center">
  <div style="font-size:20px;font-weight:800;margin-bottom:24px">Your Verification Code</div>
  <div style="background:#1C2A3A;border-radius:12px;padding:24px;margin:24px 0;display:inline-block;min-width:200px">
    <div style="font-size:40px;font-weight:900;letter-spacing:12px;color:#4F8CF7">{{otp}}</div>
  </div>
  <p style="color:#94A3B8;font-size:13px">Expires in 10 minutes. Do not share this code.</p>
</div>` },
];

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({ subject:'', html_body:'', text_body:'' });
  const [editing, setEditing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<any>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testSent, setTestSent] = useState(false);
  const [previewMode, setPreviewMode] = useState<'code'|'preview'|'text'>('code');
  const [editorTab, setEditorTab] = useState<'template'|'starter'>('template');

  useEffect(() => {
    api('/api/v1/email-templates').then((d:any) => setTemplates(Array.isArray(d)?d:[]));
  }, []);

  function select(t: any) {
    setSel(t); setEditForm({ subject:t.subject, html_body:t.html_body, text_body:t.text_body??'' });
    setEditing(false); setShowCreate(false); setPreviewMode('code');
  }

  async function save() {
    await api(`/api/v1/email-templates/${sel.key}`,{method:'PATCH',body:JSON.stringify(editForm)});
    setTemplates((ts:any[]) => ts.map(t=>t.key===sel.key?{...t,...editForm}:t));
    setEditing(false); setSaved(true); setTimeout(()=>setSaved(false),2500);
  }

  async function create() {
    if (!createForm.key||!createForm.label||!createForm.subject||!createForm.html_body)
      { alert('Key, label, subject and HTML body are required'); return; }
    const vars = createForm.variables.split(',').map((v:string)=>v.trim()).filter(Boolean);
    const created = await api('/api/v1/email-templates',{method:'POST',body:JSON.stringify({...createForm,variables:vars})});
    setTemplates((ts:any[]) => [...ts, created]);
    select(created); setShowCreate(false); setCreateForm(EMPTY);
  }

  async function del(key: string) {
    if(!confirm('Delete this template?')) return;
    await api(`/api/v1/email-templates/${key}`,{method:'DELETE'});
    setTemplates((ts:any[]) => ts.filter(t=>t.key!==key));
    if(sel?.key===key) setSel(null);
  }

  async function sendTest() {
    if(!testEmail) return;
    await api(`/api/v1/email-templates/${sel.key}/test`,{method:'POST',body:JSON.stringify({email:testEmail})});
    setTestSent(true); setTimeout(()=>setTestSent(false),3000);
  }

  function detectVars(html: string) {
    return [...new Set((html.match(/\{\{(\w+)\}\}/g)??[]).map(m=>m.slice(2,-2)))];
  }

  function cf(k:string, v:string) { setCreateForm((p:any)=>({...p,[k]:v})); }
  function ef(k:string, v:string) { setEditForm((p:any)=>({...p,[k]:v})); }

  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h1 style={{fontSize:22,fontWeight:800,color:A.white,marginBottom:4}}>Email Templates</h1>
          <p style={{fontSize:13,color:A.txtB}}>Create and manage transactional emails. Supports HTML, plain text, variables, and test sending.</p>
        </div>
        <Btn onClick={()=>{setShowCreate(true);setSel(null)}} style={{padding:'9px 20px'}}>+ New Template</Btn>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:20}}>
        {/* List */}
        <div>
          {templates.map(t=>(
            <div key={t.key} onClick={()=>select(t)} style={{padding:'12px 14px',borderRadius:10,marginBottom:6,cursor:'pointer',
              background:sel?.key===t.key?'rgba(63,143,224,.15)':A.surf,
              border:`1px solid ${sel?.key===t.key?A.blue:A.bord}`,transition:'all .15s'}}
              onMouseEnter={e=>(e.currentTarget as any).style.borderColor=A.blue}
              onMouseLeave={e=>(e.currentTarget as any).style.borderColor=sel?.key===t.key?A.blue:A.bord}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{fontSize:13,fontWeight:700,color:A.white}}>{t.label}</div>
                <div style={{width:7,height:7,borderRadius:'50%',background:t.enabled?A.green:A.txtC}}/>
              </div>
              <div style={{fontSize:11,color:A.txtC,fontFamily:'monospace',marginTop:2}}>{t.key}</div>
              {(t.variables||[]).length>0 &&
                <div style={{fontSize:10,color:A.txtC,marginTop:4}}>{t.variables.length} variable{t.variables.length!==1?'s':''}</div>}
            </div>
          ))}
          {templates.length===0 &&
            <div style={{color:A.txtC,fontSize:13,textAlign:'center',padding:30}}>No templates yet</div>}
        </div>

        {/* Create form */}
        {showCreate && (
          <Card>
            <h2 style={{fontSize:15,fontWeight:700,color:A.white,marginBottom:16}}>New Email Template</h2>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
              <div>
                <label style={{fontSize:11,color:A.txtB,display:'block',marginBottom:5}}>Key * <span style={{color:A.txtC}}>(snake_case)</span></label>
                <input value={createForm.key} onChange={e=>cf('key',e.target.value)} placeholder="challenge_passed" style={inp}
                  onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
              </div>
              <div>
                <label style={{fontSize:11,color:A.txtB,display:'block',marginBottom:5}}>Display Label *</label>
                <input value={createForm.label} onChange={e=>cf('label',e.target.value)} placeholder="Challenge Passed" style={inp}
                  onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,color:A.txtB,display:'block',marginBottom:5}}>Subject *</label>
              <input value={createForm.subject} onChange={e=>cf('subject',e.target.value)} placeholder="Hi {{first_name}}, you passed! 🎉" style={inp}
                onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
            </div>

            {/* Starter template picker */}
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,color:A.txtB,display:'block',marginBottom:8}}>
                HTML Body * &nbsp;
                <span style={{color:A.txtC}}>— or start from a template:</span>
                {STARTER_TEMPLATES.map(st=>(
                  <button key={st.id} onClick={()=>cf('html_body',st.html)} style={{
                    marginLeft:8,padding:'2px 10px',borderRadius:6,border:`1px solid ${A.bord}`,
                    background:A.surf2,color:A.txtB,fontSize:11,cursor:'pointer'}}>
                    {st.label}
                  </button>
                ))}
              </label>
              <textarea value={createForm.html_body} onChange={e=>cf('html_body',e.target.value)} rows={10}
                placeholder="<h1>Hi {{first_name}}</h1><p>Your message here.</p>"
                style={{...inp,resize:'vertical',fontFamily:'monospace',fontSize:12}}
                onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
            </div>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,color:A.txtB,display:'block',marginBottom:5}}>Plain Text Body <span style={{color:A.txtC}}>(optional, fallback)</span></label>
              <textarea value={createForm.text_body} onChange={e=>cf('text_body',e.target.value)} rows={3}
                style={{...inp,resize:'vertical',fontSize:12}}
                onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,color:A.txtB,display:'block',marginBottom:5}}>
                Variables <span style={{color:A.txtC}}>(comma separated)</span>
                {createForm.html_body && (
                  <button onClick={()=>cf('variables',detectVars(createForm.html_body).join(', '))}
                    style={{marginLeft:8,padding:'2px 10px',borderRadius:6,border:`1px solid ${A.blue}`,background:'rgba(63,143,224,.1)',color:A.blueL,fontSize:11,cursor:'pointer'}}>
                    Auto-detect from HTML
                  </button>
                )}
              </label>
              <input value={createForm.variables} onChange={e=>cf('variables',e.target.value)} placeholder="first_name, last_name, challenge_name" style={inp}
                onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
            </div>
            <div style={{display:'flex',gap:10}}>
              <Btn onClick={create} style={{padding:'8px 20px'}}>Create Template</Btn>
              <Btn onClick={()=>{setShowCreate(false);setCreateForm(EMPTY)}} variant="ghost" style={{padding:'8px 16px'}}>Cancel</Btn>
            </div>
          </Card>
        )}

        {/* Edit view */}
        {sel && !showCreate && (
          <Card>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <h2 style={{fontSize:15,fontWeight:700,color:A.white,marginBottom:6}}>{sel.label}</h2>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {(sel.variables??[]).map((v:string)=>(
                    <code key={v} style={{fontSize:10,background:A.surf2,padding:'2px 8px',borderRadius:4,color:A.blueL}}>{`{{${v}}}`}</code>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                {saved && <span style={{fontSize:12,color:A.green,fontWeight:700}}>✓ Saved</span>}
                {/* Preview toggle */}
                <div style={{display:'flex',border:`1px solid ${A.bord}`,borderRadius:8,overflow:'hidden'}}>
                  {(['code','preview','text'] as const).map(m=>(
                    <button key={m} onClick={()=>{setPreviewMode(m);setEditing(m==='code')}} style={{
                      padding:'5px 12px',border:'none',cursor:'pointer',fontSize:11,fontWeight:700,
                      background:previewMode===m?A.blue:'transparent',color:previewMode===m?'#fff':A.txtB}}>
                      {m==='code'?'HTML':m==='preview'?'Preview':'Plain'}
                    </button>
                  ))}
                </div>
                {editing && <>
                  <Btn onClick={()=>{setEditing(false);setPreviewMode('code')}} variant="ghost" style={{padding:'6px 12px',fontSize:12}}>Cancel</Btn>
                  <Btn onClick={save} style={{padding:'6px 12px',fontSize:12}}>Save</Btn>
                </>}
                {!editing && <Btn onClick={()=>{setEditing(true);setPreviewMode('code')}} variant="ghost" style={{padding:'6px 12px',fontSize:12}}>✏️ Edit</Btn>}
                <Btn onClick={()=>del(sel.key)} variant="ghost" style={{padding:'6px 12px',fontSize:12,color:A.red,borderColor:A.red}}>Delete</Btn>
              </div>
            </div>

            {/* Subject */}
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,color:A.txtB,display:'block',marginBottom:5}}>Subject Line</label>
              {editing
                ? <input value={editForm.subject} onChange={e=>ef('subject',e.target.value)} style={inp}
                    onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
                : <div style={{padding:'10px 14px',background:A.surf2,borderRadius:8,fontSize:13,color:A.white}}>{editForm.subject}</div>}
            </div>

            {/* Body */}
            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,color:A.txtB,display:'block',marginBottom:5}}>
                {previewMode==='text'?'Plain Text Body':'HTML Body'}
                {editing && previewMode==='code' && (
                  <button onClick={()=>ef('variables', detectVars(editForm.html_body).join(','))}
                    style={{marginLeft:8,padding:'2px 10px',borderRadius:6,border:`1px solid ${A.blue}`,background:'rgba(63,143,224,.1)',color:A.blueL,fontSize:11,cursor:'pointer'}}>
                    Auto-detect variables
                  </button>
                )}
              </label>
              {previewMode==='preview'
                ? <div style={{padding:20,background:'#ffffff',borderRadius:8,minHeight:200}} dangerouslySetInnerHTML={{__html:editForm.html_body}}/>
                : previewMode==='text'
                ? (editing
                  ? <textarea value={editForm.text_body} onChange={e=>ef('text_body',e.target.value)} rows={6}
                      style={{...inp,resize:'vertical',fontSize:12}}
                      onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
                  : <div style={{padding:12,background:A.surf2,borderRadius:8,fontSize:12,color:A.txtB,whiteSpace:'pre-wrap'}}>{editForm.text_body||'No plain text body set'}</div>)
                : (editing
                  ? <textarea value={editForm.html_body} onChange={e=>ef('html_body',e.target.value)} rows={14}
                      style={{...inp,resize:'vertical',fontFamily:'monospace',fontSize:12}}
                      onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
                  : <div style={{padding:12,background:A.surf2,borderRadius:8,fontSize:12,color:A.txtB,fontFamily:'monospace',maxHeight:220,overflow:'auto'}}>{editForm.html_body}</div>)
              }
            </div>

            {/* Test send */}
            <div style={{display:'flex',gap:10,alignItems:'center',paddingTop:14,borderTop:`1px solid ${A.bord}`}}>
              <input value={testEmail} onChange={e=>setTestEmail(e.target.value)} placeholder="test@example.com"
                style={{...inp,width:200}} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
              <Btn onClick={sendTest} variant="ghost" style={{padding:'8px 16px',fontSize:12}}>📧 Send Test</Btn>
              {testSent && <span style={{fontSize:12,color:A.green,fontWeight:700}}>✓ Test queued!</span>}
              <span style={{fontSize:11,color:A.txtC,marginLeft:'auto'}}>
                Variables will be replaced with sample values in test send
              </span>
            </div>
          </Card>
        )}

        {!sel && !showCreate &&
          <Card><div style={{textAlign:'center',padding:60,color:A.txtC}}>Select a template or create a new one</div></Card>}
      </div>
    </div>
  );
}
