import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { useAuthStore } from '../../lib/api.js';

// ── Markdown renderer (simple, no deps) ──────────────────────────────────────
function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;color:#F5F8FF;margin:16px 0 6px">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 style="font-size:16px;font-weight:800;color:#F5F8FF;margin:20px 0 8px">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 style="font-size:18px;font-weight:900;color:#F5F8FF;margin:20px 0 8px">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#F5F8FF">$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em style="color:#D8E0F0">$1</em>')
    .replace(/`(.+?)`/g,       '<code style="background:#1C2333;padding:1px 6px;border-radius:4px;font-size:12px;color:#60A9F0;font-family:monospace">$1</code>')
    .replace(/❗/g, '<span style="color:#FF4C6A">❗</span>')
    .replace(/✅/g, '<span style="color:#38BA82">✅</span>')
    .replace(/^- (.+)$/gm,  '<div style="display:flex;gap:8px;margin:4px 0"><span style="color:#3F8FE0;flex-shrink:0">•</span><span>$1</span></div>')
    .replace(/^(\d+)\. (.+)$/gm, '<div style="display:flex;gap:8px;margin:4px 0"><span style="color:#F5B326;font-weight:700;flex-shrink:0">$1.</span><span>$2</span></div>')
    .replace(/\n\n/g, '<div style="height:10px"></div>')
    .replace(/---/g,  '<hr style="border:none;border-top:1px solid #252D3D;margin:16px 0"/>');
}

// ── Suggested prompts ─────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { icon:'📊', label:'Full analysis',         prompt:'Give me a full marketing analysis of the platform. What are the biggest opportunities and risks right now?' },
  { icon:'🔻', label:'Funnel drop-offs',       prompt:'Analyse the conversion funnel. Where are we losing the most users and what should we do about it?' },
  { icon:'💸', label:'Revenue insights',       prompt:'Analyse revenue trends. How is growth tracking and what can we do to increase challenge purchases?' },
  { icon:'⚠️', label:'Churn & breach',         prompt:'How bad is our churn and breach situation? What re-engagement campaigns should we run?' },
  { icon:'🌍', label:'Geo opportunities',      prompt:'Which countries should we focus marketing spend on based on the current user distribution and conversion data?' },
  { icon:'📧', label:'Campaign strategy',      prompt:'Based on our current data, what email and WhatsApp campaigns should we run this week?' },
  { icon:'🏆', label:'Pass rate analysis',     prompt:'Analyse challenge pass rates. Are they healthy? What does this mean for trader quality and firm risk?' },
  { icon:'💡', label:'Quick wins',             prompt:'Give me 5 quick wins we can implement this week to improve marketing performance.' },
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export default function AIInsights() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const me = useAuthStore(s => s.admin);

  const { data: snapshot } = useQuery({
    queryKey: ['ai-snapshot'],
    queryFn: () => api.get('/ai/snapshot').then(r => r.data),
    staleTime: 60_000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(questionOverride?: string) {
    const question = questionOverride ?? input.trim();
    if (!question || loading) return;
    setInput('');
    setError('');

    const userMsg: Message = { role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Build history for API (exclude streaming placeholders)
    const history = messages
      .filter(m => !m.streaming)
      .map(m => ({ role: m.role, content: m.content }));

    // Add streaming placeholder
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);

    try {
      const token = JSON.parse(localStorage.getItem('hp-admin-auth-v2') ?? '{}').state?.accessToken ?? '';
      const res = await fetch('/api/v1/ai/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, conversationHistory: history }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (res.status === 503) { setApiKeyMissing(true); }
        setError(err.error ?? `Error ${res.status}`);
        setMessages(prev => prev.filter(m => !m.streaming));
        setLoading(false);
        return;
      }

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              fullText += parsed.delta.text;
              setMessages(prev => prev.map(m =>
                m.streaming ? { ...m, content: fullText } : m
              ));
            }
            if (parsed.type === 'error') {
              setError(parsed.error);
            }
          } catch { /* skip parse errors */ }
        }
      }

      // Finalise message
      setMessages(prev => prev.map(m =>
        m.streaming ? { ...m, content: fullText, streaming: false } : m
      ));
    } catch(e: any) {
      setError(e.message ?? 'Request failed');
      setMessages(prev => prev.filter(m => !m.streaming));
    }

    setLoading(false);
    inputRef.current?.focus();
  }

  function clearChat() {
    setMessages([]);
    setError('');
    setInput('');
  }

  const o = (snapshot?.overview as any) ?? {};

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", height:'calc(100vh - 80px)', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexShrink:0 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#6366F1,#8B5CF6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>✦</div>
            <h1 style={{ fontSize:22, fontWeight:900, color:'#F5F8FF', margin:0 }}>AI Marketing Intelligence</h1>
          </div>
          <p style={{ fontSize:13, color:'#64748B', margin:0 }}>
            Powered by Claude · Analyses live platform data · Generates actionable insights
          </p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          {/* Live KPI pills */}
          {o.total_users && (
            <div style={{ display:'flex', gap:6 }}>
              {[
                { label:`$${Number(o.revenue_30d??0).toLocaleString()} rev/30d`, color:'#38BA82' },
                { label:`${o.new_users_7d??0} new/7d`, color:'#3F8FE0' },
                { label:`${o.funded_accounts??0} funded`, color:'#F5B326' },
              ].map(k => (
                <span key={k.label} style={{ fontSize:11, fontWeight:700, padding:'4px 10px', borderRadius:20,
                  background:`${k.color}15`, color:k.color, border:`1px solid ${k.color}33` }}>
                  {k.label}
                </span>
              ))}
            </div>
          )}
          {messages.length > 0 && (
            <button onClick={clearChat} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #353947',
              background:'transparent', color:'#64748B', fontSize:12, cursor:'pointer' }}>
              Clear chat
            </button>
          )}
        </div>
      </div>

      {/* API key missing warning */}
      {apiKeyMissing && (
        <div style={{ padding:'14px 18px', background:'rgba(255,76,106,.08)', border:'1px solid rgba(255,76,106,.25)', borderRadius:10, marginBottom:16, flexShrink:0 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#FF4C6A', marginBottom:4 }}>⚠️ Anthropic API Key Not Configured</div>
          <div style={{ fontSize:12, color:'#8892B0', lineHeight:1.6 }}>
            Add <code style={{ color:'#60A9F0', background:'rgba(63,143,224,.1)', padding:'1px 6px', borderRadius:4 }}>ANTHROPIC_API_KEY</code> to Cloud Run → holaprime-admin → Edit & Deploy → Variables & Secrets.
            Get your API key from <a href="https://console.anthropic.com" target="_blank" style={{ color:'#3F8FE0' }}>console.anthropic.com</a>.
          </div>
        </div>
      )}

      {/* Chat area */}
      <div style={{ flex:1, overflowY:'auto', marginBottom:12, borderRadius:12,
        background: messages.length > 0 ? '#0F1117' : 'transparent',
        border: messages.length > 0 ? '1px solid #1E2535' : 'none' }}>

        {/* Empty state */}
        {messages.length === 0 && (
          <div style={{ padding:'40px 0' }}>
            <div style={{ textAlign:'center', marginBottom:32 }}>
              <div style={{ fontSize:48, marginBottom:12 }}>✦</div>
              <div style={{ fontSize:18, fontWeight:800, color:'#F5F8FF', marginBottom:6 }}>
                What would you like to analyse?
              </div>
              <div style={{ fontSize:13, color:'#64748B', maxWidth:420, margin:'0 auto' }}>
                Ask anything about your platform performance. Claude has access to live data including revenue, users, conversion rates, campaigns, and churn.
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, maxWidth:800, margin:'0 auto', padding:'0 20px' }}>
              {QUICK_PROMPTS.map(p => (
                <button key={p.label} onClick={() => send(p.prompt)} style={{
                  padding:'14px 14px', borderRadius:10, border:'1px solid #252D3D',
                  background:'#161B27', cursor:'pointer', textAlign:'left', transition:'all .15s',
                }}
                  onMouseEnter={e => { (e.currentTarget as any).style.borderColor='#3F8FE0'; (e.currentTarget as any).style.background='rgba(63,143,224,.06)'; }}
                  onMouseLeave={e => { (e.currentTarget as any).style.borderColor='#252D3D'; (e.currentTarget as any).style.background='#161B27'; }}>
                  <div style={{ fontSize:18, marginBottom:8 }}>{p.icon}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#D8E0F0', marginBottom:4 }}>{p.label}</div>
                  <div style={{ fontSize:11, color:'#4F5669', lineHeight:1.4 }}>{p.prompt.slice(0,60)}…</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={i} style={{
            padding: msg.role === 'user' ? '16px 20px' : '20px 24px',
            background: msg.role === 'user' ? 'rgba(63,143,224,.06)' : 'transparent',
            borderBottom: '1px solid #1E2535',
          }}>
            <div style={{ display:'flex', gap:12, maxWidth:860, margin:'0 auto' }}>
              {/* Avatar */}
              <div style={{ width:28, height:28, borderRadius:8, flexShrink:0, marginTop:2,
                background: msg.role === 'user' ? '#252D3D' : 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800,
                color: msg.role === 'user' ? '#8892B0' : '#fff' }}>
                {msg.role === 'user' ? (me?.first_name?.[0]?.toUpperCase() ?? 'U') : '✦'}
              </div>
              {/* Content */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, color:'#4F5669', fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:'.05em' }}>
                  {msg.role === 'user' ? 'You' : 'Claude'}
                </div>
                {msg.role === 'user' ? (
                  <div style={{ fontSize:14, color:'#D8E0F0', lineHeight:1.7 }}>{msg.content}</div>
                ) : (
                  <div style={{ fontSize:14, color:'#94A3B8', lineHeight:1.8 }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) || (msg.streaming ? '' : '—') }} />
                )}
                {msg.streaming && (
                  <div style={{ display:'flex', gap:4, marginTop:8 }}>
                    {[0,1,2].map(j => (
                      <div key={j} style={{ width:6, height:6, borderRadius:'50%', background:'#6366F1',
                        animation:`pulse 1s ${j*0.2}s infinite` }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts row (when chat active) */}
      {messages.length > 0 && !loading && (
        <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap', flexShrink:0 }}>
          {QUICK_PROMPTS.slice(0,4).map(p => (
            <button key={p.label} onClick={() => send(p.prompt)} style={{
              padding:'5px 12px', borderRadius:20, border:'1px solid #252D3D',
              background:'#161B27', color:'#8892B0', fontSize:11, fontWeight:700, cursor:'pointer',
              transition:'all .15s',
            }}
              onMouseEnter={e => { (e.currentTarget as any).style.borderColor='#3F8FE0'; (e.currentTarget as any).style.color='#60A9F0'; }}
              onMouseLeave={e => { (e.currentTarget as any).style.borderColor='#252D3D'; (e.currentTarget as any).style.color='#8892B0'; }}>
              {p.icon} {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !apiKeyMissing && (
        <div style={{ padding:'10px 14px', background:'rgba(255,76,106,.1)', border:'1px solid rgba(255,76,106,.3)', borderRadius:8, fontSize:12, color:'#FF4C6A', marginBottom:10, flexShrink:0 }}>
          ❌ {error}
        </div>
      )}

      {/* Input */}
      <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexShrink:0,
        background:'#161B27', border:'1px solid #252D3D', borderRadius:12, padding:'12px 14px' }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask anything about your marketing data… (Enter to send, Shift+Enter for newline)"
          style={{ flex:1, background:'transparent', border:'none', color:'#F5F8FF', fontSize:14,
            outline:'none', resize:'none', fontFamily:'inherit', lineHeight:1.6, minHeight:24, maxHeight:120 }}
          rows={1}
          disabled={loading}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{
          width:36, height:36, borderRadius:8, border:'none', cursor: loading||!input.trim() ? 'not-allowed' : 'pointer',
          background: loading||!input.trim() ? '#252D3D' : 'linear-gradient(135deg,#6366F1,#8B5CF6)',
          color:'#fff', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center',
          flexShrink:0, transition:'all .15s', opacity: loading||!input.trim() ? 0.5 : 1,
        }}>
          {loading ? '⏳' : '↑'}
        </button>
      </div>

      <div style={{ textAlign:'center', fontSize:10, color:'#4F5669', marginTop:8, flexShrink:0 }}>
        Claude analyses live platform data. Insights are for decision support — always verify with your team.
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }
      `}</style>
    </div>
  );
}
