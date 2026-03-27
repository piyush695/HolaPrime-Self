import { useState, useEffect } from 'react';
import { A, api, inp, sel, Card, Btn, Pill, Toggle } from './_shared.js';

const PAGES = ['general','forex','futures','affiliate','payout','academy'];

export default function FAQManager() {
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState('general');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ question:'', answer:'', sort_order:0 });

  useEffect(() => { api('/api/v1/faq').then(d => setItems(Array.isArray(d) ? d : [])); }, []);

  const filtered = items.filter(i => i.page === page).sort((a,b) => a.sort_order - b.sort_order);

  function startAdd() { setForm({ question:'', answer:'', sort_order: filtered.length }); setEditing(null); setShowForm(true); }
  function startEdit(item: any) { setForm({ question:item.question, answer:item.answer, sort_order:item.sort_order }); setEditing(item); setShowForm(true); }

  async function save() {
    if (!form.question.trim() || !form.answer.trim()) return;
    if (editing) {
      await api(`/api/v1/faq/${editing.id}`, { method:'PATCH', body:JSON.stringify(form) });
      setItems(it => it.map(x => x.id === editing.id ? { ...x, ...form } : x));
    } else {
      const row = await api('/api/v1/faq', { method:'POST', body:JSON.stringify({ ...form, page }) });
      if (row?.id) setItems(it => [...it, { ...form, id:row.id, page, enabled:true }]);
    }
    setShowForm(false); setEditing(null);
  }

  async function del(id: string) {
    if (!confirm('Delete this FAQ?')) return;
    await api(`/api/v1/faq/${id}`, { method:'DELETE' });
    setItems(it => it.filter(x => x.id !== id));
  }

  async function toggleItem(id: string, enabled: boolean) {
    await api(`/api/v1/faq/${id}`, { method:'PATCH', body:JSON.stringify({ enabled }) });
    setItems(it => it.map(x => x.id === id ? { ...x, enabled } : x));
  }

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:A.white, marginBottom:4 }}>FAQ Manager</h1>
          <p style={{ fontSize:13, color:A.txtB }}>Add, edit and reorder FAQs shown on each public page. Live instantly.</p>
        </div>
        <Btn onClick={startAdd}>+ Add FAQ</Btn>
      </div>

      {/* Page tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {PAGES.map(p => (
          <button key={p} onClick={() => setPage(p)}
            style={{ padding:'7px 18px', borderRadius:20, border:`1px solid ${page===p?A.blue:A.bord}`, background:page===p?'rgba(63,143,224,.15)':'transparent', color:page===p?A.blueL:A.txtB, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            {p.charAt(0).toUpperCase()+p.slice(1)} <span style={{ color:A.txtC }}>({items.filter(i=>i.page===p).length})</span>
          </button>
        ))}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <Card style={{ marginBottom:16, borderColor:A.blue }}>
          <div style={{ fontSize:14, fontWeight:700, color:A.white, marginBottom:14 }}>{editing ? 'Edit FAQ' : 'New FAQ'}</div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div>
              <label style={{ fontSize:11, color:A.txtB, display:'block', marginBottom:5 }}>Question</label>
              <input value={form.question} onChange={e=>setForm(p=>({...p,question:e.target.value}))} placeholder="Enter question…" style={inp}
                onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
            </div>
            <div>
              <label style={{ fontSize:11, color:A.txtB, display:'block', marginBottom:5 }}>Answer</label>
              <textarea value={form.answer} onChange={e=>setForm(p=>({...p,answer:e.target.value}))} rows={4} placeholder="Write the answer…"
                style={{ ...inp, resize:'vertical' }} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <div>
                <label style={{ fontSize:11, color:A.txtB, display:'block', marginBottom:5 }}>Sort Order</label>
                <input type="number" value={form.sort_order} onChange={e=>setForm(p=>({...p,sort_order:parseInt(e.target.value)||0}))} style={{ ...inp, width:100 }}/>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                <Btn onClick={save}>{editing ? 'Save Changes' : 'Add FAQ'}</Btn>
                <Btn onClick={() => { setShowForm(false); setEditing(null); }} variant="ghost">Cancel</Btn>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* FAQ list */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {filtered.map(item => (
          <Card key={item.id} style={{ padding:'14px 18px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <span style={{ fontSize:11, color:A.txtC, minWidth:22 }}>#{item.sort_order}</span>
                  <span style={{ fontSize:14, fontWeight:700, color:item.enabled?A.white:A.txtC }}>{item.question}</span>
                  {!item.enabled && <Pill label="Hidden" color={A.txtC}/>}
                </div>
                <p style={{ fontSize:13, color:A.txtB, lineHeight:1.65, marginLeft:30 }}>
                  {item.answer.length > 160 ? item.answer.slice(0,160)+'…' : item.answer}
                </p>
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <Btn onClick={() => startEdit(item)} variant="ghost" style={{ padding:'5px 10px', fontSize:11 }}>✏️</Btn>
                <Btn onClick={() => toggleItem(item.id, !item.enabled)} variant="ghost" style={{ padding:'5px 10px', fontSize:11 }}>{item.enabled?'🚫':'👁️'}</Btn>
                <Btn onClick={() => del(item.id)} variant="danger" style={{ padding:'5px 10px', fontSize:11 }}>✗</Btn>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card><div style={{ textAlign:'center', padding:36, color:A.txtC }}>No FAQs for this page yet. Click "+ Add FAQ" to get started.</div></Card>
        )}
      </div>
    </div>
  );
}
