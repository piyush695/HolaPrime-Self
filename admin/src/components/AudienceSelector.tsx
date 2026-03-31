import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { Btn, Spinner } from './ui.js';

const TYPE_COLOR: Record<string, string> = {
  custom_upload:'#3F8FE0', platform_cohort:'#38BA82', crm_segment:'#A78BFA',
};
const TYPE_ICON: Record<string, string> = {
  custom_upload:'📤', platform_cohort:'🎯', crm_segment:'🗂️',
};

interface Props {
  campaignId: string;
  onClose: () => void;
}

export default function AudienceSelector({ campaignId, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'attached'|'all'>('attached');
  const qc = useQueryClient();

  const { data: attached = [], isLoading: attachLoading } = useQuery({
    queryKey: ['campaign-audiences', campaignId],
    queryFn: () => api.get(`/audiences/by-campaign/${campaignId}`).then(r => r.data),
  });

  const { data: allAudiences = [], isLoading: allLoading } = useQuery({
    queryKey: ['audiences'],
    queryFn: () => api.get('/audiences').then(r => r.data),
    enabled: tab === 'all',
  });

  const attach = useMutation({
    mutationFn: (audienceId: string) =>
      api.post('/audiences/attach', { campaignId, audienceId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign-audiences', campaignId] }),
  });

  const detach = useMutation({
    mutationFn: (audienceId: string) =>
      api.delete(`/audiences/attach/${campaignId}/${audienceId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaign-audiences', campaignId] }),
  });

  const attachedIds = new Set((attached as any[]).map((a: any) => a.id));
  const totalContacts = (attached as any[]).reduce((s: number, a: any) => s + (a.contact_count ?? 0), 0);

  const filtered = (allAudiences as any[]).filter((a: any) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const inp: React.CSSProperties = {
    background:'rgba(255,255,255,.05)', color:'#F5F8FF', border:'1px solid #353947',
    borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', fontFamily:'inherit', width:'100%',
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.9)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#1C1F27', border:'1px solid #353947', borderRadius:16, width:580, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 40px 100px rgba(0,0,0,.8)' }}>

        {/* Header */}
        <div style={{ padding:'18px 24px', borderBottom:'1px solid #353947', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'#F5F8FF' }}>Manage Audiences</div>
            <div style={{ fontSize:12, color:'#64748B', marginTop:2 }}>
              {(attached as any[]).length} audience{(attached as any[]).length !== 1 ? 's' : ''} · {totalContacts.toLocaleString()} total contacts
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#64748B', fontSize:22, cursor:'pointer' }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid #353947', flexShrink:0 }}>
          {([
            { id:'attached', label:'Attached Audiences' },
            { id:'all',      label:'Add Audiences' },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding:'10px 18px', fontSize:13, fontWeight: tab===t.id ? 700 : 400,
              color: tab===t.id ? '#F5F8FF' : '#64748B',
              background:'none', border:'none', cursor:'pointer',
              borderBottom: tab===t.id ? '2px solid #3F8FE0' : '2px solid transparent',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:20 }}>

          {/* Attached audiences */}
          {tab === 'attached' && (
            attachLoading ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
            : !(attached as any[]).length ? (
              <div style={{ textAlign:'center', padding:'40px 0' }}>
                <div style={{ fontSize:36, marginBottom:12 }}>👥</div>
                <div style={{ fontSize:15, fontWeight:700, color:'#F5F8FF', marginBottom:6 }}>No audiences attached</div>
                <div style={{ fontSize:13, color:'#64748B', marginBottom:20 }}>Switch to "Add Audiences" to attach one</div>
                <Btn onClick={() => setTab('all')}>Browse Audiences</Btn>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {(attached as any[]).map((a: any) => (
                  <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                    padding:'14px 16px', background:'rgba(56,186,130,.06)',
                    border:'1px solid rgba(56,186,130,.2)', borderRadius:10 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <span style={{ fontSize:20 }}>{TYPE_ICON[a.type] ?? '👥'}</span>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:'#F5F8FF', marginBottom:2 }}>{a.name}</div>
                        <div style={{ fontSize:12, color:'#64748B' }}>
                          {a.contact_count.toLocaleString()} contacts
                          {a.last_refreshed_at && ` · updated ${new Date(a.last_refreshed_at).toLocaleDateString()}`}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ fontSize:16, fontWeight:900, color:'#38BA82' }}>
                        {a.contact_count.toLocaleString()}
                      </div>
                      <button onClick={() => detach.mutate(a.id)} style={{
                        padding:'5px 10px', borderRadius:6, border:'1px solid rgba(255,76,106,.3)',
                        background:'rgba(255,76,106,.05)', color:'#FF4C6A', fontSize:11, cursor:'pointer',
                      }}>Remove</button>
                    </div>
                  </div>
                ))}

                {/* Total */}
                <div style={{ padding:'12px 16px', background:'rgba(255,255,255,.03)', border:'1px solid #252D3D', borderRadius:10, display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'#F5F8FF' }}>Total Reach</span>
                  <span style={{ fontSize:16, fontWeight:900, color:'#3F8FE0' }}>{totalContacts.toLocaleString()} contacts</span>
                </div>
              </div>
            )
          )}

          {/* Add audiences */}
          {tab === 'all' && (
            <div>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search audiences…" style={{ ...inp, marginBottom:14 }} />
              {allLoading ? <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
              : !filtered.length ? (
                <div style={{ textAlign:'center', padding:40, color:'#64748B' }}>
                  No audiences found. <a href="/audiences" style={{ color:'#3F8FE0' }}>Create one first</a>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {filtered.map((a: any) => {
                    const isAttached = attachedIds.has(a.id);
                    return (
                      <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                        padding:'12px 14px', background: isAttached ? 'rgba(56,186,130,.05)' : '#161B27',
                        border:`1px solid ${isAttached ? 'rgba(56,186,130,.25)' : '#252D3D'}`, borderRadius:10 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <span style={{ fontSize:18 }}>{TYPE_ICON[a.type] ?? '👥'}</span>
                          <div>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <span style={{ fontSize:13, fontWeight:700, color:'#F5F8FF' }}>{a.name}</span>
                              <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20,
                                background:`${TYPE_COLOR[a.type]}15`, color:TYPE_COLOR[a.type],
                                border:`1px solid ${TYPE_COLOR[a.type]}33` }}>
                                {a.type.replace('_', ' ')}
                              </span>
                            </div>
                            <div style={{ fontSize:11, color:'#64748B', marginTop:2 }}>
                              {a.contact_count.toLocaleString()} contacts
                              {a.status === 'building' && ' · ⏳ building'}
                            </div>
                          </div>
                        </div>
                        {isAttached ? (
                          <span style={{ fontSize:12, color:'#38BA82', fontWeight:700 }}>✓ Attached</span>
                        ) : (
                          <Btn onClick={() => attach.mutate(a.id)} variant="secondary"
                            disabled={attach.isPending || a.status === 'building'}
                            style={{ padding:'5px 14px', fontSize:12 }}>
                            + Add
                          </Btn>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px', borderTop:'1px solid #353947', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:13, color:'#64748B' }}>
            {totalContacts > 0
              ? `Campaign will reach ${totalContacts.toLocaleString()} contacts`
              : 'No audiences attached yet'}
          </div>
          <Btn onClick={onClose}>Done</Btn>
        </div>
      </div>
    </div>
  );
}
