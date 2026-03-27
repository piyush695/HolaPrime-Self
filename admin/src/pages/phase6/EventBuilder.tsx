import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { PageHeader, Card, Btn, Input, Spinner, Badge, Empty } from '../../components/ui.js';

const C = {
  bg: '#13151B', surfA: '#1C1F27', surfB: '#252931', bordA: '#353947',
  blue: '#3F8FE0', green: '#38BA82', gold: '#F5B326', red: '#EB5454',
  white: '#F5F8FF', txtA: '#CCD2E3', txtB: '#878FA4', txtC: '#4F5669',
};

const inp: React.CSSProperties = {
  background: C.surfB, color: C.white, border: `1px solid ${C.bordA}`,
  borderRadius: 7, padding: '8px 11px', fontSize: 13, outline: 'none',
  fontFamily: 'inherit', width: '100%',
};

// ── Platform S2S config definitions ──────────────────────────────────────────
const S2S_PLATFORMS = [
  {
    value: 'meta_capi',  label: 'Meta Conversions API',    icon: '📘', color: '#1877F2',
    fields: [
      { key: 'pixelId',      label: 'Pixel ID',           required: true },
      { key: 'accessToken',  label: 'System Access Token', required: true, type: 'password' },
      { key: 'testCode',     label: 'Test Event Code',    required: false, hint: 'TEST12345' },
    ],
    eventNames: ['Lead', 'CompleteRegistration', 'Purchase', 'InitiateCheckout', 'Subscribe', 'ViewContent', 'AddPaymentInfo'],
    paramSchema: {
      content_name:     { label: 'Content Name',     hint: 'Challenge 100K' },
      content_type:     { label: 'Content Type',      hint: 'product' },
      content_ids:      { label: 'Content IDs',       hint: '["PROD-001"]' },
      currency:         { label: 'Currency',           hint: 'USD' },
      value:            { label: 'Value',              hint: '{{value}}' },
      predicted_ltv:    { label: 'Predicted LTV',      hint: '{{value}}' },
      num_items:        { label: 'Num Items',           hint: '1' },
    },
  },
  {
    value: 'google_ga4', label: 'Google Analytics 4', icon: '📊', color: '#4285F4',
    fields: [
      { key: 'measurementId', label: 'Measurement ID', required: true,  hint: 'G-XXXXXXXXXX' },
      { key: 'apiSecret',     label: 'API Secret',     required: true,  type: 'password' },
    ],
    eventNames: ['sign_up', 'purchase', 'generate_lead', 'begin_checkout', 'login', 'view_item', 'add_payment_info'],
    paramSchema: {
      currency:       { label: 'Currency',       hint: 'USD' },
      value:          { label: 'Value',           hint: '{{value}}' },
      transaction_id: { label: 'Transaction ID',  hint: '{{orderId}}' },
      item_name:      { label: 'Item Name',        hint: '{{productName}}' },
      item_id:        { label: 'Item ID',           hint: '{{productId}}' },
      coupon:         { label: 'Coupon Code',      hint: '' },
      affiliation:    { label: 'Affiliation',       hint: 'Hola Prime' },
    },
  },
  {
    value: 'tiktok_events', label: 'TikTok Events API', icon: '🎵', color: '#010101',
    fields: [
      { key: 'pixelCode',    label: 'Pixel Code',     required: true },
      { key: 'accessToken',  label: 'Access Token',   required: true, type: 'password' },
    ],
    eventNames: ['Registration', 'CompleteRegistration', 'PlaceAnOrder', 'Subscribe', 'ViewContent', 'AddPaymentInfo', 'InitiateCheckout'],
    paramSchema: {
      content_type:  { label: 'Content Type',  hint: 'product' },
      content_id:    { label: 'Content ID',    hint: '{{productId}}' },
      content_name:  { label: 'Content Name',  hint: '{{productName}}' },
      currency:      { label: 'Currency',       hint: 'USD' },
      value:         { label: 'Value',          hint: '{{value}}' },
      order_id:      { label: 'Order ID',       hint: '{{orderId}}' },
      quantity:      { label: 'Quantity',       hint: '1' },
    },
  },
  {
    value: 'taboola', label: 'Taboola Conversions API', icon: '📰', color: '#0073E6',
    fields: [
      { key: 'clientId',     label: 'Client ID',     required: true },
      { key: 'clientSecret', label: 'Client Secret', required: true, type: 'password' },
    ],
    eventNames: ['page_view', 'lead', 'purchase', 'start_trial', 'subscribe', 'registration'],
    paramSchema: {
      revenue:    { label: 'Revenue',   hint: '{{value}}' },
      currency:   { label: 'Currency',  hint: 'USD' },
      order_id:   { label: 'Order ID',  hint: '{{orderId}}' },
    },
  },
  {
    value: 'outbrain', label: 'Outbrain Conversions API', icon: '🔵', color: '#FF3600',
    fields: [
      { key: 'pixelId', label: 'Pixel ID', required: true },
      { key: 'apiKey',  label: 'API Key',  required: true, type: 'password' },
    ],
    eventNames: ['PAGE_VIEW', 'LEAD', 'PURCHASE', 'REGISTRATION', 'SIGN_UP'],
    paramSchema: {
      orderValue: { label: 'Order Value', hint: '{{value}}' },
      currency:   { label: 'Currency',   hint: 'USD' },
      orderId:    { label: 'Order ID',    hint: '{{orderId}}' },
    },
  },
  {
    value: 'snapchat', label: 'Snapchat Conversions API', icon: '👻', color: '#FFFC00',
    fields: [
      { key: 'pixelId',     label: 'Pixel ID',     required: true },
      { key: 'accessToken', label: 'Access Token', required: true, type: 'password' },
    ],
    eventNames: ['PAGE_VIEW', 'SIGN_UP', 'PURCHASE', 'ADD_TO_CART', 'LEAD', 'VIEW_CONTENT'],
    paramSchema: {
      currency:    { label: 'Currency',   hint: 'USD' },
      price:       { label: 'Price',      hint: '{{value}}' },
      order_id:    { label: 'Order ID',   hint: '{{orderId}}' },
      item_ids:    { label: 'Item IDs',   hint: '["{{productId}}"]' },
      description: { label: 'Description', hint: '{{productName}}' },
    },
  },
  {
    value: 'pinterest', label: 'Pinterest Conversions API', icon: '📌', color: '#E60023',
    fields: [
      { key: 'adAccountId', label: 'Ad Account ID', required: true },
      { key: 'accessToken', label: 'Access Token',  required: true, type: 'password' },
    ],
    eventNames: ['pagevisit', 'signup', 'checkout', 'lead', 'viewcategory', 'custom'],
    paramSchema: {
      currency:    { label: 'Currency',      hint: 'USD' },
      value:       { label: 'Order Value',   hint: '{{value}}' },
      order_id:    { label: 'Order ID',      hint: '{{orderId}}' },
      content_ids: { label: 'Content IDs',   hint: '["{{productId}}"]' },
      num_items:   { label: 'Num Items',     hint: '1' },
    },
  },
  {
    value: 'linkedin', label: 'LinkedIn Insight Tag / CAPI', icon: '💼', color: '#0A66C2',
    fields: [
      { key: 'accessToken',     label: 'Access Token',      required: true, type: 'password' },
      { key: 'adAccountId',     label: 'Ad Account ID',     required: true },
      { key: 'conversionRuleId',label: 'Conversion Rule ID',required: true },
    ],
    eventNames: ['PURCHASE', 'ADD_TO_CART', 'START_CHECKOUT', 'LEAD', 'SIGN_UP', 'OTHER'],
    paramSchema: {
      amount:       { label: 'Amount',    hint: '{{value}}' },
      currencyCode: { label: 'Currency',  hint: 'USD' },
    },
  },
  {
    value: 'mixpanel', label: 'Mixpanel', icon: '🔀', color: '#7856FF',
    fields: [{ key: 'projectToken', label: 'Project Token', required: true, type: 'password' }],
    eventNames: ['User Registered', 'Challenge Purchased', 'Challenge Passed', 'Account Funded', 'Payout Approved'],
    paramSchema: {
      plan:       { label: 'Plan',         hint: '{{productName}}' },
      value:      { label: 'Value',        hint: '{{value}}' },
      currency:   { label: 'Currency',     hint: 'USD' },
      distinct_id:{ label: 'Distinct ID',  hint: '{{userId}}' },
    },
  },
  {
    value: 'segment', label: 'Segment', icon: '⚡', color: '#52BD94',
    fields: [{ key: 'writeKey', label: 'Write Key', required: true, type: 'password' }],
    eventNames: ['User Registered', 'Order Completed', 'Account Funded', 'Signed In', 'Checkout Started'],
    paramSchema: {
      revenue:     { label: 'Revenue',     hint: '{{value}}' },
      currency:    { label: 'Currency',    hint: 'USD' },
      product_id:  { label: 'Product ID',  hint: '{{productId}}' },
      product_name:{ label: 'Product Name',hint: '{{productName}}' },
      order_id:    { label: 'Order ID',    hint: '{{orderId}}' },
    },
  },
  {
    value: 'amplitude', label: 'Amplitude', icon: '📈', color: '#0059FF',
    fields: [{ key: 'apiKey', label: 'API Key', required: true, type: 'password' }],
    eventNames: ['user_registered', 'challenge_purchased', 'challenge_passed', 'account_funded', 'payout_approved'],
    paramSchema: {
      price:       { label: 'Price',      hint: '{{value}}' },
      quantity:    { label: 'Quantity',   hint: '1' },
      productId:   { label: 'Product ID', hint: '{{productId}}' },
      revenue:     { label: 'Revenue',    hint: '{{value}}' },
    },
  },
  {
    value: 'custom_http', label: 'Custom HTTP Endpoint', icon: '🔌', color: '#6B7280',
    fields: [
      { key: 'url',      label: 'Endpoint URL',          required: true },
      { key: 'method',   label: 'HTTP Method',            required: false, hint: 'POST' },
      { key: 'headers',  label: 'Headers (JSON)',         required: false, hint: '{"Authorization":"Bearer xxx"}' },
      { key: 'template', label: 'Body Template (JSON)',   required: false, hint: '{"event":"{{externalName}}","user":"{{email}}"}' },
    ],
    eventNames: [],
    paramSchema: {},
  },
];

const INTERNAL_EVENTS = [
  { key: 'user.registered',    label: 'User Registered',   icon: '👤' },
  { key: 'user.kyc_approved',  label: 'KYC Approved',      icon: '✅' },
  { key: 'account.created',    label: 'Account Created',   icon: '📊' },
  { key: 'account.passed',     label: 'Account Passed',    icon: '🏆' },
  { key: 'account.funded',     label: 'Account Funded',    icon: '💰' },
  { key: 'payment.initiated',  label: 'Payment Initiated', icon: '💳' },
  { key: 'payment.completed',  label: 'Payment Completed', icon: '✔️' },
  { key: 'payment.failed',     label: 'Payment Failed',    icon: '❌' },
  { key: 'payout.requested',   label: 'Payout Requested',  icon: '📤' },
  { key: 'payout.approved',    label: 'Payout Approved',   icon: '💸' },
  { key: 'tournament.registered','label': 'Tournament Registered', icon: '🥊' },
];

const TEMPLATE_VARS = [
  '{{userId}}', '{{email}}', '{{firstName}}', '{{lastName}}',
  '{{phone}}', '{{countryCode}}', '{{value}}', '{{currency}}',
  '{{productId}}', '{{productName}}', '{{orderId}}',
  '{{utmSource}}', '{{utmMedium}}', '{{utmCampaign}}',
  '{{ip}}', '{{userAgent}}',
];

export default function EventBuilder() {
  const [selectedIntegration, setSelectedIntegration] = useState<any>(null);
  const [showNewIntegration, setShowNewIntegration]   = useState(false);
  const [newPlatform, setNewPlatform]                 = useState('meta_capi');
  const [newName, setNewName]                         = useState('');
  const [newConfig, setNewConfig]                     = useState<Record<string, string>>({});
  const [selectedEvent, setSelectedEvent]             = useState<string | null>(null);
  const [eventParams, setEventParams]                 = useState<Record<string, Record<string, string>>>({});
  const [externalNames, setExternalNames]             = useState<Record<string, string>>({});
  const [showVars, setShowVars]                       = useState(false);

  const qc = useQueryClient();

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.get('/integrations').then(r => r.data),
  });

  const { data: savedParams = [] } = useQuery({
    queryKey: ['event-params', selectedIntegration?.id],
    queryFn: () => selectedIntegration
      ? api.get(`/pixels/${selectedIntegration.id}/event-params`).then(r => r.data)
      : [],
    enabled: !!selectedIntegration,
  });

  const createIntegration = useMutation({
    mutationFn: () => {
      const pl = S2S_PLATFORMS.find(p => p.value === newPlatform)!;
      return api.post('/integrations', {
        name:      newName || `${pl.label} — ${newConfig[pl.fields[0]?.key] ?? ''}`,
        type:      newPlatform,
        config:    newConfig,
        eventMap:  {},
        isActive:  false,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      setShowNewIntegration(false);
      setNewName(''); setNewConfig({});
    },
  });

  const saveEventParam = useMutation({
    mutationFn: ({ event, extName, params }: { event: string; extName: string; params: Record<string, string> }) =>
      api.put(`/pixels/${selectedIntegration!.id}/event-params`, {
        internalEvent: event,
        externalEvent: extName,
        params,
        enabled: true,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-params', selectedIntegration?.id] }),
  });

  const deleteParam = useMutation({
    mutationFn: (event: string) =>
      api.delete(`/pixels/${selectedIntegration!.id}/event-params/${encodeURIComponent(event)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['event-params', selectedIntegration?.id] }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/integrations/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const currentPlatformDef = selectedIntegration
    ? S2S_PLATFORMS.find(p => p.value === selectedIntegration.type)
    : null;

  const savedParamsMap: Record<string, any> = Object.fromEntries(
    savedParams.map((p: any) => [p.internal_event, p])
  );

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={32} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="S2S Event Builder"
        subtitle="Create and configure server-side events with custom parameters per platform"
        action={<Btn onClick={() => setShowNewIntegration(true)}>+ Add Integration</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: selectedIntegration ? '320px 1fr' : '1fr', gap: 20 }}>

        {/* Integration list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {integrations.length === 0 && !showNewIntegration && (
            <Empty icon="🔌" title="No integrations yet" subtitle="Add your first S2S integration to start sending events." />
          )}

          {integrations.map((intg: any) => {
            const pl = S2S_PLATFORMS.find(p => p.value === intg.type);
            const isSelected = selectedIntegration?.id === intg.id;
            return (
              <div key={intg.id}
                onClick={() => setSelectedIntegration(isSelected ? null : intg)}
                style={{
                  padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
                  background: isSelected ? `${pl?.color ?? C.blue}18` : C.surfA,
                  border: `1px solid ${isSelected ? (pl?.color ?? C.blue) + '66' : C.bordA}`,
                  transition: 'all 0.15s',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{pl?.icon ?? '🔌'}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.white }}>{intg.name}</div>
                      <div style={{ fontSize: 11, color: C.txtB }}>{pl?.label}</div>
                    </div>
                  </div>
                  <label onClick={e => e.stopPropagation()}>
                    <div onClick={() => toggleActive.mutate({ id: intg.id, isActive: !intg.is_active })}
                      style={{
                        width: 34, height: 18, borderRadius: 9, cursor: 'pointer',
                        background: intg.is_active ? C.green : C.bordA,
                        position: 'relative', transition: 'background 0.2s',
                      }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: 3,
                        left: intg.is_active ? 19 : 3, transition: 'left 0.2s',
                      }} />
                    </div>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.keys(intg.event_map ?? {}).map((ev: string) => (
                    <span key={ev} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: `${pl?.color ?? C.blue}22`, color: pl?.color ?? C.blue, border: `1px solid ${pl?.color ?? C.blue}33` }}>
                      {intg.event_map[ev]}
                    </span>
                  ))}
                  {Object.keys(intg.event_map ?? {}).length === 0 && (
                    <span style={{ fontSize: 10, color: C.txtC }}>No events mapped yet</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* New integration form */}
          {showNewIntegration && (
            <Card>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 16 }}>New S2S Integration</div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: C.txtB, marginBottom: 8 }}>Platform</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {S2S_PLATFORMS.map(pl => (
                    <button key={pl.value} onClick={() => { setNewPlatform(pl.value); setNewConfig({}); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 10px', borderRadius: 6, cursor: 'pointer',
                        background: newPlatform === pl.value ? `${pl.color}22` : C.surfB,
                        border: `1px solid ${newPlatform === pl.value ? pl.color : C.bordA}`,
                        color: newPlatform === pl.value ? C.white : C.txtB,
                        fontSize: 12, fontFamily: 'inherit', transition: 'all 0.15s',
                      }}>
                      <span>{pl.icon}</span><span>{pl.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 12, color: C.txtB, marginBottom: 5 }}>Display Name</div>
                  <input value={newName} onChange={e => setNewName(e.target.value)}
                    style={inp} placeholder={`${S2S_PLATFORMS.find(p => p.value === newPlatform)?.label} — Primary`} />
                </div>
                {S2S_PLATFORMS.find(p => p.value === newPlatform)?.fields.map(f => (
                  <div key={f.key}>
                    <div style={{ fontSize: 12, color: C.txtB, marginBottom: 5 }}>
                      {f.label} {f.required && <span style={{ color: C.red }}>*</span>}
                    </div>
                    <input
                      type={(f as any).type ?? 'text'}
                      value={newConfig[f.key] ?? ''}
                      onChange={e => setNewConfig(p => ({ ...p, [f.key]: e.target.value }))}
                      style={inp} placeholder={(f as any).hint ?? ''}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Btn variant="secondary" onClick={() => setShowNewIntegration(false)}>Cancel</Btn>
                <Btn onClick={() => createIntegration.mutate()} disabled={createIntegration.isPending}>
                  {createIntegration.isPending ? 'Saving…' : '+ Create Integration'}
                </Btn>
              </div>
            </Card>
          )}
        </div>

        {/* Event builder panel */}
        {selectedIntegration && currentPlatformDef && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', background: C.surfA, borderRadius: 12, border: `1px solid ${currentPlatformDef.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28 }}>{currentPlatformDef.icon}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.white }}>{selectedIntegration.name}</div>
                  <div style={{ fontSize: 12, color: C.txtB }}>Configure events & parameters for {currentPlatformDef.label}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: `${currentPlatformDef.color}22`, color: currentPlatformDef.color, border: `1px solid ${currentPlatformDef.color}44` }}>
                {selectedIntegration.is_active ? '🟢 Active' : '⚫ Inactive'}
              </div>
            </div>

            {/* Template vars reference */}
            <div style={{ padding: '10px 14px', background: C.surfA, borderRadius: 8, border: `1px solid ${C.bordA}` }}>
              <button onClick={() => setShowVars(!showVars)}
                style={{ background: 'none', border: 'none', color: C.blue, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                {showVars ? '▼' : '▶'} Available Template Variables
              </button>
              {showVars && (
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {TEMPLATE_VARS.map(v => (
                    <code key={v} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: C.surfB, color: C.gold, border: `1px solid ${C.bordA}`, cursor: 'pointer' }}
                      onClick={() => navigator.clipboard.writeText(v)} title="Click to copy">
                      {v}
                    </code>
                  ))}
                  <span style={{ fontSize: 11, color: C.txtC, alignSelf: 'center' }}>Click to copy · Use in param values</span>
                </div>
              )}
            </div>

            {/* Event rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {INTERNAL_EVENTS.map(ev => {
                const saved = savedParamsMap[ev.key];
                const isOpen = selectedEvent === ev.key;
                const localParams = eventParams[ev.key] ?? (saved?.params ?? {});
                const localExtName = externalNames[ev.key] ?? saved?.external_event ?? '';

                return (
                  <div key={ev.key} style={{
                    background: C.surfA, border: `1px solid ${saved ? C.blue + '44' : C.bordA}`,
                    borderRadius: 10, overflow: 'hidden',
                    borderLeft: saved ? `3px solid ${C.blue}` : `3px solid transparent`,
                  }}>
                    {/* Row header */}
                    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', justifyContent: 'space-between' }}
                      onClick={() => setSelectedEvent(isOpen ? null : ev.key)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 18 }}>{ev.icon}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.white }}>{ev.label}</div>
                          <div style={{ fontSize: 11, color: C.txtC, fontFamily: 'monospace' }}>{ev.key}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {saved && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: `${C.blue}22`, color: C.blue, border: `1px solid ${C.blue}44` }}>
                              → {saved.external_event}
                            </span>
                            {Object.keys(saved.params ?? {}).length > 0 && (
                              <span style={{ fontSize: 10, color: C.txtB }}>
                                +{Object.keys(saved.params).length} params
                              </span>
                            )}
                          </div>
                        )}
                        {!saved && <span style={{ fontSize: 11, color: C.txtC }}>not configured</span>}
                        <span style={{ color: C.txtC, fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Expanded config */}
                    {isOpen && (
                      <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${C.bordA}` }}>
                        <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

                          {/* External event name */}
                          <div>
                            <div style={{ fontSize: 12, color: C.txtB, marginBottom: 6 }}>
                              Map to {currentPlatformDef.label} event name <span style={{ color: C.red }}>*</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <select value={localExtName}
                                onChange={e => setExternalNames(p => ({ ...p, [ev.key]: e.target.value }))}
                                style={{ ...inp, flex: 1 }}>
                                <option value="">— select event name —</option>
                                {currentPlatformDef.eventNames.map(en => <option key={en} value={en}>{en}</option>)}
                              </select>
                              <input value={localExtName}
                                onChange={e => setExternalNames(p => ({ ...p, [ev.key]: e.target.value }))}
                                style={{ ...inp, flex: 1 }} placeholder="Or type custom event name…" />
                            </div>
                          </div>

                          {/* Parameters */}
                          {Object.keys(currentPlatformDef.paramSchema).length > 0 && (
                            <div>
                              <div style={{ fontSize: 12, color: C.txtB, marginBottom: 10 }}>
                                Event Parameters <span style={{ color: C.txtC }}>(use template vars like {'{{value}}'} for dynamic values)</span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                {Object.entries(currentPlatformDef.paramSchema).map(([key, schema]: [string, any]) => (
                                  <div key={key}>
                                    <div style={{ fontSize: 11, color: C.txtC, marginBottom: 4, fontFamily: 'monospace' }}>{key}</div>
                                    <div style={{ fontSize: 10, color: C.txtC, marginBottom: 4 }}>{schema.label}</div>
                                    <input
                                      value={localParams[key] ?? ''}
                                      onChange={e => setEventParams(p => ({
                                        ...p,
                                        [ev.key]: { ...(p[ev.key] ?? {}), [key]: e.target.value },
                                      }))}
                                      style={inp} placeholder={schema.hint}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Custom params */}
                          <div>
                            <div style={{ fontSize: 12, color: C.txtB, marginBottom: 6 }}>Custom Parameters</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {Object.entries(localParams)
                                .filter(([k]) => !Object.keys(currentPlatformDef.paramSchema).includes(k))
                                .map(([key, val]) => (
                                  <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 8, alignItems: 'center' }}>
                                    <input value={key} readOnly style={{ ...inp, color: C.gold, fontFamily: 'monospace', fontSize: 12 }} />
                                    <input value={val as string}
                                      onChange={e => setEventParams(p => ({
                                        ...p,
                                        [ev.key]: { ...(p[ev.key] ?? {}), [key]: e.target.value },
                                      }))}
                                      style={inp} />
                                    <button onClick={() => setEventParams(p => {
                                      const copy = { ...(p[ev.key] ?? {}) };
                                      delete copy[key];
                                      return { ...p, [ev.key]: copy };
                                    })} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 16 }}>×</button>
                                  </div>
                                ))}
                              <button onClick={() => {
                                const k = prompt('Parameter key:');
                                if (k) setEventParams(p => ({ ...p, [ev.key]: { ...(p[ev.key] ?? {}), [k]: '' } }));
                              }} style={{
                                background: 'transparent', border: `1px dashed ${C.bordA}`,
                                borderRadius: 6, padding: '6px 12px', color: C.txtB, cursor: 'pointer',
                                fontSize: 12, fontFamily: 'inherit', width: '100%',
                              }}>+ Add Custom Parameter</button>
                            </div>
                          </div>

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: `1px solid ${C.bordA}` }}>
                            <Btn onClick={() => {
                              const extName = externalNames[ev.key] ?? saved?.external_event ?? '';
                              if (!extName) { alert('Select an event name first'); return; }
                              const cleanParams = Object.fromEntries(
                                Object.entries(localParams).filter(([, v]) => (v as string).trim() !== '')
                              );
                              saveEventParam.mutate({ event: ev.key, extName, params: cleanParams });
                            }} disabled={saveEventParam.isPending}>
                              {saveEventParam.isPending ? 'Saving…' : '💾 Save Event Config'}
                            </Btn>
                            {saved && (
                              <Btn variant="danger" onClick={() => deleteParam.mutate(ev.key)} disabled={deleteParam.isPending}>
                                🗑 Remove
                              </Btn>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
