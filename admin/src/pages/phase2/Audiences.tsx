import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { PageHeader, Card, Btn, Badge, Spinner, Empty } from '../../components/ui.js';

const TYPE_LABEL: Record<string, string> = {
  custom_upload:   '📤 Custom Upload',
  platform_cohort: '🎯 Platform Cohort',
  crm_segment:     '🗂️ CRM Segment',
};
const TYPE_COLOR: Record<string, string> = {
  custom_upload:   '#3F8FE0',
  platform_cohort: '#38BA82',
  crm_segment:     '#A78BFA',
};
const STATUS_COLOR: Record<string, string> = {
  ready:    '#38BA82',
  building: '#F5B326',
  error:    '#FF4C6A',
};

const inp: React.CSSProperties = {
  width:'100%', background:'rgba(255,255,255,.05)', color:'#F5F8FF',
  border:'1px solid #353947', borderRadius:8, padding:'9px 12px',
  fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box',
};

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/\s+/g, '_'));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  }).filter(r => Object.values(r).some(v => v));
}

// ── Cohort card component ─────────────────────────────────────────────────────
function CohortCard({ cohort, onBuild }: { cohort: any; onBuild: (key: string) => void }) {
  const { data: countData } = useQuery({
    queryKey: ['cohort-count', cohort.key],
    queryFn: () => api.get(`/audiences/cohorts/${cohort.key}/count`).then(r => r.data),
    staleTime: 5 * 60_000,
  });

  return (
    <div style={{ padding:'16px 18px', background:'#1C2333', border:'1px solid #252D3D', borderRadius:12,
      display:'flex', justifyContent:'space-between', alignItems:'center', gap:16 }}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:14, fontWeight:700, color:'#F5F8FF', marginBottom:4 }}>{cohort.label}</div>
        <div style={{ fontSize:12, color:'#64748B', lineHeight:1.5 }}>{cohort.description}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:14, flexShrink:0 }}>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:22, fontWeight:900, color:'#38BA82' }}>
            {countData?.count !== undefined ? countData.count.toLocaleString() : '—'}
          </div>
          <div style={{ fontSize:10, color:'#4F5669' }}>contacts</div>
        </div>
        <Btn onClick={() => onBuild(cohort.key)} style={{ padding:'7px 16px', fontSize:12, whiteSpace:'nowrap' }}>
          Build Audience
        </Btn>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Audiences() {
  const [tab, setTab] = useState<'audiences'|'cohorts'|'upload'>('audiences');
  const [selected, setSelected] = useState<any>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadContacts, setUploadContacts] = useState<any[]>([]);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const { data: audiences, isLoading } = useQuery({
    queryKey: ['audiences'],
    queryFn: () => api.get('/audiences').then(r => r.data),
    refetchInterval: (data: any) =>
      (data as any[])?.some((a: any) => a.status === 'building') ? 3000 : false,
  });

  const { data: cohorts } = useQuery({
    queryKey: ['cohort-defs'],
    queryFn: () => api.get('/audiences/cohorts').then(r => r.data),
    enabled: tab === 'cohorts',
  });

  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ['audience-contacts', selected?.id],
    queryFn: () => api.get(`/audiences/${selected?.id}/contacts?limit=100`).then(r => r.data),
    enabled: !!selected && showContacts,
  });

  const buildCohort = useMutation({
    mutationFn: ({ key, name }: { key: string; name?: string }) =>
      api.post('/audiences/cohort', { cohortKey: key, name }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audiences'] });
      setTab('audiences');
    },
  });

  const refresh = useMutation({
    mutationFn: (id: string) => api.post(`/audiences/${id}/refresh`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audiences'] }),
  });

  const deleteAud = useMutation({
    mutationFn: (id: string) => api.delete(`/audiences/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['audiences'] }); setSelected(null); },
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError('');
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFileName(file.name);
    if (!uploadName) setUploadName(file.name.replace(/\.[^.]+$/, ''));
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string;
        const parsed = parseCSV(text);
        if (!parsed.length) { setUploadError('No valid rows found. Check your CSV format.'); return; }
        const hasIdentifier = parsed.every(r => r.email || r.phone);
        if (!hasIdentifier) { setUploadError('Each row must have at least an "email" or "phone" column.'); return; }
        setUploadContacts(parsed);
      } catch { setUploadError('Could not parse CSV file.'); }
    };
    reader.readAsText(file);
  }

  async function submitUpload() {
    if (!uploadName) { setUploadError('Audience name is required'); return; }
    if (!uploadContacts.length) { setUploadError('No contacts to upload'); return; }
    setUploading(true);
    try {
      await api.post('/audiences/upload', {
        name: uploadName,
        contacts: uploadContacts,
        sourceFile: uploadFileName,
      });
      qc.invalidateQueries({ queryKey: ['audiences'] });
      setTab('audiences');
      setUploadContacts([]); setUploadName(''); setUploadFileName('');
    } catch(e: any) {
      setUploadError(e?.response?.data?.error ?? e.message ?? 'Upload failed');
    }
    setUploading(false);
  }

  return (
    <>
      <PageHeader
        title="Audiences"
        sub="Custom uploads, platform cohorts, and CRM segments for targeted campaigns"
        action={
          <div style={{ display:'flex', gap:8 }}>
            <Btn variant="secondary" onClick={() => setTab('cohorts')}>🎯 Platform Cohorts</Btn>
            <Btn onClick={() => setTab('upload')}>📤 Upload CSV</Btn>
          </div>
        }
      />

      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:'1px solid #353947' }}>
        {([
          { id:'audiences', label:`All Audiences (${(audiences as any[])?.length ?? 0})` },
          { id:'cohorts',   label:'Platform Cohorts' },
          { id:'upload',    label:'Upload CSV' },
        ] as { id: typeof tab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'10px 18px', fontSize:13, fontWeight: tab===t.id ? 700 : 400,
            color: tab===t.id ? '#F5F8FF' : '#878FA4',
            background:'none', border:'none', cursor:'pointer',
            borderBottom: tab===t.id ? '2px solid #3F8FE0' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── All Audiences ──────────────────────────────────────────────────── */}
      {tab === 'audiences' && (
        <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 400px' : '1fr', gap:20 }}>
          <div>
            {isLoading ? (
              <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner /></div>
            ) : !(audiences as any[])?.length ? (
              <Empty icon="👥" message="No audiences yet"
                sub="Upload a CSV or build a cohort from platform data to get started" />
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {(audiences as any[]).map((a: any) => (
                  <div key={a.id} onClick={() => { setSelected(a); setShowContacts(false); }}
                    style={{ padding:'16px 20px', background: selected?.id === a.id ? 'rgba(63,143,224,.1)' : '#161B27',
                      border:`1px solid ${selected?.id === a.id ? '#3F8FE0' : '#252D3D'}`,
                      borderRadius:12, cursor:'pointer', transition:'all .15s',
                      display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}
                    onMouseEnter={e => { if (selected?.id !== a.id) (e.currentTarget as any).style.borderColor='#353947'; }}
                    onMouseLeave={e => { if (selected?.id !== a.id) (e.currentTarget as any).style.borderColor='#252D3D'; }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                        <span style={{ fontSize:15, fontWeight:700, color:'#F5F8FF' }}>{a.name}</span>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20,
                          background:`${TYPE_COLOR[a.type]}18`, color:TYPE_COLOR[a.type],
                          border:`1px solid ${TYPE_COLOR[a.type]}33` }}>
                          {TYPE_LABEL[a.type]}
                        </span>
                      </div>
                      {a.description && <div style={{ fontSize:12, color:'#64748B', marginBottom:4 }}>{a.description}</div>}
                      <div style={{ fontSize:11, color:'#4F5669' }}>
                        {a.last_refreshed_at
                          ? `Last updated ${new Date(a.last_refreshed_at).toLocaleString()}`
                          : `Created ${new Date(a.created_at).toLocaleDateString()}`}
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:16, flexShrink:0 }}>
                      <div style={{ textAlign:'right' }}>
                        {a.status === 'building' ? (
                          <div style={{ color:'#F5B326', fontSize:12, fontWeight:700 }}>⏳ Building…</div>
                        ) : (
                          <>
                            <div style={{ fontSize:24, fontWeight:900, color:'#38BA82' }}>
                              {a.contact_count.toLocaleString()}
                            </div>
                            <div style={{ fontSize:10, color:'#4F5669' }}>contacts</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audience detail panel */}
          {selected && (
            <Card style={{ height:'fit-content', position:'sticky', top:20 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:'#F5F8FF', marginBottom:6 }}>{selected.name}</div>
                  <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20,
                    background:`${TYPE_COLOR[selected.type]}18`, color:TYPE_COLOR[selected.type],
                    border:`1px solid ${TYPE_COLOR[selected.type]}33` }}>
                    {TYPE_LABEL[selected.type]}
                  </span>
                </div>
                <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'#64748B', cursor:'pointer', fontSize:18 }}>×</button>
              </div>

              {/* Stats */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                <div style={{ padding:'12px', background:'rgba(56,186,130,.08)', border:'1px solid rgba(56,186,130,.2)', borderRadius:10, textAlign:'center' }}>
                  <div style={{ fontSize:24, fontWeight:900, color:'#38BA82' }}>{selected.contact_count.toLocaleString()}</div>
                  <div style={{ fontSize:11, color:'#64748B' }}>Total contacts</div>
                </div>
                <div style={{ padding:'12px', background:'rgba(255,255,255,.03)', border:'1px solid #252D3D', borderRadius:10, textAlign:'center' }}>
                  <div style={{ fontSize:14, fontWeight:700, color:STATUS_COLOR[selected.status] ?? '#64748B' }}>
                    {selected.status === 'building' ? '⏳' : selected.status === 'ready' ? '✅' : '❌'}
                    &nbsp;{selected.status}
                  </div>
                  <div style={{ fontSize:11, color:'#64748B' }}>Status</div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                <Btn onClick={() => setShowContacts(s => !s)} variant="secondary" style={{ justifyContent:'center' }}>
                  {showContacts ? 'Hide' : 'Preview'} Contacts
                </Btn>
                {selected.type === 'platform_cohort' && (
                  <Btn onClick={() => refresh.mutate(selected.id)} variant="secondary"
                    disabled={refresh.isPending || selected.status === 'building'}
                    style={{ justifyContent:'center' }}>
                    {refresh.isPending ? '⏳ Refreshing…' : '↻ Refresh Cohort'}
                  </Btn>
                )}
                <Btn onClick={() => { if (confirm('Delete this audience?')) deleteAud.mutate(selected.id); }}
                  variant="secondary" style={{ justifyContent:'center', color:'#FF4C6A', borderColor:'rgba(255,76,106,.3)' }}>
                  🗑 Delete Audience
                </Btn>
              </div>

              {/* Contact preview */}
              {showContacts && (
                <div>
                  <div style={{ fontSize:11, color:'#64748B', fontWeight:700, marginBottom:8, textTransform:'uppercase', letterSpacing:'.05em' }}>
                    Contact Preview (first 100)
                  </div>
                  {contactsLoading ? (
                    <div style={{ display:'flex', justifyContent:'center', padding:20 }}><Spinner /></div>
                  ) : (
                    <div style={{ maxHeight:300, overflowY:'auto', border:'1px solid #252D3D', borderRadius:8 }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                        <thead>
                          <tr style={{ background:'#1C2333', position:'sticky', top:0 }}>
                            {['Email','Name','Phone'].map(h => (
                              <th key={h} style={{ padding:'6px 10px', textAlign:'left', color:'#64748B', fontWeight:700, borderBottom:'1px solid #252D3D' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(contacts?.contacts ?? []).map((c: any, i: number) => (
                            <tr key={i} style={{ borderBottom:'1px solid #1E2535' }}>
                              <td style={{ padding:'6px 10px', color:'#D8E0F0', fontFamily:'monospace', fontSize:11 }}>{c.email ?? '—'}</td>
                              <td style={{ padding:'6px 10px', color:'#D8E0F0' }}>{[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}</td>
                              <td style={{ padding:'6px 10px', color:'#8892B0' }}>{c.phone ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ padding:'8px 10px', fontSize:11, color:'#4F5669', borderTop:'1px solid #1E2535' }}>
                        Showing {(contacts?.contacts ?? []).length} of {contacts?.total?.toLocaleString()} contacts
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* ── Platform Cohorts ───────────────────────────────────────────────── */}
      {tab === 'cohorts' && (
        <div>
          <div style={{ padding:'12px 16px', background:'rgba(63,143,224,.08)', border:'1px solid rgba(63,143,224,.2)', borderRadius:10, marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#60A9F0', marginBottom:4 }}>🎯 Platform Cohorts</div>
            <div style={{ fontSize:12, color:'#8892B0', lineHeight:1.6 }}>
              Pre-built audience segments from your live platform data. Click "Build Audience" to generate a snapshot of that cohort which you can attach to any campaign. Cohorts can be refreshed at any time to get the latest data.
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {(cohorts ?? []).map((c: any) => (
              <CohortCard key={c.key} cohort={c} onBuild={key => {
                if (buildCohort.isPending) return;
                buildCohort.mutate({ key });
              }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Upload CSV ─────────────────────────────────────────────────────── */}
      {tab === 'upload' && (
        <div style={{ maxWidth:640 }}>
          <Card>
            <div style={{ fontSize:16, fontWeight:800, color:'#F5F8FF', marginBottom:4 }}>Upload Custom Audience</div>
            <p style={{ fontSize:13, color:'#8892B0', marginBottom:20, lineHeight:1.6 }}>
              Upload a CSV with your contacts. Required: at least one of <code style={{ color:'#60A9F0' }}>email</code> or <code style={{ color:'#60A9F0' }}>phone</code> column. Optional columns: <code style={{ color:'#60A9F0' }}>first_name</code>, <code style={{ color:'#60A9F0' }}>last_name</code>, and any extra merge fields.
            </p>

            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, color:'#8892B0', display:'block', marginBottom:5, fontWeight:700 }}>Audience Name *</label>
              <input value={uploadName} onChange={e => setUploadName(e.target.value)} placeholder="e.g. Inactive Traders – March 2026" style={inp} />
            </div>

            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); (e.currentTarget as any).style.borderColor='#3F8FE0'; }}
              onDragLeave={e => { (e.currentTarget as any).style.borderColor='#353947'; }}
              onDrop={e => {
                e.preventDefault();
                (e.currentTarget as any).style.borderColor='#353947';
                const file = e.dataTransfer.files[0];
                if (file) {
                  const fakeEvent = { target: { files: [file] } } as any;
                  handleFile(fakeEvent);
                }
              }}
              style={{ border:'2px dashed #353947', borderRadius:12, padding:'32px 20px', textAlign:'center',
                cursor:'pointer', marginBottom:16, transition:'border-color .2s' }}>
              <div style={{ fontSize:36, marginBottom:10 }}>📄</div>
              <div style={{ fontSize:14, fontWeight:700, color:'#F5F8FF', marginBottom:4 }}>
                {uploadFileName ? uploadFileName : 'Drop your CSV here or click to browse'}
              </div>
              <div style={{ fontSize:12, color:'#64748B' }}>
                {uploadContacts.length > 0
                  ? `✅ ${uploadContacts.length.toLocaleString()} valid contacts ready to upload`
                  : 'Accepts .csv files — max 100,000 rows'}
              </div>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display:'none' }} />
            </div>

            {/* CSV format example */}
            <div style={{ padding:'12px 14px', background:'rgba(255,255,255,.03)', borderRadius:8, marginBottom:16, border:'1px solid #252D3D' }}>
              <div style={{ fontSize:11, color:'#64748B', fontWeight:700, marginBottom:6 }}>CSV FORMAT EXAMPLE</div>
              <code style={{ fontSize:11, color:'#94A3B8', whiteSpace:'pre', display:'block', lineHeight:1.8 }}>
{`email,first_name,last_name,phone
james@email.com,James,K,+447700900123
priya@email.com,Priya,M,+919876543210`}
              </code>
            </div>

            {/* Preview table */}
            {uploadContacts.length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, color:'#64748B', fontWeight:700, marginBottom:8 }}>PREVIEW (first 5 rows)</div>
                <div style={{ border:'1px solid #252D3D', borderRadius:8, overflow:'hidden' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'#1C2333' }}>
                        {Object.keys(uploadContacts[0]).slice(0, 5).map(h => (
                          <th key={h} style={{ padding:'7px 10px', textAlign:'left', color:'#64748B', fontWeight:700, borderBottom:'1px solid #252D3D' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uploadContacts.slice(0, 5).map((row, i) => (
                        <tr key={i} style={{ borderBottom:'1px solid #1E2535' }}>
                          {Object.values(row).slice(0, 5).map((v: any, j) => (
                            <td key={j} style={{ padding:'7px 10px', color:'#D8E0F0', fontFamily:'monospace' }}>{v || '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {uploadError && (
              <div style={{ padding:'10px 14px', background:'rgba(255,76,106,.1)', border:'1px solid rgba(255,76,106,.3)', borderRadius:8, fontSize:13, color:'#FF4C6A', marginBottom:14 }}>
                ❌ {uploadError}
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <Btn onClick={submitUpload} disabled={uploading || !uploadContacts.length}>
                {uploading ? '⏳ Uploading…' : `Upload ${uploadContacts.length ? uploadContacts.length.toLocaleString() + ' Contacts' : 'Audience'}`}
              </Btn>
              <Btn variant="secondary" onClick={() => { setUploadContacts([]); setUploadName(''); setUploadFileName(''); setUploadError(''); }}>
                Clear
              </Btn>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
