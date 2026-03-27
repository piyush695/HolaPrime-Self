import { useState, useEffect } from 'react';
import { A, api, inp, sel, Card, Btn, Pill } from './_shared.js';

const BLANK = { title:'', slug:'', excerpt:'', body:'', category:'general', author_name:'Hola Prime Team', status:'draft', meta_title:'', meta_desc:'', read_time:'5' };
const CATS = ['general','prop-trading','education','futures','risk-management','platform','psychology'];
const STATUS_COL: any = { published:A.green, draft:A.gold, archived:A.txtC };

export default function BlogCMS() {
  const [posts, setPosts] = useState<any[]>([]);
  const [view, setView] = useState<'list'|'editor'>('list');
  const [form, setForm] = useState<any>(BLANK);
  const [editId, setEditId] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api('/api/v1/blog').then(d => setPosts(Array.isArray(d) ? d : [])); }, []);

  const up = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => {
    const v = e.target.value;
    setForm((p: any) => {
      const next: any = {...p,[k]:v};
      if (k==='title') { next.slug = v.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); next.meta_title = v; }
      return next;
    });
  };

  async function save() {
    setSaving(true);
    if (editId) {
      await api(`/api/v1/blog/${editId}`, { method:'PATCH', body:JSON.stringify({...form,read_time:parseInt(form.read_time)}) });
      setPosts(ps => ps.map(p => p.id===editId ? {...p,...form} : p));
    } else {
      const row = await api('/api/v1/blog', { method:'POST', body:JSON.stringify({...form,read_time:parseInt(form.read_time)}) });
      if (row?.id) setPosts(ps => [{...form,...row}, ...ps]);
    }
    setSaving(false); setView('list'); setEditId(null);
  }

  async function archive(id: string) {
    await api(`/api/v1/blog/${id}`, { method:'DELETE' });
    setPosts(ps => ps.map(p => p.id===id ? {...p,status:'archived'} : p));
  }

  if (view === 'editor') return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <button onClick={() => setView('list')} style={{ background:'none',border:'none',color:A.txtC,cursor:'pointer',fontFamily:'inherit',fontSize:13,padding:0,marginBottom:4,display:'flex',alignItems:'center',gap:6 }}>← Back to posts</button>
          <h1 style={{ fontSize:20, fontWeight:800, color:A.white }}>{editId ? 'Edit Post' : 'New Post'}</h1>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <select value={form.status} onChange={up('status')} style={{ ...sel, width:'auto', padding:'8px 14px', fontSize:13 }}>
            <option value="draft">Save as Draft</option>
            <option value="published">Publish Now</option>
          </select>
          <Btn onClick={save} disabled={saving||!form.title||!form.body}>{saving?'Saving…':'Save Post'}</Btn>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:20 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ fontSize:11,color:A.txtB,display:'block',marginBottom:5 }}>Post Title *</label>
            <input value={form.title} onChange={up('title')} placeholder="Enter post title…" style={{ ...inp, fontSize:17, fontWeight:600 }}
              onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
          </div>
          <div>
            <label style={{ fontSize:11,color:A.txtB,display:'block',marginBottom:5 }}>Excerpt (shown in listing)</label>
            <textarea value={form.excerpt} onChange={up('excerpt')} rows={2} placeholder="Brief description for listing pages and SEO…"
              style={{ ...inp, resize:'vertical' }} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
          </div>
          <div>
            <label style={{ fontSize:11,color:A.txtB,display:'block',marginBottom:5 }}>Post Body * (HTML supported)</label>
            <textarea value={form.body} onChange={up('body')} rows={20} placeholder="Write your post content here. HTML tags are supported for formatting."
              style={{ ...inp, resize:'vertical', fontFamily:'monospace', fontSize:13 }}
              onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <Card>
            <div style={{ fontSize:13,fontWeight:700,color:A.white,marginBottom:12 }}>Post Settings</div>
            {[{l:'URL Slug',k:'slug'},{l:'Author',k:'author_name'},{l:'Read Time (mins)',k:'read_time'}].map(f => (
              <div key={f.k} style={{ marginBottom:10 }}>
                <label style={{ fontSize:11,color:A.txtB,display:'block',marginBottom:4 }}>{f.l}</label>
                <input value={form[f.k]??''} onChange={up(f.k)} style={{ ...inp, fontSize:12, padding:'8px 12px' }}
                  onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
              </div>
            ))}
            <div>
              <label style={{ fontSize:11,color:A.txtB,display:'block',marginBottom:4 }}>Category</label>
              <select value={form.category} onChange={up('category')} style={{ ...sel, fontSize:12, padding:'8px 12px' }}>
                {CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </Card>
          <Card>
            <div style={{ fontSize:13,fontWeight:700,color:A.white,marginBottom:12 }}>SEO</div>
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11,color:A.txtB,display:'block',marginBottom:4 }}>Meta Title</label>
              <input value={form.meta_title} onChange={up('meta_title')} style={{ ...inp, fontSize:12, padding:'8px 12px' }}
                onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
            </div>
            <div>
              <label style={{ fontSize:11,color:A.txtB,display:'block',marginBottom:4 }}>Meta Description</label>
              <textarea value={form.meta_desc} onChange={up('meta_desc')} rows={3} style={{ ...inp, resize:'vertical', fontSize:12, padding:'8px 12px' }}/>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:800,color:A.white,marginBottom:4 }}>Blog CMS</h1>
          <p style={{ fontSize:13,color:A.txtB }}>Write and publish blog posts. Full SEO control. No developer needed.</p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <Pill label={`${posts.filter(p=>p.status==='published').length} Published`} color={A.green}/>
          <Pill label={`${posts.filter(p=>p.status==='draft').length} Drafts`} color={A.gold}/>
          <Btn onClick={() => { setForm(BLANK); setEditId(null); setView('editor'); }}>+ New Post</Btn>
        </div>
      </div>
      <Card style={{ padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:A.surf2 }}>
              {['Title','Category','Author','Status','Published','Actions'].map(h => (
                <th key={h} style={{ padding:'11px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:A.txtC,letterSpacing:'.08em',borderBottom:`1px solid ${A.bord}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map(p => (
              <tr key={p.id} style={{ borderBottom:`1px solid ${A.bord}` }}
                onMouseEnter={e=>(e.currentTarget as any).style.background='rgba(255,255,255,.02)'}
                onMouseLeave={e=>(e.currentTarget as any).style.background=''}>
                <td style={{ padding:'11px 16px' }}>
                  <div style={{ fontSize:13,fontWeight:700,color:A.white }}>{p.title}</div>
                  <div style={{ fontSize:11,color:A.txtC,fontFamily:'monospace' }}>/{p.slug}</div>
                </td>
                <td style={{ padding:'11px 16px',fontSize:12,color:A.txtB }}>{p.category}</td>
                <td style={{ padding:'11px 16px',fontSize:12,color:A.txtB }}>{p.author_name}</td>
                <td style={{ padding:'11px 16px' }}><Pill label={p.status} color={STATUS_COL[p.status]||A.txtC}/></td>
                <td style={{ padding:'11px 16px',fontSize:12,color:A.txtC }}>{p.published_at?new Date(p.published_at).toLocaleDateString():'—'}</td>
                <td style={{ padding:'11px 16px' }}>
                  <div style={{ display:'flex', gap:6 }}>
                    <Btn onClick={() => { setEditId(p.id); setForm({...p,read_time:String(p.read_time)}); setView('editor'); }} variant="ghost" style={{ padding:'5px 10px',fontSize:11 }}>✏️ Edit</Btn>
                    <Btn onClick={() => archive(p.id)} variant="danger" style={{ padding:'5px 10px',fontSize:11 }}>Archive</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {posts.length===0 && <div style={{ textAlign:'center',padding:48,color:A.txtC }}>No posts yet. Click "New Post" to start writing.</div>}
      </Card>
    </div>
  );
}
