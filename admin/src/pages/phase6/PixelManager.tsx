import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, Card, Btn, Input, Spinner, Badge, Empty, Select,
} from '../../components/ui.js';

// ── Platform definitions ──────────────────────────────────────────────────────
const PLATFORMS = [
  {
    value: 'meta_pixel', label: 'Meta Pixel', icon: '📘', category: 'Social',
    color: '#1877F2',
    fields: [
      { key: 'pixelId', label: 'Pixel ID', placeholder: '1234567890123456', required: true },
      { key: 'advancedMatching', label: 'Advanced Matching', placeholder: 'email,phone (comma-separated fields)', required: false },
    ],
    events: ['PageView', 'Lead', 'CompleteRegistration', 'Purchase', 'InitiateCheckout', 'ViewContent', 'AddToCart', 'Subscribe'],
    snippet: (id: string) => `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){...};
fbq('init', '${id}');
fbq('track', 'PageView');
</script>`,
  },
  {
    value: 'gtm', label: 'Google Tag Manager', icon: '📦', category: 'Google',
    color: '#4285F4',
    fields: [
      { key: 'pixelId', label: 'Container ID', placeholder: 'GTM-XXXXXXX', required: true },
    ],
    events: ['page_view', 'sign_up', 'purchase', 'generate_lead', 'begin_checkout'],
    snippet: (id: string) => `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){...})(window,document,'script','dataLayer','${id}');</script>`,
  },
  {
    value: 'google_ads', label: 'Google Ads (gtag)', icon: '🎯', category: 'Google',
    color: '#34A853',
    fields: [
      { key: 'pixelId', label: 'Conversion ID', placeholder: 'AW-XXXXXXXXX', required: true },
      { key: 'conversionLabel', label: 'Conversion Label', placeholder: 'xxxxxxxxxxxxxx', required: false },
    ],
    events: ['conversion', 'page_view', 'sign_up', 'purchase'],
    snippet: (id: string) => `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`,
  },
  {
    value: 'tiktok_pixel', label: 'TikTok Pixel', icon: '🎵', category: 'Social',
    color: '#010101',
    fields: [
      { key: 'pixelId', label: 'Pixel ID', placeholder: 'CXXXXXXXXXXXXXXX', required: true },
    ],
    events: ['PageView', 'Registration', 'CompleteRegistration', 'PlaceAnOrder', 'Subscribe', 'ViewContent'],
    snippet: (id: string) => `<!-- TikTok Pixel Code -->
<script>!function (w, d, t) {...}(window, document, '${id}');</script>`,
  },
  {
    value: 'taboola_pixel', label: 'Taboola Pixel', icon: '📰', category: 'Native Ads',
    color: '#0073E6',
    fields: [
      { key: 'pixelId', label: 'Pixel ID / Account ID', placeholder: '1234567', required: true },
    ],
    events: ['page_view', 'lead', 'purchase', 'registration'],
    snippet: (id: string) => `<!-- Taboola Pixel Code -->
<script>window._tfa=window._tfa||[];_tfa.push({notify:'event',name:'page_view',id:${id}});</script>`,
  },
  {
    value: 'outbrain_pixel', label: 'Outbrain Pixel', icon: '🔵', category: 'Native Ads',
    color: '#FF3600',
    fields: [
      { key: 'pixelId', label: 'Pixel ID', placeholder: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', required: true },
    ],
    events: ['PAGE_VIEW', 'LEAD', 'PURCHASE', 'REGISTRATION', 'SIGN_UP'],
    snippet: (id: string) => `<!-- Outbrain Pixel -->
<script>!function(_window,_document){...}(window,document,'${id}');</script>`,
  },
  {
    value: 'snapchat_pixel', label: 'Snapchat Pixel', icon: '👻', category: 'Social',
    color: '#FFFC00',
    fields: [
      { key: 'pixelId', label: 'Pixel ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', required: true },
    ],
    events: ['PAGE_VIEW', 'SIGN_UP', 'PURCHASE', 'ADD_TO_CART', 'LEAD'],
    snippet: (id: string) => `<!-- Snap Pixel -->
<script>(function(e,t,n){...})(window,document,'${id}');</script>`,
  },
  {
    value: 'pinterest_pixel', label: 'Pinterest Tag', icon: '📌', category: 'Social',
    color: '#E60023',
    fields: [
      { key: 'pixelId', label: 'Tag ID', placeholder: '1234567890123', required: true },
    ],
    events: ['pagevisit', 'signup', 'checkout', 'lead', 'custom'],
    snippet: (id: string) => `<!-- Pinterest Tag -->
<script>!function(e){...}(${id});</script>`,
  },
  {
    value: 'linkedin_insight', label: 'LinkedIn Insight Tag', icon: '💼', category: 'Social',
    color: '#0A66C2',
    fields: [
      { key: 'pixelId', label: 'Partner ID', placeholder: '1234567', required: true },
    ],
    events: ['pageView', 'conversion'],
    snippet: (id: string) => `<!-- LinkedIn Insight Tag -->
<script type="text/javascript">_linkedin_partner_id="${id}";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];...</script>`,
  },
  {
    value: 'custom_script', label: 'Custom Script', icon: '⚙️', category: 'Custom',
    color: '#6B7280',
    fields: [
      { key: 'customScript', label: 'JavaScript / HTML', placeholder: '<script>...</script>', required: true, multiline: true },
    ],
    events: [],
    snippet: () => '<!-- Custom script will be injected as-is -->',
  },
];

const LOAD_ON_OPTIONS = [
  { value: 'all',       label: '🌐 All Pages' },
  { value: 'landing',   label: '🏠 Landing Page Only' },
  { value: 'dashboard', label: '📊 Trader Dashboard' },
  { value: 'checkout',  label: '💳 Checkout Page' },
];

const INTERNAL_EVENTS: Record<string, string> = {
  'user.registered':    'User Registered',
  'user.kyc_approved':  'KYC Approved',
  'payment.completed':  'Payment Completed',
  'account.created':    'Account Created',
  'account.passed':     'Account Passed',
  'account.funded':     'Account Funded',
};

const C = {
  bg: '#13151B', surfA: '#1C1F27', surfB: '#252931', bordA: '#353947',
  blue: '#3F8FE0', green: '#38BA82', gold: '#F5B326', red: '#EB5454',
  white: '#F5F8FF', txtA: '#CCD2E3', txtB: '#878FA4', txtC: '#4F5669',
};

const inp: React.CSSProperties = {
  width: '100%', background: C.surfB, color: C.white,
  border: `1px solid ${C.bordA}`, borderRadius: 8,
  padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
};

export default function PixelManager() {
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<any>(null);
  const [platform, setPlatform]     = useState(PLATFORMS[0].value);
  const [name, setName]             = useState('');
  const [fields, setFields]         = useState<Record<string, string>>({});
  const [loadOn, setLoadOn]         = useState<string[]>(['all']);
  const [isActive, setIsActive]     = useState(true);
  const [eventMap, setEventMap]     = useState<Record<string, string>>({});
  const [showSnippet, setShowSnippet] = useState<string | null>(null);

  const qc = useQueryClient();

  const { data: pixels = [], isLoading } = useQuery({
    queryKey: ['pixels'],
    queryFn: () => api.get('/pixels').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: async () => {
      const pl = PLATFORMS.find(p => p.value === platform)!;
      const pixelId = fields['pixelId'] || fields['pixelId'] || '';
      const customScript = fields['customScript'] || undefined;

      const body = {
        name: name || `${pl.label} — ${pixelId}`,
        platform,
        pixelId: platform !== 'custom_script' ? pixelId : undefined,
        extraConfig: Object.fromEntries(
          Object.entries(fields).filter(([k]) => k !== 'pixelId' && k !== 'customScript')
        ),
        customScript,
        loadOn,
        isActive,
        fireOnEvents: Object.keys(eventMap),
        eventMap,
      };

      if (editing) {
        return api.patch(`/pixels/${editing.id}`, body);
      }
      return api.post('/pixels', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pixels'] });
      resetForm();
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/pixels/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pixels'] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/pixels/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pixels'] }),
  });

  function resetForm() {
    setShowForm(false); setEditing(null); setName('');
    setFields({}); setLoadOn(['all']); setIsActive(true); setEventMap({});
    setPlatform(PLATFORMS[0].value);
  }

  function openEdit(px: any) {
    setEditing(px);
    setPlatform(px.platform);
    setName(px.name);
    setFields({ pixelId: px.pixel_id ?? '', ...(px.extra_config ?? {}), ...(px.custom_script ? { customScript: px.custom_script } : {}) });
    setLoadOn(px.load_on ?? ['all']);
    setIsActive(px.is_active);
    setEventMap(px.event_map ?? {});
    setShowForm(true);
  }

  const currentPlatform = PLATFORMS.find(p => p.value === platform)!;

  const grouped = PLATFORMS.reduce((acc, p) => {
    acc[p.category] = acc[p.category] ?? [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, typeof PLATFORMS>);

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={32} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Pixel & SDK Manager"
        subtitle="Install tracking pixels and analytics SDKs — no developer required"
        action={<Btn onClick={() => { resetForm(); setShowForm(true); }}>+ Add Pixel</Btn>}
      />

      {/* Active pixel tiles */}
      {pixels.length === 0 && !showForm && (
        <Empty icon="📡" title="No pixels installed" subtitle="Add your first tracking pixel to start capturing events on the trader app." />
      )}

      {pixels.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {pixels.map((px: any) => {
            const pl = PLATFORMS.find(p => p.value === px.platform);
            return (
              <div key={px.id} style={{
                background: C.surfA, border: `1px solid ${px.is_active ? C.bordA : C.bordA}`,
                borderRadius: 12, padding: 18, position: 'relative',
                opacity: px.is_active ? 1 : 0.6,
                borderLeft: `3px solid ${px.is_active ? (pl?.color ?? C.blue) : C.bordA}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 8, fontSize: 20,
                      background: `${pl?.color ?? C.blue}22`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{pl?.icon ?? '📡'}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{px.name}</div>
                      <div style={{ fontSize: 11, color: C.txtB }}>{pl?.label}</div>
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <div style={{
                      width: 36, height: 20, borderRadius: 10, position: 'relative',
                      background: px.is_active ? C.green : C.bordA,
                      transition: 'background 0.2s',
                    }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: 3,
                        left: px.is_active ? 19 : 3,
                        transition: 'left 0.2s',
                      }} />
                    </div>
                    <input type="checkbox" checked={px.is_active} style={{ display: 'none' }}
                      onChange={() => toggle.mutate({ id: px.id, isActive: !px.is_active })} />
                  </label>
                </div>

                <div style={{ fontSize: 11, color: C.txtB, marginBottom: 8, fontFamily: 'monospace', background: C.surfB, padding: '4px 8px', borderRadius: 4 }}>
                  {px.pixel_id || 'custom'}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                  {(px.load_on ?? []).map((l: string) => (
                    <span key={l} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: C.surfB, color: C.txtB, border: `1px solid ${C.bordA}` }}>{l}</span>
                  ))}
                  {Object.keys(px.event_map ?? {}).length > 0 && (
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: `${C.blue}22`, color: C.blue, border: `1px solid ${C.blue}44` }}>
                      {Object.keys(px.event_map).length} events
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <Btn size="sm" variant="secondary" onClick={() => openEdit(px)}>✏️ Edit</Btn>
                  <Btn size="sm" variant="secondary" onClick={() => setShowSnippet(px.id === showSnippet ? null : px.id)}>{'</>'} Snippet</Btn>
                  <Btn size="sm" variant="danger" onClick={() => del.mutate(px.id)}>🗑</Btn>
                </div>

                {showSnippet === px.id && (
                  <div style={{ marginTop: 12, padding: 10, background: C.bg, borderRadius: 6, border: `1px solid ${C.bordA}` }}>
                    <div style={{ fontSize: 10, color: C.txtC, marginBottom: 6 }}>SNIPPET PREVIEW (auto-injected by app)</div>
                    <pre style={{ fontSize: 10, color: C.txtB, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {pl?.snippet(px.pixel_id ?? '') ?? 'Custom script'}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <Card>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.white, marginBottom: 20 }}>
            {editing ? '✏️ Edit Pixel' : '+ Add New Pixel / SDK'}
          </div>

          {/* Platform selector */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: C.txtB, marginBottom: 10 }}>Select Platform</div>
            {Object.entries(grouped).map(([cat, pls]) => (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: C.txtC, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{cat}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {pls.map(pl => (
                    <button key={pl.value} onClick={() => { setPlatform(pl.value); setFields({}); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                        background: platform === pl.value ? `${pl.color}22` : C.surfB,
                        border: `1px solid ${platform === pl.value ? pl.color : C.bordA}`,
                        color: platform === pl.value ? C.white : C.txtB,
                        fontSize: 13, fontFamily: 'inherit', transition: 'all 0.15s',
                      }}>
                      <span>{pl.icon}</span>
                      <span>{pl.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Name */}
            <div>
              <div style={{ fontSize: 12, color: C.txtB, marginBottom: 6 }}>Display Name</div>
              <input value={name} onChange={e => setName(e.target.value)}
                style={inp} placeholder={`${currentPlatform.label} — Main`} />
            </div>

            {/* Load on */}
            <div>
              <div style={{ fontSize: 12, color: C.txtB, marginBottom: 6 }}>Load On</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {LOAD_ON_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => setLoadOn(prev =>
                    prev.includes(o.value) ? prev.filter(x => x !== o.value) : [...prev, o.value]
                  )} style={{
                    padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    background: loadOn.includes(o.value) ? C.blue : C.surfB,
                    border: `1px solid ${loadOn.includes(o.value) ? C.blue : C.bordA}`,
                    color: loadOn.includes(o.value) ? '#fff' : C.txtB,
                    fontFamily: 'inherit', transition: 'all 0.15s',
                  }}>{o.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Platform-specific fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            {currentPlatform.fields.map(f => (
              <div key={f.key} style={{ gridColumn: (f as any).multiline ? '1 / -1' : 'auto' }}>
                <div style={{ fontSize: 12, color: C.txtB, marginBottom: 6 }}>
                  {f.label} {f.required && <span style={{ color: C.red }}>*</span>}
                </div>
                {(f as any).multiline ? (
                  <textarea value={fields[f.key] ?? ''} onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ ...inp, height: 120, resize: 'vertical' } as any}
                    placeholder={f.placeholder} />
                ) : (
                  <input value={fields[f.key] ?? ''} onChange={e => setFields(p => ({ ...p, [f.key]: e.target.value }))}
                    style={inp} placeholder={f.placeholder} />
                )}
              </div>
            ))}
          </div>

          {/* Event mapping */}
          {currentPlatform.events.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.white, marginBottom: 10 }}>
                🎯 Event Mapping <span style={{ fontSize: 11, color: C.txtB, fontWeight: 400 }}>(map internal events to {currentPlatform.label} event names)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(INTERNAL_EVENTS).map(([internal, label]) => (
                  <div key={internal} style={{ display: 'grid', gridTemplateColumns: '1fr 24px 1fr', gap: 10, alignItems: 'center' }}>
                    <div style={{ padding: '8px 12px', background: C.surfB, border: `1px solid ${C.bordA}`, borderRadius: 6, fontSize: 12, color: C.txtA }}>
                      🔵 {label}
                    </div>
                    <div style={{ textAlign: 'center', color: C.txtC, fontSize: 14 }}>→</div>
                    <select value={eventMap[internal] ?? ''} onChange={e => {
                      const val = e.target.value;
                      setEventMap(p => val ? { ...p, [internal]: val } : Object.fromEntries(Object.entries(p).filter(([k]) => k !== internal)));
                    }} style={{ ...inp, background: eventMap[internal] ? `${C.blue}22` : C.surfB }}>
                      <option value="">— not mapped —</option>
                      {currentPlatform.events.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active toggle + save */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: `1px solid ${C.bordA}` }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: C.txtA }}>
              <div style={{
                width: 40, height: 22, borderRadius: 11, background: isActive ? C.green : C.bordA,
                position: 'relative', transition: 'background 0.2s',
              }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: isActive ? 21 : 3, transition: 'left 0.2s' }} />
              </div>
              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} style={{ display: 'none' }} />
              {isActive ? 'Active — will be injected in app' : 'Inactive — will NOT be injected'}
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="secondary" onClick={resetForm}>Cancel</Btn>
              <Btn onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? 'Saving…' : editing ? '💾 Update Pixel' : '✅ Install Pixel'}
              </Btn>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
