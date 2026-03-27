import { useState, useEffect } from 'react';
import { A, api, inp, Card, Btn } from './_shared.js';

export default function SiteContent() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<string|null>(null);
  const [editVal, setEditVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string|null>(null);
  useEffect(() => { api('/api/v1/site-content').then(d => Array.isArray(d) ? setItems(d) : setItems([])); }, []);
  function startEdit(item: any) { setEditing(item.key); setEditVal(typeof item.value==='object'?JSON.stringify(item.value,null,2):String(item.value)); }
  async function save(key: string) {
    setSaving(true);
    try {
      const parsed = JSON.parse(editVal);
      await api(`/api/v1/site-content/${key}`, { method:'PATCH', body:JSON.stringify({ value:parsed }) });
      setItems(it => it.map(x => x.key===key ? {...x,value:parsed} : x));
      setEditing(null); setSaved(key); setTimeout(()=>setSaved(null),2500);
    } catch { alert('Invalid JSON — please check your syntax'); }
    setSaving(false);
  }
  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ marginBottom:24 }}><h1 style={{ fontSize:22,fontWeight:800,color:A.white,marginBottom:4 }}>Site Content Editor</h1><p style={{ fontSize:13,color:A.txtB }}>Edit homepage stats, announcement bar, and site-wide content. Changes go live instantly.</p></div>
      <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
        {items.map(item => (
          <Card key={item.key}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:editing===item.key?14:0 }}>
              <div>
                <div style={{ fontSize:14,fontWeight:700,color:A.white,marginBottom:3 }}>{item.label}</div>
                <div style={{ fontSize:12,color:A.txtB,marginBottom:4 }}>{item.description}</div>
                <code style={{ fontSize:10,color:A.txtC,background:A.surf2,padding:'2px 8px',borderRadius:4 }}>{item.key}</code>
              </div>
              <div style={{ display:'flex',gap:8,alignItems:'center' }}>
                {saved===item.key && <span style={{fontSize:12,color:A.green,fontWeight:700}}>✓ Saved!</span>}
                {editing!==item.key && <Btn onClick={()=>startEdit(item)} variant="ghost" style={{padding:'6px 14px',fontSize:12}}>✏️ Edit</Btn>}
                {editing===item.key && <Btn onClick={()=>setEditing(null)} variant="ghost" style={{padding:'6px 14px',fontSize:12}}>Cancel</Btn>}
                {editing===item.key && <Btn onClick={()=>save(item.key)} disabled={saving} style={{padding:'6px 14px',fontSize:12}}>{saving?'Saving…':'Save'}</Btn>}
              </div>
            </div>
            {editing===item.key ? (
              <textarea value={editVal} onChange={e=>setEditVal(e.target.value)} rows={editVal.includes('\n')?10:3}
                style={{...inp,resize:'vertical',fontFamily:'monospace',fontSize:13}}
                onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
            ) : (
              <div style={{marginTop:8,padding:'10px 14px',background:A.surf2,borderRadius:8,fontSize:12,color:A.txtB,fontFamily:'monospace',maxHeight:60,overflow:'hidden',textOverflow:'ellipsis'}}>
                {typeof item.value==='object'?JSON.stringify(item.value).slice(0,200):String(item.value).slice(0,200)}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
