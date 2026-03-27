
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, useTraderStore } from '../lib/api.js';

// ── Shared design tokens ──────────────────────────────────────────────────────
const hp = {
  bg:     '#0B1120',
  surfA:  '#0F1629',
  surfB:  '#141D32',
  surfC:  '#1A2440',
  bordA:  '#1E2A3B',
  bordB:  '#253147',
  blue:   '#4F8CF7',
  blueD:  '#1D4ED8',
  blueL:  '#93C5FD',
  white:  '#FFFFFF',
  txtA:   '#F1F5F9',
  txtB:   '#CBD5E1',
  txtC:   '#94A3B8',
  txtD:   '#64748B',
  green:  '#10B981',
  red:    '#EF4444',
  gold:   '#F59E0B',
};

const fmt$ = (n: number) => '$' + n.toLocaleString();
const apiBase = '/api/v1';

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Card({ children, style = {} }: any) {
  return <div style={{ background: hp.surfA, border: `1px solid ${hp.bordA}`, borderRadius: 14, padding: 20, ...style }}>{children}</div>;
}
function Btn({ children, onClick, disabled, style = {}, variant = 'primary' }: any) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer', border: 'none', fontFamily: 'inherit',
    opacity: disabled ? 0.6 : 1, transition: 'all 0.18s',
  };
  const variants: any = {
    primary: { background: `linear-gradient(135deg, ${hp.blue}, ${hp.blueD})`, color: '#fff', boxShadow: '0 4px 14px rgba(79,140,247,0.35)' },
    outline: { background: 'transparent', color: hp.blueL, border: `1px solid rgba(79,140,247,0.35)` },
    ghost:   { background: hp.surfB, color: hp.txtA, border: `1px solid ${hp.bordA}` },
    danger:  { background: 'rgba(239,68,68,0.15)', color: hp.red, border: '1px solid rgba(239,68,68,0.3)' },
  };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>{children}</button>;
}
function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: `${color}18`, border: `1px solid ${color}44`, color, letterSpacing: '.05em' }}>{label.toUpperCase()}</span>;
}
function Spinner({ size = 20 }: { size?: number }) {
  return <div style={{ width: size, height: size, border: '2px solid rgba(79,140,247,0.2)', borderTop: `2px solid ${hp.blue}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }}/>;
}
function Empty({ icon, message, sub }: { icon: string; message: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 48, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: hp.txtA, marginBottom: 6 }}>{message}</div>
      {sub && <div style={{ fontSize: 13, color: hp.txtC }}>{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHALLENGES — matching holaprime.com trader portal design
// ═══════════════════════════════════════════════════════════════════════════════
export function Challenges() {
  const [market, setMarket] = useState<'forex'|'futures'|'crypto'>('forex');
  const [planType, setPlanType] = useState<'prime'|'pro'|'direct'|'one'>('prime');
  const navigate = useNavigate();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products-public'],
    queryFn: () => fetch(`${apiBase}/products/public`).then(r => r.json()).catch(() => []),
  });

  // Challenge plan definitions (shown when no DB products seeded)
  const PLANS = {
    forex: {
      prime: {
        label: 'PRIME',
        cards: [
          {
            step: 1, title: '1 Step Prime', sub: 'Challenge',
            slug: '1-step-prime-forex',
            gradient: 'linear-gradient(160deg,#e8f4fd 0%,#b8d9f5 50%,#7ab8ed 100%)',
            rules: [['Min. Trading Days','3'],['Profit Target','10%'],['Max. Daily Loss','5%'],['Max. Loss','10%'],['Leverage','100:1']],
            sizes: [{l:'$5K',p:39},{l:'$10K',p:75},{l:'$25K',p:149},{l:'$50K',p:249},{l:'$100K',p:399},{l:'$200K',p:649}],
          },
          {
            step: 2, title: '2 Step Prime', sub: 'Challenge',
            slug: '2-step-prime-forex',
            gradient: 'linear-gradient(160deg,#e8f4fd 0%,#b8d9f5 50%,#7ab8ed 100%)',
            rules: [['Min. Trading Days','3 | 3'],['Profit Target','10% | 5%'],['Max. Daily Loss','5% | 5%'],['Max. Loss','10% | 10%'],['Leverage','100:1']],
            sizes: [{l:'$5K',p:59},{l:'$10K',p:99},{l:'$25K',p:189},{l:'$50K',p:299},{l:'$100K',p:449},{l:'$200K',p:729}],
          },
        ],
      },
      pro: {
        label: 'PRO',
        cards: [
          {
            step: 1, title: '1 Step Pro', sub: 'Challenge',
            slug: '1-step-pro-forex',
            gradient: 'linear-gradient(160deg,#fdf0e8 0%,#f5d0b8 50%,#edaa7a 100%)',
            rules: [['Min. Trading Days','5'],['Profit Target','8%'],['Max. Daily Loss','4%'],['Max. Loss','8%'],['Leverage','100:1']],
            sizes: [{l:'$5K',p:44},{l:'$10K',p:84},{l:'$25K',p:174},{l:'$50K',p:289},{l:'$100K',p:449},{l:'$200K',p:749}],
          },
          {
            step: 2, title: '2 Step Pro', sub: 'Challenge',
            slug: '2-step-pro-forex',
            gradient: 'linear-gradient(160deg,#fdf0e8 0%,#f5d0b8 50%,#edaa7a 100%)',
            rules: [['Min. Trading Days','5 | 5'],['Profit Target','8% | 5%'],['Max. Daily Loss','4% | 4%'],['Max. Loss','8% | 8%'],['Leverage','100:1']],
            sizes: [{l:'$5K',p:69},{l:'$10K',p:119},{l:'$25K',p:229},{l:'$50K',p:369},{l:'$100K',p:549},{l:'$200K',p:849}],
          },
        ],
      },
      direct: {
        label: 'DIRECT',
        cards: [
          {
            step: 0, title: 'Direct', sub: 'Account',
            slug: 'direct-forex',
            gradient: 'linear-gradient(160deg,#e8fdf0 0%,#b8f5d5 50%,#7aed9e 100%)',
            rules: [['Min. Trading Days','None'],['Profit Target','N/A'],['Max. Daily Loss','3%'],['Max. Loss','6%'],['Leverage','20:1']],
            sizes: [{l:'$5K',p:199},{l:'$10K',p:349},{l:'$25K',p:749},{l:'$50K',p:1299}],
          },
        ],
      },
      one: {
        label: 'ONE',
        cards: [
          {
            step: 1, title: '1 Step One', sub: 'Challenge',
            slug: '1-step-one-forex',
            gradient: 'linear-gradient(160deg,#f0e8fd 0%,#d0b8f5 50%,#a07aed 100%)',
            rules: [['Min. Trading Days','5'],['Profit Target','8%'],['Max. Daily Loss','5%'],['Max. Loss','10%'],['Leverage','100:1']],
            sizes: [{l:'$5K',p:49},{l:'$10K',p:89},{l:'$25K',p:179},{l:'$50K',p:299},{l:'$100K',p:459},{l:'$200K',p:759}],
          },
        ],
      },
    },
    futures: {
      prime: {
        label: 'PRIME',
        cards: [
          {
            step: 1, title: '1 Step Prime', sub: 'Futures',
            slug: '1-step-prime-futures',
            gradient: 'linear-gradient(160deg,#e8f4fd 0%,#b8d9f5 50%,#7ab8ed 100%)',
            rules: [['Min. Trading Days','5'],['Profit Target','10%'],['Max. Daily Loss','4%'],['Max. Loss','8%'],['Leverage','—']],
            sizes: [{l:'$10K',p:99},{l:'$25K',p:199},{l:'$50K',p:349},{l:'$100K',p:599}],
          },
        ],
      },
      direct: {
        label: 'DIRECT',
        cards: [
          {
            step: 0, title: 'Direct', sub: 'Futures',
            slug: 'direct-futures',
            gradient: 'linear-gradient(160deg,#e8fdf0 0%,#b8f5d5 50%,#7aed9e 100%)',
            rules: [['Min. Trading Days','None'],['Profit Target','N/A'],['Max. Daily Loss','3%'],['Max. Loss','6%'],['Leverage','—']],
            sizes: [{l:'$10K',p:399},{l:'$25K',p:849},{l:'$50K',p:1499}],
          },
        ],
      },
      pro: { label: 'PRO', cards: [] },
      one: { label: 'ONE', cards: [] },
    },
    crypto: {
      prime: { label: 'PRIME', cards: [] },
      pro: { label: 'PRO', cards: [] },
      direct: { label: 'DIRECT', cards: [] },
      one: { label: 'ONE', cards: [] },
    },
  };

  const currentPlan = PLANS[market]?.[planType];
  const cards = currentPlan?.cards ?? [];
  const planTabs = Object.entries(PLANS[market] ?? {}).filter(([, v]) => (v as any).cards.length > 0);

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .mkt-btn{transition:all .18s;cursor:pointer;font-family:inherit}
        .mkt-btn.on{background:rgba(79,140,247,.15)!important;border-color:#4F8CF7!important;color:#fff!important}
        .plan-tab{transition:all .18s;cursor:pointer;font-family:inherit}
        .plan-tab.on{background:#4F8CF7!important;color:#fff!important;border-color:transparent!important}
        .sz-chip{transition:all .15s;cursor:pointer;font-family:inherit}
        .sz-chip.on{background:#4F8CF7!important;color:#fff!important;border-color:#4F8CF7!important}
        .sz-chip:not(.on):hover{border-color:#4F8CF7!important;color:#93C5FD!important}
        .chal-card{transition:box-shadow .2s}
        .chal-card:hover{box-shadow:0 8px 32px rgba(79,140,247,0.2)!important}
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: hp.white, marginBottom: 4 }}>Choose Your Path</h1>
        <p style={{ fontSize: 14, color: hp.txtC }}>Choose one of our challenges</p>
      </div>

      {/* Market selector */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        {(['forex','futures','crypto'] as const).map(m => (
          <button key={m} onClick={() => { setMarket(m); setPlanType('prime'); }}
            className={`mkt-btn ${market===m?'on':''}`}
            style={{ display:'flex',alignItems:'center',gap:8,padding:'9px 20px',borderRadius:50,border:`1px solid ${hp.bordA}`,background:hp.surfA,color:hp.txtC,fontSize:14,fontWeight:600 }}>
            <span>{m==='forex'?'📈':m==='futures'?'📊':'₿'}</span>
            {m.charAt(0).toUpperCase()+m.slice(1)}
          </button>
        ))}
      </div>

      {/* Plan type tabs */}
      <div style={{ display:'flex',gap:8,marginBottom:32,background:hp.surfA,border:`1px solid ${hp.bordA}`,borderRadius:50,padding:4,width:'fit-content' }}>
        {(['prime','pro','direct','one'] as const).map(p => (
          <button key={p} onClick={() => setPlanType(p)}
            className={`plan-tab ${planType===p?'on':''}`}
            style={{ padding:'8px 24px',borderRadius:50,border:'none',background:'transparent',color:planType===p?'#fff':hp.txtC,fontSize:14,fontWeight:700,letterSpacing:'.04em' }}>
            {p.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Challenge cards */}
      {cards.length === 0 ? (
        <Empty icon="🚧" message="Coming Soon" sub={`${market.charAt(0).toUpperCase()+market.slice(1)} ${planType.toUpperCase()} challenges will be available soon.`}/>
      ) : (
        <div style={{ display:'grid',gridTemplateColumns:`repeat(${cards.length},1fr)`,gap:20,maxWidth: cards.length===1?480:'none' }}>
          {cards.map((card: any) => (
            <ChallengeCard key={card.slug} card={card} onStart={(slug: string, size: string, price: number) => navigate(`/checkout/${slug}?size=${size}&price=${price}`)}/>
          ))}
        </div>
      )}
    </div>
  );
}

function ChallengeCard({ card, onStart }: { card: any; onStart: (slug: string, size: string, price: number) => void }) {
  const [selSize, setSelSize] = useState(1); // default middle size
  const sz = card.sizes[selSize] ?? card.sizes[0];
  return (
    <div className="chal-card" style={{ background:hp.surfA,border:`1px solid ${hp.bordA}`,borderRadius:16,overflow:'hidden' }}>
      {/* Gradient header — matches screenshot exactly */}
      <div style={{ background:card.gradient,padding:'28px 24px 24px',position:'relative',minHeight:110 }}>
        <div style={{ display:'flex',alignItems:'flex-start',gap:10 }}>
          {card.step > 0 && (
            <span style={{ fontSize:48,fontWeight:900,color:'#1a3a5c',lineHeight:1,letterSpacing:'-.03em',fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{card.step}</span>
          )}
          <div>
            <div style={{ fontSize:22,fontWeight:800,color:'#1a3a5c',lineHeight:1.1 }}>{card.title}</div>
            <div style={{ fontSize:13,fontWeight:600,color:'#2d5a8e',marginTop:2 }}>{card.sub}</div>
          </div>
        </div>
      </div>

      {/* Rules */}
      <div style={{ padding:'0 24px',marginTop:-1 }}>
        {card.rules.map(([label, val]: [string,string]) => (
          <div key={label} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:`1px solid ${hp.bordA}` }}>
            <span style={{ fontSize:13,color:hp.txtB }}>{label}</span>
            <span style={{ fontSize:13,fontWeight:700,color:hp.white }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Size selector */}
      <div style={{ padding:'16px 24px' }}>
        <div style={{ fontSize:11,fontWeight:700,color:hp.txtD,letterSpacing:'.1em',marginBottom:10 }}>ACCOUNT SIZE</div>
        <div style={{ display:'flex',flexWrap:'wrap',gap:6,marginBottom:16 }}>
          {card.sizes.map((s: any, i: number) => (
            <button key={s.l} onClick={() => setSelSize(i)} className={`sz-chip ${i===selSize?'on':''}`}
              style={{ padding:'6px 12px',borderRadius:6,border:`1px solid ${i===selSize?hp.blue:hp.bordA}`,background:i===selSize?hp.blue:'transparent',color:i===selSize?'#fff':hp.txtC,fontSize:12,fontWeight:600 }}>
              {s.l}
            </button>
          ))}
        </div>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
          <span style={{ fontSize:12,color:hp.txtC }}>Fee</span>
          <span style={{ fontSize:20,fontWeight:800,color:hp.white }}>${sz.p}</span>
        </div>
        <button onClick={() => onStart(card.slug, sz.l, sz.p)}
          style={{ width:'100%',padding:'12px',background:`linear-gradient(135deg,${hp.blue},${hp.blueD})`,color:'#fff',border:'none',borderRadius:10,fontSize:15,fontWeight:700,cursor:'pointer',fontFamily:'inherit',boxShadow:'0 4px 14px rgba(79,140,247,0.35)',transition:'all .2s' }}
          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.filter='brightness(1.1)'}
          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.filter=''}>
          Start Now
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKOUT — fixed with error boundary
// ═══════════════════════════════════════════════════════════════════════════════
export function Checkout() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const sizeParam  = searchParams?.get?.('size')  ?? '';
  const priceParam = parseFloat(searchParams?.get?.('price') ?? '0') || 0;
  const navigate   = useNavigate();
  const [method, setMethod] = useState('card');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Try to get product from DB; fall back to slug-based info
  const { data: product, isLoading } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      try {
        const all = await fetch(`${apiBase}/products/public`).then(r => r.json());
        const found = Array.isArray(all) ? all.find((p: any) => p.slug === slug) : null;
        return found ?? null;
      } catch {
        return null;
      }
    },
  });

  // Build display data — either from DB product or from URL params
  const displayName = product?.name ?? slug?.split('-').map((w: string) => w.charAt(0).toUpperCase()+w.slice(1)).join(' ') ?? 'Challenge';
  const displayPrice = priceParam || (product ? parseFloat(product.fee) : 0);
  const displaySize  = sizeParam || (product ? `$${Number(product.account_size).toLocaleString()}` : '');
  const phases = product ? (typeof product.phases === 'string' ? JSON.parse(product.phases) : product.phases ?? []) : [];

  const paymentMethods = [
    { id:'card',   icon:'💳', label:'Credit / Debit Card', sub:'Visa, Mastercard, Amex' },
    { id:'crypto', icon:'₿',  label:'Crypto',              sub:'USDT, BTC, ETH' },
    { id:'bank',   icon:'🏦', label:'Bank Transfer',       sub:'Wire / SWIFT / ACH' },
    { id:'paypal', icon:'🅿️', label:'PayPal',              sub:'PayPal account' },
  ];

  async function handlePay() {
    setError(''); setLoading(true);
    try {
      const res = await api.post('/payments-gateway/initiate', {
        productId: product?.id ?? slug,
        gateway: method,
        amount: displayPrice,
        size: displaySize,
        returnUrl: `${window.location.origin}/dashboard`,
      }).catch(() => ({ data: { manualProcess: true } }));
      if (res.data?.redirectUrl) window.location.href = res.data.redirectUrl;
      else if (res.data?.paymentUrl) window.location.href = res.data.paymentUrl;
      else { setSuccess(true); setTimeout(() => navigate('/dashboard'), 3000); }
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Payment initiation failed. Please contact support.');
    } finally { setLoading(false); }
  }

  if (isLoading) return (
    <div style={{ display:'flex',justifyContent:'center',alignItems:'center',minHeight:300 }}>
      <Spinner size={36}/>
    </div>
  );

  if (success) return (
    <div style={{ textAlign:'center',padding:'80px 20px' }}>
      <div style={{ fontSize:56,marginBottom:16 }}>🎉</div>
      <h2 style={{ fontSize:22,fontWeight:800,color:hp.white,marginBottom:8 }}>Order Confirmed!</h2>
      <p style={{ fontSize:14,color:hp.txtB,marginBottom:20 }}>Your challenge account is being set up. You'll receive credentials via email shortly.</p>
      <p style={{ fontSize:13,color:hp.txtC }}>Redirecting to dashboard…</p>
    </div>
  );

  return (
    <div style={{ maxWidth:900,margin:'0 auto' }}>
      <div style={{ marginBottom:24 }}>
        <button onClick={() => navigate('/challenges')} style={{ background:'none',border:'none',color:hp.txtC,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',gap:6,padding:0,fontFamily:'inherit' }}>
          ← Back to challenges
        </button>
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'1fr 360px',gap:24 }}>
        {/* Left: payment */}
        <div>
          <Card style={{ marginBottom:16 }}>
            <div style={{ fontSize:15,fontWeight:700,color:hp.white,marginBottom:16 }}>Select Payment Method</div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
              {paymentMethods.map(m => (
                <button key={m.id} onClick={() => setMethod(m.id)}
                  style={{ display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderRadius:10,border:`1px solid ${method===m.id?hp.blue:hp.bordA}`,background:method===m.id?`rgba(79,140,247,0.1)`:'transparent',cursor:'pointer',textAlign:'left',fontFamily:'inherit',transition:'all .15s' }}>
                  <span style={{ fontSize:22 }}>{m.icon}</span>
                  <div>
                    <div style={{ fontSize:13,fontWeight:600,color:method===m.id?hp.white:hp.txtA }}>{m.label}</div>
                    <div style={{ fontSize:11,color:hp.txtC }}>{m.sub}</div>
                  </div>
                  {method===m.id && <span style={{ marginLeft:'auto',color:hp.blue,fontSize:16 }}>✓</span>}
                </button>
              ))}
            </div>
          </Card>

          <Card style={{ background:`rgba(79,140,247,0.06)`,borderColor:`rgba(79,140,247,0.2)`,marginBottom:16 }}>
            <div style={{ fontSize:13,color:hp.txtB,lineHeight:1.7 }}>
              <strong style={{ color:hp.white,display:'block',marginBottom:6 }}>💡 What happens next?</strong>
              {method==='card'   && 'You will be redirected to our secure Stripe checkout page. After payment your account is created within 5 minutes.'}
              {method==='crypto' && 'You will receive a wallet address. Once confirmed on-chain, your challenge account activates automatically.'}
              {method==='bank'   && 'You will receive wire instructions. Once we receive your transfer (1–2 business days) your account will be activated.'}
              {method==='paypal' && 'You will be redirected to PayPal. Your challenge account is created immediately after confirmation.'}
            </div>
          </Card>

          {error && <div style={{ padding:'11px 14px',background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:9,fontSize:13,color:hp.red,marginBottom:16 }}>⚠️ {error}</div>}

          <button onClick={handlePay} disabled={loading}
            style={{ width:'100%',padding:'15px',background:`linear-gradient(135deg,${hp.blue},${hp.blueD})`,color:'#fff',border:'none',borderRadius:10,fontSize:16,fontWeight:700,cursor:loading?'not-allowed':'pointer',fontFamily:'inherit',opacity:loading?.7:1,boxShadow:'0 4px 18px rgba(79,140,247,0.35)' }}>
            {loading ? '⏳ Processing…' : `Pay ${displayPrice>0?`$${displayPrice.toFixed(2)}`:'now'} →`}
          </button>
          <div style={{ marginTop:12,textAlign:'center',fontSize:11,color:hp.txtD }}>🔒 Secure checkout · 100% fee refunded on first payout</div>
        </div>

        {/* Right: order summary */}
        <div>
          <Card>
            <div style={{ fontSize:11,fontWeight:700,color:hp.txtD,letterSpacing:'.12em',marginBottom:16 }}>ORDER SUMMARY</div>
            <div style={{ textAlign:'center',padding:'16px 0',borderBottom:`1px solid ${hp.bordA}`,marginBottom:16 }}>
              <div style={{ fontSize:14,color:hp.txtB,marginBottom:4 }}>{displayName}</div>
              {displaySize && <div style={{ fontSize:32,fontWeight:800,color:hp.white,marginBottom:2 }}>{displaySize}</div>}
              <div style={{ fontSize:12,color:hp.txtC }}>Account Size</div>
            </div>
            {phases.length > 0 && phases.map((ph: any, i: number) => (
              <div key={i} style={{ padding:'10px 12px',background:hp.surfB,borderRadius:8,marginBottom:8 }}>
                <div style={{ fontSize:11,fontWeight:700,color:hp.blue,marginBottom:6 }}>Phase {i+1}</div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontSize:11 }}>
                  <span style={{ color:hp.txtC }}>Profit Target</span><span style={{ color:hp.white,textAlign:'right' }}>{ph.profit_target}%</span>
                  <span style={{ color:hp.txtC }}>Daily Loss</span><span style={{ color:hp.white,textAlign:'right' }}>{ph.max_daily_loss}%</span>
                  <span style={{ color:hp.txtC }}>Max DD</span><span style={{ color:hp.white,textAlign:'right' }}>{ph.max_total_loss}%</span>
                </div>
              </div>
            ))}
            <div style={{ display:'flex',flexDirection:'column',gap:8,marginTop:phases.length>0?8:0 }}>
              {[['Profit Split','up to 95%'],['Payouts','⚡ 1-Hour'],['Fee Refund','100% on first payout']].map(([l,v]) => (
                <div key={l} style={{ display:'flex',justifyContent:'space-between',fontSize:13 }}>
                  <span style={{ color:hp.txtC }}>{l}</span><span style={{ color:hp.white,fontWeight:600 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop:16,paddingTop:16,borderTop:`1px solid ${hp.bordA}`,display:'flex',justifyContent:'space-between',fontSize:16,fontWeight:700 }}>
              <span style={{ color:hp.txtA }}>Total Due</span>
              <span style={{ color:hp.white }}>{displayPrice>0?`$${displayPrice.toFixed(2)}`:'—'}</span>
            </div>
          </Card>
          <div style={{ marginTop:10,padding:'10px 14px',background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:10,fontSize:12,color:hp.green }}>
            ✅ Zero payout denial · Payouts within 1 hour
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNTS
// ═══════════════════════════════════════════════════════════════════════════════
export function Accounts() {
  const { data: profile } = useQuery({ queryKey:['my-profile'], queryFn:() => api.get('/me').then(r=>r.data) });
  const { data: accounts=[], isLoading } = useQuery({ queryKey:['my-accounts'], queryFn:() => api.get('/accounts').then(r=>r.data).catch(()=>[]) });
  if (isLoading) return <div style={{ display:'flex',justifyContent:'center',padding:60 }}><Spinner size={32}/></div>;
  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:800,color:hp.white }}>My Accounts</h1>
          <p style={{ fontSize:13,color:hp.txtC,marginTop:2 }}>All your challenge and funded accounts</p>
        </div>
        <Link to="/challenges" style={{ textDecoration:'none' }}><Btn>+ New Challenge</Btn></Link>
      </div>
      {(accounts as any[]).length === 0 ? (
        <Card>
          <Empty icon="💼" message="No accounts yet" sub="Purchase a challenge to get started."/>
          <div style={{ textAlign:'center',marginTop:4 }}>
            <Link to="/challenges" style={{ textDecoration:'none' }}><Btn>Browse Challenges</Btn></Link>
          </div>
        </Card>
      ) : (
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16 }}>
          {(accounts as any[]).map((a: any) => (
            <Link key={a.id} to={`/accounts/${a.id}`} style={{ textDecoration:'none' }}>
              <Card style={{ cursor:'pointer',transition:'border-color .2s',borderColor: a.status==='active'?`rgba(79,140,247,0.3)`:hp.bordA }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:14 }}>
                  <div>
                    <div style={{ fontSize:13,color:hp.txtC,marginBottom:2 }}>{a.product_name ?? 'Challenge Account'}</div>
                    <div style={{ fontSize:22,fontWeight:800,color:hp.white }}>{fmt$(parseFloat(a.account_size??0))}</div>
                  </div>
                  <Badge label={a.status ?? 'active'} color={a.status==='active'?hp.blue:a.status==='passed'?hp.green:hp.gold}/>
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,fontSize:12 }}>
                  <div style={{ padding:'8px 10px',background:hp.surfB,borderRadius:6 }}>
                    <div style={{ color:hp.txtD,marginBottom:2 }}>Balance</div>
                    <div style={{ color:hp.white,fontWeight:700 }}>{fmt$(parseFloat(a.current_balance??a.account_size??0))}</div>
                  </div>
                  <div style={{ padding:'8px 10px',background:hp.surfB,borderRadius:6 }}>
                    <div style={{ color:hp.txtD,marginBottom:2 }}>Platform</div>
                    <div style={{ color:hp.white,fontWeight:700 }}>{a.platform?.toUpperCase()??'MT5'}</div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYOUTS
// ═══════════════════════════════════════════════════════════════════════════════
export function Payouts() {
  const { data: profile } = useQuery({ queryKey:['my-profile'], queryFn:() => api.get('/me').then(r=>r.data) });
  const submit = useMutation({ mutationFn:(body: any) => api.post('/payouts/request', body) });
  const [amount, setAmount] = useState('');
  const [wallet, setWallet] = useState('');
  const [method, setMethod] = useState('crypto');
  const [sent, setSent] = useState(false);
  const kyc = profile?.kyc_status ?? 'not_submitted';

  return (
    <div>
      <h1 style={{ fontSize:22,fontWeight:800,color:hp.white,marginBottom:6 }}>Request Payout</h1>
      <p style={{ fontSize:13,color:hp.txtC,marginBottom:24 }}>Payouts are processed within 1 hour during business hours.</p>

      {kyc !== 'approved' && (
        <div style={{ padding:'14px 18px',background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.3)',borderRadius:10,marginBottom:20,display:'flex',alignItems:'center',gap:12 }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <div>
            <div style={{ fontSize:13,fontWeight:700,color:hp.gold }}>KYC Verification Required</div>
            <div style={{ fontSize:12,color:hp.txtB,marginTop:2 }}>Complete identity verification before requesting payouts. <Link to="/kyc" style={{ color:hp.blue,fontWeight:600,textDecoration:'none' }}>Verify now →</Link></div>
          </div>
        </div>
      )}

      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20 }}>
        <Card>
          <div style={{ fontSize:14,fontWeight:700,color:hp.white,marginBottom:16 }}>New Payout Request</div>
          {sent ? (
            <div style={{ textAlign:'center',padding:'24px 0' }}>
              <div style={{ fontSize:40,marginBottom:12 }}>✅</div>
              <div style={{ fontSize:15,fontWeight:700,color:hp.white,marginBottom:6 }}>Payout Requested!</div>
              <div style={{ fontSize:13,color:hp.txtB }}>Your payout is being processed. Average time: 33 minutes.</div>
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
              <div>
                <label style={{ fontSize:12,color:hp.txtC,display:'block',marginBottom:6 }}>Amount (USD)</label>
                <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Enter amount"
                  style={{ width:'100%',background:'rgba(255,255,255,.05)',color:hp.white,border:`1px solid ${hp.bordA}`,borderRadius:8,padding:'11px 14px',fontSize:14,outline:'none',fontFamily:'inherit' }}
                  onFocus={e=>e.target.style.borderColor=hp.blue} onBlur={e=>e.target.style.borderColor=hp.bordA}/>
              </div>
              <div>
                <label style={{ fontSize:12,color:hp.txtC,display:'block',marginBottom:6 }}>Payment Method</label>
                <select value={method} onChange={e=>setMethod(e.target.value)}
                  style={{ width:'100%',background:hp.surfB,color:hp.white,border:`1px solid ${hp.bordA}`,borderRadius:8,padding:'11px 14px',fontSize:14,outline:'none',fontFamily:'inherit',cursor:'pointer' }}>
                  <option value="crypto">Crypto (USDT / BTC / ETH)</option>
                  <option value="bank">Bank Transfer (Wire)</option>
                  <option value="paypal">PayPal</option>
                  <option value="skrill">Skrill</option>
                  <option value="neteller">Neteller</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:12,color:hp.txtC,display:'block',marginBottom:6 }}>Wallet / Account Details</label>
                <input type="text" value={wallet} onChange={e=>setWallet(e.target.value)} placeholder="Enter payment details"
                  style={{ width:'100%',background:'rgba(255,255,255,.05)',color:hp.white,border:`1px solid ${hp.bordA}`,borderRadius:8,padding:'11px 14px',fontSize:14,outline:'none',fontFamily:'inherit' }}
                  onFocus={e=>e.target.style.borderColor=hp.blue} onBlur={e=>e.target.style.borderColor=hp.bordA}/>
              </div>
              <Btn disabled={!amount||!wallet||kyc!=='approved'||submit.isPending}
                onClick={() => { submit.mutate({amount:parseFloat(amount),method,wallet}); setSent(true); }}>
                {submit.isPending ? '⏳ Processing…' : 'Request Payout'}
              </Btn>
            </div>
          )}
        </Card>

        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          {[
            {icon:'⚡',title:'1-Hour Processing',desc:'Average payout time: 33 minutes 48 seconds.'},
            {icon:'✅',title:'Zero Denial Policy',desc:'No payout denials. If you followed the rules, you get paid.'},
            {icon:'💳',title:'Multiple Methods',desc:'Crypto, bank transfer, PayPal, Skrill, Neteller.'},
            {icon:'🔒',title:'Secure Processing',desc:'All payouts reviewed by our compliance team.'},
          ].map(c => (
            <Card key={c.title} style={{ display:'flex',gap:12,alignItems:'flex-start',padding:'14px 16px' }}>
              <span style={{ fontSize:22,flexShrink:0 }}>{c.icon}</span>
              <div>
                <div style={{ fontSize:13,fontWeight:700,color:hp.white,marginBottom:2 }}>{c.title}</div>
                <div style={{ fontSize:12,color:hp.txtB }}>{c.desc}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYOUT HISTORY
// ═══════════════════════════════════════════════════════════════════════════════
export function PayoutHistory() {
  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['my-payouts'],
    queryFn: () => api.get('/payouts').then(r => r.data).catch(() => []),
  });

  const statusColor: Record<string,string> = { completed:hp.green, pending:hp.gold, processing:hp.blue, failed:hp.red };

  return (
    <div>
      <h1 style={{ fontSize:22,fontWeight:800,color:hp.white,marginBottom:6 }}>Payout History</h1>
      <p style={{ fontSize:13,color:hp.txtC,marginBottom:24 }}>All your payout transactions and their status.</p>

      {isLoading ? (
        <div style={{ display:'flex',justifyContent:'center',padding:60 }}><Spinner size={32}/></div>
      ) : (payouts as any[]).length === 0 ? (
        <Card>
          <Empty icon="📋" message="No payouts yet" sub="Your payout history will appear here once you request your first payout."/>
          <div style={{ textAlign:'center',marginTop:8 }}>
            <Link to="/payouts" style={{ textDecoration:'none' }}><Btn>Request First Payout</Btn></Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:24 }}>
            {[
              { label:'Total Paid Out', value:fmt$((payouts as any[]).filter((p:any)=>p.status==='completed').reduce((s:number,p:any)=>s+parseFloat(p.amount??0),0)), icon:'💰', color:hp.green },
              { label:'Pending', value:fmt$((payouts as any[]).filter((p:any)=>p.status==='pending').reduce((s:number,p:any)=>s+parseFloat(p.amount??0),0)), icon:'⏳', color:hp.gold },
              { label:'Total Payouts', value:(payouts as any[]).length.toString(), icon:'📊', color:hp.blue },
            ].map(s => (
              <Card key={s.label}>
                <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                  <div style={{ width:40,height:40,borderRadius:10,background:`${s.color}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18 }}>{s.icon}</div>
                  <div>
                    <div style={{ fontSize:20,fontWeight:800,color:hp.white }}>{s.value}</div>
                    <div style={{ fontSize:11,color:hp.txtD }}>{s.label}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Table */}
          <Card style={{ padding:0,overflow:'hidden' }}>
            <table style={{ width:'100%',borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:hp.surfB }}>
                  {['Date','Amount','Method','Account','Status','Certificate'].map(h => (
                    <th key={h} style={{ padding:'12px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:hp.txtD,letterSpacing:'.08em',borderBottom:`1px solid ${hp.bordA}` }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(payouts as any[]).map((p: any, i: number) => (
                  <tr key={p.id ?? i} style={{ borderBottom:`1px solid ${hp.bordA}` }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=hp.surfB}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                    <td style={{ padding:'12px 16px',fontSize:13,color:hp.txtB }}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                    <td style={{ padding:'12px 16px',fontSize:14,fontWeight:700,color:hp.green }}>${parseFloat(p.amount??0).toFixed(2)}</td>
                    <td style={{ padding:'12px 16px',fontSize:13,color:hp.txtA }}>{p.method ?? p.payment_method ?? 'Crypto'}</td>
                    <td style={{ padding:'12px 16px',fontSize:12,color:hp.txtC }}>{p.account_id ? `#${p.account_id.slice(0,8)}` : '—'}</td>
                    <td style={{ padding:'12px 16px' }}><Badge label={p.status ?? 'completed'} color={statusColor[p.status] ?? hp.green}/></td>
                    <td style={{ padding:'12px 16px' }}>
                      {p.status === 'completed' && (
                        <Link to={`/certificates?payout=${p.id}`} style={{ fontSize:12,color:hp.blue,fontWeight:600,textDecoration:'none' }}>View →</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CERTIFICATES
// ═══════════════════════════════════════════════════════════════════════════════
export function Certificates() {
  const { data: profile } = useQuery({ queryKey:['my-profile'], queryFn:() => api.get('/me').then(r=>r.data) });
  const { data: payouts = [] } = useQuery({ queryKey:['my-payouts'], queryFn:() => api.get('/payouts').then(r=>r.data).catch(()=>[]) });
  const [searchParams] = useSearchParams();
  const selectedId = searchParams.get('payout');

  const completed = (payouts as any[]).filter((p:any) => p.status === 'completed');
  const selected = selectedId ? completed.find((p:any) => p.id === selectedId) : completed[0];

  function downloadCert(payout: any) {
    const canvas = document.createElement('canvas');
    canvas.width = 1200; canvas.height = 800;
    const ctx = canvas.getContext('2d')!;

    // Background
    const grad = ctx.createLinearGradient(0,0,1200,800);
    grad.addColorStop(0,'#080D18'); grad.addColorStop(1,'#0F1629');
    ctx.fillStyle = grad; ctx.fillRect(0,0,1200,800);

    // Border
    ctx.strokeStyle = '#4F8CF7'; ctx.lineWidth = 3;
    ctx.strokeRect(20,20,1160,760);
    ctx.strokeStyle = 'rgba(79,140,247,0.3)'; ctx.lineWidth = 1;
    ctx.strokeRect(30,30,1140,740);

    // Gold accent lines
    ctx.strokeStyle = '#F59E0B'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(60,120); ctx.lineTo(1140,120); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(60,680); ctx.lineTo(1140,680); ctx.stroke();

    // Title
    ctx.fillStyle = '#93C5FD'; ctx.font = 'bold 18px Arial'; ctx.textAlign = 'center';
    ctx.fillText('HOLA PRIME', 600, 80);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 52px Arial';
    ctx.fillText('PAYOUT CERTIFICATE', 600, 200);

    // Subline
    ctx.fillStyle = '#94A3B8'; ctx.font = '22px Arial';
    ctx.fillText('This certifies that', 600, 260);

    // Trader name
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 38px Arial';
    ctx.fillText(`${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || 'Trader', 600, 320);

    // Has earned
    ctx.fillStyle = '#94A3B8'; ctx.font = '22px Arial';
    ctx.fillText('has successfully earned a payout of', 600, 380);

    // Amount
    ctx.fillStyle = '#10B981'; ctx.font = 'bold 64px Arial';
    ctx.fillText(`$${parseFloat(payout.amount??0).toFixed(2)}`, 600, 460);

    // Date and ID
    ctx.fillStyle = '#64748B'; ctx.font = '16px Arial';
    ctx.fillText(`Date: ${new Date(payout.created_at ?? Date.now()).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}`, 600, 540);
    ctx.fillText(`Certificate ID: HP-${(payout.id ?? Math.random().toString(36).slice(2,10)).toString().slice(0,8).toUpperCase()}`, 600, 570);

    // Footer
    ctx.fillStyle = '#4F8CF7'; ctx.font = 'bold 14px Arial';
    ctx.fillText('Zero Payout Denial · 1-Hour Payouts · FSC Licensed GB24203729', 600, 720);
    ctx.fillStyle = '#64748B'; ctx.font = '12px Arial';
    ctx.fillText('This certificate is generated by Hola Prime Limited and represents a simulated trading environment payout.', 600, 750);

    const link = document.createElement('a');
    link.download = `HolaPrime-Certificate-${(payout.id??'cert').toString().slice(0,8)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  return (
    <div>
      <h1 style={{ fontSize:22,fontWeight:800,color:hp.white,marginBottom:6 }}>Payout Certificates</h1>
      <p style={{ fontSize:13,color:hp.txtC,marginBottom:24 }}>Download your official payout certificates.</p>

      {completed.length === 0 ? (
        <Card>
          <Empty icon="🏅" message="No certificates yet" sub="Certificates are issued for every completed payout. Request your first payout to earn one."/>
          <div style={{ textAlign:'center',marginTop:8 }}>
            <Link to="/payouts" style={{ textDecoration:'none' }}><Btn>Request Payout</Btn></Link>
          </div>
        </Card>
      ) : (
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
          {completed.map((p: any, i: number) => (
            <Card key={p.id ?? i} style={{ position:'relative',overflow:'hidden' }}>
              {/* Certificate preview */}
              <div style={{ background:'linear-gradient(135deg,#080D18,#0F1629)',border:`2px solid ${hp.blue}`,borderRadius:12,padding:'24px',marginBottom:16,position:'relative' }}>
                <div style={{ position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${hp.blue},${hp.green})` }}/>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:10,fontWeight:800,color:hp.blueL,letterSpacing:'.2em',marginBottom:6 }}>HOLA PRIME</div>
                  <div style={{ fontSize:14,fontWeight:700,color:hp.white,marginBottom:12 }}>PAYOUT CERTIFICATE</div>
                  <div style={{ fontSize:11,color:hp.txtC,marginBottom:4 }}>
                    {profile?.first_name} {profile?.last_name}
                  </div>
                  <div style={{ fontSize:28,fontWeight:900,color:hp.green }}>${parseFloat(p.amount??0).toFixed(2)}</div>
                  <div style={{ fontSize:10,color:hp.txtD,marginTop:4 }}>
                    {new Date(p.created_at ?? Date.now()).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'})}
                  </div>
                </div>
                {/* Corner seal */}
                <div style={{ position:'absolute',top:8,right:8,width:28,height:28,background:hp.green,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>✓</div>
              </div>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:13,fontWeight:700,color:hp.white }}>${parseFloat(p.amount??0).toFixed(2)} Payout</div>
                  <div style={{ fontSize:11,color:hp.txtD }}>ID: HP-{(p.id??'cert').toString().slice(0,8).toUpperCase()}</div>
                </div>
                <Btn onClick={() => downloadCert(p)} style={{ padding:'8px 16px',fontSize:12 }}>
                  ⬇ Download
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Demo certificate for traders with no payouts yet */}
      {completed.length === 0 && false && (
        <Card style={{ marginTop:20 }}>
          <div style={{ fontSize:13,fontWeight:700,color:hp.white,marginBottom:8 }}>📋 Sample Certificate</div>
          <p style={{ fontSize:12,color:hp.txtB }}>Here is what your certificate will look like after your first payout.</p>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AFFILIATE DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
export function AffiliateDashboard() {
  const { data: profile } = useQuery({ queryKey:['my-profile'], queryFn:() => api.get('/me').then(r=>r.data) });
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [customCode, setCustomCode] = useState('');
  const qc = useQueryClient();

  const { data: affiliateData, isLoading } = useQuery({
    queryKey: ['my-affiliate'],
    queryFn: () => api.get('/affiliate/me').then(r=>r.data).catch(() => null),
  });

  const affiliateCode = affiliateData?.code ?? profile?.id?.slice(0,8)?.toUpperCase() ?? 'MYCODE';
  const affiliateLink = `${window.location.origin}/register?ref=${affiliateCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(affiliateLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const createCode = async () => {
    if (!customCode.trim()) return;
    setCreating(true);
    try {
      await api.post('/affiliate/code', { code: customCode.trim().toUpperCase() });
      setNewCode(customCode.trim().toUpperCase());
      qc.invalidateQueries({ queryKey: ['my-affiliate'] });
    } catch (e: any) {
      alert(e.response?.data?.error ?? 'Could not create code. Try a different one.');
    } finally { setCreating(false); }
  };

  const stats = affiliateData?.stats ?? { clicks:0, signups:0, purchases:0, earned:0, pending:0 };

  return (
    <div>
      <h1 style={{ fontSize:22,fontWeight:800,color:hp.white,marginBottom:6 }}>Affiliate Dashboard</h1>
      <p style={{ fontSize:13,color:hp.txtC,marginBottom:24 }}>Share your link and earn commission on every challenge purchased.</p>

      {/* Stats */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:24 }}>
        {[
          {label:'Clicks',        value:stats.clicks,              icon:'👆', color:hp.blue},
          {label:'Sign Ups',      value:stats.signups,             icon:'👥', color:hp.blueL},
          {label:'Purchases',     value:stats.purchases,           icon:'🏆', color:hp.gold},
          {label:'Total Earned',  value:`$${Number(stats.earned).toFixed(2)}`,  icon:'💰', color:hp.green},
          {label:'Pending',       value:`$${Number(stats.pending).toFixed(2)}`, icon:'⏳', color:hp.gold},
        ].map(s => (
          <Card key={s.label}>
            <div style={{ fontSize:22,marginBottom:8 }}>{s.icon}</div>
            <div style={{ fontSize:22,fontWeight:800,color:s.color }}>{s.value}</div>
            <div style={{ fontSize:11,color:hp.txtD,marginTop:3 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20 }}>
        {/* Affiliate link */}
        <Card>
          <div style={{ fontSize:15,fontWeight:700,color:hp.white,marginBottom:16 }}>Your Referral Link</div>
          <div style={{ background:hp.surfB,border:`1px solid ${hp.bordA}`,borderRadius:9,padding:'12px 14px',marginBottom:12,display:'flex',alignItems:'center',gap:10 }}>
            <span style={{ fontSize:12,color:hp.blueL,fontFamily:'monospace',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{affiliateLink}</span>
            <button onClick={copyLink} style={{ flexShrink:0,padding:'6px 14px',background:copied?'rgba(16,185,129,0.15)':'rgba(79,140,247,0.15)',border:`1px solid ${copied?hp.green:hp.blue}`,borderRadius:6,fontSize:12,color:copied?hp.green:hp.blue,cursor:'pointer',fontFamily:'inherit',fontWeight:700,transition:'all .2s' }}>
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'rgba(79,140,247,0.06)',border:`1px solid rgba(79,140,247,0.15)`,borderRadius:8 }}>
            <span style={{ fontSize:16 }}>🔖</span>
            <div>
              <div style={{ fontSize:13,fontWeight:700,color:hp.white }}>Your Code: <span style={{ color:hp.blueL,fontFamily:'monospace' }}>{affiliateCode}</span></div>
              <div style={{ fontSize:11,color:hp.txtC }}>Traders can also enter this code at registration.</div>
            </div>
          </div>

          {/* Custom code creator */}
          <div style={{ marginTop:16,paddingTop:16,borderTop:`1px solid ${hp.bordA}` }}>
            <div style={{ fontSize:13,fontWeight:700,color:hp.white,marginBottom:10 }}>Create Custom Code</div>
            <div style={{ display:'flex',gap:8 }}>
              <input value={customCode} onChange={e=>setCustomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''))} placeholder="e.g. JOHN25"
                maxLength={12}
                style={{ flex:1,background:'rgba(255,255,255,.05)',color:hp.white,border:`1px solid ${hp.bordA}`,borderRadius:8,padding:'10px 14px',fontSize:13,outline:'none',fontFamily:'monospace' }}
                onFocus={e=>e.target.style.borderColor=hp.blue} onBlur={e=>e.target.style.borderColor=hp.bordA}/>
              <Btn onClick={createCode} disabled={creating||!customCode.trim()} style={{ padding:'10px 18px',fontSize:13 }}>
                {creating ? '…' : 'Create'}
              </Btn>
            </div>
            {newCode && <div style={{ marginTop:8,fontSize:12,color:hp.green }}>✅ Code "{newCode}" created! It's now your active referral code.</div>}
          </div>
        </Card>

        {/* Commission info */}
        <Card>
          <div style={{ fontSize:15,fontWeight:700,color:hp.white,marginBottom:16 }}>Commission Structure</div>
          <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
            {[
              {tier:'Starter',ref:'1–10 referrals',rate:'20%',color:hp.blue},
              {tier:'Growth', ref:'11–50 referrals',rate:'25%',color:hp.blueL},
              {tier:'Elite',  ref:'51+ referrals',  rate:'30%',color:hp.gold},
            ].map(t => (
              <div key={t.tier} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:hp.surfB,border:`1px solid ${hp.bordA}`,borderRadius:10 }}>
                <div>
                  <div style={{ fontSize:14,fontWeight:700,color:t.color }}>{t.tier}</div>
                  <div style={{ fontSize:11,color:hp.txtD }}>{t.ref}</div>
                </div>
                <div style={{ fontSize:22,fontWeight:800,color:t.color }}>{t.rate}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:16,padding:'12px',background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:8,fontSize:12,color:hp.green }}>
            💸 Commissions are paid monthly. Minimum withdrawal: $50.
          </div>
        </Card>
      </div>

      {/* Referral table */}
      <Card style={{ marginTop:20 }}>
        <div style={{ fontSize:15,fontWeight:700,color:hp.white,marginBottom:16 }}>Recent Referrals</div>
        {!affiliateData?.referrals?.length ? (
          <Empty icon="🔗" message="No referrals yet" sub="Share your link to start earning commissions. Every challenge purchase earns you up to 30%."/>
        ) : (
          <table style={{ width:'100%',borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:hp.surfB }}>
                {['Date','Trader','Plan','Fee','Commission','Status'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:700,color:hp.txtD,letterSpacing:'.08em',borderBottom:`1px solid ${hp.bordA}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(affiliateData.referrals as any[]).map((r: any, i: number) => (
                <tr key={i} style={{ borderBottom:`1px solid ${hp.bordA}` }}>
                  <td style={{ padding:'10px 14px',fontSize:12,color:hp.txtB }}>{new Date(r.date).toLocaleDateString()}</td>
                  <td style={{ padding:'10px 14px',fontSize:13,color:hp.txtA }}>{r.email}</td>
                  <td style={{ padding:'10px 14px',fontSize:12,color:hp.txtC }}>{r.plan}</td>
                  <td style={{ padding:'10px 14px',fontSize:13,color:hp.white }}>${r.fee}</td>
                  <td style={{ padding:'10px 14px',fontSize:13,fontWeight:700,color:hp.green }}>${r.commission}</td>
                  <td style={{ padding:'10px 14px' }}><Badge label={r.status} color={r.status==='paid'?hp.green:hp.gold}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Share tools */}
      <Card style={{ marginTop:20 }}>
        <div style={{ fontSize:15,fontWeight:700,color:hp.white,marginBottom:14 }}>Share Your Link</div>
        <div style={{ display:'flex',gap:10,flexWrap:'wrap' }}>
          {[
            {label:'Twitter/X', icon:'𝕏', url:`https://twitter.com/intent/tweet?text=Trade%20with%20Hola%20Prime%20%E2%80%94%20the%20fastest%20payout%20prop%20firm!%20Use%20my%20link%3A%20${encodeURIComponent(affiliateLink)}`},
            {label:'WhatsApp', icon:'💬', url:`https://wa.me/?text=${encodeURIComponent(`Join Hola Prime — fastest payout prop firm! ${affiliateLink}`)}`},
            {label:'Telegram', icon:'✈️', url:`https://t.me/share/url?url=${encodeURIComponent(affiliateLink)}&text=${encodeURIComponent('Trade with Hola Prime!')}`},
          ].map(s => (
            <a key={s.label} href={s.url} target="_blank" rel="noreferrer"
              style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'9px 18px',background:hp.surfB,border:`1px solid ${hp.bordA}`,borderRadius:8,textDecoration:'none',fontSize:13,color:hp.txtA,fontWeight:500,transition:'all .15s' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=hp.blue;(e.currentTarget as HTMLElement).style.color=hp.white;}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=hp.bordA;(e.currentTarget as HTMLElement).style.color=hp.txtA;}}>
              <span>{s.icon}</span>{s.label}
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// KYC
// ═══════════════════════════════════════════════════════════════════════════════
export function KYC() {
  const { data: profile } = useQuery({ queryKey:['my-profile'], queryFn:() => api.get('/me').then(r=>r.data) });
  const submit = useMutation({ mutationFn: () => api.post('/kyc') });
  const statusMessages: Record<string,{icon:string;title:string;desc:string;color:string}> = {
    not_submitted: {icon:'🪪',title:'Not Submitted',desc:'Submit your identity documents to unlock payouts.',color:hp.txtB},
    pending:       {icon:'⏳',title:'Under Review',desc:'Your documents are being reviewed. Usually 1–2 business days.',color:hp.gold},
    under_review:  {icon:'🔍',title:'Under Review',desc:'Our compliance team is reviewing your documents.',color:hp.blue},
    approved:      {icon:'✅',title:'Verified',desc:'Your identity is verified. You can now request payouts.',color:hp.green},
    rejected:      {icon:'❌',title:'Rejected',desc:'Your KYC was rejected. Please contact support for details.',color:hp.red},
  };
  const kyc = profile?.kyc_status ?? 'not_submitted';
  const s = statusMessages[kyc] ?? statusMessages.not_submitted;
  return (
    <div style={{ maxWidth:560 }}>
      <h1 style={{ fontSize:22,fontWeight:800,color:hp.white,marginBottom:20 }}>Identity Verification</h1>
      <Card>
        <div style={{ textAlign:'center',padding:'28px 0',marginBottom:20 }}>
          <div style={{ fontSize:52,marginBottom:10 }}>{s.icon}</div>
          <Badge label={s.title} color={s.color}/>
          <p style={{ fontSize:14,color:hp.txtB,marginTop:12,maxWidth:340,margin:'12px auto 0' }}>{s.desc}</p>
        </div>
        {kyc === 'not_submitted' && (
          <div>
            <div style={{ padding:'14px',background:hp.surfB,borderRadius:8,marginBottom:16 }}>
              <div style={{ fontSize:13,fontWeight:700,color:hp.white,marginBottom:8 }}>You'll need:</div>
              {['Government-issued photo ID (passport or national ID)','Proof of address (utility bill or bank statement, ≤90 days old)','A selfie holding your ID'].map((item,i) => (
                <div key={i} style={{ display:'flex',gap:8,alignItems:'flex-start',marginBottom:6 }}>
                  <span style={{ color:hp.green,flexShrink:0 }}>✓</span>
                  <span style={{ fontSize:13,color:hp.txtA }}>{item}</span>
                </div>
              ))}
            </div>
            <div style={{ padding:'10px 14px',background:'rgba(79,140,247,0.08)',border:'1px solid rgba(79,140,247,0.2)',borderRadius:8,marginBottom:14,display:'flex',alignItems:'center',gap:8 }}>
              <span style={{ width:6,height:6,borderRadius:'50%',background:hp.blue,animation:'pulse 2s infinite',display:'inline-block' }}/>
              <span style={{ fontSize:12,color:hp.blueL,fontWeight:600 }}>Powered by Sumsub — Bank-grade identity verification</span>
            </div>
            <Btn onClick={() => submit.mutate()} disabled={submit.isPending} style={{ width:'100%',justifyContent:'center' }}>
              {submit.isPending ? 'Starting…' : 'Start Verification'}
            </Btn>
            {submit.isSuccess && <div style={{ marginTop:10,padding:'8px 12px',background:'rgba(16,185,129,0.1)',border:`1px solid rgba(16,185,129,0.25)`,borderRadius:6,fontSize:12,color:hp.green }}>✅ Verification started. Our team will contact you within 24 hours.</div>}
          </div>
        )}
        {kyc === 'rejected' && (
          <Link to="/support" style={{ textDecoration:'none' }}><Btn variant="outline" style={{ width:'100%',justifyContent:'center' }}>Contact Support</Btn></Link>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════════════════════════════════════
export function Profile() {
  const { data: profile, refetch } = useQuery({ queryKey:['my-profile'], queryFn:() => api.get('/me').then(r=>r.data) });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const save = useMutation({ mutationFn:(data: any) => api.patch('/me', data), onSuccess:()=>{setEditing(false);refetch();} });
  useEffect(() => { if (profile) setForm({ firstName:profile.first_name,lastName:profile.last_name,phone:profile.phone }); }, [profile]);
  const inp = { width:'100%',background:'rgba(255,255,255,.05)',color:hp.white,border:`1px solid ${hp.bordA}`,borderRadius:8,padding:'11px 14px',fontSize:14,outline:'none',fontFamily:'inherit' } as React.CSSProperties;
  return (
    <div style={{ maxWidth:600 }}>
      <h1 style={{ fontSize:22,fontWeight:800,color:hp.white,marginBottom:20 }}>My Profile</h1>
      <Card>
        <div style={{ display:'flex',alignItems:'center',gap:16,marginBottom:24,paddingBottom:20,borderBottom:`1px solid ${hp.bordA}` }}>
          <div style={{ width:56,height:56,borderRadius:'50%',background:`linear-gradient(135deg,${hp.blue},${hp.blueD})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:700,color:'#fff' }}>
            {(profile?.first_name?.[0]??'?')}{(profile?.last_name?.[0]??'')}
          </div>
          <div>
            <div style={{ fontSize:17,fontWeight:700,color:hp.white }}>{profile?.first_name} {profile?.last_name}</div>
            <div style={{ fontSize:13,color:hp.txtC }}>{profile?.email}</div>
          </div>
          <Btn variant="ghost" onClick={() => setEditing(e => !e)} style={{ marginLeft:'auto',padding:'8px 16px',fontSize:13 }}>
            {editing ? 'Cancel' : '✏️ Edit'}
          </Btn>
        </div>
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          {[
            {label:'First Name', key:'firstName', val:profile?.first_name},
            {label:'Last Name',  key:'lastName',  val:profile?.last_name},
            {label:'Email',      key:'email',     val:profile?.email, readonly:true},
            {label:'Phone',      key:'phone',     val:profile?.phone},
            {label:'Country',    key:'country',   val:profile?.country_code, readonly:true},
            {label:'KYC Status', key:'kyc',       val:profile?.kyc_status ?? 'not submitted', readonly:true},
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize:12,color:hp.txtC,display:'block',marginBottom:5 }}>{f.label}</label>
              {editing && !f.readonly ? (
                <input value={form[f.key]??''} onChange={e=>setForm((p: any)=>({...p,[f.key]:e.target.value}))} style={inp}
                  onFocus={(e: React.FocusEvent<HTMLInputElement>)=>e.target.style.borderColor=hp.blue}
                  onBlur={(e: React.FocusEvent<HTMLInputElement>)=>e.target.style.borderColor=hp.bordA}/>
              ) : (
                <div style={{ fontSize:14,color:f.readonly?hp.txtC:hp.txtA,padding:'10px 0',borderBottom:`1px solid ${hp.bordA}` }}>{f.val ?? '—'}</div>
              )}
            </div>
          ))}
          {editing && (
            <Btn onClick={() => save.mutate(form)} disabled={save.isPending} style={{ width:'100%',justifyContent:'center',marginTop:8 }}>
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </Btn>
          )}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPORT
// ═══════════════════════════════════════════════════════════════════════════════
export function Support() {
  const [form, setForm] = useState({subject:'',message:'',priority:'normal'});
  const [sent, setSent] = useState(false);
  const up = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => setForm(p => ({...p,[k]:e.target.value}));
  const inp = { width:'100%',background:'rgba(255,255,255,.05)',color:hp.white,border:`1px solid ${hp.bordA}`,borderRadius:8,padding:'11px 14px',fontSize:14,outline:'none',fontFamily:'inherit' } as React.CSSProperties;
  return (
    <div>
      <h1 style={{ fontSize:22,fontWeight:800,color:hp.white,marginBottom:20 }}>Support</h1>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20 }}>
        <Card>
          <div style={{ fontSize:15,fontWeight:700,color:hp.white,marginBottom:16 }}>Submit a Ticket</div>
          {sent ? (
            <div style={{ textAlign:'center',padding:'28px 0' }}>
              <div style={{ fontSize:40,marginBottom:12 }}>✅</div>
              <div style={{ fontSize:15,fontWeight:700,color:hp.white,marginBottom:6 }}>Ticket Submitted!</div>
              <div style={{ fontSize:13,color:hp.txtB }}>We'll reply within 2 hours. For urgent issues, join our Discord.</div>
            </div>
          ) : (
            <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
              <div>
                <label style={{ fontSize:12,color:hp.txtC,display:'block',marginBottom:5 }}>Subject</label>
                <select value={form.subject} onChange={up('subject')} style={{ ...inp,cursor:'pointer' }}>
                  <option value="">Select a topic</option>
                  <option>Challenge & Evaluation</option>
                  <option>Payout Request</option>
                  <option>Account Credentials</option>
                  <option>Technical Issue</option>
                  <option>KYC Verification</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:12,color:hp.txtC,display:'block',marginBottom:5 }}>Priority</label>
                <select value={form.priority} onChange={up('priority')} style={{ ...inp,cursor:'pointer' }}>
                  <option value="normal">Normal</option>
                  <option value="high">High — Payout related</option>
                  <option value="urgent">Urgent — Account at risk</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:12,color:hp.txtC,display:'block',marginBottom:5 }}>Message</label>
                <textarea value={form.message} onChange={up('message')} rows={5} placeholder="Describe your issue in detail…"
                  style={{ ...inp,resize:'vertical' }}
                  onFocus={(e: React.FocusEvent<HTMLTextAreaElement>)=>e.target.style.borderColor=hp.blue}
                  onBlur={(e: React.FocusEvent<HTMLTextAreaElement>)=>e.target.style.borderColor=hp.bordA}/>
              </div>
              <Btn disabled={!form.subject||!form.message} onClick={() => setSent(true)} style={{ width:'100%',justifyContent:'center' }}>
                Submit Ticket
              </Btn>
            </div>
          )}
        </Card>
        <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
          {[
            {icon:'💬',t:'Live Chat',d:'24/7 chat with real support agents.',href:'#'},
            {icon:'🎮',t:'Discord',d:'Join 5,000+ traders. Fastest response.',href:'https://discord.com/invite/hjDcUcEfgA'},
            {icon:'✉️',t:'Email',d:'support@holaprime.com — replies in 2hrs.',href:'mailto:support@holaprime.com'},
          ].map(c => (
            <Card key={c.t} style={{ display:'flex',gap:12,alignItems:'center' }}>
              <span style={{ fontSize:24,flexShrink:0 }}>{c.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14,fontWeight:700,color:hp.white }}>{c.t}</div>
                <div style={{ fontSize:12,color:hp.txtB }}>{c.d}</div>
              </div>
              <a href={c.href} target="_blank" rel="noreferrer"
                style={{ padding:'7px 14px',borderRadius:8,background:'rgba(79,140,247,0.1)',border:'1px solid rgba(79,140,247,0.25)',color:hp.blueL,textDecoration:'none',fontSize:12,fontWeight:600 }}>Open</a>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════════════════════════
export function Leaderboard() {
  const { data: board = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.get('/leaderboard').then(r=>r.data).catch(()=>[
      {rank:1,name:'James K.',country:'🇬🇧',profit:'+34.2%',amount:'$18,450',account:'$50K'},
      {rank:2,name:'Ahmad R.',country:'🇦🇪',profit:'+28.7%',amount:'$14,350',account:'$50K'},
      {rank:3,name:'Priya M.',country:'🇮🇳',profit:'+25.1%',amount:'$25,100',account:'$100K'},
      {rank:4,name:'Kai T.',country:'🇩🇪',profit:'+22.8%',amount:'$11,400',account:'$50K'},
      {rank:5,name:'Lucas B.',country:'🇧🇷',profit:'+19.4%',amount:'$9,700',account:'$50K'},
    ]),
  });
  const medals: Record<number,string> = {1:'🥇',2:'🥈',3:'🥉'};
  return (
    <div>
      <h1 style={{ fontSize:22,fontWeight:800,color:hp.white,marginBottom:20 }}>Leaderboard</h1>
      <Card style={{ padding:0,overflow:'hidden' }}>
        <table style={{ width:'100%',borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:hp.surfB }}>
              {['Rank','Trader','Country','Account','Profit %','Amount Earned'].map(h=>(
                <th key={h} style={{ padding:'12px 16px',textAlign:'left',fontSize:11,fontWeight:700,color:hp.txtD,letterSpacing:'.08em',borderBottom:`1px solid ${hp.bordA}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(board as any[]).map((r: any,i: number) => (
              <tr key={i} style={{ borderBottom:`1px solid ${hp.bordA}`,background:i<3?`rgba(79,140,247,0.04)`:'' }}>
                <td style={{ padding:'13px 16px',fontSize:18 }}>{medals[r.rank] ?? `#${r.rank}`}</td>
                <td style={{ padding:'13px 16px',fontSize:14,fontWeight:600,color:hp.white }}>{r.name}</td>
                <td style={{ padding:'13px 16px',fontSize:16 }}>{r.country}</td>
                <td style={{ padding:'13px 16px',fontSize:13,color:hp.txtC }}>{r.account}</td>
                <td style={{ padding:'13px 16px',fontSize:14,fontWeight:700,color:hp.green }}>{r.profit}</td>
                <td style={{ padding:'13px 16px',fontSize:14,fontWeight:700,color:hp.white }}>{r.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOURNAMENTS
// ═══════════════════════════════════════════════════════════════════════════════
export function TournamentsPage() {
  const { data: ts = [], isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => api.get('/tournaments').then(r=>r.data).catch(()=>[]),
  });
  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22,fontWeight:800,color:hp.white }}>Tournaments</h1>
          <p style={{ fontSize:13,color:hp.txtC,marginTop:2 }}>Compete against traders worldwide and win cash prizes.</p>
        </div>
        <a href="https://discord.com/invite/hjDcUcEfgA" target="_blank" rel="noreferrer" style={{ textDecoration:'none' }}>
          <Btn variant="outline">Join Discord to Register</Btn>
        </a>
      </div>
      {(ts as any[]).length === 0 ? (
        <Card>
          <div style={{ textAlign:'center',padding:'48px 0' }}>
            <div style={{ fontSize:48,marginBottom:14 }}>🏆</div>
            <div style={{ fontSize:16,fontWeight:700,color:hp.white,marginBottom:8 }}>Monthly Trading Competition</div>
            <div style={{ fontSize:13,color:hp.txtB,maxWidth:420,margin:'0 auto',marginBottom:20 }}>
              Compete with traders worldwide for a share of $50,000+ in monthly prizes. Rankings based on profit percentage — fair for all account sizes.
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,maxWidth:400,margin:'0 auto' }}>
              {[['🥇 1st','$10,000'],['🥈 2nd','$5,000'],['🥉 3rd','$2,500']].map(([r,p])=>(
                <div key={r} style={{ padding:'14px',background:hp.surfB,border:`1px solid ${hp.bordA}`,borderRadius:10,textAlign:'center' }}>
                  <div style={{ fontSize:13,color:hp.txtD }}>{r}</div>
                  <div style={{ fontSize:16,fontWeight:800,color:hp.white }}>{p}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:16 }}>
          {(ts as any[]).map((t: any,i: number) => (
            <Card key={i} style={{ borderTop:`2px solid ${hp.blue}` }}>
              <div style={{ fontSize:15,fontWeight:700,color:hp.white,marginBottom:4 }}>{t.name}</div>
              <div style={{ fontSize:12,color:hp.txtC,marginBottom:12 }}>{t.start_date} – {t.end_date}</div>
              <div style={{ fontSize:22,fontWeight:800,color:hp.gold,marginBottom:12 }}>{t.prize_pool}</div>
              <Badge label={t.status ?? 'active'} color={hp.green}/>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
