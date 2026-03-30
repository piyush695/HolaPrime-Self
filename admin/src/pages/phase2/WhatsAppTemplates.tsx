import { useState, useEffect } from 'react';
import { A, api, inp, sel as selStyle, Card, Btn, Pill } from '../ops/_shared.js';

const CATEGORY_COLORS: Record<string, string> = {
  MARKETING: A.blue, UTILITY: A.green, AUTHENTICATION: A.gold,
};

const EMPTY_FORM = {
  name: '', wa_template_name: '', language: 'en_US', category: 'MARKETING',
  header_type: '', header_content: '', body_text: '', footer_text: '',
};

export default function WhatsAppTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api('/api/v1/whatsapp/templates').then((d: any) => setTemplates(Array.isArray(d) ? d : []));
  }, []);

  function selectTemplate(t: any) {
    setSel(t); setShowCreate(false);
    setEditForm({ body_text: t.body_text, footer_text: t.footer_text ?? '', status: t.status });
  }

  async function createTemplate() {
    if (!form.name || !form.wa_template_name || !form.body_text) {
      alert('Name, template name, and body text are required'); return;
    }
    setSaving(true);
    try {
      const created = await api('/api/v1/whatsapp/templates', {
        method: 'POST', body: JSON.stringify({ ...form, variables: extractVars(form.body_text) }),
      });
      setTemplates((ts: any[]) => [...ts, created]);
      setSel(created); setShowCreate(false); setForm(EMPTY_FORM);
    } catch { alert('Failed to create template'); }
    setSaving(false);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await api(`/api/v1/whatsapp/templates/${sel.id}`, {
        method: 'PATCH', body: JSON.stringify(editForm),
      });
      setTemplates((ts: any[]) => ts.map(t => t.id === sel.id ? { ...t, ...editForm } : t));
      setSel((s: any) => ({ ...s, ...editForm }));
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch { alert('Save failed'); }
    setSaving(false);
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return;
    await api(`/api/v1/whatsapp/templates/${id}`, { method: 'DELETE' });
    setTemplates((ts: any[]) => ts.filter(t => t.id !== id));
    if (sel?.id === id) setSel(null);
  }

  function extractVars(text: string) {
    const matches = text.match(/\{\{(\w+)\}\}/g) ?? [];
    return [...new Set(matches.map(m => m.slice(2, -2)))];
  }

  function f(key: string, val: string) {
    setForm((p: any) => ({ ...p, [key]: val }));
  }

  const STATUS_COLOR: Record<string, string> = {
    draft: A.txtC, pending_approval: A.gold, approved: A.green, rejected: A.red,
  };

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: A.white, marginBottom: 4 }}>WhatsApp Templates</h1>
          <p style={{ fontSize: 13, color: A.txtB }}>Manage approved Meta template messages for broadcasts and automated sends.</p>
        </div>
        <Btn onClick={() => { setShowCreate(true); setSel(null); }} style={{ padding: '9px 20px' }}>
          + New Template
        </Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        {/* Template list */}
        <div>
          {templates.length === 0 && (
            <Card><div style={{ textAlign: 'center', color: A.txtC, padding: 30, fontSize: 13 }}>
              No templates yet.<br />Create your first one →
            </div></Card>
          )}
          {templates.map(t => (
            <div key={t.id} onClick={() => selectTemplate(t)}
              style={{ padding: '12px 14px', borderRadius: 10, marginBottom: 6, cursor: 'pointer',
                background: sel?.id === t.id ? 'rgba(63,143,224,.15)' : A.surf,
                border: `1px solid ${sel?.id === t.id ? A.blue : A.bord}`, transition: 'all .15s' }}
              onMouseEnter={e => (e.currentTarget as any).style.borderColor = A.blue}
              onMouseLeave={e => (e.currentTarget as any).style.borderColor = sel?.id === t.id ? A.blue : A.bord}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: A.white }}>{t.name}</div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[t.status] ?? A.txtC, marginTop: 4 }} />
              </div>
              <div style={{ fontSize: 11, color: A.txtC, fontFamily: 'monospace', marginBottom: 4 }}>{t.wa_template_name}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Pill label={t.category} color={CATEGORY_COLORS[t.category] ?? A.txtC} />
                <Pill label={t.language} color={A.txtC} />
              </div>
            </div>
          ))}
        </div>

        {/* Create form */}
        {showCreate && (
          <Card>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: A.white, marginBottom: 16 }}>Create Template</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Display Name *</label>
                <input value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. Challenge Passed" style={inp}
                  onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Meta Template Name * <span style={{ color: A.txtC }}>(snake_case)</span></label>
                <input value={form.wa_template_name} onChange={e => f('wa_template_name', e.target.value)} placeholder="e.g. challenge_passed_v1" style={inp}
                  onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Category</label>
                <select value={form.category} onChange={e => f('category', e.target.value)} style={selStyle}>
                  <option value="MARKETING">MARKETING</option>
                  <option value="UTILITY">UTILITY</option>
                  <option value="AUTHENTICATION">AUTHENTICATION</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Language</label>
                <select value={form.language} onChange={e => f('language', e.target.value)} style={selStyle}>
                  <option value="en_US">English (US)</option>
                  <option value="en_GB">English (UK)</option>
                  <option value="ar">Arabic</option>
                  <option value="hi">Hindi</option>
                  <option value="es">Spanish</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>
                Body Text * <span style={{ color: A.txtC }}>Use {'{{variable_name}}'} for personalisation</span>
              </label>
              <textarea value={form.body_text} onChange={e => f('body_text', e.target.value)} rows={5}
                placeholder="Hi {{first_name}}, congratulations on passing your {{challenge_name}} challenge! 🎉"
                style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                onFocus={e => e.currentTarget.style.borderColor = A.blue}
                onBlur={e => e.currentTarget.style.borderColor = A.bord} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Header (optional)</label>
                <input value={form.header_content} onChange={e => f('header_content', e.target.value)} placeholder="Header text" style={inp}
                  onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Footer (optional)</label>
                <input value={form.footer_text} onChange={e => f('footer_text', e.target.value)} placeholder="Reply STOP to unsubscribe" style={inp}
                  onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
              </div>
            </div>
            {form.body_text && extractVars(form.body_text).length > 0 && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: A.surf2, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: A.txtC, marginBottom: 6 }}>Detected variables:</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {extractVars(form.body_text).map(v => (
                    <code key={v} style={{ fontSize: 11, background: 'rgba(63,143,224,.15)', color: A.blueL, padding: '2px 8px', borderRadius: 4 }}>
                      {`{{${v}}}`}
                    </code>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn onClick={createTemplate} disabled={saving} style={{ padding: '8px 20px' }}>
                {saving ? 'Creating…' : 'Create Template'}
              </Btn>
              <Btn onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }} variant="ghost" style={{ padding: '8px 16px' }}>
                Cancel
              </Btn>
            </div>
          </Card>
        )}

        {/* Template detail / edit */}
        {sel && !showCreate && editForm && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: A.white, marginBottom: 6 }}>{sel.name}</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Pill label={sel.category} color={CATEGORY_COLORS[sel.category] ?? A.txtC} />
                  <Pill label={sel.language} color={A.txtC} />
                  <span style={{ fontSize: 12, color: STATUS_COLOR[sel.status], fontWeight: 700 }}>
                    ● {sel.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {saved && <span style={{ fontSize: 12, color: A.green, fontWeight: 700 }}>✓ Saved</span>}
                <Btn onClick={saveEdit} disabled={saving} style={{ padding: '6px 16px', fontSize: 12 }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </Btn>
                <Btn onClick={() => deleteTemplate(sel.id)} variant="ghost"
                  style={{ padding: '6px 12px', fontSize: 12, color: A.red, borderColor: A.red }}>
                  Delete
                </Btn>
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: A.surf2, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: A.txtC, marginBottom: 4 }}>Meta Template Name</div>
              <code style={{ fontSize: 13, color: A.blueL }}>{sel.wa_template_name}</code>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Body Text</label>
              <textarea value={editForm.body_text}
                onChange={e => setEditForm((p: any) => ({ ...p, body_text: e.target.value }))}
                rows={6} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}
                onFocus={e => e.currentTarget.style.borderColor = A.blue}
                onBlur={e => e.currentTarget.style.borderColor = A.bord} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Footer Text</label>
                <input value={editForm.footer_text ?? ''} onChange={e => setEditForm((p: any) => ({ ...p, footer_text: e.target.value }))}
                  style={inp} onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Status</label>
                <select value={editForm.status} onChange={e => setEditForm((p: any) => ({ ...p, status: e.target.value }))} style={selStyle}>
                  <option value="draft">Draft</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {sel.variables?.length > 0 && (
              <div style={{ padding: '10px 14px', background: A.surf2, borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: A.txtC, marginBottom: 6 }}>Variables in this template:</div>
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
        )}

        {!sel && !showCreate && (
          <Card><div style={{ textAlign: 'center', padding: 60, color: A.txtC }}>
            Select a template to edit or create a new one
          </div></Card>
        )}
      </div>
    </div>
  );
}
