import { useState, useEffect } from 'react';
import { A, api, inp, sel, Card, Btn, Pill } from './_shared.js';

const PRI_COL: any = { urgent:A.red, high:A.orange, normal:A.blue, low:A.txtC };
const STA_COL: any = { open:A.red, in_progress:A.gold, resolved:A.green, closed:A.txtC };

export default function SupportTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [reply, setReply] = useState('');
  const [filter, setFilter] = useState({ status:'open', priority:'' });
  const [sending, setSending] = useState(false);

  useEffect(() => { api('/api/v1/support').then(d => setTickets(Array.isArray(d) ? d : [])); }, []);

  async function loadTicket(id: string) {
    const data = await api(`/api/v1/support/${id}`);
    setSelected(data); setReply('');
  }

  async function sendReply() {
    if (!reply.trim() || !selected) return;
    setSending(true);
    await api(`/api/v1/support/${selected.id}/reply`, { method:'POST', body:JSON.stringify({ message:reply }) });
    setSending(false);
    loadTicket(selected.id);
  }

  async function setStatus(id: string, status: string) {
    await api(`/api/v1/support/${id}`, { method:'PATCH', body:JSON.stringify({ status }) });
    setTickets(ts => ts.map(t => t.id===id ? {...t,status} : t));
    if (selected?.id===id) setSelected((s: any) => ({...s,status}));
  }

  const filtered = tickets.filter(t =>
    (!filter.status || t.status===filter.status) &&
    (!filter.priority || t.priority===filter.priority)
  );

  const counts = { open:tickets.filter(t=>t.status==='open').length, in_progress:tickets.filter(t=>t.status==='in_progress').length };

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h1 style={{ fontSize:22,fontWeight:800,color:A.white,marginBottom:4 }}>Support Tickets</h1>
            <div style={{ display:'flex', gap:10 }}>
              <Pill label={`${counts.open} Open`} color={A.red}/>
              <Pill label={`${counts.in_progress} In Progress`} color={A.gold}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <select value={filter.status} onChange={e=>setFilter(f=>({...f,status:e.target.value}))} style={{ ...sel, width:'auto', padding:'7px 12px', fontSize:12 }}>
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
            <select value={filter.priority} onChange={e=>setFilter(f=>({...f,priority:e.target.value}))} style={{ ...sel, width:'auto', padding:'7px 12px', fontSize:12 }}>
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'360px 1fr', gap:16, height:'calc(100vh - 200px)' }}>
        {/* Ticket list */}
        <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:6, paddingRight:4 }}>
          {filtered.map(t => (
            <div key={t.id} onClick={() => loadTicket(t.id)}
              style={{ padding:'12px 14px',borderRadius:10,cursor:'pointer',background:selected?.id===t.id?'rgba(63,143,224,.12)':A.surf,border:`1px solid ${selected?.id===t.id?A.blue:A.bord}`,transition:'all .15s' }}
              onMouseEnter={e => (e.currentTarget as any).style.borderColor=A.blue}
              onMouseLeave={e => (e.currentTarget as any).style.borderColor=selected?.id===t.id?A.blue:A.bord}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <div style={{ display:'flex', gap:5 }}>
                  <Pill label={t.priority} color={PRI_COL[t.priority]}/>
                  <Pill label={t.status?.replace('_',' ')} color={STA_COL[t.status]}/>
                </div>
                <span style={{ fontSize:10,color:A.txtC }}>{new Date(t.created_at).toLocaleDateString()}</span>
              </div>
              <div style={{ fontSize:13,fontWeight:700,color:A.white,marginBottom:2 }}>{t.subject}</div>
              <div style={{ fontSize:11,color:A.txtC }}>{t.ticket_no} · {t.email||'Anonymous'}</div>
            </div>
          ))}
          {filtered.length===0 && <div style={{ textAlign:'center',padding:40,color:A.txtC }}>No tickets match filter</div>}
        </div>

        {/* Ticket detail */}
        {selected ? (
          <Card style={{ display:'flex',flexDirection:'column',overflow:'hidden',padding:0,height:'100%' }}>
            <div style={{ padding:'14px 18px',borderBottom:`1px solid ${A.bord}`,display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <div>
                <div style={{ fontSize:15,fontWeight:700,color:A.white,marginBottom:2 }}>{selected.subject}</div>
                <div style={{ fontSize:12,color:A.txtC }}>{selected.ticket_no} · {selected.first_name} {selected.last_name} · {selected.email}</div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                {['open','in_progress','resolved','closed'].map(s => (
                  <Btn key={s} onClick={() => setStatus(selected.id,s)} variant={selected.status===s?'primary':'ghost'} style={{ padding:'5px 10px',fontSize:11 }}>
                    {s.replace('_',' ')}
                  </Btn>
                ))}
              </div>
            </div>

            <div style={{ flex:1,overflowY:'auto',padding:'14px 18px',display:'flex',flexDirection:'column',gap:10 }}>
              {/* Original */}
              <div style={{ padding:'12px 14px',background:A.surf2,borderRadius:10,borderLeft:`3px solid ${A.blue}` }}>
                <div style={{ fontSize:11,color:A.txtC,marginBottom:6 }}>{selected.first_name} {selected.last_name} · {new Date(selected.created_at).toLocaleString()}</div>
                <p style={{ fontSize:13,color:A.txtA,lineHeight:1.7 }}>{selected.message}</p>
              </div>
              {/* Replies */}
              {(selected.replies||[]).map((r: any) => (
                <div key={r.id} style={{ padding:'12px 14px',background:r.author_type==='admin'?'rgba(63,143,224,.08)':A.surf2,borderRadius:10,borderLeft:`3px solid ${r.author_type==='admin'?A.blue:A.bord}` }}>
                  <div style={{ fontSize:11,color:A.txtC,marginBottom:6 }}>{r.author_type==='admin'?'⚡ Support Team':'👤 Trader'} · {new Date(r.created_at).toLocaleString()}</div>
                  <p style={{ fontSize:13,color:A.txtA,lineHeight:1.7 }}>{r.message}</p>
                </div>
              ))}
            </div>

            <div style={{ padding:'12px 18px',borderTop:`1px solid ${A.bord}`,display:'flex',gap:10,alignItems:'flex-end' }}>
              <textarea value={reply} onChange={e=>setReply(e.target.value)} placeholder="Type your reply…" rows={2}
                style={{ ...inp, flex:1, resize:'none' }}
                onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}
                onKeyDown={e=>{ if(e.key==='Enter'&&e.ctrlKey) sendReply(); }}/>
              <Btn onClick={sendReply} disabled={sending||!reply.trim()} style={{ padding:'10px 20px' }}>
                {sending?'Sending…':'Send Reply'}
              </Btn>
            </div>
          </Card>
        ) : (
          <Card><div style={{ textAlign:'center',padding:80,color:A.txtC }}>Select a ticket to view conversation</div></Card>
        )}
      </div>
    </div>
  );
}
