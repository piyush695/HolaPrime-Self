import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, Card, CardHeader, Table, Btn, Input, Spinner, Badge, StatusBadge, Empty,
} from '../../components/ui.js';

const ALL_EVENTS = [
  'user.registered','user.kyc_approved','user.kyc_rejected',
  'account.created','account.breached','account.passed','account.funded',
  'payment.completed','payment.failed',
  'payout.approved','payout.rejected',
  'risk.breach','risk.warning',
];

export default function Webhooks() {
  const [selected,   setSelected]   = useState<any>(null);
  const [showNew,    setShowNew]     = useState(false);
  const [newEp, setNewEp] = useState({ name:'', url:'', events: [] as string[] });
  const [pingResult, setPingResult]  = useState<Record<string,boolean>>({});
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn:  () => api.get('/webhooks').then(r => r.data),
  });

  const { data: deliveries } = useQuery({
    queryKey: ['webhook-deliveries', selected?.id],
    queryFn:  () => selected ? api.get(`/webhooks/${selected.id}/deliveries`).then(r => r.data) : null,
    enabled:  !!selected,
  });

  const create = useMutation({
    mutationFn: () => api.post('/webhooks', newEp),
    onSuccess:  () => { qc.invalidateQueries({ queryKey:['webhooks'] }); setShowNew(false); setNewEp({ name:'', url:'', events:[] }); },
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id:string; isActive:boolean }) =>
      api.patch(`/webhooks/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey:['webhooks'] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess:  () => { qc.invalidateQueries({ queryKey:['webhooks'] }); setSelected(null); },
  });

  const ping = useMutation({
    mutationFn: (id: string) => api.post(`/webhooks/${id}/ping`).then(r => r.data),
    onSuccess:  (data: any, id: string) => setPingResult(p => ({ ...p, [id]: data.ok })),
  });

  const toggleEvent = (ev: string) => {
    setNewEp(p => ({
      ...p,
      events: p.events.includes(ev) ? p.events.filter(e => e !== ev) : [...p.events, ev],
    }));
  };

  const cols = [
    { key:'name', label:'Endpoint', render:(r:any) => (
      <div>
        <div style={{ fontWeight:600, color:'#F5F8FF' }}>{r.name}</div>
        <div style={{ fontSize:11, color:'#4F5669', fontFamily:'monospace' }}>{r.url}</div>
      </div>
    )},
    { key:'events_count', label:'Events', width:80,
      render:(r:any) => <Badge label={`${r.events?.length ?? 0} events`} variant="blue" /> },
    { key:'is_active', label:'Status', width:90,
      render:(r:any) => <Badge label={r.is_active?'active':'paused'} variant={r.is_active?'green':'default'} /> },
    { key:'last_ping_ok', label:'Last Ping', width:100,
      render:(r:any) => r.last_ping_at
        ? <Badge label={r.last_ping_ok?'healthy':'failed'} variant={r.last_ping_ok?'green':'red'} />
        : <span style={{ color:'#4F5669', fontSize:11 }}>Never</span> },
    { key:'stats', label:'Deliveries', width:120,
      render:(r:any) => <span style={{ color:'#878FA4' }}>{r.successful ?? 0}/{r.total_deliveries ?? 0} ok</span> },
    { key:'actions', label:'', width:140,
      render:(r:any) => (
        <div style={{ display:'flex', gap:6 }}>
          <Btn size="sm" variant="secondary" onClick={() => setSelected(r)}>View</Btn>
          <Btn size="sm" variant="ghost"
            onClick={() => { ping.mutate(r.id); }}
            style={{ color: pingResult[r.id] === true ? '#38BA82' : pingResult[r.id] === false ? '#EB5454' : '#3F8FE0' }}>
            Ping
          </Btn>
        </div>
      ),
    },
  ];

  const deliveryCols = [
    { key:'event', label:'Event', render:(r:any) => <code style={{ fontSize:11, color:'#3F8FE0' }}>{r.event}</code> },
    { key:'status_code', label:'Status', width:80,
      render:(r:any) => r.status_code
        ? <Badge label={String(r.status_code)} variant={r.status_code < 300 ? 'green' : 'red'} />
        : <Badge label="pending" variant="default" /> },
    { key:'attempt', label:'Attempt', width:70, render:(r:any) => <span style={{ color:'#878FA4' }}>{r.attempt}</span> },
    { key:'created_at', label:'Time', width:140,
      render:(r:any) => <span style={{ color:'#878FA4', fontSize:11 }}>{new Date(r.created_at).toLocaleString()}</span> },
    { key:'error', label:'Error', render:(r:any) => r.error
      ? <span style={{ fontSize:11, color:'#EB5454' }}>{r.error.slice(0,60)}</span>
      : <span style={{ color:'#38BA82', fontSize:11 }}>OK</span>
    },
  ];

  return (
    <>
      <PageHeader
        title="Webhooks"
        sub="Outbound webhook endpoints for platform events"
        action={<Btn onClick={() => setShowNew(true)}>+ New Endpoint</Btn>}
      />

      {/* New endpoint modal */}
      {showNew && (
        <div style={{ position:'fixed', inset:0, background:'#00000088', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#1C1F27', border:'1px solid #353947', borderRadius:12, padding:24, width:520, maxHeight:'80vh', overflowY:'auto' }}>
            <div style={{ fontWeight:700, color:'#F5F8FF', marginBottom:16 }}>New Webhook Endpoint</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:14 }}>
              <div>
                <div style={{ fontSize:11, color:'#878FA4', marginBottom:4 }}>Name</div>
                <Input value={newEp.name} onChange={v => setNewEp(p => ({ ...p, name:v }))} style={{ width:'100%' }} placeholder="e.g. CRM sync" />
              </div>
              <div>
                <div style={{ fontSize:11, color:'#878FA4', marginBottom:4 }}>URL</div>
                <Input value={newEp.url} onChange={v => setNewEp(p => ({ ...p, url:v }))} style={{ width:'100%' }} placeholder="https://your-app.com/webhooks/holaprime" />
              </div>
            </div>
            <div style={{ fontSize:11, color:'#878FA4', marginBottom:8 }}>Subscribe to events:</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
              {ALL_EVENTS.map(ev => (
                <button key={ev} onClick={() => toggleEvent(ev)} style={{
                  padding:'4px 10px', borderRadius:5, fontSize:11, cursor:'pointer', border:'1px solid',
                  background: newEp.events.includes(ev) ? '#162F4F' : '#252931',
                  color:      newEp.events.includes(ev) ? '#3F8FE0' : '#878FA4',
                  borderColor: newEp.events.includes(ev) ? '#3F8FE044' : '#353947',
                }}>{ev}</button>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <Btn variant="primary" disabled={!newEp.name||!newEp.url||newEp.events.length===0||create.isPending} onClick={() => create.mutate()}>
                Create Endpoint
              </Btn>
              <Btn variant="secondary" onClick={() => setShowNew(false)}>Cancel</Btn>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 480px' : '1fr', gap:16 }}>
        <Card>
          {isLoading ? <Spinner /> : (data ?? []).length === 0
            ? <Empty icon="🔗" message="No webhook endpoints" sub="Create an endpoint to start receiving event notifications" />
            : <Table columns={cols} data={data ?? []} onRowClick={setSelected} />
          }
        </Card>

        {selected && (
          <Card>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:'#F5F8FF' }}>{selected.name}</div>
                <code style={{ fontSize:11, color:'#878FA4' }}>{selected.url}</code>
              </div>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'#878FA4', fontSize:18, cursor:'pointer' }}>×</button>
            </div>

            <div style={{ padding:'10px', background:'#252931', borderRadius:8, marginBottom:14 }}>
              <div style={{ fontSize:11, color:'#4F5669', marginBottom:4 }}>SIGNING SECRET (HMAC-SHA256)</div>
              <code style={{ fontSize:11, color:'#3F8FE0', wordBreak:'break-all' }}>{selected.secret}</code>
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:'#4F5669', marginBottom:6 }}>SUBSCRIBED EVENTS</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {(selected.events ?? []).map((ev: string) => (
                  <code key={ev} style={{ fontSize:10, background:'#162F4F', color:'#3F8FE0', padding:'2px 7px', borderRadius:4 }}>{ev}</code>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              <Btn size="sm" variant={selected.is_active ? 'secondary' : 'primary'}
                onClick={() => toggle.mutate({ id:selected.id, isActive:!selected.is_active })}>
                {selected.is_active ? 'Pause' : 'Activate'}
              </Btn>
              <Btn size="sm" variant="ghost" onClick={() => ping.mutate(selected.id)}>Send Ping</Btn>
              <Btn size="sm" variant="danger" onClick={() => del.mutate(selected.id)}>Delete</Btn>
            </div>

            <div style={{ fontSize:12, fontWeight:700, color:'#4F5669', letterSpacing:'0.05em', marginBottom:8 }}>RECENT DELIVERIES</div>
            {!deliveries ? <Spinner /> : (deliveries?.deliveries ?? []).length === 0
              ? <Empty icon="📬" message="No deliveries yet" />
              : <Table columns={deliveryCols} data={deliveries.deliveries ?? []} />
            }
          </Card>
        )}
      </div>
    </>
  );
}
