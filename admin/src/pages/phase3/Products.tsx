import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, Card, CardHeader, Table, StatCard,
  Btn, Input, Select, Spinner, Badge, StatusBadge, Empty,
} from '../../components/ui.js';

const STATUS_OPTIONS = [
  { value:'draft',    label:'Draft' },
  { value:'active',   label:'Active' },
  { value:'inactive', label:'Inactive' },
];

const PLATFORM_OPTIONS = [
  { value:'mt5',         label:'MT5' },
  { value:'ctrader',     label:'cTrader' },
  { value:'matchtrader', label:'MatchTrader' },
  { value:'ninjatrader', label:'NinjaTrader' },
  { value:'tradovate',   label:'Tradovate' },
];

const DEFAULT_PHASES = [
  { phase:'evaluation',   profit_target:8,  max_daily_loss:4, max_total_loss:8,  min_trading_days:4, max_duration_days:30 },
  { phase:'verification', profit_target:5,  max_daily_loss:4, max_total_loss:8,  min_trading_days:4, max_duration_days:60 },
];

const fmt$ = (v: number) =>
  new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(v);

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        style={{ width:36, height:30, border:'1px solid #353947', borderRadius:4, cursor:'pointer', background:'none' }} />
      <Input value={value} onChange={onChange} style={{ width:100, fontFamily:'monospace', fontSize:12 }} />
      <div style={{ display:'flex', gap:4 }}>
        {['#3F8FE0','#38BA82','#F5B326','#EB5454','#8B5CF6','#14B8A6','#F97316','#F5F8FF'].map(c => (
          <button key={c} onClick={() => onChange(c)}
            style={{ width:18, height:18, borderRadius:3, background:c, border: value===c?'2px solid #fff':'1px solid #353947', cursor:'pointer' }} />
        ))}
      </div>
    </div>
  );
}

function PhaseEditor({ phases, onChange }: {
  phases: any[]; onChange: (phases: any[]) => void;
}) {
  const update = (i: number, key: string, val: unknown) => {
    const next = phases.map((p, pi) => pi === i ? { ...p, [key]: val } : p);
    onChange(next);
  };
  const addPhase    = () => onChange([...phases, { phase: 'custom', profit_target: 8, max_daily_loss: 4, max_total_loss: 8, min_trading_days: 4, max_duration_days: 30 }]);
  const removePhase = (i: number) => onChange(phases.filter((_, pi) => pi !== i));

  return (
    <div>
      {phases.map((ph, i) => (
        <div key={i} style={{ padding:'14px', background:'#252931', borderRadius:8, marginBottom:10, border:'1px solid #353947' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#3F8FE0' }}>Phase {i + 1}</div>
            {phases.length > 1 && <Btn size="sm" variant="danger" onClick={() => removePhase(i)}>Remove</Btn>}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            <div>
              <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Phase Name</div>
              <Input value={ph.phase} onChange={v => update(i, 'phase', v)} style={{ width:'100%' }} />
            </div>
            <div>
              <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Profit Target %</div>
              <Input type="number" value={String(ph.profit_target)} onChange={v => update(i, 'profit_target', parseFloat(v))} style={{ width:'100%' }} />
            </div>
            <div>
              <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Max Daily Loss %</div>
              <Input type="number" value={String(ph.max_daily_loss)} onChange={v => update(i, 'max_daily_loss', parseFloat(v))} style={{ width:'100%' }} />
            </div>
            <div>
              <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Max Total Loss %</div>
              <Input type="number" value={String(ph.max_total_loss)} onChange={v => update(i, 'max_total_loss', parseFloat(v))} style={{ width:'100%' }} />
            </div>
            <div>
              <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Min Trading Days</div>
              <Input type="number" value={String(ph.min_trading_days)} onChange={v => update(i, 'min_trading_days', parseInt(v))} style={{ width:'100%' }} />
            </div>
            <div>
              <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Max Duration (days)</div>
              <Input type="number" value={String(ph.max_duration_days ?? '')} onChange={v => update(i, 'max_duration_days', v ? parseInt(v) : null)} placeholder="No limit" style={{ width:'100%' }} />
            </div>
          </div>
        </div>
      ))}
      <Btn size="sm" variant="secondary" onClick={addPhase}>+ Add Phase</Btn>
    </div>
  );
}

export default function Products() {
  const [tab,      setTab]      = useState<'products'|'labels'>('products');
  const [selected, setSelected] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm]         = useState<any>({});
  const qc = useQueryClient();

  const { data: products, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn:  () => api.get('/products').then(r => r.data),
  });

  const { data: phaseLabels } = useQuery({
    queryKey: ['phase-labels'],
    queryFn:  () => api.get('/products/phase-labels').then(r => r.data),
    enabled:  tab === 'labels',
  });

  const { data: statusLabels } = useQuery({
    queryKey: ['status-labels'],
    queryFn:  () => api.get('/products/status-labels').then(r => r.data),
    enabled:  tab === 'labels',
  });

  const save = useMutation({
    mutationFn: () => selected?.id
      ? api.patch(`/products/${selected.id}`, formToApi(form))
      : api.post('/products', formToApi(form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['admin-products'] });
      setIsEditing(false);
    },
  });

  const duplicate = useMutation({
    mutationFn: (id: string) => api.post(`/products/${id}/duplicate`),
    onSuccess:  () => qc.invalidateQueries({ queryKey:['admin-products'] }),
  });

  const archive = useMutation({
    mutationFn: (id: string) => api.post(`/products/${id}/archive`),
    onSuccess:  () => { qc.invalidateQueries({ queryKey:['admin-products'] }); setSelected(null); },
  });

  const updatePhaseLabel = useMutation({
    mutationFn: ({ key, data }: { key: string; data: any }) =>
      api.patch(`/products/phase-labels/${key}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey:['phase-labels'] }),
  });

  const updateStatusLabel = useMutation({
    mutationFn: ({ key, data }: { key: string; data: any }) =>
      api.patch(`/products/status-labels/${key}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey:['status-labels'] }),
  });

  const openNew = () => {
    setSelected(null);
    setForm({
      name:'', description:'', shortTagline:'',
      status:'draft', accountSize:10000, fee:149,
      currency:'USD', platform:'mt5',
      phases: DEFAULT_PHASES,
      leverage:'1:100',
      instrumentsAllowed:['FOREX','GOLD','INDICES'],
      newsTradingAllowed:false, weekendHoldingAllowed:false,
      scalingPlan:false, profitSplit:80,
      payoutFrequency:'monthly',
      badgeText:'', badgeColor:'#3F8FE0', icon:'🏆',
      highlight:false, isFeatured:false, features:[], sortOrder:0,
    });
    setIsEditing(true);
  };

  const openEdit = (p: any) => {
    setSelected(p);
    setForm(apiToForm(p));
    setIsEditing(true);
  };

  const setF = (k: string) => (v: unknown) => setForm((p: any) => ({ ...p, [k]: v }));

  const columns = [
    { key:'product', label:'Product',
      render:(r:any) => (
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ fontSize:22 }}>{r.icon ?? '🏆'}</span>
          <div>
            <div style={{ fontWeight:700, color:'#F5F8FF', display:'flex', gap:6, alignItems:'center' }}>
              {r.name}
              {r.badge_text && (
                <span style={{ fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:10, background:r.badge_color ?? '#3F8FE0', color:'#fff' }}>
                  {r.badge_text}
                </span>
              )}
            </div>
            <div style={{ fontSize:11, color:'#4F5669' }}>{r.short_tagline}</div>
          </div>
        </div>
      ),
    },
    { key:'account_size', label:'Size', width:100,
      render:(r:any) => <span style={{ color:'#F5B326', fontWeight:700 }}>{fmt$(parseFloat(r.account_size))}</span> },
    { key:'fee', label:'Fee', width:80,
      render:(r:any) => <span style={{ color:'#CCD2E3' }}>{fmt$(parseFloat(r.fee))}</span> },
    { key:'profit_split', label:'Split', width:70,
      render:(r:any) => <span style={{ color:'#38BA82' }}>{r.profit_split}%</span> },
    { key:'platform', label:'Platform', width:100,
      render:(r:any) => <Badge label={r.platform} variant="blue" /> },
    { key:'status', label:'Status', width:90,
      render:(r:any) => <StatusBadge status={r.status} /> },
    { key:'total_accounts', label:'Accounts', width:90,
      render:(r:any) => <span style={{ color:'#878FA4' }}>{r.total_accounts ?? 0}</span> },
    { key:'actions', label:'', width:140,
      render:(r:any) => (
        <div style={{ display:'flex', gap:6 }}>
          <Btn size="sm" onClick={() => openEdit(r)}>Edit</Btn>
          <Btn size="sm" variant="ghost" onClick={() => duplicate.mutate(r.id)}>Copy</Btn>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Challenge Products"
        sub="Create and manage prop firm challenge tiers. Changes reflect on the trader portal immediately."
        action={
          <div style={{ display:'flex', gap:8 }}>
            {tab === 'products' && <Btn onClick={openNew}>+ New Product</Btn>}
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, marginBottom:20, borderBottom:'1px solid #353947' }}>
        {[{id:'products',label:'Products'},{id:'labels',label:'Phase & Status Labels'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            padding:'10px 20px', fontSize:13, fontWeight:tab===t.id?700:400,
            color:tab===t.id?'#F5F8FF':'#878FA4', background:'none', border:'none',
            cursor:'pointer', borderBottom:tab===t.id?'2px solid #3F8FE0':'2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Product list */}
      {tab === 'products' && (
        <div style={{ display:'grid', gridTemplateColumns: isEditing ? '1fr 520px' : '1fr', gap:16 }}>
          <Card>
            {isLoading ? <Spinner /> : (products ?? []).length === 0
              ? <Empty icon="🏆" message="No products yet" sub="Create your first challenge product" />
              : <Table columns={columns} data={products ?? []} />
            }
          </Card>

          {/* Product editor panel */}
          {isEditing && (
            <Card style={{ maxHeight:'calc(100vh - 180px)', overflowY:'auto' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                <div style={{ fontSize:15, fontWeight:700, color:'#F5F8FF' }}>
                  {selected ? 'Edit Product' : 'New Product'}
                </div>
                <button onClick={() => setIsEditing(false)} style={{ background:'none', border:'none', color:'#878FA4', fontSize:18, cursor:'pointer' }}>×</button>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

                {/* Section: Basic */}
                <div style={{ fontSize:11, fontWeight:700, color:'#4F5669', letterSpacing:'0.06em' }}>BASIC INFO</div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div style={{ gridColumn:'1/-1' }}>
                    <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Product Name <span style={{ color:'#EB5454' }}>*</span></div>
                    <Input value={form.name ?? ''} onChange={setF('name')} style={{ width:'100%' }} />
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Tagline (shown on product card)</div>
                    <Input value={form.shortTagline ?? ''} onChange={setF('shortTagline')} placeholder="e.g. Our most popular challenge" style={{ width:'100%' }} />
                  </div>
                  <div style={{ gridColumn:'1/-1' }}>
                    <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Description</div>
                    <textarea value={form.description ?? ''} onChange={e => setF('description')(e.target.value)} rows={2}
                      style={{ width:'100%', background:'#252931', color:'#F5F8FF', border:'1px solid #353947', borderRadius:6, padding:'7px 10px', fontSize:13, resize:'vertical', outline:'none', fontFamily:'inherit' }} />
                  </div>
                </div>

                {/* Section: Pricing */}
                <div style={{ fontSize:11, fontWeight:700, color:'#4F5669', letterSpacing:'0.06em', marginTop:4 }}>PRICING</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                  <div>
                    <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Account Size ($)</div>
                    <Input type="number" value={String(form.accountSize ?? '')} onChange={v => setF('accountSize')(parseFloat(v))} style={{ width:'100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Entry Fee ($)</div>
                    <Input type="number" value={String(form.fee ?? '')} onChange={v => setF('fee')(parseFloat(v))} style={{ width:'100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Profit Split %</div>
                    <Input type="number" value={String(form.profitSplit ?? '')} onChange={v => setF('profitSplit')(parseInt(v))} style={{ width:'100%' }} />
                  </div>
                </div>

                {/* Section: Platform & Rules */}
                <div style={{ fontSize:11, fontWeight:700, color:'#4F5669', letterSpacing:'0.06em', marginTop:4 }}>PLATFORM & RULES</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Platform</div>
                    <Select value={form.platform ?? 'mt5'} onChange={setF('platform')} options={PLATFORM_OPTIONS} style={{ width:'100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Leverage</div>
                    <Input value={form.leverage ?? '1:100'} onChange={setF('leverage')} style={{ width:'100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Payout Frequency</div>
                    <Select value={form.payoutFrequency ?? 'monthly'} onChange={setF('payoutFrequency')}
                      options={['monthly','bi-weekly','weekly','on-demand'].map(v => ({ value:v, label:v }))} style={{ width:'100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Status</div>
                    <Select value={form.status ?? 'draft'} onChange={setF('status')} options={STATUS_OPTIONS} style={{ width:'100%' }} />
                  </div>
                </div>

                {/* Toggles */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                  {[
                    { k:'newsTradingAllowed',    l:'News Trading' },
                    { k:'weekendHoldingAllowed', l:'Weekend Holding' },
                    { k:'scalingPlan',           l:'Scaling Plan' },
                    { k:'highlight',             l:'Highlighted' },
                    { k:'isFeatured',            l:'Featured' },
                  ].map(t => (
                    <div key={t.k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:'#252931', borderRadius:6 }}>
                      <span style={{ fontSize:11, color:'#CCD2E3' }}>{t.l}</span>
                      <button onClick={() => setF(t.k)(!form[t.k])} style={{
                        width:34, height:18, borderRadius:9, border:'none', cursor:'pointer',
                        background: form[t.k] ? '#38BA82' : '#353947', position:'relative',
                      }}>
                        <div style={{ position:'absolute', top:2, left: form[t.k] ? 17 : 2, width:14, height:14, borderRadius:'50%', background:'#fff', transition:'left 0.15s' }} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Section: Display */}
                <div style={{ fontSize:11, fontWeight:700, color:'#4F5669', letterSpacing:'0.06em', marginTop:4 }}>DISPLAY / BADGE</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Icon (emoji)</div>
                    <Input value={form.icon ?? '🏆'} onChange={setF('icon')} style={{ width:'100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Badge Text (optional)</div>
                    <Input value={form.badgeText ?? ''} onChange={setF('badgeText')} placeholder="Popular, Best Value…" style={{ width:'100%' }} />
                  </div>
                  {form.badgeText && (
                    <div style={{ gridColumn:'1/-1' }}>
                      <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Badge Color</div>
                      <ColorPicker value={form.badgeColor ?? '#3F8FE0'} onChange={setF('badgeColor')} />
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Sort Order</div>
                    <Input type="number" value={String(form.sortOrder ?? 0)} onChange={v => setF('sortOrder')(parseInt(v))} style={{ width:'100%' }} />
                  </div>
                </div>

                {/* Features list */}
                <div>
                  <div style={{ fontSize:11, color:'#878FA4', marginBottom:6 }}>Feature Bullets (shown on product card)</div>
                  {(form.features ?? []).map((f: string, i: number) => (
                    <div key={i} style={{ display:'flex', gap:6, marginBottom:5 }}>
                      <Input value={f} onChange={v => {
                        const next = [...(form.features ?? [])];
                        next[i] = v;
                        setF('features')(next);
                      }} style={{ flex:1 }} placeholder="e.g. No minimum trading days" />
                      <Btn size="sm" variant="danger" onClick={() => setF('features')((form.features ?? []).filter((_: any, fi: number) => fi !== i))}>×</Btn>
                    </div>
                  ))}
                  <Btn size="sm" variant="secondary" onClick={() => setF('features')([...(form.features ?? []), ''])}>+ Add Feature</Btn>
                </div>

                {/* Phase editor */}
                <div style={{ fontSize:11, fontWeight:700, color:'#4F5669', letterSpacing:'0.06em', marginTop:4 }}>CHALLENGE PHASES</div>
                <PhaseEditor phases={form.phases ?? DEFAULT_PHASES} onChange={setF('phases')} />

                {/* Preview */}
                {(form.name || form.badgeText) && (
                  <div style={{ padding:'12px', background:'#252931', borderRadius:8, border:`1px solid ${form.highlight ? '#F5B32655' : '#353947'}` }}>
                    <div style={{ fontSize:11, color:'#4F5669', marginBottom:6 }}>PREVIEW</div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <span style={{ fontSize:20 }}>{form.icon ?? '🏆'}</span>
                      <span style={{ fontWeight:700, color:'#F5F8FF' }}>{form.name}</span>
                      {form.badgeText && (
                        <span style={{ fontSize:10, fontWeight:700, padding:'1px 8px', borderRadius:10, background:form.badgeColor ?? '#3F8FE0', color:'#fff' }}>
                          {form.badgeText}
                        </span>
                      )}
                    </div>
                    {form.shortTagline && <div style={{ fontSize:12, color:'#878FA4' }}>{form.shortTagline}</div>}
                    <div style={{ fontSize:18, fontWeight:800, color:'#F5F8FF', marginTop:6 }}>{fmt$(form.accountSize ?? 0)}</div>
                    <div style={{ fontSize:12, color:'#878FA4' }}>Entry: {fmt$(form.fee ?? 0)} · {form.profitSplit ?? 80}% split</div>
                  </div>
                )}

                <div style={{ display:'flex', gap:8 }}>
                  <Btn variant="primary" onClick={() => save.mutate()} disabled={!form.name || save.isPending}>
                    {save.isPending ? 'Saving…' : selected ? 'Save Changes' : 'Create Product'}
                  </Btn>
                  {selected && (
                    <Btn variant="danger" onClick={() => archive.mutate(selected.id)}>Archive</Btn>
                  )}
                  <Btn variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Btn>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Labels tab */}
      {tab === 'labels' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <Card>
            <CardHeader title="Phase Labels" sub="Shown in trader portal and admin accounts table" />
            {!phaseLabels ? <Spinner /> : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {(phaseLabels ?? []).map((pl: any) => (
                  <PhaseLabelRow key={pl.phase_key} label={pl} onSave={data => updatePhaseLabel.mutate({ key: pl.phase_key, data })} />
                ))}
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Status Labels" sub="Account status display names and colors" />
            {!statusLabels ? <Spinner /> : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {(statusLabels ?? []).map((sl: any) => (
                  <StatusLabelRow key={sl.status_key} label={sl} onSave={data => updateStatusLabel.mutate({ key: sl.status_key, data })} />
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function PhaseLabelRow({ label, onSave }: { label: any; onSave: (data: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ label: label.label, shortLabel: label.short_label, color: label.color, description: label.description });

  if (!editing) return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'#252931', borderRadius:8 }}>
      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
        <div style={{ width:10, height:10, borderRadius:'50%', background:label.color }} />
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#F5F8FF' }}>{label.label} <span style={{ color:'#4F5669', fontSize:11 }}>({label.short_label})</span></div>
          <div style={{ fontSize:11, color:'#4F5669' }}><code style={{ color:'#878FA4' }}>{label.phase_key}</code></div>
        </div>
      </div>
      <Btn size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Btn>
    </div>
  );

  return (
    <div style={{ padding:'12px', background:'#252931', borderRadius:8, border:'1px solid #3F8FE044' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
        <div>
          <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Display Label</div>
          <Input value={form.label} onChange={v => setForm(p => ({ ...p, label:v }))} style={{ width:'100%' }} />
        </div>
        <div>
          <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Short Label</div>
          <Input value={form.shortLabel} onChange={v => setForm(p => ({ ...p, shortLabel:v }))} style={{ width:'100%' }} />
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Color</div>
          <ColorPicker value={form.color} onChange={v => setForm(p => ({ ...p, color:v }))} />
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <Btn size="sm" variant="primary" onClick={() => { onSave(form); setEditing(false); }}>Save</Btn>
        <Btn size="sm" variant="secondary" onClick={() => setEditing(false)}>Cancel</Btn>
      </div>
    </div>
  );
}

function StatusLabelRow({ label, onSave }: { label: any; onSave: (data: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ label: label.label, color: label.color, description: label.description });

  if (!editing) return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'#252931', borderRadius:8 }}>
      <div style={{ display:'flex', gap:10, alignItems:'center' }}>
        <div style={{ width:10, height:10, borderRadius:'50%', background:label.color }} />
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#F5F8FF' }}>{label.label}</div>
          <div style={{ fontSize:11, color:'#4F5669' }}><code style={{ color:'#878FA4' }}>{label.status_key}</code></div>
        </div>
      </div>
      <Btn size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit</Btn>
    </div>
  );

  return (
    <div style={{ padding:'12px', background:'#252931', borderRadius:8, border:'1px solid #3F8FE044' }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
        <div>
          <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Display Label</div>
          <Input value={form.label} onChange={v => setForm(p => ({ ...p, label:v }))} style={{ width:'100%' }} />
        </div>
        <div>
          <div style={{ fontSize:11, color:'#878FA4', marginBottom:3 }}>Color</div>
          <ColorPicker value={form.color} onChange={v => setForm(p => ({ ...p, color:v }))} />
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <Btn size="sm" variant="primary" onClick={() => { onSave(form); setEditing(false); }}>Save</Btn>
        <Btn size="sm" variant="secondary" onClick={() => setEditing(false)}>Cancel</Btn>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formToApi(form: any) {
  return {
    name:                  form.name,
    slug:                  form.slug,
    description:           form.description,
    shortTagline:          form.shortTagline,
    status:                form.status,
    accountSize:           form.accountSize,
    fee:                   form.fee,
    currency:              form.currency ?? 'USD',
    platform:              form.platform,
    phases:                form.phases,
    leverage:              form.leverage,
    instrumentsAllowed:    form.instrumentsAllowed,
    newsTradingAllowed:    form.newsTradingAllowed,
    weekendHoldingAllowed: form.weekendHoldingAllowed,
    scalingPlan:           form.scalingPlan,
    profitSplit:           form.profitSplit,
    payoutFrequency:       form.payoutFrequency,
    badgeText:             form.badgeText || undefined,
    badgeColor:            form.badgeColor,
    icon:                  form.icon,
    highlight:             form.highlight,
    isFeatured:            form.isFeatured,
    features:              (form.features ?? []).filter((f: string) => f.trim()),
    sortOrder:             form.sortOrder,
  };
}

function apiToForm(p: any) {
  return {
    name:                  p.name,
    slug:                  p.slug,
    description:           p.description,
    shortTagline:          p.short_tagline,
    status:                p.status,
    accountSize:           parseFloat(p.account_size),
    fee:                   parseFloat(p.fee),
    currency:              p.currency,
    platform:              p.platform,
    phases:                typeof p.phases === 'string' ? JSON.parse(p.phases) : p.phases,
    leverage:              p.leverage,
    instrumentsAllowed:    p.instruments_allowed,
    newsTradingAllowed:    p.news_trading_allowed,
    weekendHoldingAllowed: p.weekend_holding_allowed,
    scalingPlan:           p.scaling_plan,
    profitSplit:           p.profit_split,
    payoutFrequency:       p.payout_frequency,
    badgeText:             p.badge_text ?? '',
    badgeColor:            p.badge_color ?? '#3F8FE0',
    icon:                  p.icon ?? '🏆',
    highlight:             p.highlight,
    isFeatured:            p.is_featured,
    features:              p.features ?? [],
    sortOrder:             p.sort_order,
  };
}
