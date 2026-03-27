import { useState, useEffect } from 'react';
import { A, api, inp, Card, Btn, Pill } from './_shared.js';
export default function PayoutControl() {
  const [rules, setRules] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [tab, setTab] = useState<'queue'|'rules'>('queue');
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => { api('/api/v1/payout-rules').then(d=>setRules(Array.isArray(d)?d:[])); api('/api/v1/payout-rules/queue').then(d=>setQueue(Array.isArray(d)?d:[])); }, []);
  async function approve(id: string) { await api(`/api/v1/payout-rules/queue/${id}/approve`,{method:'POST',body:JSON.stringify({notes:'Approved'})}); setQueue(q=>q.filter(x=>x.id!==id)); }
  async function reject(id: string) { const r=prompt('Rejection reason:'); if(!r)return; await api(`/api/v1/payout-rules/queue/${id}/reject`,{method:'POST',body:JSON.stringify({reason:r})}); setQueue(q=>q.filter(x=>x.id!==id)); }
  async function batchApprove() { await api('/api/v1/payout-rules/queue/batch-approve',{method:'POST',body:JSON.stringify({ids:sel})}); setQueue(q=>q.filter(x=>!sel.includes(x.id))); setSel([]); }
  async function updateRule(key: string, value: number) { await api(`/api/v1/payout-rules/${key}`,{method:'PATCH',body:JSON.stringify({value})}); }
  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <div style={{marginBottom:24}}><h1 style={{fontSize:22,fontWeight:800,color:A.white,marginBottom:4}}>Payout Control Centre</h1><p style={{fontSize:13,color:A.txtB}}>Review pending payout requests and configure payout rules from one place.</p></div>
      <div style={{display:'flex',gap:2,marginBottom:20,background:A.surf2,borderRadius:10,padding:4,width:'fit-content'}}>
        {(['queue','rules'] as const).map(t=><button key={t} onClick={()=>setTab(t)} style={{padding:'8px 24px',borderRadius:8,border:'none',background:tab===t?A.blue:'transparent',color:tab===t?'#fff':A.txtB,fontFamily:'inherit',fontSize:13,fontWeight:700,cursor:'pointer'}}>{t==='queue'?`Approval Queue (${queue.length})`:'Payout Rules'}</button>)}
      </div>
      {tab==='queue'?(
        <div>
          {sel.length>0&&<div style={{marginBottom:12,display:'flex',gap:10,alignItems:'center'}}><span style={{fontSize:13,color:A.txtB}}>{sel.length} selected</span><Btn onClick={batchApprove} variant="success">✅ Approve All Selected</Btn></div>}
          {queue.length===0?<Card><div style={{textAlign:'center',padding:40}}><div style={{fontSize:40,marginBottom:12}}>✅</div><div style={{color:A.txtB}}>No pending payouts</div></div></Card>:(
            <Card style={{padding:0,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr style={{background:A.surf2}}><th style={{padding:'10px',width:40}}><input type="checkbox" onChange={e=>setSel(e.target.checked?queue.map(q=>q.id):[])}/></th>{['Trader','Amount','Method','KYC','Date','Actions'].map(h=><th key={h} style={{padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:A.txtC,borderBottom:`1px solid ${A.bord}`}}>{h}</th>)}</tr></thead>
                <tbody>{queue.map(p=>(
                  <tr key={p.id} style={{borderBottom:`1px solid ${A.bord}`,background:sel.includes(p.id)?'rgba(63,143,224,.05)':''}} onMouseEnter={e=>(e.currentTarget as any).style.background='rgba(255,255,255,.02)'} onMouseLeave={e=>(e.currentTarget as any).style.background=sel.includes(p.id)?'rgba(63,143,224,.05)':''}>
                    <td style={{padding:'10px'}}><input type="checkbox" checked={sel.includes(p.id)} onChange={e=>setSel(s=>e.target.checked?[...s,p.id]:s.filter(x=>x!==p.id))}/></td>
                    <td style={{padding:'10px 14px',fontSize:13,color:A.white}}>{p.first_name} {p.last_name}</td>
                    <td style={{padding:'10px 14px',fontSize:15,fontWeight:800,color:A.green}}>${parseFloat(p.amount||0).toFixed(2)}</td>
                    <td style={{padding:'10px 14px',fontSize:12,color:A.txtA}}>{p.payment_method||'—'}</td>
                    <td style={{padding:'10px 14px'}}><Pill label={p.kyc_status||'pending'} color={p.kyc_status==='approved'?A.green:A.gold}/></td>
                    <td style={{padding:'10px 14px',fontSize:12,color:A.txtC}}>{new Date(p.created_at).toLocaleDateString()}</td>
                    <td style={{padding:'10px 14px'}}><div style={{display:'flex',gap:6}}><Btn onClick={()=>approve(p.id)} variant="success" style={{padding:'5px 10px',fontSize:11}}>✅</Btn><Btn onClick={()=>reject(p.id)} variant="danger" style={{padding:'5px 10px',fontSize:11}}>✗</Btn></div></td>
                  </tr>
                ))}</tbody>
              </table>
            </Card>
          )}
        </div>
      ):(
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:14}}>
          {rules.map(r=>(
            <Card key={r.rule_key}>
              <div style={{fontSize:14,fontWeight:700,color:A.white,marginBottom:4}}>{r.label}</div>
              <div style={{fontSize:12,color:A.txtB,marginBottom:12}}>{r.description}</div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <input type="number" defaultValue={r.value?.value??r.value} onBlur={e=>updateRule(r.rule_key,parseFloat(e.target.value))} style={{...inp,width:120}} onFocus={e=>e.currentTarget.style.borderColor=A.blue} onBlur={e=>e.currentTarget.style.borderColor=A.bord}/>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
