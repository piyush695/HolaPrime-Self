import { useState, useEffect } from 'react';
import { A, api, inp, Card, Btn, Pill } from './_shared.js';

const EMPTY_FORM = { key: '', label: '', subject: '', html_body: '', text_body: '', variables: '' };

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({ subject: '', html_body: '' });
  const [editing, setEditing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<any>(EMPTY_FORM);
  const [saved, setSaved] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testSent, setTestSent] = useState(false);
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    api('/api/v1/email-templates').then((d: any) => setTemplates(Array.isArray(d) ? d : []));
  }, []);

  function selectTmpl(t: any) {
    setSel(t); setEditForm({ subject: t.subject, html_body: t.html_body, text_body: t.text_body ?? '' });
    setEditing(false); setShowCreate(false); setPreview(false);
  }

  async function save() {
    await api(`/api/v1/email-templates/${sel.key}`, { method: 'PATCH', body: JSON.stringify(editForm) });
    setTemplates((ts: any[]) => ts.map(t => t.key === sel.key ? { ...t, ...editForm } : t));
    setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  }

  async function createTemplate() {
    if (!createForm.key || !createForm.label || !createForm.subject || !createForm.html_body) {
      alert('All fields except variables are required'); return;
    }
    const vars = createForm.variables.split(',').map((v: string) => v.trim()).filter(Boolean);
    const created = await api('/api/v1/email-templates', {
      method: 'POST',
      body: JSON.stringify({ ...createForm, variables: vars }),
    });
    setTemplates((ts: any[]) => [...ts, created]);
    setSel(created); setEditForm({ subject: created.subject, html_body: created.html_body, text_body: '' });
    setShowCreate(false); setCreateForm(EMPTY_FORM);
  }

  async function deleteTemplate(key: string) {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    await api(`/api/v1/email-templates/${key}`, { method: 'DELETE' });
    setTemplates((ts: any[]) => ts.filter(t => t.key !== key));
    if (sel?.key === key) setSel(null);
  }

  async function sendTest() {
    if (!testEmail) return;
    await api(`/api/v1/email-templates/${sel.key}/test`, { method: 'POST', body: JSON.stringify({ email: testEmail }) });
    setTestSent(true); setTimeout(() => setTestSent(false), 3000);
  }

  function cf(key: string, val: string) { setCreateForm((p: any) => ({ ...p, [key]: val })); }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: A.white, marginBottom: 4 }}>Email Templates</h1>
          <p style={{ fontSize: 13, color: A.txtB }}>Edit all transactional emails sent to traders. Changes apply to all future sends.</p>
        </div>
        <Btn onClick={() => { setShowCreate(true); setSel(null); setEditing(false); }} style={{ padding: '9px 20px' }}>
          + New Template
        </Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
        {/* Template list */}
        <div>
          {templates.map(t => (
            <div key={t.key} onClick={() => selectTmpl(t)}
              style={{ padding: '12px 14px', borderRadius: 10, marginBottom: 6, cursor: 'pointer',
                background: sel?.key === t.key ? 'rgba(63,143,224,.15)' : A.surf,
                border: `1px solid ${sel?.key === t.key ? A.blue : A.bord}`, transition: 'all .15s' }}
              onMouseEnter={e => (e.currentTarget as any).style.borderColor = A.blue}
              onMouseLeave={e => (e.currentTarget as any).style.borderColor = sel?.key === t.key ? A.blue : A.bord}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: A.white }}>{t.label}</div>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.enabled ? A.green : A.txtC }} />
              </div>
              <div style={{ fontSize: 11, color: A.txtC, fontFamily: 'monospace', marginTop: 2 }}>{t.key}</div>
            </div>
          ))}
        </div>

        {/* Create form */}
        {showCreate && (
          <Card>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: A.white, marginBottom: 16 }}>New Email Template</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Key * <span style={{ color: A.txtC }}>(snake_case, unique)</span></label>
                <input value={createForm.key} onChange={e => cf('key', e.target.value)} placeholder="breach_recovery" style={inp}
                  onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Display Label *</label>
                <input value={createForm.label} onChange={e => cf('label', e.target.value)} placeholder="Breach Recovery Email" style={inp}
                  onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Subject * <span style={{ color: A.txtC }}>Use {'{{variable}}'} for personalisation</span></label>
              <input value={createForm.subject} onChange={e => cf('subject', e.target.value)} placeholder="Hi {{first_name}}, about your recent trade..." style={inp}
                onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>HTML Body *</label>
              <textarea value={createForm.html_body} onChange={e => cf('html_body', e.target.value)} rows={8}
                placeholder="<h1>Hi {{first_name}},</h1><p>Your message here.</p>"
                style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Variables <span style={{ color: A.txtC }}>(comma separated: first_name, amount)</span></label>
              <input value={createForm.variables} onChange={e => cf('variables', e.target.value)} placeholder="first_name, last_name, amount" style={inp}
                onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn onClick={createTemplate} style={{ padding: '8px 20px' }}>Create Template</Btn>
              <Btn onClick={() => { setShowCreate(false); setCreateForm(EMPTY_FORM); }} variant="ghost" style={{ padding: '8px 16px' }}>Cancel</Btn>
            </div>
          </Card>
        )}

        {/* Edit view */}
        {sel && !showCreate && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: A.white, marginBottom: 6 }}>{sel.label}</h2>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(sel.variables ?? []).map((v: string) => (
                    <code key={v} style={{ fontSize: 10, background: A.surf2, padding: '2px 8px', borderRadius: 4, color: A.blueL }}>
                      {`{{${v}}}`}
                    </code>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {saved && <span style={{ fontSize: 12, color: A.green, fontWeight: 700 }}>✓ Saved</span>}
                <Btn onClick={() => setPreview(p => !p)} variant="ghost" style={{ padding: '6px 12px', fontSize: 12 }}>
                  {preview ? '✏️ Edit' : '👁️ Preview'}
                </Btn>
                {!editing && !preview && <Btn onClick={() => setEditing(true)} variant="ghost" style={{ padding: '6px 12px', fontSize: 12 }}>✏️ Edit</Btn>}
                {editing && <><Btn onClick={() => setEditing(false)} variant="ghost" style={{ padding: '6px 12px', fontSize: 12 }}>Cancel</Btn>
                  <Btn onClick={save} style={{ padding: '6px 12px', fontSize: 12 }}>Save</Btn></>}
                <Btn onClick={() => deleteTemplate(sel.key)} variant="ghost"
                  style={{ padding: '6px 12px', fontSize: 12, color: A.red, borderColor: A.red }}>Delete</Btn>
              </div>
            </div>

            {/* Subject */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>Subject</label>
              {editing
                ? <input value={editForm.subject} onChange={e => setEditForm((p: any) => ({ ...p, subject: e.target.value }))} style={inp}
                    onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
                : <div style={{ padding: '10px 14px', background: A.surf2, borderRadius: 8, fontSize: 13, color: A.white }}>{editForm.subject}</div>}
            </div>

            {/* HTML Body */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: A.txtB, display: 'block', marginBottom: 5 }}>HTML Body</label>
              {preview
                ? <div style={{ padding: 16, background: '#ffffff', borderRadius: 8, minHeight: 200 }}
                    dangerouslySetInnerHTML={{ __html: editForm.html_body }} />
                : editing
                ? <textarea value={editForm.html_body} onChange={e => setEditForm((p: any) => ({ ...p, html_body: e.target.value }))}
                    rows={12} style={{ ...inp, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                    onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
                : <div style={{ padding: 12, background: A.surf2, borderRadius: 8, fontSize: 12, color: A.txtB,
                    fontFamily: 'monospace', maxHeight: 200, overflow: 'auto' }}>
                    {editForm.html_body}
                  </div>}
            </div>

            {/* Test send */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 14, borderTop: `1px solid ${A.bord}` }}>
              <input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@example.com"
                style={{ ...inp, width: 220 }} onFocus={e => e.currentTarget.style.borderColor = A.blue} onBlur={e => e.currentTarget.style.borderColor = A.bord} />
              <Btn onClick={sendTest} variant="ghost" style={{ padding: '8px 16px', fontSize: 12 }}>📧 Send Test</Btn>
              {testSent && <span style={{ fontSize: 12, color: A.green }}>✓ Test queued!</span>}
            </div>
          </Card>
        )}

        {!sel && !showCreate && (
          <Card><div style={{ textAlign: 'center', padding: 60, color: A.txtC }}>
            Select a template to edit or click New Template to create one
          </div></Card>
        )}
      </div>
    </div>
  );
}
