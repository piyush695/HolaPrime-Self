import { useState, useEffect } from 'react';
import { A, api, inp, Card, Btn, Pill } from '../ops/_shared.js';

// Meta WhatsApp Business API - full template structure
type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';
type HeaderType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION' | '';
type Category = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

const EMPTY_BUTTON = (type: ButtonType) => {
  if (type === 'QUICK_REPLY') return { type, text: '' };
  if (type === 'URL') return { type, text: '', url: '', example: '' };
  if (type === 'PHONE_NUMBER') return { type, text: '', phone_number: '' };
  if (type === 'COPY_CODE') return { type, example: '' };
  return { type, text: '' };
};

const CATEGORY_COLOR: Record<string, string> = { MARKETING: A.blue, UTILITY: A.green, AUTHENTICATION: A.gold };
const STATUS_COLOR: Record<string, string> = { draft: A.txtC, pending_approval: A.gold, approved: A.green, rejected: A.red };

const sel2: React.CSSProperties = { width:'100%',background:'rgba(255,255,255,.05)',color:A.white,border:`1px solid ${A.bord}`,borderRadius:8,padding:'9px 12px',fontSize:13,outline:'none',fontFamily:'inherit',cursor:'pointer' };

function ButtonEditor({ buttons, onChange }: { buttons: any[], onChange: (b: any[]) => void }) {
  function addButton(type: ButtonType) {
    if (buttons.length >= 3) { alert('Maximum 3 buttons per template'); return; }
    // Max 2 CTA buttons (URL/PHONE combined)
    const ctas = buttons.filter(b => b.type === 'URL' || b.type === 'PHONE_NUMBER');
    if ((type === 'URL' || type === 'PHONE_NUMBER') && ctas.length >= 2) { alert('Maximum 2 CTA buttons'); return; }
    onChange([...buttons, EMPTY_BUTTON(type)]);
  }
  function update(i: number, field: string, val: string) {
    onChange(buttons.map((b, idx) => idx === i ? { ...b, [field]: val } : b));
  }
  function remove(i: number) { onChange(buttons.filter((_, idx) => idx !== i)); }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: A.txtB, fontWeight: 700, display: 'flex', alignItems: 'center', marginRight: 4 }}>Add button:</span>
        {(['QUICK_REPLY','URL','PHONE_NUMBER','COPY_CODE'] as ButtonType[]).map(type => (
          <button key={type} onClick={() => addButton(type)} style={{
            padding: '5px 12px', borderRadius: 6, border: `1px solid ${A.bord}`,
            background: A.surf2, color: A.txtB, fontSize: 11, cursor: 'pointer', fontWeight: 700,
          }}>
            {type === 'QUICK_REPLY' ? '↩ Quick Reply' : type === 'URL' ? '🔗 URL' : type === 'PHONE_NUMBER' ? '📞 Phone' : '📋 Copy Code'}
          </button>
        ))}
        <span style={{ fontSize: 11, color: A.txtC, alignSelf: 'center' }}>
          Max 3 total · Max 2 CTA (URL/Phone) · Max 3 Quick Replies
        </span>
      </div>

      {buttons.map((btn, i) => (
        <div key={i} style={{ padding: '12px 14px', background: A.surf2, borderRadius: 8, marginBottom: 8, border: `1px solid ${A.bord}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: CATEGORY_COLOR[btn.type] ?? A.txtC, padding: '2px 8px', background: `${CATEGORY_COLOR[btn.type] ?? A.txtC}18`, borderRadius: 4 }}>
              {btn.type}
            </span>
            <button onClick={() => remove(i)} style={{ background: 'transparent', border: 'none', color: A.red, cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {btn.type !== 'COPY_CODE' && (
              <input value={btn.text || ''} onChange={e => update(i, 'text', e.target.value)}
                placeholder="Button label (max 25 chars)" maxLength={25} style={{ ...inp, fontSize: 12 }}
                onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
            )}
            {btn.type === 'URL' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input value={btn.url || ''} onChange={e => update(i, 'url', e.target.value)}
                  placeholder="https://holaprime.com/{{1}} (use {{1}} for dynamic part)" style={{ ...inp, fontSize: 12 }}
                  onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
                <input value={btn.example || ''} onChange={e => update(i, 'example', e.target.value)}
                  placeholder="Example URL (required by Meta)" style={{ ...inp, fontSize: 12 }}
                  onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
              </div>
            )}
            {btn.type === 'PHONE_NUMBER' && (
              <input value={btn.phone_number || ''} onChange={e => update(i, 'phone_number', e.target.value)}
                placeholder="+44 7700 900000 (full international format)" style={{ ...inp, fontSize: 12 }}
                onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
            )}
            {btn.type === 'COPY_CODE' && (
              <input value={btn.example || ''} onChange={e => update(i, 'example', e.target.value)}
                placeholder="Example code (e.g. HP2024OFF)" style={{ ...inp, fontSize: 12 }}
                onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplatePreview({ template }: { template: any }) {
  return (
    <div style={{ background: '#1E2535', borderRadius: 12, padding: 20, border: `1px solid ${A.bord}` }}>
      <div style={{ fontSize: 11, color: A.txtC, marginBottom: 12, fontWeight: 700 }}>PREVIEW — WhatsApp message appearance</div>
      <div style={{ background: '#0B1120', borderRadius: 8, padding: 0, maxWidth: 340 }}>
        {/* Header */}
        {template.header_content && (
          <div style={{ background: '#1C2A3A', padding: '12px 14px', borderRadius: '8px 8px 0 0',
            borderBottom: `1px solid ${A.bord}` }}>
            {template.header_type === 'TEXT'
              ? <div style={{ fontSize: 14, fontWeight: 700, color: A.white }}>{template.header_content}</div>
              : template.header_type === 'IMAGE'
              ? <div style={{ height: 80, background: '#252D3D', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: A.txtC, fontSize: 12 }}>📷 Image</div>
              : template.header_type === 'VIDEO'
              ? <div style={{ height: 80, background: '#252D3D', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: A.txtC, fontSize: 12 }}>▶️ Video</div>
              : template.header_type === 'DOCUMENT'
              ? <div style={{ padding: '8px 12px', background: '#252D3D', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, color: A.txtA, fontSize: 12 }}>📄 Document</div>
              : null}
          </div>
        )}
        {/* Body */}
        <div style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 14, color: A.white, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {template.body_text || <span style={{ color: A.txtC }}>Body text will appear here…</span>}
          </div>
          {template.footer_text && (
            <div style={{ fontSize: 11, color: A.txtC, marginTop: 8 }}>{template.footer_text}</div>
          )}
        </div>
        {/* Buttons */}
        {template.buttons?.length > 0 && (
          <div style={{ borderTop: `1px solid ${A.bord}` }}>
            {template.buttons.map((btn: any, i: number) => (
              <div key={i} style={{ padding: '10px 14px', borderTop: i > 0 ? `1px solid ${A.bord}` : 'none',
                textAlign: 'center', cursor: 'pointer', color: '#4F8CF7', fontSize: 13, fontWeight: 700 }}>
                {btn.type === 'URL' ? `🔗 ${btn.text}` : btn.type === 'PHONE_NUMBER' ? `📞 ${btn.text}` : btn.type === 'COPY_CODE' ? '📋 Copy Code' : `↩ ${btn.text}`}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WhatsAppTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [createError, setCreateError] = useState('');

  const [form, setForm] = useState<any>({
    name: '', wa_template_name: '', language: 'en_US', category: 'MARKETING' as Category,
    header_type: '' as HeaderType, header_content: '',
    body_text: '', footer_text: '', buttons: [],
  });

  const [editForm, setEditForm] = useState<any>(null);

  useEffect(() => {
    api('/api/v1/whatsapp/templates').then((d:any) => setTemplates(Array.isArray(d)?d:[]));
  }, []);

  function select(t: any) {
    setSel(t); setShowCreate(false); setShowPreview(false);
    setEditForm({
      body_text: t.body_text, footer_text: t.footer_text ?? '',
      status: t.status, buttons: t.buttons ?? [],
    });
  }

  function setF(k: string, v: any) { setForm((p: any) => ({ ...p, [k]: v })); }
  function setEF(k: string, v: any) { setEditForm((p: any) => ({ ...p, [k]: v })); }

  function extractVars(text: string) {
    return [...new Set((text.match(/\{\{(\d+|\w+)\}\}/g) ?? []).map(m => m.slice(2, -2)))];
  }

  async function create() {
    setCreateError('');
    if (!form.name) { setCreateError('Display name is required'); return; }
    if (!form.wa_template_name) { setCreateError('Meta template name (snake_case) is required'); return; }
    if (!form.body_text) { setCreateError('Body text is required'); return; }
    setSaving(true);
    try {
      const created = await api('/api/v1/whatsapp/templates', {
        method: 'POST',
        body: JSON.stringify({ ...form, variables: extractVars(form.body_text) }),
      });
      setTemplates((ts: any[]) => [...ts, created]);
      select(created); setShowCreate(false); setCreateError('');
      setForm({ name:'', wa_template_name:'', language:'en_US', category:'MARKETING', header_type:'', header_content:'', body_text:'', footer_text:'', buttons:[] });
    } catch(e: any) {
      setCreateError(e.message ?? 'Failed to create template');
    }
    setSaving(false);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await api(`/api/v1/whatsapp/templates/${sel.id}`, { method: 'PATCH', body: JSON.stringify(editForm) });
      setTemplates((ts: any[]) => ts.map(t => t.id === sel.id ? { ...t, ...editForm } : t));
      setSel((s: any) => ({ ...s, ...editForm }));
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch { alert('Save failed'); }
    setSaving(false);
  }

  async function del(id: string) {
    if (!confirm('Delete this template?')) return;
    await api(`/api/v1/whatsapp/templates/${id}`, { method: 'DELETE' });
    setTemplates((ts: any[]) => ts.filter(t => t.id !== id));
    if (sel?.id === id) setSel(null);
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: A.white, marginBottom: 4 }}>WhatsApp Templates</h1>
          <p style={{ fontSize: 13, color: A.txtB }}>Create and manage Meta Business API templates. Supports headers, body, footer, quick replies, CTA buttons, and OTP.</p>
        </div>
        <Btn onClick={() => { setShowCreate(true); setSel(null); }} style={{ padding: '9px 20px' }}>+ New Template</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        {/* List */}
        <div>
          {templates.map(t => (
            <div key={t.id} onClick={() => select(t)}
              style={{ padding: '12px 14px', borderRadius: 10, marginBottom: 6, cursor: 'pointer',
                background: sel?.id === t.id ? 'rgba(63,143,224,.15)' : A.surf,
                border: `1px solid ${sel?.id === t.id ? A.blue : A.bord}`, transition: 'all .15s' }}
              onMouseEnter={e => (e.currentTarget as any).style.borderColor = A.blue}
              onMouseLeave={e => (e.currentTarget as any).style.borderColor = sel?.id === t.id ? A.blue : A.bord}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: A.white, marginBottom: 2 }}>{t.name}</div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[t.status] ?? A.txtC, marginTop: 3 }} />
              </div>
              <div style={{ fontSize: 11, color: A.txtC, fontFamily: 'monospace', marginBottom: 4 }}>{t.wa_template_name}</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                <Pill label={t.category} color={CATEGORY_COLOR[t.category] ?? A.txtC} />
                <Pill label={t.language} color={A.txtC} />
                {t.buttons?.length > 0 && <Pill label={`${t.buttons.length} btn`} color={A.purple ?? '#A78BFA'} />}
              </div>
            </div>
          ))}
          {templates.length === 0 &&
            <div style={{ color: A.txtC, fontSize: 13, textAlign: 'center', padding: 30 }}>No templates yet</div>}
        </div>

        {/* Create form */}
        {showCreate && (
          <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr 380px' : '1fr', gap: 16 }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: A.white }}>New WhatsApp Template</h2>
                <Btn onClick={() => setShowPreview(p => !p)} variant="ghost" style={{ padding: '6px 12px', fontSize: 12 }}>
                  {showPreview ? 'Hide Preview' : '👁 Preview'}
                </Btn>
              </div>

              {/* Identity */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Display Name *</label>
                  <input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="Challenge Passed Alert" style={inp}
                    onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>
                    Meta Template Name * <span style={{ color: A.txtC }}>(snake_case — must match Meta)</span>
                  </label>
                  <input value={form.wa_template_name} onChange={e => setF('wa_template_name', e.target.value)} placeholder="challenge_passed_alert" style={inp}
                    onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Category *</label>
                  <select value={form.category} onChange={e => setF('category', e.target.value)} style={sel2}>
                    <option value="MARKETING">MARKETING — Promotions, offers, win-back</option>
                    <option value="UTILITY">UTILITY — Transactional, account updates</option>
                    <option value="AUTHENTICATION">AUTHENTICATION — OTP, verification codes</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Language</label>
                  <select value={form.language} onChange={e => setF('language', e.target.value)} style={sel2}>
                    <option value="en_US">English (US)</option>
                    <option value="en_GB">English (UK)</option>
                    <option value="ar">Arabic</option>
                    <option value="hi">Hindi</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="pt_BR">Portuguese (BR)</option>
                    <option value="id">Indonesian</option>
                  </select>
                </div>
              </div>

              {/* Header */}
              <div style={{ background: A.surf2, borderRadius: 8, padding: 14, marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: A.txtB, fontWeight: 700, display: 'block', marginBottom: 8 }}>
                  HEADER <span style={{ color: A.txtC, fontWeight: 400 }}>(optional)</span>
                </label>
                <div style={{ display: 'flex', gap: 6, marginBottom: form.header_type ? 10 : 0, flexWrap: 'wrap' }}>
                  {(['','TEXT','IMAGE','VIDEO','DOCUMENT','LOCATION'] as HeaderType[]).map(ht => (
                    <button key={ht} onClick={() => setF('header_type', ht)} style={{
                      padding: '4px 12px', borderRadius: 6, border: `1px solid ${form.header_type === ht ? A.blue : A.bord}`,
                      background: form.header_type === ht ? 'rgba(63,143,224,.15)' : 'transparent',
                      color: form.header_type === ht ? A.blueL : A.txtB, fontSize: 12, cursor: 'pointer', fontWeight: 600,
                    }}>
                      {ht === '' ? 'None' : ht === 'IMAGE' ? '📷 Image' : ht === 'VIDEO' ? '▶️ Video' : ht === 'DOCUMENT' ? '📄 Doc' : ht === 'LOCATION' ? '📍 Location' : '📝 Text'}
                    </button>
                  ))}
                </div>
                {form.header_type === 'TEXT' && (
                  <input value={form.header_content} onChange={e => setF('header_content', e.target.value)}
                    placeholder="Header text (max 60 chars)" maxLength={60} style={{ ...inp, fontSize: 12 }}
                    onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
                )}
                {(form.header_type === 'IMAGE' || form.header_type === 'VIDEO' || form.header_type === 'DOCUMENT') && (
                  <div style={{ padding: 10, background: A.surf, borderRadius: 6, fontSize: 12, color: A.txtC }}>
                    Media URL will be provided when sending. Meta stores approved media samples.
                  </div>
                )}
              </div>

              {/* Body */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>
                  BODY * <span style={{ color: A.txtC }}>Use {'{{1}}'}, {'{{2}}'} etc. for variables (Meta format) or {'{{name}}'} (our format)</span>
                </label>
                <textarea value={form.body_text} onChange={e => setF('body_text', e.target.value)} rows={5}
                  placeholder={form.category === 'AUTHENTICATION'
                    ? 'Your Hola Prime verification code is {{1}}. Valid for 10 minutes.'
                    : 'Hi {{1}}! 🎉 You passed your *{{2}}* challenge. Complete KYC to get your funded account:\n{{3}}'}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                  onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
                {form.body_text && (
                  <div style={{ marginTop: 6, fontSize: 11, color: A.txtC }}>
                    {extractVars(form.body_text).length > 0
                      ? `Variables detected: ${extractVars(form.body_text).map(v => `{{${v}}}`).join(', ')}`
                      : 'No variables detected'}
                    &nbsp;· {form.body_text.length}/1024 chars
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>
                  FOOTER <span style={{ color: A.txtC }}>(optional — e.g. "Reply STOP to unsubscribe")</span>
                </label>
                <input value={form.footer_text} onChange={e => setF('footer_text', e.target.value)}
                  placeholder="Reply STOP to unsubscribe" maxLength={60} style={{ ...inp, fontSize: 12 }}
                  onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
              </div>

              {/* Buttons */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11, color: A.txtB, fontWeight: 700, display: 'block', marginBottom: 10 }}>
                  BUTTONS <span style={{ color: A.txtC, fontWeight: 400 }}>(optional — max 3)</span>
                </label>
                <ButtonEditor buttons={form.buttons} onChange={v => setF('buttons', v)} />
              </div>

              {createError && (
                <div style={{ padding:'10px 14px',background:'rgba(255,76,106,.1)',border:'1px solid rgba(255,76,106,.3)',borderRadius:8,fontSize:13,color:'#FF4C6A',marginBottom:12 }}>
                  ❌ {createError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn onClick={create} disabled={saving} style={{ padding: '8px 20px' }}>
                  {saving ? 'Creating…' : 'Create Template'}
                </Btn>
                <Btn onClick={() => { setShowCreate(false); setCreateError(''); }} variant="ghost" style={{ padding: '8px 16px' }}>Cancel</Btn>
              </div>

              <div style={{ marginTop: 16, padding: '10px 14px', background: A.surf2, borderRadius: 8, fontSize: 12, color: A.txtC }}>
                💡 Templates must be submitted to Meta for approval before use in campaigns. UTILITY and AUTHENTICATION templates typically approve within minutes; MARKETING templates may take 24 hours.
              </div>
            </Card>

            {showPreview && <TemplatePreview template={form} />}
          </div>
        )}

        {/* Edit/detail view */}
        {sel && !showCreate && editForm && (
          <div style={{ display: 'grid', gridTemplateColumns: showPreview ? '1fr 360px' : '1fr', gap: 16 }}>
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: A.white, marginBottom: 6 }}>{sel.name}</h2>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Pill label={sel.category} color={CATEGORY_COLOR[sel.category] ?? A.txtC} />
                    <Pill label={sel.language} color={A.txtC} />
                    <span style={{ fontSize: 12, color: STATUS_COLOR[sel.status], fontWeight: 700 }}>
                      ● {sel.status?.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {saved && <span style={{ fontSize: 12, color: A.green, fontWeight: 700 }}>✓ Saved</span>}
                  <Btn onClick={() => setShowPreview(p => !p)} variant="ghost" style={{ padding: '6px 12px', fontSize: 12 }}>
                    {showPreview ? 'Hide Preview' : '👁 Preview'}
                  </Btn>
                  <Btn onClick={saveEdit} disabled={saving} style={{ padding: '6px 16px', fontSize: 12 }}>
                    {saving ? 'Saving…' : 'Save'}
                  </Btn>
                  <Btn onClick={() => del(sel.id)} variant="ghost"
                    style={{ padding: '6px 12px', fontSize: 12, color: A.red, borderColor: A.red }}>
                    Delete
                  </Btn>
                </div>
              </div>

              <div style={{ padding: '10px 14px', background: A.surf2, borderRadius: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: A.txtC, marginBottom: 2 }}>Meta Template Name</div>
                <code style={{ fontSize: 13, color: A.blueL }}>{sel.wa_template_name}</code>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Body Text</label>
                <textarea value={editForm.body_text}
                  onChange={e => setEF('body_text', e.target.value)} rows={6}
                  style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                  onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Footer</label>
                  <input value={editForm.footer_text ?? ''} onChange={e => setEF('footer_text', e.target.value)}
                    style={inp} onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Status</label>
                  <select value={editForm.status} onChange={e => setEF('status', e.target.value)} style={sel2}>
                    <option value="draft">Draft</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: A.txtB, fontWeight: 700, display: 'block', marginBottom: 10 }}>Buttons</label>
                <ButtonEditor buttons={editForm.buttons ?? []} onChange={v => setEF('buttons', v)} />
              </div>

              {sel.variables?.length > 0 && (
                <div style={{ padding: '10px 14px', background: A.surf2, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: A.txtC, marginBottom: 6 }}>Variables:</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {sel.variables.map((v: string) => (
                      <code key={v} style={{ fontSize: 11, background: 'rgba(63,143,224,.15)', color: A.blueL, padding: '2px 8px', borderRadius: 4 }}>
                        {`{{${v}}}`}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </Card>
            {showPreview && <TemplatePreview template={{ ...sel, ...editForm }} />}
          </div>
        )}

        {!sel && !showCreate &&
          <Card><div style={{ textAlign: 'center', padding: 60, color: A.txtC }}>Select a template or create a new one</div></Card>}
      </div>
    </div>
  );
}
