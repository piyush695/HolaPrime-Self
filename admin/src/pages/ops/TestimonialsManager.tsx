import { useState, useEffect } from 'react';
import { A, api, inp, Card, Btn, Pill, Toggle } from './_shared.js';

const BLANK = { trader_name:'', country:'', country_flag:'🌍', payout_amount:'', quote:'', rating:5, verified:false, featured:false, sort_order:0, enabled:true };

export default function TestimonialsManager() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState<any>(BLANK);
  const [editing, setEditing] = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { api('/api/v1/testimonials').then(d => setItems(Array.isArray(d) ? d : [])); }, []);

  const up = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) => setForm((p: any) => ({...p,[k]:e.target.value}));

  async function save() {
    const payload = { ...form, rating: parseInt(form.rating), sort_order: parseInt(form.sort_order||0) };
    if (editing) {
      await api(`/api/v1/testimonials/${editing}`, { method:'PATCH', body:JSON.stringify(payload) });
      setItems(it => it.map(x => x.id===editing ? {...x,...payload} : x));
    } else {
      const row = await api('/api/v1/testimonials', { method:'POST', body:JSON.stringify(payload) });
      if (row?.id) setItems(it => [...it, {...payload, id:row.id}]);
    }
    setForm(BLANK); setEditing(null); setShowForm(false);
  }

  async function del(id: string) {
    if (!confirm('Delete this testimonial?')) return;
    await api(`/api/v1/testimonials/${id}`, { method:'DELETE' });
    setItems(it => it.filter(x => x.id !== id));
  }

  async function toggleFeatured(id: string, featured: boolean) {
    await api(`/api/v1/testimonials/${id}`, { method:'PATCH', body:JSON.stringify({ featured }) });
    setItems(it => it.map(x => x.id===id ? {...x,featured} : x));
  }

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:A.white, marginBottom:4 }}>Testimonials</h1>
          <p style={{ fontSize:13, color:A.txtB }}>Manage trader testimonials displayed on the homepage. Drag to reorder.</p>
        </div>
        <Btn onClick={() => { setForm(BLANK); setEditing(null); setShowForm(s=>!s); }}>
          {showForm && !editing ? '× Cancel' : '+ Add Testimonial'}
        </Btn>
      </div>

      {(showForm || editing) && (
        <Card style={{ marginBottom:20, borderColor:A.blue }}>
          <div style={{ fontSize:14, fontWeight:700, color:A.white, marginBottom:16 }}>{editing ? 'Edit Testimonial' : 'New Testimonial'}</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:12 }}>
            {[{l:'Trader Name',k:'trader_name',ph:'James K.'},{l:'Country',k:'country',ph:'United Kingdom'},{l:'Flag Emoji',k:'country_flag',ph:'🇬🇧'},{l:'Payout Amount',k:'payout_amount',ph:'$4,200'},{l:'Rating (1-5)',k:'rating',ph:'5'},{l:'Sort Order',k:'sort_order',ph:'0'}].map(f => (
              <div key={f.k}>
                <label style={{ fontSize:11, color:A.txtB, display:'block', marginBottom:5 }}>{f.l}</label>
                <input value={form[f.k]??''} onChange={up(f.k)} placeholder={f.ph} style={inp}
                  onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
              </div>
            ))}
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:11, color:A.txtB, display:'block', marginBottom:5 }}>Quote</label>
            <textarea value={form.quote} onChange={up('quote')} rows={3} placeholder="Trader's testimonial in their own words…"
              style={{ ...inp, resize:'vertical' }} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
          </div>
          <div style={{ display:'flex', gap:24, marginBottom:16 }}>
            <Toggle checked={form.verified} onChange={(v:boolean)=>setForm((p:any)=>({...p,verified:v}))} label="Verified Trader"/>
            <Toggle checked={form.featured} onChange={(v:boolean)=>setForm((p:any)=>({...p,featured:v}))} label="Featured (Homepage)"/>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <Btn onClick={save} disabled={!form.trader_name||!form.quote}>{editing?'Save Changes':'Add Testimonial'}</Btn>
            <Btn onClick={() => { setShowForm(false); setEditing(null); setForm(BLANK); }} variant="ghost">Cancel</Btn>
          </div>
        </Card>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14 }}>
        {items.map(item => (
          <Card key={item.id} style={{ opacity:item.enabled?1:0.55 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:42,height:42,borderRadius:'50%',background:`linear-gradient(135deg,${A.blue},${A.blueD})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>{item.country_flag}</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:A.white }}>{item.trader_name}</div>
                  <div style={{ fontSize:11, color:A.txtC }}>{item.country}{item.payout_amount?` · ${item.payout_amount}`:''}</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:4, flexWrap:'wrap', justifyContent:'flex-end' }}>
                {item.featured && <Pill label="Featured" color={A.gold}/>}
                {item.verified && <Pill label="Verified" color={A.green}/>}
              </div>
            </div>
            <div style={{ display:'flex', gap:2, marginBottom:8 }}>
              {[1,2,3,4,5].map(i => <span key={i} style={{ color:i<=item.rating?A.gold:'#333', fontSize:14 }}>★</span>)}
            </div>
            <p style={{ fontSize:13, color:A.txtB, lineHeight:1.65, marginBottom:14, fontStyle:'italic' }}>
              "{item.quote.length>120 ? item.quote.slice(0,120)+'…' : item.quote}"
            </p>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <Btn onClick={() => { setEditing(item.id); setForm({...item}); setShowForm(true); }} variant="ghost" style={{ padding:'5px 12px', fontSize:12 }}>✏️ Edit</Btn>
              <Toggle checked={item.featured} onChange={(v:boolean)=>toggleFeatured(item.id,v)} label="Featured"/>
              <Btn onClick={() => del(item.id)} variant="danger" style={{ padding:'5px 12px', fontSize:12, marginLeft:'auto' }}>✗</Btn>
            </div>
          </Card>
        ))}
      </div>
      {items.length === 0 && <Card><div style={{ textAlign:'center', padding:40, color:A.txtC }}>No testimonials yet. Add your first one above.</div></Card>}
    </div>
  );
}
