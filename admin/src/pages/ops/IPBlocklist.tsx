import { useState, useEffect } from 'react';
import { A, api, inp, Card, Btn, Pill } from './_shared.js';

export default function IPBlocklist() {
  const [ips, setIps] = useState<any[]>([]);
  const [form, setForm] = useState({ ip_address:'', reason:'' });

  useEffect(() => { api('/api/v1/ip-blocklist').then(d => setIps(Array.isArray(d)?d:[])); }, []);

  async function block(e: React.FormEvent) {
    e.preventDefault();
    await api('/api/v1/ip-blocklist', { method:'POST', body:JSON.stringify(form) });
    api('/api/v1/ip-blocklist').then(d => setIps(Array.isArray(d)?d:[]));
    setForm({ ip_address:'', reason:'' });
  }

  async function unblock(id: number) {
    await api(`/api/v1/ip-blocklist/${id}`, { method:'DELETE' });
    setIps(list => list.filter(x => x.id !== id));
  }

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22,fontWeight:800,color:A.white,marginBottom:4 }}>IP Blocklist</h1>
        <p style={{ fontSize:13,color:A.txtB }}>Block IPs or CIDR ranges from registration and platform access. Takes effect instantly.</p>
      </div>

      <Card style={{ marginBottom:20 }}>
        <div style={{ fontSize:14,fontWeight:700,color:A.white,marginBottom:14 }}>Block IP Address</div>
        <form onSubmit={block}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:12, alignItems:'flex-end' }}>
            <div>
              <label style={{ fontSize:11,color:A.txtB,display:'block',marginBottom:5 }}>IP Address or CIDR Range</label>
              <input required value={form.ip_address} onChange={e=>setForm(p=>({...p,ip_address:e.target.value}))}
                placeholder="e.g. 192.168.1.100 or 10.0.0.0/24" style={inp}
                onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
            </div>
            <div>
              <label style={{ fontSize:11,color:A.txtB,display:'block',marginBottom:5 }}>Reason (optional)</label>
              <input value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))}
                placeholder="Fraud attempt, brute force, etc." style={inp}
                onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
            </div>
            <Btn variant="danger" style={{ whiteSpace:'nowrap' }}>🚫 Block IP</Btn>
          </div>
        </form>
      </Card>

      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
        <div style={{ fontSize:14,fontWeight:700,color:A.white }}>Blocked IPs <span style={{ color:A.txtC,fontWeight:400,fontSize:13 }}>({ips.length})</span></div>
      </div>

      <Card style={{ padding:0, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:A.surf2 }}>
              {['IP Address','Reason','Blocked At','Expires','Actions'].map(h => (
                <th key={h} style={{ padding:'11px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:A.txtC,letterSpacing:'.08em',borderBottom:`1px solid ${A.bord}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ips.map(ip => (
              <tr key={ip.id} style={{ borderBottom:`1px solid ${A.bord}` }}
                onMouseEnter={e=>(e.currentTarget as any).style.background='rgba(255,76,106,.04)'}
                onMouseLeave={e=>(e.currentTarget as any).style.background=''}>
                <td style={{ padding:'11px 16px' }}>
                  <code style={{ fontSize:13,fontWeight:700,color:A.red,background:'rgba(255,76,106,.1)',padding:'3px 8px',borderRadius:4 }}>{ip.ip_address}</code>
                </td>
                <td style={{ padding:'11px 16px',fontSize:13,color:A.txtB }}>{ip.reason||<span style={{color:A.txtC}}>No reason given</span>}</td>
                <td style={{ padding:'11px 16px',fontSize:12,color:A.txtC }}>{new Date(ip.created_at).toLocaleDateString()}</td>
                <td style={{ padding:'11px 16px',fontSize:12,color:A.txtC }}>{ip.expires_at?new Date(ip.expires_at).toLocaleDateString():'Never'}</td>
                <td style={{ padding:'11px 16px' }}>
                  <Btn onClick={() => unblock(ip.id)} variant="ghost" style={{ padding:'5px 14px',fontSize:12 }}>Unblock</Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ips.length===0 && <div style={{ textAlign:'center',padding:48,color:A.txtC }}>✅ No IPs are currently blocked</div>}
      </Card>
    </div>
  );
}
