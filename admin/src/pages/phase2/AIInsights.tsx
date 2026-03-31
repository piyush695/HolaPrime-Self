import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../lib/api.js';

const QUICK_PROMPTS = [
  { icon:'📊', label:'Full marketing analysis', prompt:'Give me a full marketing analysis of the platform right now. What are the biggest opportunities and risks?' },
  { icon:'🔻', label:'Funnel drop-offs',        prompt:'Analyse our conversion funnel step by step. Where are we losing the most users and what should we do about it?' },
  { icon:'💸', label:'Revenue & growth',        prompt:'Analyse our revenue trends and growth rate. What can we do to increase challenge purchases this month?' },
  { icon:'⚠️', label:'Churn & breach risk',     prompt:'How bad is our churn and breach situation? Who is at risk and what re-engagement campaigns should we run?' },
  { icon:'🌍', label:'Geo opportunities',       prompt:'Which countries should we double down on for marketing spend? Based on current user distribution and conversion.' },
  { icon:'📧', label:'Campaign ideas',          prompt:'Based on our current platform data, what email and WhatsApp campaigns should we run this week? Give me ready-to-use subject lines.' },
  { icon:'🏆', label:'Challenge pass rates',    prompt:'Analyse our challenge pass rates. Are they healthy for the business? What does this mean for trader quality and firm risk?' },
  { icon:'💡', label:'Top 5 quick wins',        prompt:'Give me 5 quick wins we can implement this week to improve marketing performance. Be specific and actionable.' },
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

function MarkdownText({ text }: { text: string }) {
  const html = text
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:800;color:#F5F8FF;margin:14px 0 5px;padding:0">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 style="font-size:16px;font-weight:800;color:#F5F8FF;margin:18px 0 8px;padding:0">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 style="font-size:18px;font-weight:900;color:#F5F8FF;margin:20px 0 10px;padding:0">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#F5F8FF;font-weight:700">$1</strong>')
    .replace(/`(.+?)`/g, '<code style="background:#1C2333;border:1px solid #252D3D;padding:1px 7px;border-radius:4px;font-size:12px;color:#60A9F0;font-family:monospace">$1</code>')
    .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:3px 0;padding-left:4px"><span style="color:#3F8FE0;flex-shrink:0;margin-top:1px">›</span><span style="color:#94A3B8">$1</span></div>')
    .replace(/^(\d+)\. (.+)$/gm, '<div style="display:flex;gap:10px;margin:4px 0;padding-left:4px"><span style="color:#F5B326;font-weight:800;min-width:20px;flex-shrink:0">$1.</span><span style="color:#94A3B8">$2</span></div>')
    .replace(/❗/g, '<span style="color:#FF4C6A;font-size:15px">❗</span>')
    .replace(/✅/g, '<span style="color:#38BA82;font-size:15px">✅</span>')
    .replace(/💡/g, '<span style="font-size:15px">💡</span>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #252D3D;margin:16px 0"/>')
    .replace(/\n\n/g, '</p><p style="margin:0;color:#94A3B8;line-height:1.8">')
    .replace(/\n/g, '<br/>');

  return (
    <div
      style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.8 }}
      dangerouslySetInnerHTML={{ __html: `<p style="margin:0;color:#94A3B8;line-height:1.8">${html}</p>` }}
    />
  );
}

function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '4px 0', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: '#4F5669', marginRight: 4 }}>Claude is thinking</span>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 6, height: 6, borderRadius: '50%', background: '#6366F1',
          animation: `ai-pulse 1.2s ${i * 0.2}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

export default function AIInsights() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const me = useAuthStore(s => s.admin);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, [input]);

  async function send(questionOverride?: string) {
    const question = (questionOverride ?? input).trim();
    if (!question || loading) return;
    setInput('');
    setError('');

    const userMsg: Message = { role: 'user', content: question };
    const history = messages
      .filter(m => !m.streaming && m.content)
      .map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', streaming: true }]);
    setLoading(true);

    try {
      const token = JSON.parse(localStorage.getItem('hp-admin-auth-v2') ?? '{}').state?.accessToken ?? '';
      const res = await fetch('/api/v1/ai/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, conversationHistory: history }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        if (res.status === 503) setApiKeyMissing(true);
        throw new Error(errData.error ?? `HTTP ${res.status}`);
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
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
              fullText += ev.delta.text;
              setMessages(prev => prev.map(m => m.streaming ? { ...m, content: fullText } : m));
            }
            if (ev.type === 'error') throw new Error(ev.error);
          } catch { /* skip */ }
        }
      }

      setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false, content: fullText || '(no response)' } : m));
    } catch (e: any) {
      setError(e.message ?? 'Request failed');
      setMessages(prev => prev.filter(m => !m.streaming));
    }

    setLoading(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  const firstInitial = (me?.first_name?.[0] ?? 'A').toUpperCase();

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', overflow: 'hidden' }}>

      <style>{`
        @keyframes ai-pulse { 0%,100%{opacity:.25;transform:scale(.75)} 50%{opacity:1;transform:scale(1)} }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: '16px 0 12px', borderBottom: '1px solid #1E2535', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>✦</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#F5F8FF', lineHeight: 1.2 }}>AI Marketing Intelligence</div>
            <div style={{ fontSize: 12, color: '#4F5669', marginTop: 2 }}>Powered by Claude · Analyses live Hola Prime data</div>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => { setMessages([]); setError(''); setApiKeyMissing(false); }} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #252D3D', background: 'transparent', color: '#64748B', fontSize: 12, cursor: 'pointer' }}>
            New conversation
          </button>
        )}
      </div>

      {/* ── API key warning ─────────────────────────────────────────────────── */}
      {apiKeyMissing && (
        <div style={{ flexShrink: 0, margin: '12px 0', padding: '12px 16px', background: 'rgba(255,76,106,.08)', border: '1px solid rgba(255,76,106,.25)', borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#FF4C6A', marginBottom: 4 }}>⚠️ ANTHROPIC_API_KEY not found in environment</div>
          <div style={{ fontSize: 12, color: '#8892B0' }}>
            Go to <strong style={{ color: '#F5F8FF' }}>Cloud Run → holaprime-admin → Edit & Deploy → Variables & Secrets</strong> and add <code style={{ color: '#60A9F0', background: 'rgba(63,143,224,.1)', padding: '1px 6px', borderRadius: 4 }}>ANTHROPIC_API_KEY</code> as an environment variable.
          </div>
        </div>
      )}

      {/* ── Messages / Empty state ──────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>

        {messages.length === 0 ? (
          /* Empty state */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✦</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#F5F8FF', marginBottom: 6, textAlign: 'center' }}>What would you like to analyse?</div>
            <div style={{ fontSize: 13, color: '#4F5669', maxWidth: 440, textAlign: 'center', marginBottom: 32, lineHeight: 1.6 }}>
              Claude has access to your live platform data — revenue, users, conversions, churn, campaigns, and more. Ask anything.
            </div>

            {/* Quick prompt grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, width: '100%', maxWidth: 820 }}>
              {QUICK_PROMPTS.map(p => (
                <button key={p.label} onClick={() => send(p.prompt)} disabled={loading} style={{
                  padding: '14px 12px', borderRadius: 10, border: '1px solid #1E2535',
                  background: '#161B27', cursor: 'pointer', textAlign: 'left',
                  transition: 'border-color .15s, background .15s',
                }}
                  onMouseEnter={e => { (e.currentTarget as any).style.borderColor = '#6366F1'; (e.currentTarget as any).style.background = 'rgba(99,102,241,.06)'; }}
                  onMouseLeave={e => { (e.currentTarget as any).style.borderColor = '#1E2535'; (e.currentTarget as any).style.background = '#161B27'; }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{p.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#D8E0F0', marginBottom: 4, lineHeight: 1.3 }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: '#4F5669', lineHeight: 1.4 }}>{p.prompt.length > 55 ? p.prompt.slice(0, 55) + '…' : p.prompt}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat messages */
          <div>
            {messages.map((msg, i) => (
              <div key={i} style={{
                padding: '16px 0',
                borderBottom: '1px solid #1A2030',
                display: 'flex',
                gap: 14,
              }}>
                {/* Avatar */}
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: msg.role === 'user'
                    ? '#252D3D'
                    : 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: msg.role === 'user' ? 13 : 16,
                  fontWeight: 800, color: msg.role === 'user' ? '#8892B0' : '#fff',
                  marginTop: 2,
                }}>
                  {msg.role === 'user' ? firstInitial : '✦'}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: msg.role === 'user' ? '#3F8FE0' : '#6366F1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    {msg.role === 'user' ? 'You' : 'Claude'}
                  </div>
                  {msg.role === 'user' ? (
                    <div style={{ fontSize: 14, color: '#D8E0F0', lineHeight: 1.7 }}>{msg.content}</div>
                  ) : msg.streaming && !msg.content ? (
                    <ThinkingDots />
                  ) : (
                    <>
                      <MarkdownText text={msg.content} />
                      {msg.streaming && <ThinkingDots />}
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} style={{ height: 8 }} />
          </div>
        )}
      </div>

      {/* ── Quick prompts row (when chat active) ────────────────────────────── */}
      {messages.length > 0 && !loading && (
        <div style={{ flexShrink: 0, display: 'flex', gap: 6, padding: '8px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {QUICK_PROMPTS.slice(0, 5).map(p => (
            <button key={p.label} onClick={() => send(p.prompt)} style={{
              padding: '5px 12px', borderRadius: 20, border: '1px solid #1E2535',
              background: '#161B27', color: '#64748B', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all .15s',
            }}
              onMouseEnter={e => { (e.currentTarget as any).style.borderColor = '#6366F1'; (e.currentTarget as any).style.color = '#A5B4FC'; }}
              onMouseLeave={e => { (e.currentTarget as any).style.borderColor = '#1E2535'; (e.currentTarget as any).style.color = '#64748B'; }}>
              {p.icon} {p.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ flexShrink: 0, padding: '10px 14px', background: 'rgba(255,76,106,.08)', border: '1px solid rgba(255,76,106,.25)', borderRadius: 8, fontSize: 12, color: '#FF4C6A', marginBottom: 10 }}>
          ❌ {error}
        </div>
      )}

      {/* ── Input area ──────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, paddingTop: 8 }}>
        <div style={{
          display: 'flex', gap: 10, alignItems: 'flex-end',
          background: '#161B27', border: `1px solid ${loading ? '#6366F1' : '#252D3D'}`,
          borderRadius: 14, padding: '12px 14px', transition: 'border-color .2s',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask anything about your marketing data… (Enter to send · Shift+Enter for new line)"
            style={{
              flex: 1, background: 'transparent', border: 'none', color: '#F5F8FF',
              fontSize: 14, outline: 'none', resize: 'none', fontFamily: 'inherit',
              lineHeight: 1.6, minHeight: 24, maxHeight: 140, overflowY: 'auto',
            }}
            rows={1}
            disabled={loading}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            style={{
              width: 36, height: 36, borderRadius: 9, border: 'none', flexShrink: 0,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              background: loading || !input.trim() ? '#1E2535' : 'linear-gradient(135deg,#6366F1,#8B5CF6)',
              color: loading || !input.trim() ? '#4F5669' : '#fff',
              fontSize: loading ? 14 : 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .2s', boxShadow: loading || !input.trim() ? 'none' : '0 4px 14px rgba(99,102,241,.4)',
            }}>
            {loading ? '⏳' : '↑'}
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: 10, color: '#2E3850', marginTop: 6 }}>
          Claude · live platform data · for internal decision support only
        </div>
      </div>
    </div>
  );
}
