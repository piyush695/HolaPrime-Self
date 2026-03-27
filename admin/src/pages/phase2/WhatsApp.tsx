import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, Card, StatCard, Spinner, Btn, Badge, Empty,
} from '../../components/ui.js';

export default function WhatsApp() {
  const [convStatus, setConvStatus] = useState('open');
  const [selected, setSelected] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const qc = useQueryClient();

  const { data: stats } = useQuery({
    queryKey: ['wa-stats'],
    queryFn:  () => api.get('/whatsapp/stats').then(r => r.data),
  });

  const { data: convs, isLoading } = useQuery({
    queryKey: ['wa-conversations', convStatus],
    queryFn:  () => api.get('/whatsapp/conversations', { params:{ status: convStatus, limit: 50 } }).then(r => r.data),
    refetchInterval: 15_000,
  });

  const { data: thread } = useQuery({
    queryKey: ['wa-thread', selected?.id],
    queryFn:  () => selected ? api.get(`/whatsapp/conversations/${selected.id}`).then(r => r.data) : null,
    enabled:  !!selected,
    refetchInterval: 10_000,
  });

  const sendReply = useMutation({
    mutationFn: () => api.post('/whatsapp/send/text', {
      phone:          selected.phone,
      body:           replyText,
      contactId:      selected.contact_id,
      conversationId: selected.id,
    }),
    onSuccess: () => {
      setReplyText('');
      qc.invalidateQueries({ queryKey:['wa-thread', selected?.id] });
    },
  });

  const MSG_BG: Record<string, string> = {
    inbound: '#252931', outbound: '#162F4F',
  };

  return (
    <>
      <PageHeader title="WhatsApp Inbox" sub="Conversations, broadcasts, and template messages" />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Open Conversations"  value={stats?.open_conversations  ?? '—'} color="#25D366" />
        <StatCard label="Sent This Month"     value={stats?.sent_this_month     ?? '—'} color="#3F8FE0" />
        <StatCard label="Read This Month"     value={stats?.read_this_month     ?? '—'} color="#38BA82" />
        <StatCard label="Approved Templates"  value={stats?.approved_templates  ?? '—'} color="#F5B326" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:16, height:'calc(100vh - 260px)', minHeight:500 }}>
        {/* Conversation list */}
        <Card style={{ padding:0, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {/* Filter tabs */}
          <div style={{ display:'flex', borderBottom:'1px solid #353947', flexShrink:0 }}>
            {['open','closed','pending'].map(s => (
              <button key={s} onClick={() => setConvStatus(s)} style={{
                flex:1, padding:'10px 0', fontSize:12, fontWeight: convStatus===s ? 700 : 400,
                color: convStatus===s ? '#F5F8FF' : '#878FA4',
                background:'none', border:'none', cursor:'pointer',
                borderBottom: convStatus===s ? '2px solid #25D366' : '2px solid transparent',
              }}>{s}</button>
            ))}
          </div>

          <div style={{ flex:1, overflowY:'auto' }}>
            {isLoading ? (
              <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
            ) : (convs?.conversations ?? []).length === 0 ? (
              <Empty icon="💬" message="No conversations" />
            ) : (
              (convs?.conversations ?? []).map((c: any) => (
                <div
                  key={c.id}
                  onClick={() => setSelected(c)}
                  style={{
                    padding:'12px 14px', cursor:'pointer',
                    borderBottom:'1px solid #35394733',
                    background: selected?.id === c.id ? '#252931' : 'transparent',
                    transition:'background 0.1s',
                  }}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:3 }}>
                    <div style={{ fontWeight:600, color:'#F5F8FF', fontSize:13 }}>
                      {c.first_name ? `${c.first_name} ${c.last_name ?? ''}` : c.phone}
                    </div>
                    {c.last_message_at && (
                      <span style={{ fontSize:10, color:'#4F5669', flexShrink:0 }}>
                        {new Date(c.last_message_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:11, color:'#4F5669' }}>{c.phone}</div>
                  {c.last_message && (
                    <div style={{ fontSize:12, color:'#878FA4', marginTop:3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {c.last_message}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Message thread */}
        {selected ? (
          <Card style={{ padding:0, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            {/* Thread header */}
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #353947', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'#25D36622', border:'1px solid #25D36644', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                💬
              </div>
              <div>
                <div style={{ fontWeight:700, color:'#F5F8FF', fontSize:13 }}>
                  {selected.first_name ? `${selected.first_name} ${selected.last_name ?? ''}` : selected.phone}
                </div>
                <div style={{ fontSize:11, color:'#4F5669' }}>{selected.phone}</div>
              </div>
              <div style={{ marginLeft:'auto' }}>
                <Badge label={selected.status} variant={selected.status==='open'?'green':'default'} />
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:8 }}>
              {!thread ? (
                <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner /></div>
              ) : (thread.messages ?? []).length === 0 ? (
                <Empty icon="💬" message="No messages yet" />
              ) : (
                (thread.messages ?? []).map((m: any) => (
                  <div
                    key={m.id}
                    style={{
                      display:'flex',
                      justifyContent: m.direction === 'outbound' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div style={{
                      maxWidth:'70%', padding:'8px 12px',
                      background: MSG_BG[m.direction],
                      borderRadius: m.direction === 'outbound' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      border:'1px solid #353947',
                    }}>
                      <div style={{ fontSize:13, color:'#CCD2E3', lineHeight:1.4 }}>{m.body}</div>
                      <div style={{ fontSize:10, color:'#4F5669', marginTop:4, display:'flex', gap:6, justifyContent:'flex-end', alignItems:'center' }}>
                        <span>{new Date(m.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
                        {m.direction === 'outbound' && (
                          <span style={{ color: m.status==='read'?'#25D366':m.status==='delivered'?'#878FA4':'#4F5669' }}>
                            {m.status==='read'?'✓✓':m.status==='delivered'?'✓✓':'✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Reply box */}
            <div style={{ padding:'12px 16px', borderTop:'1px solid #353947', display:'flex', gap:8, flexShrink:0 }}>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (replyText.trim()) sendReply.mutate(); } }}
                placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                rows={2}
                style={{
                  flex:1, background:'#252931', color:'#F5F8FF',
                  border:'1px solid #353947', borderRadius:8,
                  padding:'8px 12px', fontSize:13, resize:'none', outline:'none',
                }}
              />
              <Btn
                variant="primary"
                disabled={!replyText.trim() || sendReply.isPending}
                onClick={() => sendReply.mutate()}
                style={{ alignSelf:'flex-end', padding:'8px 16px' }}
              >
                Send
              </Btn>
            </div>
          </Card>
        ) : (
          <Card style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Empty icon="💬" message="Select a conversation" sub="Choose a conversation from the list to view messages and reply" />
          </Card>
        )}
      </div>
    </>
  );
}
