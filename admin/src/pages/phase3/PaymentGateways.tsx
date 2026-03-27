import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import {
  PageHeader, Card, CardHeader, StatCard, Btn, Spinner, Badge, Empty,
} from '../../components/ui.js';

const GATEWAY_ICONS: Record<string, string> = {
  stripe:           '💳',
  crypto_manual:    '₿',
  nowpayments:      '🔄',
  coinbase_commerce:'🔵',
  skrill:           '💜',
  neteller:         '🟠',
  bank_transfer:    '🏦',
  flutterwave:      '🦋',
  razorpay:         '💙',
  paypal:           '🅿️',
};

const STATUS_COLOR: Record<string, string> = {
  active:    '#38BA82',
  test_mode: '#F5B326',
  inactive:  '#4F5669',
};

// Config fields per gateway
const GATEWAY_CONFIG_FIELDS: Record<string, Array<{ key: string; label: string; type?: string; hint?: string }>> = {
  stripe: [
    { key:'secretKey',     label:'Secret Key',        type:'password', hint:'sk_live_...' },
    { key:'publishableKey',label:'Publishable Key',   hint:'pk_live_...' },
    { key:'webhookSecret', label:'Webhook Secret',    type:'password', hint:'whsec_...' },
  ],
  nowpayments: [
    { key:'apiKey',      label:'API Key',      type:'password' },
    { key:'ipnSecret',   label:'IPN Secret',   type:'password' },
    { key:'defaultCoin', label:'Default Coin', hint:'USDTTRC20 / USDTERC20 / BTC / ETH' },
  ],
  paypal: [
    { key:'clientId',     label:'Client ID' },
    { key:'clientSecret', label:'Client Secret', type:'password' },
    { key:'webhookId',    label:'Webhook ID' },
    { key:'env',          label:'Environment', hint:'sandbox or production' },
  ],
  flutterwave: [
    { key:'secretKey',     label:'Secret Key',     type:'password' },
    { key:'publicKey',     label:'Public Key' },
    { key:'encryptionKey', label:'Encryption Key', type:'password' },
    { key:'webhookSecret', label:'Webhook Hash (Verif-Hash)', type:'password' },
  ],
  razorpay: [
    { key:'keyId',         label:'Key ID' },
    { key:'keySecret',     label:'Key Secret',      type:'password' },
    { key:'webhookSecret', label:'Webhook Secret',  type:'password' },
  ],
  skrill: [
    { key:'merchantEmail', label:'Merchant Email' },
    { key:'merchantId',    label:'Merchant ID' },
    { key:'secretWord',    label:'Secret Word', type:'password' },
  ],
  neteller: [
    { key:'clientId',     label:'Client ID' },
    { key:'clientSecret', label:'Client Secret', type:'password' },
    { key:'env',          label:'Environment', hint:'production or test' },
  ],
  bank_transfer: [
    { key:'_info', label:'', hint:'Configure bank accounts as JSON in the config field below.' },
  ],
  crypto_manual: [
    { key:'_info', label:'', hint:'Configure wallet addresses as JSON in the config field below.' },
  ],
};

export default function PaymentGateways() {
  const [selected, setSelected] = useState<any>(null);
  const [configJson, setConfigJson] = useState('');
  const [simpleFields, setSimpleFields] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const [feePct, setFeePct] = useState('');
  const qc = useQueryClient();

  const { data: gateways, isLoading } = useQuery({
    queryKey: ['payment-gateways'],
    queryFn:  () => api.get('/payments-gateway/admin').then(r => r.data),
  });

  const { data: health } = useQuery({
    queryKey: ['gateway-health'],
    queryFn:  () => api.get('/payments-gateway/admin/health').then(r => r.data),
    refetchInterval: 60_000,
  });

  const { data: pendingBank } = useQuery({
    queryKey: ['pending-bank-transfers'],
    queryFn:  () => api.get('/payments-gateway/admin/bank-transfers').then(r => r.data),
  });

  const { data: pendingCrypto } = useQuery({
    queryKey: ['pending-crypto-deposits'],
    queryFn:  () => api.get('/payments-gateway/admin/crypto-deposits').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: () => {
      let config: Record<string, unknown> = {};
      const fields = GATEWAY_CONFIG_FIELDS[selected?.name] ?? [];
      const hasJsonField = fields.some(f => f.key === '_info');

      if (hasJsonField) {
        try { config = JSON.parse(configJson); } catch { alert('Invalid JSON'); return Promise.reject(); }
      } else {
        config = simpleFields;
      }

      return api.patch(`/payments-gateway/admin/${selected.name}`, {
        status: status || undefined,
        config: Object.keys(config).length > 0 ? config : undefined,
        feePct: feePct ? parseFloat(feePct) : undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['payment-gateways'] });
      setSelected(null);
    },
  });

  const confirmBank = useMutation({
    mutationFn: (id: string) => api.post(`/payments-gateway/admin/bank-transfers/${id}/confirm`),
    onSuccess: () => qc.invalidateQueries({ queryKey:['pending-bank-transfers'] }),
  });

  const confirmCrypto = useMutation({
    mutationFn: ({ id, txHash, amount }: { id: string; txHash: string; amount: number }) =>
      api.post(`/payments-gateway/admin/crypto-deposits/${id}/confirm`, { txHash, amount }),
    onSuccess: () => qc.invalidateQueries({ queryKey:['pending-crypto-deposits'] }),
  });

  const openGateway = (gw: any) => {
    setSelected(gw);
    setStatus(gw.status);
    setFeePct(String(gw.fee_pct ?? ''));
    setSimpleFields({});
    setConfigJson(JSON.stringify(gw.safe_config ?? {}, null, 2));
  };

  const activeCount   = (gateways ?? []).filter((g: any) => g.status === 'active').length;
  const pendingBankN  = (pendingBank  ?? []).length;
  const pendingCryptoN= (pendingCrypto ?? []).length;

  return (
    <>
      <PageHeader title="Payment Gateways" sub="Configure and manage all payment methods" />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        <StatCard label="Total Gateways"    value={(gateways ?? []).length} />
        <StatCard label="Active"            value={activeCount}             color="#38BA82" />
        <StatCard label="Pending Bank Wires" value={pendingBankN}           color={pendingBankN   > 0 ? '#F5B326' : '#4F5669'} />
        <StatCard label="Pending Crypto"    value={pendingCryptoN}          color={pendingCryptoN > 0 ? '#8B5CF6' : '#4F5669'} />
      </div>

      {/* Pending bank transfers */}
      {pendingBankN > 0 && (
        <Card style={{ marginBottom:16, borderColor:'#F5B32655' }}>
          <CardHeader title="⚠️ Pending Bank Transfers" sub="Confirm once you see the wire in your bank account" />
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {(pendingBank ?? []).map((t: any) => (
              <div key={t.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', background:'#252931', borderRadius:8 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#F5F8FF' }}>{t.first_name} {t.last_name} — {t.product_name}</div>
                  <div style={{ fontSize:11, color:'#878FA4' }}>
                    Ref: <code style={{ color:'#F5B326' }}>{t.reference_code}</code> · Amount: <strong style={{ color:'#38BA82' }}>${parseFloat(t.amount).toFixed(2)} {t.currency}</strong>
                  </div>
                  <div style={{ fontSize:11, color:'#4F5669' }}>{t.email} · {new Date(t.created_at).toLocaleString()}</div>
                </div>
                <Btn size="sm" variant="primary"
                  onClick={() => confirmBank.mutate(t.id)}
                  disabled={confirmBank.isPending}>
                  ✓ Confirm Received
                </Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pending crypto deposits */}
      {pendingCryptoN > 0 && (
        <Card style={{ marginBottom:16, borderColor:'#8B5CF655' }}>
          <CardHeader title="⚠️ Pending Crypto Deposits" sub="Verify on blockchain explorer then confirm" />
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {(pendingCrypto ?? []).map((d: any) => (
              <CryptoConfirmRow key={d.id} deposit={d} onConfirm={(txHash, amount) =>
                confirmCrypto.mutate({ id: d.id, txHash, amount })
              } />
            ))}
          </div>
        </Card>
      )}

      {/* Gateway grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12 }}>
        {isLoading
          ? [1,2,3,4].map(i => <Card key={i} style={{ height:120 }}><Spinner /></Card>)
          : (gateways ?? []).map((gw: any) => {
              const h = health?.[gw.name];
              return (
                <Card key={gw.name} style={{ cursor:'pointer' }} onClick={() => openGateway(gw)}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                      <span style={{ fontSize:28 }}>{GATEWAY_ICONS[gw.name] ?? '💰'}</span>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:'#F5F8FF' }}>{gw.display_name}</div>
                        <div style={{ fontSize:11, color:'#878FA4' }}>
                          Fee: {gw.fee_pct}%{gw.fee_fixed > 0 ? ` + $${gw.fee_fixed}` : ''} ·
                          Min: ${gw.min_amount}
                        </div>
                        <div style={{ fontSize:11, color:'#4F5669', marginTop:2 }}>
                          {(gw.supported_currencies ?? []).join(', ')}
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>
                      <Badge
                        label={gw.status.replace(/_/g,' ')}
                        variant={gw.status === 'active' ? 'green' : gw.status === 'test_mode' ? 'gold' : 'default'}
                      />
                      {h !== undefined && (
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <div style={{ width:6, height:6, borderRadius:'50%', background: h.ok ? '#38BA82' : '#EB5454' }} />
                          <span style={{ fontSize:10, color:'#878FA4' }}>{h.ok ? `${h.latencyMs}ms` : 'offline'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
        }
      </div>

      {/* Config modal */}
      {selected && (
        <div style={{ position:'fixed', inset:0, background:'#00000088', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#1C1F27', border:'1px solid #353947', borderRadius:14, padding:26, width:520, maxHeight:'85vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:800, color:'#F5F8FF' }}>
                  {GATEWAY_ICONS[selected.name]} {selected.display_name}
                </div>
                <div style={{ fontSize:12, color:'#878FA4', marginTop:2 }}>{selected.name}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background:'none', border:'none', color:'#878FA4', fontSize:20, cursor:'pointer' }}>×</button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {/* Status */}
              <div>
                <div style={{ fontSize:12, color:'#878FA4', marginBottom:4 }}>Status</div>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  style={{ width:'100%', background:'#252931', color:'#F5F8FF', border:'1px solid #353947', borderRadius:6, padding:'8px 10px', fontSize:13, outline:'none', fontFamily:'inherit' }}>
                  <option value="inactive">Inactive</option>
                  <option value="test_mode">Test Mode</option>
                  <option value="active">Active</option>
                </select>
              </div>

              {/* Fee */}
              <div>
                <div style={{ fontSize:12, color:'#878FA4', marginBottom:4 }}>Gateway Fee % (passed to customer)</div>
                <input type="number" step="0.01" value={feePct} onChange={e => setFeePct(e.target.value)}
                  placeholder="0.00"
                  style={{ width:'100%', background:'#252931', color:'#F5F8FF', border:'1px solid #353947', borderRadius:6, padding:'8px 10px', fontSize:13, outline:'none', fontFamily:'inherit' }} />
              </div>

              {/* Config fields */}
              {(GATEWAY_CONFIG_FIELDS[selected.name] ?? []).map(f => {
                if (f.key === '_info') return (
                  <div key="_info" style={{ padding:'10px', background:'#252931', borderRadius:6, fontSize:12, color:'#878FA4' }}>
                    {f.hint}
                    <div style={{ marginTop:8 }}>
                      <div style={{ fontSize:11, color:'#4F5669', marginBottom:4 }}>JSON Config:</div>
                      <textarea value={configJson} onChange={e => setConfigJson(e.target.value)} rows={8}
                        style={{ width:'100%', background:'#1C1F27', color:'#3F8FE0', border:'1px solid #353947', borderRadius:4, padding:'6px', fontSize:11, fontFamily:'monospace', resize:'vertical', outline:'none' }} />
                    </div>
                  </div>
                );
                return (
                  <div key={f.key}>
                    <div style={{ fontSize:12, color:'#878FA4', marginBottom:4 }}>
                      {f.label} {f.hint && <span style={{ color:'#4F5669' }}>({f.hint})</span>}
                    </div>
                    <input
                      type={f.type ?? 'text'}
                      value={simpleFields[f.key] ?? ''}
                      onChange={e => setSimpleFields(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.hint}
                      style={{ width:'100%', background:'#252931', color:'#F5F8FF', border:'1px solid #353947', borderRadius:6, padding:'8px 10px', fontSize:13, outline:'none', fontFamily:'inherit' }}
                    />
                  </div>
                );
              })}

              <div style={{ padding:'10px 12px', background:'#123B26', border:'1px solid #38BA8233', borderRadius:6, fontSize:11, color:'#878FA4' }}>
                🔒 Credentials are stored encrypted in the database. They are never exposed in API responses.
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <Btn variant="primary" onClick={() => save.mutate()} disabled={save.isPending}>
                  {save.isPending ? 'Saving…' : 'Save Configuration'}
                </Btn>
                <Btn variant="secondary" onClick={() => setSelected(null)}>Cancel</Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CryptoConfirmRow({ deposit, onConfirm }: { deposit: any; onConfirm: (txHash: string, amount: number) => void }) {
  const [txHash, setTxHash] = useState('');
  const [amount, setAmount] = useState(String(deposit.expected_amount));

  return (
    <div style={{ padding:'12px', background:'#252931', borderRadius:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#F5F8FF' }}>{deposit.first_name} {deposit.last_name} — {deposit.product_name}</div>
          <div style={{ fontSize:11, color:'#878FA4' }}>
            {deposit.coin} on {deposit.network} · Expected: <strong style={{ color:'#8B5CF6' }}>{deposit.expected_amount}</strong>
          </div>
          <div style={{ fontSize:11, color:'#4F5669' }}>Wallet: <code style={{ color:'#3F8FE0' }}>{deposit.wallet_address}</code></div>
        </div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <input value={txHash} onChange={e => setTxHash(e.target.value)} placeholder="Transaction hash (from blockchain explorer)"
          style={{ flex:1, background:'#1C1F27', color:'#F5F8FF', border:'1px solid #353947', borderRadius:6, padding:'6px 10px', fontSize:12, outline:'none', fontFamily:'monospace' }} />
        <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Received amount"
          style={{ width:120, background:'#1C1F27', color:'#F5F8FF', border:'1px solid #353947', borderRadius:6, padding:'6px 10px', fontSize:12, outline:'none' }} />
        <Btn size="sm" variant="primary" disabled={!txHash || !amount} onClick={() => onConfirm(txHash, parseFloat(amount))}>
          Confirm
        </Btn>
      </div>
    </div>
  );
}
