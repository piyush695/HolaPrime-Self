import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// ── Brand tokens ──────────────────────────────────────────────────────────────
const B = {
  bg0:'#080D18', bg1:'#0B1120', bg2:'#0F1629', bg3:'#141D32', bg4:'#1A2440',
  bord:'#1E2A3B', bordL:'#253147',
  blue:'#4F8CF7', blueD:'#1D4ED8', blueL:'#93C5FD',
  white:'#FFFFFF', txtA:'#F1F5F9', txtB:'#CBD5E1', txtC:'#94A3B8', txtD:'#64748B',
  green:'#10B981', greenL:'#34D399', red:'#EF4444', gold:'#F59E0B',
};

const CDN = 'https://d3e6em9gfrqmqr.cloudfront.net/corporate';

// ── Shared CSS ────────────────────────────────────────────────────────────────
const PAGE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#0B1120;color:#F1F5F9;-webkit-font-smoothing:antialiased;overflow-x:hidden}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#080D18}::-webkit-scrollbar-thumb{background:#253147;border-radius:3px}
.btn-p{display:inline-flex;align-items:center;gap:8px;padding:13px 28px;background:linear-gradient(135deg,#4F8CF7,#1D4ED8);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;text-decoration:none;box-shadow:0 4px 16px rgba(79,140,247,.35);transition:all .2s}
.btn-p:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(79,140,247,.5)}
.btn-o{display:inline-flex;align-items:center;gap:8px;padding:12px 24px;background:rgba(79,140,247,.08);color:#93C5FD;border:1px solid rgba(79,140,247,.3);border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;text-decoration:none;transition:all .2s}
.btn-o:hover{background:rgba(79,140,247,.15);border-color:rgba(79,140,247,.6);color:#fff}
.rule-row{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid #1E2A3B}
.rule-row:last-child{border-bottom:none}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.pg-hero{animation:fadeUp .5s ease}
.sz-btn{transition:all .18s;cursor:pointer}
.sz-btn.on{background:#4F8CF7!important;color:#fff!important;border-color:#4F8CF7!important}
.sz-btn:not(.on):hover{border-color:#4F8CF7!important;color:#93C5FD!important}
.step-btn{transition:all .18s;cursor:pointer}
.step-btn.on{background:linear-gradient(135deg,#4F8CF7,#1D4ED8)!important;color:#fff!important;border-color:transparent!important}
.faq-border{border-bottom:1px solid #1E2A3B}
.card-h{transition:transform .25s,border-color .25s}
.card-h:hover{transform:translateY(-3px);border-color:#253147!important}
@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
`;

// ── Nav items with full real paths ────────────────────────────────────────────
const NAV_ITEMS = [
  {label:'Forex',menu:[
    {hd:'Plans',items:[
      ['Pro Challenge','1-step & 2-step from $59','/forex/pro-challenge'],
      ['Prime Challenge','From $39','/forex/prime-challenge'],
      ['One Challenge','Single phase, fast track','/forex/one-challenge'],
      ['Direct Account','Instant funding','/forex/direct-account'],
      ['Scaling Plan','Grow up to $4M','/forex/scaling'],
      ['Trading Rules','Full guidelines','/forex/trading-rules'],
    ]},
    {hd:'Trading',items:[
      ['Trading Platforms','MT5, cTrader & more','/forex/trading-platforms'],
      ['Transparency Report','Real payout data','/forex/transparency-report'],
      ['Trading Tools','Indicators & resources','/forex/trading-tools'],
      ['FAQs','Common questions','/forex/faq'],
    ]},
  ]},
  {label:'Futures',tag:'New',menu:[
    {hd:'Futures Plans',items:[
      ['Prime Challenge','1-step challenge','/futures/prime-challenge'],
      ['Direct Account','Instant funding','/futures/direct-account'],
      ['Instruments','50+ instruments','/futures/instruments'],
      ['Trading Rules','Futures guidelines','/futures/trading-rules'],
      ['FAQs','Common questions','/futures/faq'],
    ]},
  ]},
  {label:'About',menu:[
    {hd:'Company',items:[
      ['Who We Are','Our story & mission','/about'],
      ['Our Team','Meet the people','/team'],
      ['Awards','Fastest payout firm','/awards'],
      ['1-Hour Payouts','Our guarantee','/1-hour-payouts'],
      ['Payout Report','Real payout data','/payout-report'],
      ['News & Media','Press & announcements','/news'],
      ['Careers',"We're hiring",'/careers'],
      ['Contact Us','24/7 support','/contact'],
    ]},
  ]},
  {label:'Affiliate',menu:[
    {hd:'Partners',items:[
      ['Affiliate Program','Earn per referral','/affiliate'],
      ['Affiliate FAQs','Questions answered','/affiliate/faq'],
      ['Affiliate Login','Your dashboard','/affiliate/login'],
    ]},
  ]},
  {label:'More',menu:[
    {hd:'Explore',items:[
      ['Prime Academy','Free trading education','/academy'],
      ['Competition','Win cash prizes','/competition'],
      ['Risk Control','Our risk framework','/risk-control'],
      ['Blog','Articles & insights','/blog'],
    ]},
  ]},
];

// ── Shared Navbar ─────────────────────────────────────────────────────────────
export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [hover, setHover] = useState<string|null>(null);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', h); return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <>
      <style>{PAGE_CSS}</style>
      <nav style={{ position:'sticky',top:0,zIndex:999,background:scrolled?'rgba(11,17,32,.97)':'rgba(11,17,32,.8)',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',borderBottom:`1px solid ${scrolled?B.bord:'transparent'}`,transition:'all .3s' }}>
        <div style={{ maxWidth:1280,margin:'0 auto',padding:'0 28px',display:'flex',alignItems:'center',height:68 }}>
          <Link to="/" style={{ textDecoration:'none',flexShrink:0 }}>
            <img src="/logo-white.png" alt="hola prime" style={{ height:52,width:'auto',objectFit:'contain',display:'block' }}/>
          </Link>
          <div style={{ display:'flex',alignItems:'center',gap:0,marginLeft:44,flex:1 }}>
            {NAV_ITEMS.map(item => (
              <div key={item.label} style={{ position:'relative' }} onMouseEnter={() => setHover(item.label)} onMouseLeave={() => setHover(null)}>
                <button style={{ background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:14,fontWeight:500,color:hover===item.label?B.white:B.txtC,padding:'8px 14px',borderRadius:8,display:'flex',alignItems:'center',gap:5,transition:'color .15s',whiteSpace:'nowrap' }}>
                  {item.label}
                  {(item as any).tag && <span style={{ fontSize:9,padding:'2px 6px',background:B.blue,color:'#fff',borderRadius:20,fontWeight:800,marginLeft:2 }}>{(item as any).tag}</span>}
                  <span style={{ fontSize:9,color:B.txtD,transition:'transform .2s',transform:hover===item.label?'rotate(180deg)':'none',display:'inline-block' }}>▼</span>
                </button>
                {hover===item.label && item.menu && (
                  <div style={{ position:'absolute',top:'100%',left:'50%',transform:'translateX(-50%)',marginTop:8,background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14,padding:'20px 22px',minWidth:460,boxShadow:'0 20px 60px rgba(0,0,0,.8)',display:'flex',gap:24,animation:'fadeUp .15s ease' }}>
                    {item.menu.map(sec => (
                      <div key={sec.hd} style={{ flex:1 }}>
                        <div style={{ fontSize:10,fontWeight:800,color:B.blue,letterSpacing:'.14em',marginBottom:12 }}>{sec.hd.toUpperCase()}</div>
                        {sec.items.map(([lbl,sub,href]) => (
                          <Link key={lbl} to={href} style={{ textDecoration:'none',display:'block',padding:'8px 10px',borderRadius:8,marginBottom:2,transition:'background .12s' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = B.bg3}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                            <div style={{ fontSize:13,fontWeight:600,color:B.txtA }}>{lbl}</div>
                            <div style={{ fontSize:11,color:B.txtD,marginTop:1 }}>{sub}</div>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display:'flex',alignItems:'center',gap:10,flexShrink:0 }}>
            <a href="https://discord.com/invite/hjDcUcEfgA" target="_blank" rel="noreferrer" className="btn-o" style={{ padding:'8px 16px',fontSize:13 }}>Join Discord</a>
            <Link to="/login" style={{ padding:'8px 16px',borderRadius:8,textDecoration:'none',fontSize:13,color:B.txtC,fontWeight:500,transition:'color .15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = B.white}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = B.txtC}>Login</Link>
            <Link to="/register" className="btn-p" style={{ fontSize:14,padding:'10px 24px' }}>Get Funded</Link>
          </div>
        </div>
      </nav>
    </>
  );
}

// ── Shared Footer ─────────────────────────────────────────────────────────────
export function SiteFooter() {
  const cols = [
    {t:'Forex',ls:[['Pro Challenge','/forex/pro-challenge'],['Prime Challenge','/forex/prime-challenge'],['One Challenge','/forex/one-challenge'],['Direct Account','/forex/direct-account'],['Scaling Plan','/forex/scaling']]},
    {t:'Futures',ls:[['Prime Challenge','/futures/prime-challenge'],['Direct Account','/futures/direct-account'],['Instruments','/futures/instruments'],['Trading Rules','/futures/trading-rules']]},
    {t:'Company',ls:[['About Us','/about'],['Our Team','/team'],['Awards','/awards'],['Contact Us','/contact'],['Careers','/careers'],['News & Media','/news']]},
    {t:'Resources',ls:[['Prime Academy','/academy'],['Transparency Report','/forex/transparency-report'],['Risk Control','/risk-control'],['Blog','/blog'],['Trading Tools','/forex/trading-tools']]},
    {t:'Affiliate',ls:[['Partner Program','/affiliate'],['Affiliate FAQs','/affiliate/faq'],['Affiliate Login','/affiliate/login']]},
  ];
  return (
    <footer style={{ background:B.bg0,borderTop:`1px solid ${B.bord}`,padding:'60px 28px 32px' }}>
      <div style={{ maxWidth:1280,margin:'0 auto' }}>
        <div style={{ display:'grid',gridTemplateColumns:'220px repeat(5,1fr)',gap:28,marginBottom:40 }}>
          <div>
            <Link to="/"><img src="/logo-white.png" alt="hola prime" style={{ height:48,width:'auto',objectFit:'contain',marginBottom:16,display:'block' }}/></Link>
            <p style={{ fontSize:12,color:B.txtD,lineHeight:1.8,marginBottom:16 }}>The most transparent prop firm. Built by traders, for traders. FSC Licensed · GB24203729.</p>
            <div style={{ display:'flex',gap:8 }}>
              {['💬','𝕏','▶️','📷'].map((ic,i) => (
                <a key={i} href="#" style={{ width:32,height:32,borderRadius:8,background:B.bg2,border:`1px solid ${B.bord}`,display:'flex',alignItems:'center',justifyContent:'center',textDecoration:'none',fontSize:14,transition:'all .15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor=B.blue; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor=B.bord; }}>{ic}</a>
              ))}
            </div>
          </div>
          {cols.map(col => (
            <div key={col.t}>
              <div style={{ fontSize:9,fontWeight:800,color:B.blue,letterSpacing:'.15em',marginBottom:14 }}>{col.t.toUpperCase()}</div>
              {col.ls.map(([label,path]) => (
                <Link key={label} to={path} style={{ display:'block',fontSize:13,color:B.txtD,textDecoration:'none',marginBottom:9,transition:'color .15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = B.txtA}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = B.txtD}>{label}</Link>
              ))}
            </div>
          ))}
        </div>
        <div style={{ paddingTop:22,borderTop:`1px solid ${B.bord}`,display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:24,flexWrap:'wrap' }}>
          <p style={{ fontSize:10,color:B.txtD,lineHeight:1.8,maxWidth:700 }}>
            <strong style={{ color:B.txtC }}>RISK WARNING:</strong> Hola Prime accounts are simulated and do not represent live trading. Trading involves significant risk. Past performance is not indicative of future results. FSC Licensed · GB24203729. Not available in all jurisdictions.
          </p>
          <div style={{ fontSize:11,color:B.txtD,textAlign:'right' }}>
            <div>© 2025 Hola Prime Limited</div>
            <div style={{ marginTop:4,display:'flex',gap:12 }}>
              {['Privacy Policy','Terms of Service','Cookie Policy'].map(l => (
                <a key={l} href="#" style={{ color:B.txtD,textDecoration:'none',transition:'color .15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color=B.txtB}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color=B.txtD}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Page wrapper ──────────────────────────────────────────────────────────────
function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background:B.bg1,minHeight:'100vh',fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
      <SiteNav/>
      {children}
      <SiteFooter/>
    </div>
  );
}

// ── Page Hero ─────────────────────────────────────────────────────────────────
function PageHero({ badge, title, subtitle, cta='Get Funded', ctaLink='/register', ctaSecondary='', ctaSecondaryLink='' }: any) {
  return (
    <section style={{ background:B.bg0,padding:'80px 28px 72px',position:'relative',overflow:'hidden' }}>
      <div style={{ position:'absolute',top:0,right:0,width:'50%',height:'100%',background:`radial-gradient(ellipse at 80% 30%,rgba(79,140,247,0.08),transparent 70%)`,pointerEvents:'none' }}/>
      <div style={{ maxWidth:1280,margin:'0 auto',position:'relative' }} className="pg-hero">
        <div style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'5px 14px',background:'rgba(79,140,247,0.1)',border:'1px solid rgba(79,140,247,0.25)',borderRadius:50,marginBottom:24 }}>
          <span style={{ width:6,height:6,borderRadius:'50%',background:B.blue,animation:'pulse 2s infinite' }}/>
          <span style={{ fontSize:10,fontWeight:700,color:B.blueL,letterSpacing:'.1em' }}>{badge}</span>
        </div>
        <h1 style={{ fontSize:'clamp(36px,5.5vw,72px)',fontWeight:800,color:B.white,lineHeight:1.05,letterSpacing:'-.03em',marginBottom:18,maxWidth:800 }}>{title}</h1>
        <p style={{ fontSize:18,color:B.txtB,lineHeight:1.7,maxWidth:580,marginBottom:32 }}>{subtitle}</p>
        <div style={{ display:'flex',gap:14,flexWrap:'wrap' }}>
          <Link to={ctaLink} className="btn-p" style={{ fontSize:15,padding:'14px 32px' }}>{cta} →</Link>
          {ctaSecondary && <Link to={ctaSecondaryLink} className="btn-o" style={{ fontSize:15,padding:'13px 28px' }}>{ctaSecondary}</Link>}
        </div>
      </div>
    </section>
  );
}

// ── Challenge Configurator ────────────────────────────────────────────────────
function ChallengeConfigurator({ name, tag, desc, steps, sizes, rules1, rules2 }: any) {
  const [aS, setAS] = useState(0);
  const [aSz, setASz] = useState(2);
  const sd = sizes[aSz] ?? sizes[0];
  const price = aS === 0 ? sd.p1 : sd.p2;
  const rules = aS === 0 ? rules1 : (rules2?.length ? rules2 : rules1);
  return (
    <div style={{ background:B.bg2,borderRadius:20,border:`1px solid ${B.bord}`,overflow:'hidden' }}>
      <div style={{ height:2,background:`linear-gradient(90deg,${B.blue},${B.bg2})` }}/>
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr' }}>
        <div style={{ padding:'36px 40px',borderRight:`1px solid ${B.bord}` }}>
          <div style={{ display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',background:'rgba(79,140,247,0.1)',border:'1px solid rgba(79,140,247,0.25)',borderRadius:4,marginBottom:16 }}>
            <span style={{ fontSize:9,fontWeight:800,color:B.blueL,letterSpacing:'.1em' }}>{tag}</span>
          </div>
          <h3 style={{ fontSize:26,fontWeight:800,color:B.white,marginBottom:8 }}>{name}</h3>
          <p style={{ fontSize:14,color:B.txtC,marginBottom:24,lineHeight:1.65 }}>{desc}</p>
          {steps?.length > 1 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:10,fontWeight:700,color:B.txtD,letterSpacing:'.1em',marginBottom:10 }}>CHALLENGE TYPE</div>
              <div style={{ display:'flex',gap:8 }}>
                {steps.map((s: string, i: number) => (
                  <button key={s} onClick={() => setAS(i)} className={`step-btn ${i===aS?'on':''}`}
                    style={{ padding:'9px 22px',borderRadius:8,border:`1px solid ${i===aS?B.blue:B.bordL}`,background:'transparent',color:i===aS?'#fff':B.txtC,fontFamily:'inherit',fontSize:13,fontWeight:600 }}>{s}</button>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:10,fontWeight:700,color:B.txtD,letterSpacing:'.1em',marginBottom:10 }}>ACCOUNT SIZE</div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
              {sizes.map((s: any, i: number) => (
                <button key={s.l} onClick={() => setASz(i)} className={`sz-btn ${i===aSz?'on':''}`}
                  style={{ padding:'9px 16px',borderRadius:8,border:`1px solid ${i===aSz?B.blue:B.bordL}`,background:'transparent',color:i===aSz?'#fff':B.txtC,fontFamily:'inherit',fontSize:13,fontWeight:600 }}>${s.l}</button>
              ))}
            </div>
          </div>
          <div style={{ padding:'18px 22px',background:'rgba(79,140,247,0.06)',border:'1px solid rgba(79,140,247,0.15)',borderRadius:12,marginBottom:22 }}>
            <div style={{ fontSize:11,color:B.txtD,marginBottom:4 }}>CHALLENGE FEE</div>
            <div style={{ display:'flex',alignItems:'flex-end',gap:10 }}>
              <span style={{ fontSize:50,fontWeight:800,color:B.white,lineHeight:1 }}>${price}</span>
              <span style={{ fontSize:14,color:B.txtD,paddingBottom:6 }}>one-time · refundable</span>
            </div>
            <div style={{ fontSize:12,color:B.txtD,marginTop:4 }}>100% fee refunded on first payout · up to 95% profit split</div>
          </div>
          <Link to="/register" className="btn-p" style={{ display:'flex',justifyContent:'center',padding:'14px',fontSize:15,borderRadius:10 }}>Start {name} →</Link>
        </div>
        <div style={{ padding:'36px 40px' }}>
          <div style={{ fontSize:10,fontWeight:700,color:B.txtD,letterSpacing:'.12em',marginBottom:20 }}>TRADING RULES</div>
          {rules.map(([lbl, val]: [string,string], i: number) => (
            <div key={lbl} className="rule-row">
              <span style={{ fontSize:14,color:B.txtB }}>{lbl}</span>
              <span style={{ fontSize:15,fontWeight:700,color:B.white }}>{val}</span>
            </div>
          ))}
          <div style={{ marginTop:24,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
            {[['⚡','1-Hour Payouts'],['♾️','Unlimited Days'],['📰','News Trading OK'],['🤖','EA / Algo OK'],['💰','100% Fee Refund'],['📈','Scale to $4M']].map(([icon,txt]) => (
              <div key={txt} style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 12px',background:B.bg3,border:`1px solid ${B.bord}`,borderRadius:8,fontSize:12,color:B.txtB }}>
                <span>{icon}</span>{txt}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ stats }: { stats: [string,string][] }) {
  return (
    <div style={{ display:'grid',gridTemplateColumns:`repeat(${stats.length},1fr)`,border:`1px solid ${B.bord}`,borderRadius:14,overflow:'hidden',margin:'0 0 48px' }}>
      {stats.map(([val,lbl], i) => (
        <div key={lbl} style={{ padding:'24px',textAlign:'center',background:B.bg2,borderRight:i<stats.length-1?`1px solid ${B.bord}`:'none' }}>
          <div style={{ fontSize:28,fontWeight:800,color:B.white,marginBottom:4 }}>{val}</div>
          <div style={{ fontSize:12,color:B.txtD }}>{lbl}</div>
        </div>
      ))}
    </div>
  );
}

// ── FAQ accordion ─────────────────────────────────────────────────────────────
function FAQList({ items }: { items: [string,string][] }) {
  const [open, setOpen] = useState(0);
  return (
    <div>
      {items.map(([q, a], i) => (
        <div key={i} className="faq-border">
          <button onClick={() => setOpen(open===i ? -1 : i)} style={{ width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'18px 0',background:'none',border:'none',cursor:'pointer',textAlign:'left',gap:16,fontFamily:'inherit' }}>
            <span style={{ fontSize:15,fontWeight:600,color:open===i?B.white:B.txtA }}>{q}</span>
            <span style={{ color:open===i?B.blue:B.txtD,fontSize:20,fontWeight:300,flexShrink:0,transition:'transform .25s',transform:open===i?'rotate(45deg)':'none',display:'inline-block' }}>+</span>
          </button>
          <div style={{ maxHeight:open===i?300:0,overflow:'hidden',transition:'max-height .35s ease' }}>
            <p style={{ padding:'0 0 18px',fontSize:14,color:B.txtB,lineHeight:1.8 }}>{a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Benefit cards ─────────────────────────────────────────────────────────────
function BenefitCards({ items }: { items: { icon: string; title: string; desc: string }[] }) {
  return (
    <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16 }}>
      {items.map(item => (
        <div key={item.title} className="card-h" style={{ padding:'24px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14,borderTop:`2px solid ${B.blue}` }}>
          <div style={{ fontSize:28,marginBottom:12 }}>{item.icon}</div>
          <h3 style={{ fontSize:16,fontWeight:700,color:B.white,marginBottom:8 }}>{item.title}</h3>
          <p style={{ fontSize:13,color:B.txtB,lineHeight:1.7 }}>{item.desc}</p>
        </div>
      ))}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionH({ label='', title, sub='' }: { label?: string; title: string; sub?: string }) {
  return (
    <div style={{ textAlign:'center',marginBottom:48 }}>
      {label && <div style={{ fontSize:10,fontWeight:700,color:B.blue,letterSpacing:'.15em',marginBottom:12 }}>{label}</div>}
      <h2 style={{ fontSize:'clamp(28px,4vw,52px)',fontWeight:800,color:B.white,letterSpacing:'-.02em',lineHeight:1.1,marginBottom:sub?14:0 }}>{title}</h2>
      {sub && <p style={{ fontSize:16,color:B.txtB,maxWidth:560,margin:'0 auto' }}>{sub}</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FOREX PAGES
// ══════════════════════════════════════════════════════════════════════════════

export function ForexProChallenge() {
  return (
    <Page>
      <PageHero badge="FOREX · PRO CHALLENGE" title="Pro Challenges" subtitle="We Know What It Takes to Trade Like a Pro. Fast-track your funding with 1-step or 2-step evaluation and keep up to 95% of your profits." cta="Get Funded" ctaLink="/register" ctaSecondary="Join Discord" ctaSecondaryLink="https://discord.com/invite/hjDcUcEfgA"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <StatsBar stats={[['$59','Starting fee'],['1-Hour','Payouts'],['$200K','Max Account'],['175+','Countries']]}/>
          <SectionH title="Choose Your Pro Challenge" sub="Two paths to funding — the 1-Step for speed, the 2-Step for consistency. Both unlock up to 95% profit split."/>
          <ChallengeConfigurator
            name="Pro Challenge" tag="UP TO 95% PROFIT SPLIT"
            desc="Hit your profit target in 1 or 2 phases while respecting simple risk rules. Pass, complete KYC, and start receiving payouts in as little as 1 hour."
            steps={['1-Step','2-Step']}
            sizes={[{l:'5K',p1:44,p2:69},{l:'10K',p1:84,p2:119},{l:'25K',p1:174,p2:229},{l:'50K',p1:289,p2:369},{l:'100K',p1:449,p2:549},{l:'200K',p1:749,p2:849}]}
            rules1={[['Profit Target','8%'],['Daily Loss Limit','4%'],['Max Drawdown','8%'],['Min Trading Days','5'],['Leverage','1:100'],['Profit Split','up to 95%']]}
            rules2={[['Phase 1 Target','8%'],['Phase 2 Target','5%'],['Daily Loss Limit','4%'],['Max Drawdown','8%'],['Leverage','1:100'],['Profit Split','up to 95%']]}
          />
        </div>
      </section>
      <section style={{ padding:'72px 28px',background:B.bg0 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <SectionH label="WHY PRO CHALLENGE" title="Benefits of the Pro Challenge" sub="Everything you need to start trading with our capital — on your terms."/>
          <BenefitCards items={[
            {icon:'⚡',title:'100x Leverage',desc:'Control larger positions with less capital. 1:100 leverage across all major forex pairs and instruments.'},
            {icon:'💰',title:'100% Fee Refund',desc:'Pass your challenge and we reimburse your full challenge fee with your first payout. Zero risk to join.'},
            {icon:'📈',title:'Up to 95% Profit Split',desc:'Keep up to 95% of every dollar you earn. One of the highest profit splits available at any prop firm.'},
            {icon:'♾️',title:'Unlimited Trading Days',desc:'No rushing. Trade at your own pace with no maximum time limit on your challenge or funded account.'},
            {icon:'📰',title:'News Trading Allowed',desc:'Trade around NFP, FOMC, and all major economic events without restrictions or blackout periods.'},
            {icon:'🤖',title:'Expert Advisors Welcome',desc:'Run any EA or algorithmic strategy. All automated trading is fully permitted on Pro Challenge accounts.'},
          ]}/>
        </div>
      </section>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:820,margin:'0 auto' }}>
          <SectionH title="Pro Challenge FAQ"/>
          <FAQList items={[
            ['What is the Pro Challenge?','The Pro Challenge is a two-phase (or single-phase) evaluation where you trade a demo account and must hit a profit target while respecting daily loss and maximum drawdown limits. Pass, complete KYC, and you receive a funded Hola Prime account.'],
            ['What is the difference between 1-Step and 2-Step?','The 1-Step requires hitting an 8% profit target in a single phase. The 2-Step requires hitting 8% in Phase 1 and 5% in Phase 2. Both have the same risk rules. The 1-Step is faster; the 2-Step has a lower fee.'],
            ['Is there a time limit?','No. There is no maximum duration on your Pro Challenge or your funded account. Trade at your own pace without pressure.'],
            ['Can I trade during news events?','Yes. News trading is fully permitted on all Pro Challenge accounts. There are no lockout periods around economic events.'],
            ['When do I get my fee refunded?','Your full challenge fee is automatically refunded with your first profit payout from your funded Hola Prime account.'],
          ]}/>
        </div>
      </section>
    </Page>
  );
}

export function ForexPrimeChallenge() {
  return (
    <Page>
      <PageHero badge="FOREX · PRIME CHALLENGE" title="Prime Challenges" subtitle="The most accessible prop trading challenge. Start from just $39, with generous rules designed to give serious traders the best shot at funding." cta="Get Funded" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <StatsBar stats={[['$39','Starting fee'],['1-Hour','Payouts'],['$200K','Max Account'],['90%','Profit Split']]}/>
          <SectionH title="Choose Your Prime Challenge" sub="Lower entry fees, generous rules, and the same 1-hour payout guarantee. Perfect for traders who want the best chance at consistent funding."/>
          <ChallengeConfigurator
            name="Prime Challenge" tag="BEST VALUE"
            desc="The most trader-friendly rules in the industry. Lower profit targets, more breathing room, and identical payout speed."
            steps={['1-Step','2-Step']}
            sizes={[{l:'5K',p1:39,p2:59},{l:'10K',p1:75,p2:99},{l:'25K',p1:149,p2:189},{l:'50K',p1:249,p2:299},{l:'100K',p1:399,p2:449},{l:'200K',p1:649,p2:729}]}
            rules1={[['Profit Target','10%'],['Daily Loss Limit','5%'],['Max Drawdown','10%'],['Min Trading Days','3'],['Leverage','1:100'],['Profit Split','up to 90%']]}
            rules2={[['Phase 1 Target','10%'],['Phase 2 Target','5%'],['Daily Loss','5%'],['Max Drawdown','10%'],['Leverage','1:100'],['Profit Split','up to 90%']]}
          />
        </div>
      </section>
      <section style={{ padding:'72px 28px',background:B.bg0 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <SectionH label="WHY PRIME CHALLENGE" title="Designed for Serious Traders" sub="Every rule exists to give skilled traders the best possible conditions to demonstrate their ability."/>
          <BenefitCards items={[
            {icon:'🎯',title:'5% Daily Loss Buffer',desc:'Generous daily loss limit gives you more room to manage drawdown without being stopped out by short-term volatility.'},
            {icon:'⏱️',title:'Only 3 Min Trading Days',desc:'Qualify in as little as 3 trading days for a 1-step challenge. No unnecessary waiting periods.'},
            {icon:'💸',title:'From Just $39',desc:'The lowest starting fee of any Hola Prime challenge. Access a $5,000 simulated account for less than the cost of a dinner.'},
            {icon:'📊',title:'10% Max Drawdown',desc:'More room to manage your strategy through drawdown periods without losing your account.'},
            {icon:'🔄',title:'Scale to $4M',desc:'Consistent performers can scale their funded account up to $4,000,000 through the Alpha Prime Scaling Plan.'},
            {icon:'🌍',title:'175+ Countries',desc:'Available in over 175 countries with local payment methods and multi-currency support.'},
          ]}/>
        </div>
      </section>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:820,margin:'0 auto' }}>
          <SectionH title="Prime Challenge FAQ"/>
          <FAQList items={[
            ['How is the Prime Challenge different from the Pro Challenge?','The Prime Challenge has a lower entry fee and a more generous daily loss limit (5% vs 4%) and max drawdown (10% vs 8%). The profit target is slightly higher (10% vs 8%). It is designed to give traders more room to breathe.'],
            ['What happens after I pass?','After passing your phase(s), you complete a quick KYC check (usually under 15 minutes). Your funded Hola Prime account is then activated and you can request your first payout within 1 hour of earning a profit.'],
            ['Is there a minimum number of trading days?','Yes, the Prime Challenge requires a minimum of 3 trading days for a 1-step challenge. This is one of the shortest minimum trading day requirements in the industry.'],
            ['Can I reset if I breach a rule?','Yes. You can purchase a discounted reset of your challenge account at any time. You start fresh with the same rules and account size.'],
          ]}/>
        </div>
      </section>
    </Page>
  );
}

export function ForexOneChallenge() {
  return (
    <Page>
      <PageHero badge="FOREX · ONE CHALLENGE" title="One Challenge" subtitle="The fastest path to funding. A single evaluation phase — hit the target, get funded. No second phase, no complications." cta="Start One Challenge" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <StatsBar stats={[['1-Phase','Evaluation'],['8%','Profit Target'],['5%','Daily Loss Limit'],['1-Hour','Payouts']]}/>
          <SectionH title="Simple. Fast. Funded." sub="The One Challenge is a single-phase evaluation. Pass once, get funded. No second phase, no verification step."/>
          <ChallengeConfigurator
            name="One Challenge" tag="FASTEST PATH TO FUNDING"
            desc="One phase, one target. Hit 8% profit while respecting daily loss and drawdown rules — and you're funded. Simple as that."
            steps={['1-Step']}
            sizes={[{l:'5K',p1:49,p2:49},{l:'10K',p1:89,p2:89},{l:'25K',p1:179,p2:179},{l:'50K',p1:299,p2:299},{l:'100K',p1:459,p2:459},{l:'200K',p1:759,p2:759}]}
            rules1={[['Profit Target','8%'],['Daily Loss Limit','5%'],['Max Drawdown','10%'],['Min Trading Days','5'],['Leverage','1:100'],['Profit Split','up to 90%']]}
            rules2={[]}
          />
        </div>
      </section>
      <section style={{ padding:'72px 28px',background:B.bg0 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <SectionH title="Why Choose the One Challenge?"/>
          <BenefitCards items={[
            {icon:'🚀',title:'Single Phase Only',desc:'No second evaluation phase. Pass the One Challenge and you go straight to a funded account. Fast and simple.'},
            {icon:'⚡',title:'Same 1-Hour Payouts',desc:'All funded accounts — regardless of which challenge you passed — receive the same 1-hour payout guarantee.'},
            {icon:'💯',title:'Full Fee Refund',desc:'Pass your One Challenge and your entry fee is fully refunded with your first payout. Zero cost to participate.'},
            {icon:'📈',title:'Up to 90% Profit Split',desc:'Keep up to 90% of all profits from your funded account. One of the highest split rates in the industry.'},
            {icon:'🎯',title:'Clear & Simple Rules',desc:'One profit target (8%), one daily loss limit (5%), one max drawdown (10%). No confusion, no surprises.'},
            {icon:'🌐',title:'All Instruments',desc:'Trade forex, indices, commodities, and crypto across all major exchanges from a single funded account.'},
          ]}/>
        </div>
      </section>
    </Page>
  );
}

export function ForexDirectAccount() {
  return (
    <Page>
      <PageHero badge="FOREX · DIRECT ACCOUNT" title="Direct Account" subtitle="Skip the evaluation entirely. Pay once, get funded instantly, and start earning real payouts from day one. No challenge required." cta="Get Instant Funding" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <StatsBar stats={[['Instant','Funding'],['No','Evaluation'],['1-Hour','Payouts'],['80%','Profit Split']]}/>
          <SectionH title="Instant Funding — No Challenge" sub="Direct accounts are for experienced traders who want to start earning immediately without going through an evaluation phase."/>
          <ChallengeConfigurator
            name="Direct Account" tag="INSTANT FUNDING — NO EVALUATION"
            desc="Pay once, receive your funded account immediately. Start trading and requesting payouts right away — no evaluation, no waiting."
            steps={['Instant']}
            sizes={[{l:'5K',p1:199,p2:199},{l:'10K',p1:349,p2:349},{l:'25K',p1:749,p2:749},{l:'50K',p1:1299,p2:1299}]}
            rules1={[['No Evaluation','✓ Instant Access'],['Daily Loss Limit','3%'],['Max Drawdown','6%'],['Min Trading Days','None'],['Leverage','1:20'],['Profit Split','up to 80%']]}
            rules2={[]}
          />
        </div>
      </section>
      <section style={{ padding:'72px 28px',background:B.bg0 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <SectionH title="Is the Direct Account Right for You?"/>
          <BenefitCards items={[
            {icon:'⚡',title:'Immediate Access',desc:'Your funded account is active within minutes of purchase. No waiting, no evaluation, no delays.'},
            {icon:'💸',title:'Start Earning Day One',desc:'Request your first payout as soon as you generate profit. The 1-hour payout guarantee applies from your very first trade.'},
            {icon:'🛡️',title:'Strict Risk Rules',desc:'The Direct Account has tighter risk rules (3% daily loss, 6% max drawdown) to reflect the instant funding model.'},
            {icon:'🔄',title:'Scalable Account',desc:'Consistent performance on a Direct Account makes you eligible for account scaling through the Alpha Prime plan.'},
            {icon:'📊',title:'All Major Instruments',desc:'Forex, indices, commodities, and crypto. The full range of instruments available across all Hola Prime accounts.'},
            {icon:'💰',title:'80% Profit Split',desc:'Keep 80% of all profits from your Direct Account. A fair split for a zero-evaluation funded account.'},
          ]}/>
        </div>
      </section>
    </Page>
  );
}

export function ScalingPlan() {
  return (
    <Page>
      <PageHero badge="FOREX · SCALING PLAN" title="Alpha Prime Scaling Plan" subtitle="Top-performing traders can scale their accounts up to $4,000,000. Prove your consistency and we grow your capital alongside you." cta="Start Scaling" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <StatsBar stats={[['$4M','Maximum Capital'],['25%','First Scale'],['40%','Second Scale'],['95%','Profit Split']]}/>
          <SectionH title="How the Scaling Plan Works" sub="Every time you meet the scaling conditions, your account balance grows. No cap on how far you can go."/>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:48 }}>
            {[
              {n:'1st',pct:'25%',desc:'After 4 months of consistent performance, your balance increases by 25%.'},
              {n:'2nd',pct:'40%',desc:'Continue performing and your balance increases by a further 40% of the original.'},
              {n:'3rd+',pct:'50%',desc:'Every subsequent scaling event grows your account by 50% of the original balance.'},
              {n:'Max',pct:'$4M',desc:'The maximum funded account size through the Alpha Prime Scaling Plan is $4,000,000.'},
            ].map(s => (
              <div key={s.n} style={{ padding:'28px 24px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14,textAlign:'center' }}>
                <div style={{ fontSize:14,fontWeight:700,color:B.blueL,marginBottom:8 }}>SCALING {s.n}</div>
                <div style={{ fontSize:36,fontWeight:800,color:B.white,marginBottom:10 }}>{s.pct}</div>
                <p style={{ fontSize:13,color:B.txtC,lineHeight:1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ padding:'32px 36px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:16,marginBottom:48 }}>
            <h3 style={{ fontSize:20,fontWeight:700,color:B.white,marginBottom:16 }}>Scaling Conditions</h3>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
              {[
                ['Minimum trading period','4 months on current account'],
                ['Minimum profitable months','At least 3 of the last 4 months'],
                ['Net profit requirement','Positive P&L over the period'],
                ['No rule violations','No daily loss or drawdown breaches'],
                ['Minimum trading days','At least 12 days per month'],
                ['Profit split after scaling','Remains up to 95%'],
              ].map(([l,v]) => (
                <div key={l} style={{ display:'flex',justifyContent:'space-between',padding:'12px 16px',background:B.bg3,borderRadius:8,fontSize:13 }}>
                  <span style={{ color:B.txtC }}>{l}</span>
                  <span style={{ color:B.white,fontWeight:600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Page>
  );
}

export function ForexTradingRules() {
  return (
    <Page>
      <PageHero badge="FOREX · TRADING RULES" title="Forex Trading Rules" subtitle="Clear, fair, and transparent rules designed by traders for traders. Understand exactly what's required to pass and stay funded." cta="Start Challenge" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <SectionH title="Core Trading Rules" sub="These rules apply to all Hola Prime forex challenge and funded accounts. They exist to encourage responsible risk management."/>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,marginBottom:48 }}>
            {[
              {title:'Daily Loss Limit',icon:'📉',colour:'#EF4444',desc:'You must not lose more than 4–5% of your account balance in a single trading day. The daily loss is calculated from the highest equity of the day. This rule resets every day at midnight UTC.'},
              {title:'Maximum Drawdown',icon:'📊',colour:'#F59E0B',desc:'Your account balance must never fall more than 8–10% below the starting balance (depending on your challenge). This is an absolute limit that cannot be recovered if breached.'},
              {title:'Minimum Trading Days',icon:'📅',colour:B.blue,desc:'You must trade for a minimum number of days (3–5 depending on challenge) before you can pass. This ensures traders demonstrate consistency rather than lucky single-day runs.'},
              {title:'Profit Target',icon:'🎯',colour:B.green,desc:'You must achieve the required profit target (8–10% depending on challenge) while respecting the loss rules. Once achieved, you advance to the next phase or receive your funded account.'},
            ].map(rule => (
              <div key={rule.title} style={{ padding:'28px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14,borderLeft:`3px solid ${rule.colour}` }}>
                <div style={{ fontSize:28,marginBottom:12 }}>{rule.icon}</div>
                <h3 style={{ fontSize:17,fontWeight:700,color:B.white,marginBottom:10 }}>{rule.title}</h3>
                <p style={{ fontSize:14,color:B.txtB,lineHeight:1.7 }}>{rule.desc}</p>
              </div>
            ))}
          </div>
          <SectionH title="Permitted & Restricted Activities"/>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20 }}>
            <div style={{ padding:'24px',background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:14 }}>
              <h3 style={{ fontSize:16,fontWeight:700,color:B.green,marginBottom:16 }}>✅ Permitted</h3>
              {['All major and minor forex pairs','Indices, commodities, and crypto','Scalping and day trading','Swing trading and position trading','News trading (including NFP, FOMC)','Expert Advisors (EAs) and algorithmic trading','Copy trading from your own accounts','Hedging within account limits'].map(item => (
                <div key={item} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:'1px solid rgba(16,185,129,0.1)',fontSize:13,color:B.txtB }}>
                  <span style={{ color:B.green,flexShrink:0 }}>✓</span>{item}
                </div>
              ))}
            </div>
            <div style={{ padding:'24px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:14 }}>
              <h3 style={{ fontSize:16,fontWeight:700,color:B.red,marginBottom:16 }}>❌ Not Permitted</h3>
              {['Latency arbitrage or price manipulation exploits','Exploiting demo/live price feed discrepancies','Account management for third parties','Copy trading from external signals without disclosure','Martingale strategies that violate drawdown rules','Coordinated trading across multiple accounts to manipulate results','Any strategy designed to abuse platform weaknesses'].map(item => (
                <div key={item} style={{ display:'flex',alignItems:'flex-start',gap:10,padding:'8px 0',borderBottom:'1px solid rgba(239,68,68,0.1)',fontSize:13,color:B.txtB }}>
                  <span style={{ color:B.red,flexShrink:0,marginTop:1 }}>✗</span>{item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Page>
  );
}

export function TradingPlatforms() {
  const platforms = [
    {name:'MetaTrader 5',sub:'MT5',icon:'📊',colour:'#6366F1',features:['Advanced charting with 80+ indicators','Built-in EA development with MQL5','Multi-asset support — forex, stocks, futures','Fast execution with one-click trading','Full algorithmic trading support'],compatible:['Forex','Futures']},
    {name:'cTrader',sub:'cTrader',icon:'📉',colour:B.blue,features:['Level II pricing and full market depth','Advanced order management','Clean, professional interface','cAlgo algorithmic trading','Detailed analytics and reporting'],compatible:['Forex']},
    {name:'DXTrade',sub:'DXT',icon:'💎',colour:'#8B5CF6',features:['Cloud-based — no download required','Fully customisable workspace','Advanced order types','Real-time risk management tools','Mobile and desktop support'],compatible:['Forex','Futures']},
    {name:'MatchTrader',sub:'MT',icon:'🔄',colour:B.green,features:['Real-time execution engine','Advanced charting suite','Integrated risk management','Multi-device support','API access for algo traders'],compatible:['Forex']},
    {name:'TradeLocker',sub:'TL',icon:'🔐',colour:B.gold,features:['Modern, intuitive interface','Advanced charting tools','Risk management dashboard','Fast mobile application','Regular platform updates'],compatible:['Forex']},
  ];
  return (
    <Page>
      <PageHero badge="TRADING PLATFORMS" title="World-Class Trading Platforms" subtitle="Choose your preferred platform and trade on the same technology used by professional traders worldwide. All platforms are available on your Hola Prime account." cta="Get Started" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <SectionH title="Available Platforms" sub="All Hola Prime forex accounts are compatible with every platform below. Select at signup."/>
          <div style={{ display:'flex',flexDirection:'column',gap:20 }}>
            {platforms.map(p => (
              <div key={p.name} className="card-h" style={{ padding:'32px 36px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:16,display:'grid',gridTemplateColumns:'80px 1fr auto' ,gap:28,alignItems:'center' }}>
                <div style={{ width:72,height:72,borderRadius:16,background:`${p.colour}18`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:32 }}>{p.icon}</div>
                <div>
                  <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:8 }}>
                    <h3 style={{ fontSize:20,fontWeight:700,color:B.white }}>{p.name}</h3>
                    <span style={{ fontSize:11,fontWeight:800,color:p.colour,padding:'2px 10px',background:`${p.colour}15`,border:`1px solid ${p.colour}40`,borderRadius:20 }}>{p.sub}</span>
                    {p.compatible.map(c => <span key={c} style={{ fontSize:11,color:B.txtD,padding:'2px 8px',background:B.bg3,border:`1px solid ${B.bord}`,borderRadius:20 }}>{c}</span>)}
                  </div>
                  <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
                    {p.features.map(f => (
                      <span key={f} style={{ fontSize:12,color:B.txtC,display:'flex',alignItems:'center',gap:5 }}>
                        <span style={{ color:B.green,fontSize:10 }}>●</span>{f}
                      </span>
                    ))}
                  </div>
                </div>
                <Link to="/register" className="btn-p" style={{ whiteSpace:'nowrap',padding:'12px 24px',fontSize:13 }}>Trade on {p.sub}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Page>
  );
}

export function TransparencyReport() {
  return (
    <Page>
      <PageHero badge="TRANSPARENCY REPORT" title="Payout Transparency Report" subtitle="We publish our real payout data so you can verify our claims. Every number on this page is backed by actual transactions." cta="View Live Data" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <StatsBar stats={[['33m 48s','Avg Payout Time'],['3m 37s','Fastest Payout'],['$4,500','Avg Payout / Trader'],['$0','Payout Denials']]}/>
          <SectionH title="Our Zero Denial Track Record" sub="Since our founding, we have processed thousands of payouts. Every single legitimate withdrawal request has been fulfilled."/>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:48 }}>
            {[
              {icon:'⚡',title:'Sub-60 Minute Average',desc:'Our average payout processing time is 33 minutes and 48 seconds — measured across all payouts ever processed.'},
              {icon:'✅',title:'100% Approval Rate',desc:'No trader who followed the rules has ever had a payout denied. We have maintained this record since day one.'},
              {icon:'🔍',title:'Blockchain Verification',desc:'Crypto payouts are verifiable on-chain. Every USDT and BTC payment can be independently confirmed on the blockchain.'},
              {icon:'📊',title:'Daily Published Data',desc:'We publish our average payout times and volumes on a rolling basis so traders can always verify our performance.'},
              {icon:'🏆',title:'iFX Expo Award',desc:'Recognised as the Fastest Payout Prop Firm at iFX Expo Dubai — independently verified by the award organisers.'},
              {icon:'💳',title:'Multiple Payment Methods',desc:'Payouts are processed via bank transfer, crypto (USDT, BTC, ETH), Skrill, Neteller, PayPal, and more.'},
            ].map(c => (
              <div key={c.title} className="card-h" style={{ padding:'24px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14 }}>
                <div style={{ fontSize:28,marginBottom:12 }}>{c.icon}</div>
                <h3 style={{ fontSize:15,fontWeight:700,color:B.white,marginBottom:8 }}>{c.title}</h3>
                <p style={{ fontSize:13,color:B.txtB,lineHeight:1.7 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Page>
  );
}

export function TradingTools() {
  return (
    <Page>
      <PageHero badge="TRADING TOOLS" title="Professional Trading Tools" subtitle="Every Hola Prime account comes with access to professional-grade tools to help you trade smarter and manage risk more effectively." cta="Get Funded" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <BenefitCards items={[
            {icon:'📊',title:'Advanced Charting Suite',desc:'Access full charting capabilities with 80+ technical indicators, multiple timeframes, and drawing tools across all platforms.'},
            {icon:'⚠️',title:'Risk Management Dashboard',desc:'Real-time P&L tracking, drawdown monitoring, and daily loss alerts so you always know where you stand.'},
            {icon:'📰',title:'Economic Calendar',desc:'Integrated economic calendar with impact ratings for all major events — NFP, FOMC, CPI, GDP, and more.'},
            {icon:'🤖',title:'EA & Algo Support',desc:'Full support for Expert Advisors on MT5. Run any automated strategy — scalpers, grid systems, or custom algorithms.'},
            {icon:'📱',title:'Mobile Trading App',desc:'Trade on the go with full-featured mobile apps available for iOS and Android across all supported platforms.'},
            {icon:'🎓',title:'Prime Academy Access',desc:'All funded traders get full access to the Prime Academy — webinars, courses, and 1-on-1 coaching sessions.'},
          ]}/>
        </div>
      </section>
    </Page>
  );
}

export function ForexFAQ() {
  return (
    <Page>
      <PageHero badge="FOREX · FAQ" title="Forex FAQ" subtitle="Everything you need to know about trading forex with Hola Prime — from challenges to payouts to account management." cta="Start Challenge" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:820,margin:'0 auto' }}>
          <FAQList items={[
            ['What challenges are available for forex?','Hola Prime offers four forex challenge types: Pro Challenge (1-step or 2-step, up to 95% split), Prime Challenge (1-step or 2-step, from $39), One Challenge (single phase), and Direct Account (instant funding, no evaluation).'],
            ['How do I get funded?','Select a challenge, complete the evaluation by hitting the profit target while following risk rules, complete a quick KYC check, and your funded Hola Prime account is activated. The process typically takes 1–2 weeks depending on your trading pace.'],
            ['What instruments can I trade?','You can trade all major and minor forex pairs, as well as indices, commodities, and select cryptocurrencies. The specific instruments available depend on the platform you choose.'],
            ['Are there any overnight or weekend holding restrictions?','No. You can hold positions overnight and over weekends on all Hola Prime forex accounts. There are no forced closure rules outside of the standard daily loss and drawdown limits.'],
            ['Can I trade with an EA or automated strategy?','Yes. All forms of automated trading, including Expert Advisors, custom scripts, and algorithmic strategies, are fully permitted on all Hola Prime forex accounts.'],
            ['How are payouts processed?','Payouts are processed within 1 hour of a valid request during business hours. You can withdraw via bank transfer, crypto (USDT, BTC, ETH), Skrill, Neteller, PayPal, and other methods.'],
            ['Is there a maximum payout amount?','No. There is no maximum limit on the amount you can withdraw from your funded account. You can request your full profit balance at any time.'],
            ['What happens if I violate a trading rule?','If you breach the daily loss limit or maximum drawdown, your challenge or funded account will be suspended. You will need to purchase a new challenge or a discounted reset to continue.'],
          ]}/>
        </div>
      </section>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FUTURES PAGES
// ══════════════════════════════════════════════════════════════════════════════

export function FuturesPrimeChallenge() {
  return (
    <Page>
      <PageHero badge="FUTURES · PRIME CHALLENGE" title="Futures Prime Challenge" subtitle="Simplified and accessible — the way futures should always have been. Trade 50+ instruments with the same 1-hour payout guarantee." cta="Get Funded" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <StatsBar stats={[['50+','Instruments'],['1-Step','Evaluation'],['1-Hour','Payouts'],['90%','Profit Split']]}/>
          <SectionH title="1-Step Futures Challenge" sub="A single evaluation phase for futures traders. Hit your profit target, pass KYC, and start trading funded futures immediately."/>
          <ChallengeConfigurator
            name="Futures Prime Challenge" tag="1-STEP FUTURES EVALUATION"
            desc="The straightforward path to funded futures trading. One phase, clear rules, and the same world-class support you'd expect from Hola Prime."
            steps={['1-Step']}
            sizes={[{l:'10K',p1:99,p2:99},{l:'25K',p1:199,p2:199},{l:'50K',p1:349,p2:349},{l:'100K',p1:599,p2:599}]}
            rules1={[['Profit Target','10%'],['Daily Loss Limit','4%'],['Max Drawdown','8%'],['Min Trading Days','5'],['Instruments','50+ Futures'],['Profit Split','up to 90%']]}
            rules2={[]}
          />
        </div>
      </section>
      <section style={{ padding:'72px 28px',background:B.bg0 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <SectionH title="Why Trade Futures with Hola Prime?"/>
          <BenefitCards items={[
            {icon:'📈',title:'50+ Instruments',desc:'Access over 50 futures instruments including equity indices (ES, NQ, YM), commodities (CL, GC, SI), and more.'},
            {icon:'⚡',title:'Same 1-Hour Payouts',desc:'The same payout speed that made Hola Prime famous in forex applies to all funded futures accounts.'},
            {icon:'🛡️',title:'Transparent Rules',desc:'Clear daily loss limits and drawdown rules designed by futures traders who understand the unique characteristics of futures markets.'},
            {icon:'🎓',title:'Futures Simplified',desc:'Our educational resources explain futures trading in plain English. Access webinars, guides, and 1-on-1 coaching.'},
            {icon:'💻',title:'DXTrade Platform',desc:'Trade futures on DXTrade — a professional-grade platform with real-time market depth, advanced charts, and fast execution.'},
            {icon:'🌍',title:'Available Worldwide',desc:'Hola Prime futures accounts are available in 175+ countries. Trade from anywhere with a simple KYC verification.'},
          ]}/>
        </div>
      </section>
    </Page>
  );
}

export function FuturesDirectAccount() {
  return (
    <Page>
      <PageHero badge="FUTURES · DIRECT ACCOUNT" title="Futures Direct Account" subtitle="Instant access to a funded futures account. No evaluation, no waiting — just pay, verify, and start trading." cta="Get Instant Funding" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <StatsBar stats={[['Instant','Access'],['No','Evaluation'],['50+','Instruments'],['80%','Profit Split']]}/>
          <SectionH title="Skip Straight to Funded" sub="The Futures Direct Account is for experienced futures traders who want to start earning without going through an evaluation."/>
          <ChallengeConfigurator
            name="Futures Direct Account" tag="INSTANT FUTURES FUNDING"
            desc="Pay once, receive your funded futures account immediately. Start trading 50+ instruments and requesting payouts from day one."
            steps={['Instant']}
            sizes={[{l:'10K',p1:399,p2:399},{l:'25K',p1:849,p2:849},{l:'50K',p1:1499,p2:1499}]}
            rules1={[['No Evaluation','✓ Instant Access'],['Daily Loss Limit','3%'],['Max Drawdown','6%'],['Min Trading Days','None'],['Instruments','50+ Futures'],['Profit Split','up to 80%']]}
            rules2={[]}
          />
        </div>
      </section>
    </Page>
  );
}

export function FuturesInstruments() {
  const instruments = [
    {cat:'Equity Indices',items:[['E-mini S&P 500','ES','CME'],['E-mini Nasdaq 100','NQ','CME'],['E-mini Dow Jones','YM','CBOT'],['E-mini Russell 2000','RTY','CME'],['Euro Stoxx 50','FESX','Eurex']]},
    {cat:'Energy',items:[['WTI Crude Oil','CL','NYMEX'],['Brent Crude Oil','B','ICE'],['Natural Gas','NG','NYMEX'],['RBOB Gasoline','RB','NYMEX'],['Heating Oil','HO','NYMEX']]},
    {cat:'Metals',items:[['Gold','GC','COMEX'],['Silver','SI','COMEX'],['Platinum','PL','NYMEX'],['Copper','HG','COMEX'],['Palladium','PA','NYMEX']]},
    {cat:'Grains & Agriculture',items:[['Corn','ZC','CBOT'],['Wheat','ZW','CBOT'],['Soybeans','ZS','CBOT'],['Soybean Oil','ZL','CBOT'],['Live Cattle','LE','CME']]},
  ];
  return (
    <Page>
      <PageHero badge="FUTURES · INSTRUMENTS" title="Futures Instruments" subtitle="Trade over 50 futures instruments across indices, energies, metals, and agricultural products. All available on your Hola Prime futures account." cta="Start Trading" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <StatsBar stats={[['50+','Instruments'],['24/5','Market Access'],['4','Asset Classes'],['Real-time','Pricing']]}/>
          <div style={{ display:'flex',flexDirection:'column',gap:36 }}>
            {instruments.map(cat => (
              <div key={cat.cat}>
                <h3 style={{ fontSize:18,fontWeight:700,color:B.white,marginBottom:16,paddingBottom:12,borderBottom:`1px solid ${B.bord}` }}>{cat.cat}</h3>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10 }}>
                  {cat.items.map(([name,ticker,exchange]) => (
                    <div key={ticker} style={{ padding:'16px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:10,textAlign:'center' }}>
                      <div style={{ fontSize:18,fontWeight:800,color:B.blue,marginBottom:4 }}>{ticker}</div>
                      <div style={{ fontSize:12,fontWeight:600,color:B.white,marginBottom:4 }}>{name}</div>
                      <div style={{ fontSize:10,color:B.txtD }}>{exchange}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Page>
  );
}

export function FuturesTradingRules() {
  return (
    <Page>
      <PageHero badge="FUTURES · TRADING RULES" title="Futures Trading Rules" subtitle="Clear, fair rules designed specifically for futures trading. Understand exactly what's required to pass your challenge and stay funded." cta="Start Challenge" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <SectionH title="Core Futures Trading Rules"/>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:48 }}>
            {[
              {t:'Daily Loss Limit',c:'#EF4444',d:'You must not lose more than 4% of your account balance in a single trading day. Calculated from the highest equity point of the day. Resets daily at midnight UTC.'},
              {t:'Maximum Drawdown',c:'#F59E0B',d:'Your account balance must never fall more than 8% below the starting balance. This is an absolute, non-recoverable limit.'},
              {t:'Minimum Trading Days',c:B.blue,d:'You must have at least 5 trading days before passing the evaluation. A trading day is defined as any calendar day on which at least one trade is executed.'},
              {t:'Profit Target',c:B.green,d:'You must achieve at least 10% profit while respecting all risk rules. Once achieved, you move to KYC and receive your funded account.'},
            ].map(r => (
              <div key={r.t} style={{ padding:'24px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14,borderLeft:`3px solid ${r.c}` }}>
                <h3 style={{ fontSize:16,fontWeight:700,color:B.white,marginBottom:8 }}>{r.t}</h3>
                <p style={{ fontSize:14,color:B.txtB,lineHeight:1.7 }}>{r.d}</p>
              </div>
            ))}
          </div>
          <SectionH title="Futures-Specific Guidelines"/>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
            <div style={{ padding:'24px',background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:14 }}>
              <h3 style={{ fontSize:15,fontWeight:700,color:B.green,marginBottom:14 }}>✅ Allowed</h3>
              {['All 50+ listed futures instruments','Intraday and overnight positions','Automated trading strategies','Spreading between correlated instruments','News trading around economic data'].map(i => (
                <div key={i} style={{ display:'flex',gap:8,padding:'7px 0',borderBottom:'1px solid rgba(16,185,129,0.1)',fontSize:13,color:B.txtB }}>
                  <span style={{ color:B.green }}>✓</span>{i}
                </div>
              ))}
            </div>
            <div style={{ padding:'24px',background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:14 }}>
              <h3 style={{ fontSize:15,fontWeight:700,color:B.red,marginBottom:14 }}>❌ Not Allowed</h3>
              {['Exploiting platform latency or price feed gaps','Coordinated trading across accounts','Strategies that abuse the simulated environment','Exceeding the daily loss or drawdown limits'].map(i => (
                <div key={i} style={{ display:'flex',gap:8,padding:'7px 0',borderBottom:'1px solid rgba(239,68,68,0.1)',fontSize:13,color:B.txtB }}>
                  <span style={{ color:B.red }}>✗</span>{i}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Page>
  );
}

export function FuturesFAQ() {
  return (
    <Page>
      <PageHero badge="FUTURES · FAQ" title="Futures FAQ" subtitle="Common questions about trading futures with Hola Prime — from account setup to instruments to payouts." cta="Start Trading" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:820,margin:'0 auto' }}>
          <FAQList items={[
            ['What futures instruments can I trade?','Over 50 futures contracts across equity indices (ES, NQ, YM, RTY), energy (CL, NG, RB), metals (GC, SI, HG), and agricultural products (ZC, ZW, ZS). The full list is available on the Instruments page.'],
            ['What platform do I trade futures on?','Futures are available on DXTrade — a professional-grade cloud platform with full market depth, advanced charting, and fast execution. No download required.'],
            ['Are the rules the same as forex?','The core rules are similar — daily loss limit, maximum drawdown, and profit target — but are calibrated specifically for futures market conditions.'],
            ['Can I hold positions overnight in futures?','Yes. Overnight holding is permitted on all Hola Prime futures accounts. Be aware of higher overnight margin requirements on some contracts.'],
            ['How are futures payouts processed?','Futures payouts follow the same 1-hour processing guarantee as forex. Available payment methods include bank transfer, crypto, Skrill, Neteller, and PayPal.'],
            ['Is there a futures educational program?','Yes. The Prime Academy includes dedicated futures content — introductory courses, webinars, and coaching sessions focused on futures market dynamics.'],
          ]}/>
        </div>
      </section>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ABOUT / COMPANY PAGES
// ══════════════════════════════════════════════════════════════════════════════

export function AboutUs() {
  return (
    <Page>
      <PageHero badge="ABOUT HOLA PRIME" title="We are Traders" subtitle="Born from the same sleepless nights, volatile charts, and the hunger to keep pushing forward. We built Hola Prime because the industry needed a firm that actually puts traders first." cta="Join the Community" ctaLink="https://discord.com/invite/hjDcUcEfgA"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:48,alignItems:'center',marginBottom:72 }}>
            <div>
              <div style={{ fontSize:11,fontWeight:700,color:B.blue,letterSpacing:'.15em',marginBottom:14 }}>OUR MISSION</div>
              <h2 style={{ fontSize:'clamp(26px,3.5vw,44px)',fontWeight:800,color:B.white,lineHeight:1.1,marginBottom:18 }}>To create a transparent, trader-first prop trading ecosystem</h2>
              <p style={{ fontSize:16,color:B.txtB,lineHeight:1.8,marginBottom:16 }}>We know what it feels like to fight through tough markets, face drawdowns, and keep going when no one else believes in your journey. At Hola Prime, we've built a prop firm that removes unnecessary hurdles and puts traders first.</p>
              <p style={{ fontSize:16,color:B.txtB,lineHeight:1.8 }}>From our Zero Payout Denial Policy to our 1-hour payouts, everything we do is designed to give skilled traders the best possible environment to succeed.</p>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 }}>
              {[['Fastest','Payout Prop Firm — iFX Expo Dubai'],['20,000+','Funded Traders Worldwide'],['$4.5M+','Total Payouts Processed'],['175+','Countries Served']].map(([v,l]) => (
                <div key={l} style={{ padding:'24px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14,textAlign:'center' }}>
                  <div style={{ fontSize:22,fontWeight:800,color:B.blue,marginBottom:6 }}>{v}</div>
                  <div style={{ fontSize:12,color:B.txtD,lineHeight:1.5 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <SectionH title="Our Core Values"/>
          <BenefitCards items={[
            {icon:'🔍',title:'Transparency',desc:'We publish our real payout data, processing times, and trader outcomes. No hidden statistics, no exaggerated claims.'},
            {icon:'🤝',title:'Trader-First',desc:'Every decision we make starts with one question: does this help our traders succeed? If the answer is no, we don\'t do it.'},
            {icon:'⚡',title:'Speed',desc:'We pioneered 1-hour payouts because traders shouldn\'t have to wait days to access money they\'ve earned. Speed matters.'},
            {icon:'🌍',title:'Accessibility',desc:'From $38 starting fees to support in 175+ countries, we\'ve worked to make funded trading accessible to everyone.'},
            {icon:'📚',title:'Education',desc:'We provide free education, coaching, and tools because better traders create better outcomes for everyone.'},
            {icon:'🏆',title:'Excellence',desc:'We hold ourselves to the highest standard in every area — technology, support, compliance, and execution.'},
          ]}/>
        </div>
      </section>
    </Page>
  );
}

export function OurTeam() {
  const team = [
    {name:'Somesh Kapuria',role:'MD & CEO',desc:'Former Citibank New York leader with decades of financial operations experience. MBA in Finance from New York, B.Tech from PEC Chandigarh.'},
    {name:'Marketing Director',role:'Marketing & Growth',desc:'10+ years across FMCG, E-commerce, D2C. Former ITC Performance Marketing Head. Specialises in scaling businesses and ROI optimisation.'},
    {name:'Charles',role:'Head of UI/UX',desc:'Designs Hola Prime\'s intuitive platform experience. Leads UI/UX strategy, prioritising usability and consistency across all interfaces.'},
    {name:'Risk & Compliance',role:'Chief Compliance Officer',desc:'Chartered Accountant with 15+ years in Risk and Compliance. Former Ernst & Young professional. Pioneer of the self-regulated compliance framework.'},
    {name:'Finn',role:'Content Strategy Director',desc:'Directs content strategy, producing clear, accurate materials for trader education. Upholds brand credibility and reinforces transparency.'},
    {name:'Rajas Bakre',role:'Associate Director, Client Success',desc:'Electronics Engineer and ex-Amazon professional. Drives transparent, reliable, trader-first solutions and scalable support frameworks.'},
  ];
  return (
    <Page>
      <PageHero badge="OUR TEAM" title="Meet the People Behind Hola Prime" subtitle="A team of traders, technologists, and financial professionals united by one mission — to build the most transparent prop trading firm in the world." cta="Join Our Team" ctaLink="/careers"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20 }}>
            {team.map(m => (
              <div key={m.name} className="card-h" style={{ padding:'28px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14 }}>
                <div style={{ width:60,height:60,borderRadius:'50%',background:`linear-gradient(135deg,${B.blue},${B.blueD})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,marginBottom:16,color:'#fff',fontWeight:700 }}>{m.name[0]}</div>
                <h3 style={{ fontSize:16,fontWeight:700,color:B.white,marginBottom:4 }}>{m.name}</h3>
                <div style={{ fontSize:12,fontWeight:600,color:B.blue,marginBottom:12 }}>{m.role}</div>
                <p style={{ fontSize:13,color:B.txtB,lineHeight:1.7 }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Page>
  );
}

export function Awards() {
  const awards = [
    {year:'2025',name:'Global Prop Firm of the Month — March 2025',org:'Forex Prop Reviews',icon:'🥇'},
    {year:'2025',name:'Most Trusted Prop Firm — February 2025',org:'Forex Prop Reviews',icon:'🏅'},
    {year:'2024',name:'Fastest Payout Prop Firm',org:'iFX Expo Dubai, UF Awards',icon:'⚡'},
    {year:'2024',name:'Best Prop Trading Firm — Innovation Award',org:'Industry Recognition',icon:'🏆'},
  ];
  return (
    <Page>
      <PageHero badge="AWARDS" title="Award-Winning Transparency" subtitle="Independent recognition of our commitment to fast payouts, fair rules, and genuine transparency in prop trading." cta="Experience the Difference" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <StatsBar stats={[['#1','Fastest Payout Firm'],['33m 48s','Average Payout'],['4.9/5','Trustpilot Score'],['0','Payout Denials']]}/>
          <SectionH title="Our Awards & Recognition"/>
          <div style={{ display:'flex',flexDirection:'column',gap:16,marginBottom:48 }}>
            {awards.map(a => (
              <div key={a.name} className="card-h" style={{ padding:'28px 36px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14,display:'flex',alignItems:'center',gap:24 }}>
                <div style={{ fontSize:40,flexShrink:0 }}>{a.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11,fontWeight:700,color:B.blue,letterSpacing:'.1em',marginBottom:6 }}>{a.year}</div>
                  <h3 style={{ fontSize:18,fontWeight:700,color:B.white,marginBottom:4 }}>{a.name}</h3>
                  <div style={{ fontSize:13,color:B.txtC }}>{a.org}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Page>
  );
}

export function OneHourPayouts() {
  return (
    <Page>
      <PageHero badge="1-HOUR PAYOUTS" title="Industry's First 1-Hour Payout Prop Firm" subtitle="You've done the hard work. You've managed the risk. You've earned the profit. Why should you wait? With our 10-Point Solid Payout System, your money is in your hands within just one hour." cta="Get Funded" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <StatsBar stats={[['33m 48s','Average Payout Time'],['3m 37s','Fastest Payout'],['100%','Success Rate'],['$0','Payout Denials']]}/>
          <SectionH title="The 10-Point Solid Payout System" sub="Every payout is processed through our robust 10-point system — designed to ensure speed, accuracy, and reliability every single time."/>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:48 }}>
            {[
              ['Water-tight Policy Manual','Clear, enforceable rules that ensure payouts are accurate and processed consistently for every trader.'],
              ['Daily Payout Planning','We assess earnings every day and prepare them to be paid out the very next day without delay.'],
              ['Dedicated Payout Account','An independent, secure account evaluated daily by our risk team to ensure sufficient liquidity.'],
              ['Cushion Funds (30–40% Buffer)','We maintain a 30–40% liquidity buffer to handle unexpected demand spikes and peak payout periods.'],
              ['Compliance & Risk Management','Our compliance team ensures every payout is fair, genuine, and meets all regulatory requirements.'],
              ['Independent Risk Oversight','A separate risk team reviews all payouts independently to ensure no conflicts of interest.'],
              ['Automated Processing Pipeline','Technology-driven processing minimises human error and dramatically reduces processing time.'],
              ['Real-time Balance Monitoring','Continuous monitoring of the payout account balance ensures funds are always available.'],
              ['Multi-method Payment Support','Bank transfer, crypto, Skrill, Neteller, PayPal and more — choose the fastest method for you.'],
              ['24/7 Support Team','Real humans available around the clock to resolve any payout queries immediately.'],
            ].map(([t, d], i) => (
              <div key={t} style={{ padding:'20px 24px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:12,display:'flex',gap:16 }}>
                <div style={{ width:28,height:28,borderRadius:'50%',background:`linear-gradient(135deg,${B.blue},${B.blueD})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:'#fff',flexShrink:0 }}>{i+1}</div>
                <div>
                  <h4 style={{ fontSize:14,fontWeight:700,color:B.white,marginBottom:4 }}>{t}</h4>
                  <p style={{ fontSize:13,color:B.txtB,lineHeight:1.6 }}>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Page>
  );
}

export function NewsMedia() {
  const news = [
    {date:'Mar 2025',cat:'Announcement',title:'Hola Prime Announces Karl-Anthony Towns as First-Ever Sports Brand Ambassador',desc:'Leading global proprietary trading firm Hola Prime is proud to announce five-time All-Star Karl-Anthony Towns as its first-ever sports brand ambassador.'},
    {date:'Feb 2025',cat:'Award',title:'Most Trusted Prop Firm — February 2025',desc:'Hola Prime has been recognised as the Most Trusted Prop Firm for February 2025 by Forex Prop Reviews, an independent review platform.'},
    {date:'Mar 2025',cat:'Award',title:'Global Prop Firm of the Month — March 2025',desc:'Hola Prime wins Global Prop Firm of the Month from Forex Prop Reviews for the second consecutive month.'},
    {date:'2024',cat:'Award',title:'Fastest Payout Prop Firm — iFX Expo Dubai',desc:'Hola Prime awarded Fastest Payout Prop Firm at iFX Expo Dubai — independently verified by payout metrics showing an average processing time of 33 minutes.'},
    {date:'2024',cat:'Partnership',title:'Featured in Forbes, Yahoo Finance, and MarketWatch',desc:'Hola Prime gains widespread coverage in major financial publications, recognising its innovation in the prop trading space.'},
  ];
  return (
    <Page>
      <PageHero badge="NEWS & MEDIA" title="News & Media" subtitle="The latest announcements, press coverage, and company updates from Hola Prime." cta="Get Funded" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
            {news.map(n => (
              <div key={n.title} className="card-h" style={{ padding:'28px 32px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14 }}>
                <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:12 }}>
                  <span style={{ fontSize:10,fontWeight:800,color:B.blue,padding:'3px 10px',background:'rgba(79,140,247,0.1)',border:'1px solid rgba(79,140,247,0.2)',borderRadius:20 }}>{n.cat.toUpperCase()}</span>
                  <span style={{ fontSize:12,color:B.txtD }}>{n.date}</span>
                </div>
                <h3 style={{ fontSize:18,fontWeight:700,color:B.white,marginBottom:8 }}>{n.title}</h3>
                <p style={{ fontSize:14,color:B.txtB,lineHeight:1.7 }}>{n.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Page>
  );
}

export function Careers() {
  const roles = [
    {title:'Senior Frontend Engineer',dept:'Engineering',type:'Full-time',loc:'Remote',desc:'Build and scale the Hola Prime trader portal and marketing website. React, TypeScript, Node.js experience required.'},
    {title:'Customer Support Specialist',dept:'Operations',type:'Full-time',loc:'Remote',desc:'Provide world-class support to traders across email, chat, and Discord. Trading knowledge is a plus.'},
    {title:'Risk & Compliance Analyst',dept:'Compliance',type:'Full-time',loc:'Remote / Hybrid',desc:'Monitor trader activity, review payout requests, and ensure the platform operates within regulatory guidelines.'},
    {title:'Performance Marketing Manager',dept:'Marketing',type:'Full-time',loc:'Remote',desc:'Own paid acquisition across Google, Meta, TikTok, and affiliate channels. Scale our trader acquisition programs.'},
    {title:'Trading Coach',dept:'Education',type:'Part-time',loc:'Remote',desc:'Deliver 1-on-1 coaching sessions and group webinars for our Prime Academy community of funded traders.'},
  ];
  return (
    <Page>
      <PageHero badge="CAREERS" title="Join the Hola Prime Team" subtitle="We are building the most transparent prop firm in the world. If you are passionate about trading, technology, and helping traders succeed — we want to hear from you." cta="View Open Roles" ctaLink="#roles"/>
      <section id="roles" style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <SectionH title="Open Positions" sub="All roles are remote-first. We hire based on skill, not location."/>
          <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
            {roles.map(r => (
              <div key={r.title} className="card-h" style={{ padding:'28px 32px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14,display:'flex',justifyContent:'space-between',alignItems:'center',gap:24 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:8 }}>
                    <h3 style={{ fontSize:16,fontWeight:700,color:B.white }}>{r.title}</h3>
                    <span style={{ fontSize:10,padding:'2px 8px',background:'rgba(79,140,247,0.1)',color:B.blueL,border:'1px solid rgba(79,140,247,0.2)',borderRadius:20,fontWeight:700 }}>{r.dept}</span>
                  </div>
                  <div style={{ display:'flex',gap:12,marginBottom:10,fontSize:12,color:B.txtD }}>
                    <span>📍 {r.loc}</span><span>⏱ {r.type}</span>
                  </div>
                  <p style={{ fontSize:13,color:B.txtB,lineHeight:1.6 }}>{r.desc}</p>
                </div>
                <a href="mailto:careers@holaprime.com" className="btn-p" style={{ whiteSpace:'nowrap',flexShrink:0,padding:'11px 22px',fontSize:13 }}>Apply Now</a>
              </div>
            ))}
          </div>
          <div style={{ marginTop:36,padding:'28px',background:'rgba(79,140,247,0.06)',border:'1px solid rgba(79,140,247,0.15)',borderRadius:14,textAlign:'center' }}>
            <p style={{ fontSize:14,color:B.txtB,marginBottom:10 }}>Don't see the right role? Send a speculative application to <a href="mailto:careers@holaprime.com" style={{ color:B.blue,fontWeight:600 }}>careers@holaprime.com</a></p>
          </div>
        </div>
      </section>
    </Page>
  );
}

export function Contact() {
  const [form, setForm] = useState({name:'',email:'',subject:'',message:''});
  const [sent, setSent] = useState(false);
  const up = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) => setForm(p => ({...p,[k]:e.target.value}));
  const inp = { width:'100%',background:'rgba(255,255,255,.05)',color:B.white,border:`1px solid ${B.bord}`,borderRadius:9,padding:'12px 16px',fontSize:14,outline:'none',fontFamily:'inherit',transition:'border-color .2s' } as React.CSSProperties;
  return (
    <Page>
      <PageHero badge="CONTACT US" title="Get in Touch" subtitle="Our support team is available 24/7 to help with any questions about challenges, payouts, or your account. Real humans, not bots." cta="Join Discord" ctaLink="https://discord.com/invite/hjDcUcEfgA"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto',display:'grid',gridTemplateColumns:'1fr 1fr',gap:48 }}>
          <div>
            <h2 style={{ fontSize:28,fontWeight:800,color:B.white,marginBottom:24 }}>Send a Message</h2>
            {sent ? (
              <div style={{ padding:'24px',background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:12,textAlign:'center' }}>
                <div style={{ fontSize:32,marginBottom:12 }}>✅</div>
                <div style={{ fontSize:16,fontWeight:700,color:B.white,marginBottom:8 }}>Message Sent!</div>
                <p style={{ fontSize:14,color:B.txtB }}>We'll get back to you within 2 hours. For urgent queries, join our Discord for instant support.</p>
              </div>
            ) : (
              <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
                  <div><label style={{ fontSize:12,color:B.txtC,display:'block',marginBottom:6 }}>Full Name</label><input value={form.name} onChange={up('name')} placeholder="John Doe" style={inp} onFocus={e=>e.target.style.borderColor=B.blue} onBlur={e=>e.target.style.borderColor=B.bord}/></div>
                  <div><label style={{ fontSize:12,color:B.txtC,display:'block',marginBottom:6 }}>Email</label><input type="email" value={form.email} onChange={up('email')} placeholder="you@example.com" style={inp} onFocus={e=>e.target.style.borderColor=B.blue} onBlur={e=>e.target.style.borderColor=B.bord}/></div>
                </div>
                <div><label style={{ fontSize:12,color:B.txtC,display:'block',marginBottom:6 }}>Subject</label>
                  <select value={form.subject} onChange={up('subject')} style={{ ...inp,cursor:'pointer' }} onFocus={e=>e.target.style.borderColor=B.blue} onBlur={e=>e.target.style.borderColor=B.bord}>
                    <option value="">Select a topic</option>
                    <option>Challenge & Evaluation</option>
                    <option>Payout Request</option>
                    <option>Account Management</option>
                    <option>Technical Support</option>
                    <option>Partnership & Affiliate</option>
                    <option>Other</option>
                  </select>
                </div>
                <div><label style={{ fontSize:12,color:B.txtC,display:'block',marginBottom:6 }}>Message</label><textarea value={form.message} onChange={up('message')} placeholder="Describe your question in detail…" rows={5} style={{ ...inp,resize:'vertical' }} onFocus={e=>e.target.style.borderColor=B.blue} onBlur={e=>e.target.style.borderColor=B.bord}/></div>
                <button onClick={() => { if(form.name && form.email && form.message) setSent(true); }} className="btn-p" style={{ width:'100%',padding:'14px',fontSize:15,justifyContent:'center' }}>Send Message →</button>
              </div>
            )}
          </div>
          <div>
            <h2 style={{ fontSize:28,fontWeight:800,color:B.white,marginBottom:24 }}>Other Ways to Reach Us</h2>
            <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
              {[
                {icon:'💬',title:'Live Chat',desc:'Chat with a real support agent right now. Available 24/7 on the website.',action:'Start Chat',link:'#'},
                {icon:'🎮',title:'Discord',desc:'Join our community of 5,000+ traders. Fastest response times for most questions.',action:'Join Discord',link:'https://discord.com/invite/hjDcUcEfgA'},
                {icon:'✉️',title:'Email Support',desc:'Send us an email at support@holaprime.com. We respond within 2 hours.',action:'Send Email',link:'mailto:support@holaprime.com'},
                {icon:'📱',title:'Social Media',desc:'Reach us on Twitter/X @HolaPrime or Instagram @holaprime.official.',action:'Follow Us',link:'#'},
              ].map(c => (
                <div key={c.title} style={{ padding:'20px 24px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:12,display:'flex',gap:16,alignItems:'center' }}>
                  <span style={{ fontSize:28,flexShrink:0 }}>{c.icon}</span>
                  <div style={{ flex:1 }}>
                    <h3 style={{ fontSize:15,fontWeight:700,color:B.white,marginBottom:4 }}>{c.title}</h3>
                    <p style={{ fontSize:13,color:B.txtB }}>{c.desc}</p>
                  </div>
                  <a href={c.link} className="btn-o" style={{ whiteSpace:'nowrap',padding:'9px 16px',fontSize:12,flexShrink:0 }}>{c.action}</a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// AFFILIATE
// ══════════════════════════════════════════════════════════════════════════════

export function AffiliatePage() {
  return (
    <Page>
      <PageHero badge="AFFILIATE PROGRAM" title="Earn with Every Referral" subtitle="Join the Hola Prime Affiliate Program and earn competitive commissions for every trader you refer. No cap on earnings — the more you refer, the more you earn." cta="Join Now — It's Free" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <StatsBar stats={[['Up to 30%','Commission Rate'],['Monthly','Payouts'],['Real-time','Dashboard'],['No Cap','On Earnings']]}/>
          <SectionH title="How the Affiliate Program Works"/>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:48 }}>
            {[
              {n:'01',icon:'🔗',t:'Get Your Link',d:'Sign up for the affiliate program and receive a unique tracking link and promo code.'},
              {n:'02',icon:'📢',t:'Share & Promote',d:'Share your link through social media, YouTube, blogs, email — wherever your audience is.'},
              {n:'03',icon:'👥',t:'Traders Sign Up',d:'Traders use your link to register and purchase challenges on Hola Prime.'},
              {n:'04',icon:'💸',t:'Earn Commission',d:'Receive your commission every month via bank transfer, crypto, or other payment methods.'},
            ].map(s => (
              <div key={s.n} style={{ padding:'24px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14,textAlign:'center' }}>
                <div style={{ width:44,height:44,borderRadius:'50%',background:`linear-gradient(135deg,${B.blue},${B.blueD})`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#fff',fontSize:12,margin:'0 auto 16px' }}>{s.n}</div>
                <div style={{ fontSize:24,marginBottom:10 }}>{s.icon}</div>
                <h3 style={{ fontSize:15,fontWeight:700,color:B.white,marginBottom:8 }}>{s.t}</h3>
                <p style={{ fontSize:13,color:B.txtB,lineHeight:1.6 }}>{s.d}</p>
              </div>
            ))}
          </div>
          <BenefitCards items={[
            {icon:'💰',title:'Competitive Commissions',desc:'Earn up to 30% commission on every challenge purchase made by a trader you refer. No limit on total earnings.'},
            {icon:'📊',title:'Real-time Dashboard',desc:'Track your clicks, signups, conversions, and commissions in real time through your personal affiliate dashboard.'},
            {icon:'🔄',title:'Recurring Commissions',desc:'Earn every time a referred trader makes a new purchase — including resets, upgrades, and additional challenges.'},
            {icon:'⚡',title:'Monthly Payouts',desc:'Commissions are paid out monthly via bank transfer, USDT, or other supported payment methods.'},
            {icon:'🎯',title:'Marketing Materials',desc:'Access a full library of banners, landing pages, email templates, and creative assets to support your promotion.'},
            {icon:'🤝',title:'Dedicated Manager',desc:'High-volume affiliates receive a dedicated affiliate manager to help optimise campaigns and maximise earnings.'},
          ]}/>
        </div>
      </section>
    </Page>
  );
}

export function AffiliateFAQ() {
  return (
    <Page>
      <PageHero badge="AFFILIATE FAQ" title="Affiliate Program FAQ" subtitle="Everything you need to know about earning with the Hola Prime Affiliate Program." cta="Join the Program" ctaLink="/affiliate"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:820,margin:'0 auto' }}>
          <FAQList items={[
            ['How much commission do I earn?','You can earn up to 30% of the challenge fee for every trader you refer. The exact commission rate depends on your affiliate tier, which is determined by your referral volume.'],
            ['When are commissions paid?','Commissions are paid monthly, typically on the 15th of each month for the previous month\'s confirmed conversions. Minimum payout threshold is $50.'],
            ['How long does the cookie last?','The affiliate tracking cookie lasts for 90 days. If a trader clicks your link and purchases a challenge within 90 days, you receive credit for the referral.'],
            ['Do I earn on resets and upgrades?','Yes. You earn a commission every time a referred trader makes any purchase — including new challenges, challenge resets, and account upgrades.'],
            ['What payment methods are available?','Affiliate commissions can be paid via bank wire, USDT, Bitcoin, PayPal, or Skrill. Select your preferred method in your affiliate dashboard.'],
            ['Is there a minimum referral requirement?','No. You can earn commissions from your very first referral with no minimum volume requirement.'],
            ['Can I be both a trader and an affiliate?','Yes. Many Hola Prime traders also participate in the affiliate program. You can hold a funded account and an affiliate account simultaneously.'],
          ]}/>
        </div>
      </section>
    </Page>
  );
}

export function AffiliateLogin() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const nav = useNavigate();
  return (
    <Page>
      <section style={{ padding:'80px 28px',background:B.bg0,minHeight:'80vh',display:'flex',alignItems:'center' }}>
        <div style={{ maxWidth:420,margin:'0 auto',width:'100%' }}>
          <div style={{ textAlign:'center',marginBottom:32 }}>
            <div style={{ fontSize:11,fontWeight:700,color:B.blue,letterSpacing:'.15em',marginBottom:12 }}>AFFILIATE PORTAL</div>
            <h1 style={{ fontSize:28,fontWeight:800,color:B.white,marginBottom:8 }}>Affiliate Login</h1>
            <p style={{ fontSize:14,color:B.txtB }}>Access your affiliate dashboard, track referrals, and view earnings.</p>
          </div>
          <div style={{ background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:18,padding:'36px 32px' }}>
            <div style={{ display:'flex',flexDirection:'column',gap:16 }}>
              <div>
                <label style={{ fontSize:12,color:B.txtC,display:'block',marginBottom:6 }}>Email Address</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="affiliate@example.com"
                  style={{ width:'100%',background:'rgba(255,255,255,.05)',color:B.white,border:`1px solid ${B.bord}`,borderRadius:9,padding:'12px 16px',fontSize:14,outline:'none',fontFamily:'inherit' }}
                  onFocus={e=>e.target.style.borderColor=B.blue} onBlur={e=>e.target.style.borderColor=B.bord}/>
              </div>
              <div>
                <label style={{ fontSize:12,color:B.txtC,display:'block',marginBottom:6 }}>Password</label>
                <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="••••••••"
                  style={{ width:'100%',background:'rgba(255,255,255,.05)',color:B.white,border:`1px solid ${B.bord}`,borderRadius:9,padding:'12px 16px',fontSize:14,outline:'none',fontFamily:'inherit' }}
                  onFocus={e=>e.target.style.borderColor=B.blue} onBlur={e=>e.target.style.borderColor=B.bord}/>
              </div>
              <button className="btn-p" style={{ width:'100%',padding:'14px',fontSize:15,justifyContent:'center',marginTop:8 }}>Sign In to Affiliate Dashboard</button>
              <div style={{ textAlign:'center',fontSize:13,color:B.txtC }}>Not an affiliate yet? <Link to="/affiliate" style={{ color:B.blue,fontWeight:600,textDecoration:'none' }}>Join the Program →</Link></div>
            </div>
          </div>
        </div>
      </section>
    </Page>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MORE PAGES
// ══════════════════════════════════════════════════════════════════════════════

export function PrimeAcademy() {
  const courses = [
    {icon:'📈',title:'Forex Fundamentals',level:'Beginner',lessons:12,desc:'Everything you need to know about the forex market — pairs, pips, spreads, and how currency markets move.'},
    {icon:'📊',title:'Technical Analysis Mastery',level:'Intermediate',lessons:18,desc:'Chart patterns, candlestick analysis, support & resistance, trend trading, and the indicators that actually matter.'},
    {icon:'🛡️',title:'Risk Management',level:'All Levels',lessons:8,desc:'Position sizing, drawdown management, the psychology of risk, and how to protect your account at all times.'},
    {icon:'🤖',title:'Algorithmic Trading',level:'Advanced',lessons:14,desc:'Build and backtest trading bots using MQL5 for MT5. No coding experience required to get started.'},
    {icon:'📉',title:'Futures Trading 101',level:'Beginner',lessons:10,desc:'Introduction to futures markets, contract specifications, margin requirements, and how to use Hola Prime futures accounts.'},
    {icon:'🧠',title:'Trading Psychology',level:'All Levels',lessons:6,desc:'Master the mental side of trading — discipline, handling losses, overcoming FOMO, and maintaining consistency.'},
  ];
  return (
    <Page>
      <PageHero badge="PRIME ACADEMY" title="Free Trading Education for Hola Prime Traders" subtitle="The Prime Academy gives every Hola Prime trader access to professional-grade education — completely free. Courses, webinars, and 1-on-1 coaching from experienced traders." cta="Join the Academy" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <StatsBar stats={[['6+','Course Modules'],['60+','Video Lessons'],['Weekly','Live Webinars'],['Free','For All Traders']]}/>
          <SectionH title="Course Library" sub="Structured learning paths from beginner to advanced, covering every aspect of prop trading success."/>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:48 }}>
            {courses.map(c => (
              <div key={c.title} className="card-h" style={{ padding:'24px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14 }}>
                <div style={{ fontSize:32,marginBottom:14 }}>{c.icon}</div>
                <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10 }}>
                  <h3 style={{ fontSize:15,fontWeight:700,color:B.white }}>{c.title}</h3>
                </div>
                <div style={{ display:'flex',gap:8,marginBottom:12 }}>
                  <span style={{ fontSize:11,padding:'2px 8px',background:'rgba(79,140,247,0.1)',color:B.blueL,border:'1px solid rgba(79,140,247,0.2)',borderRadius:20 }}>{c.level}</span>
                  <span style={{ fontSize:11,color:B.txtD }}>{c.lessons} lessons</span>
                </div>
                <p style={{ fontSize:13,color:B.txtB,lineHeight:1.7,marginBottom:16 }}>{c.desc}</p>
                <Link to="/register" style={{ fontSize:13,color:B.blue,fontWeight:600,textDecoration:'none' }}>Enrol Free →</Link>
              </div>
            ))}
          </div>
          <div style={{ padding:'36px',background:'rgba(79,140,247,0.06)',border:'1px solid rgba(79,140,247,0.15)',borderRadius:16,textAlign:'center' }}>
            <h3 style={{ fontSize:20,fontWeight:700,color:B.white,marginBottom:10 }}>Weekly Live Webinars</h3>
            <p style={{ fontSize:15,color:B.txtB,marginBottom:20,maxWidth:560,margin:'0 auto 20px' }}>Join live weekly sessions with experienced traders covering market analysis, strategy reviews, and Q&A. Available to all Hola Prime account holders.</p>
            <Link to="/register" className="btn-p" style={{ fontSize:14,padding:'13px 28px' }}>Get Funded to Access Webinars</Link>
          </div>
        </div>
      </section>
    </Page>
  );
}

export function Competition() {
  return (
    <Page>
      <PageHero badge="TRADING COMPETITION" title="Prop Firm Trading Competition" subtitle="Compete against traders worldwide, showcase your skills, and win real cash prizes. Open to all Hola Prime challenge and funded account holders." cta="Enter Competition" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <StatsBar stats={[['$50,000+','Total Prize Pool'],['Monthly','Competitions'],['Open to','All Traders'],['Real Cash','Prizes']]}/>
          <SectionH title="How the Competition Works"/>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:48 }}>
            {[
              {n:'01',t:'Register & Join',d:'Hold any active Hola Prime challenge or funded account. Registration for each competition is free and opens 7 days before the start date.'},
              {n:'02',t:'Trade to Win',d:'Compete over the competition period (usually 30 days). Rankings are based on profit percentage, not absolute dollar amount — making it fair for all account sizes.'},
              {n:'03',t:'Claim Your Prize',d:'Top-ranked traders win cash prizes paid directly to their account. Prizes are also awarded for most consistent performance and best risk-adjusted returns.'},
            ].map(s => (
              <div key={s.n} style={{ padding:'28px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14 }}>
                <div style={{ width:36,height:36,borderRadius:'50%',background:`linear-gradient(135deg,${B.blue},${B.blueD})`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#fff',fontSize:13,marginBottom:16 }}>{s.n}</div>
                <h3 style={{ fontSize:16,fontWeight:700,color:B.white,marginBottom:8 }}>{s.t}</h3>
                <p style={{ fontSize:13,color:B.txtB,lineHeight:1.7 }}>{s.d}</p>
              </div>
            ))}
          </div>
          <div style={{ padding:'36px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:16 }}>
            <h3 style={{ fontSize:20,fontWeight:700,color:B.white,marginBottom:20 }}>Monthly Prize Structure</h3>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12 }}>
              {[['🥇 1st','$10,000'],['🥈 2nd','$5,000'],['🥉 3rd','$2,500'],['4th–10th','$500 each'],['Top 50','Challenge Reset']].map(([rank,prize]) => (
                <div key={rank} style={{ padding:'18px',background:B.bg3,border:`1px solid ${B.bord}`,borderRadius:10,textAlign:'center' }}>
                  <div style={{ fontSize:13,fontWeight:700,color:B.txtC,marginBottom:6 }}>{rank}</div>
                  <div style={{ fontSize:18,fontWeight:800,color:B.white }}>{prize}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </Page>
  );
}

export function RiskControl() {
  return (
    <Page>
      <PageHero badge="RISK CONTROL" title="Our Risk Management Framework" subtitle="Transparency isn't just about payouts — it's about how we manage risk. Here's an honest look at how Hola Prime maintains financial stability and protects both traders and the firm." cta="Learn More" ctaLink="/about"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <SectionH title="How We Manage Risk" sub="Our risk framework is built on five core pillars that ensure every funded trader's payouts are secure and every rule is enforced consistently."/>
          <BenefitCards items={[
            {icon:'📋',title:'Clear Rule Enforcement',desc:'All risk rules — daily loss limits, maximum drawdown, and profit targets — are enforced automatically and consistently across all accounts.'},
            {icon:'💰',title:'Dedicated Payout Reserves',desc:'We maintain dedicated reserves specifically for trader payouts, including a 30–40% liquidity buffer to handle peak demand periods.'},
            {icon:'👁️',title:'Daily Risk Monitoring',desc:'Our risk team reviews account activity every day to identify unusual patterns and ensure the platform remains financially healthy.'},
            {icon:'🔍',title:'Independent Compliance',desc:'An independent compliance team verifies all payout requests and trader activity to ensure fairness and regulatory alignment.'},
            {icon:'⚖️',title:'Balanced Trader-Firm Model',desc:'Our rules are designed so that consistently profitable, well-managed traders succeed — and the firm remains sustainable long-term.'},
            {icon:'📊',title:'Published Transparency Data',desc:'We publish our payout statistics, approval rates, and processing times publicly so any trader can verify our claims independently.'},
          ]}/>
        </div>
      </section>
    </Page>
  );
}

export function Blog() {
  const posts = [
    {cat:'Prop Trading',date:'Mar 2025',title:'Why Zero Payout Denial Changes Everything for Prop Traders',desc:'For years, payout denials were the dirty secret of the prop trading industry. We explain how Hola Prime ended that pattern — and why it matters for every trader.',readTime:'6 min read'},
    {cat:'Education',date:'Mar 2025',title:'How to Pass a Prop Firm Challenge: A Complete Guide',desc:'From choosing the right challenge to managing your daily loss limit, this complete guide covers everything you need to know about passing a prop firm evaluation.',readTime:'12 min read'},
    {cat:'Futures',date:'Feb 2025',title:'Futures Trading for Forex Traders: What You Need to Know',desc:'Making the switch from forex to futures? This guide explains the key differences, the instruments available, and how to approach futures trading on Hola Prime.',readTime:'8 min read'},
    {cat:'Risk Management',date:'Feb 2025',title:'Position Sizing: The Skill That Separates Funded Traders from the Rest',desc:'Most traders focus on entries and exits. The traders who stay funded focus on position sizing. Here\'s how to get it right.',readTime:'7 min read'},
    {cat:'Platform',date:'Jan 2025',title:'MT5 vs cTrader vs DXTrade: Which Platform is Right for You?',desc:'A detailed comparison of the three most popular platforms available on Hola Prime — helping you choose the right tool for your trading style.',readTime:'9 min read'},
    {cat:'Psychology',date:'Jan 2025',title:'The Mental Game: How to Trade Consistently Without Blowing Your Account',desc:'Trading psychology is the most underrated skill in prop trading. A deep dive into the mental patterns that cause traders to fail challenges — and how to fix them.',readTime:'10 min read'},
  ];
  return (
    <Page>
      <PageHero badge="BLOG" title="Hola Prime Blog" subtitle="Insights, guides, and market analysis from the Hola Prime team and our community of funded traders." cta="Get Funded" ctaLink="/register"/>
      <section style={{ padding:'72px 28px',background:B.bg1 }}>
        <div style={{ maxWidth:1280,margin:'0 auto' }}>
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20 }}>
            {posts.map(p => (
              <div key={p.title} className="card-h" style={{ background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:16,overflow:'hidden',cursor:'pointer' }}>
                <div style={{ height:4,background:`linear-gradient(90deg,${B.blue},${B.bg2})` }}/>
                <div style={{ padding:'24px' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
                    <span style={{ fontSize:10,fontWeight:800,color:B.blue,padding:'2px 8px',background:'rgba(79,140,247,0.1)',border:'1px solid rgba(79,140,247,0.2)',borderRadius:20 }}>{p.cat}</span>
                    <span style={{ fontSize:11,color:B.txtD }}>{p.date}</span>
                    <span style={{ fontSize:11,color:B.txtD,marginLeft:'auto' }}>{p.readTime}</span>
                  </div>
                  <h3 style={{ fontSize:16,fontWeight:700,color:B.white,marginBottom:10,lineHeight:1.4 }}>{p.title}</h3>
                  <p style={{ fontSize:13,color:B.txtB,lineHeight:1.7,marginBottom:16 }}>{p.desc}</p>
                  <span style={{ fontSize:13,color:B.blue,fontWeight:600 }}>Read article →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Page>
  );
}

// ── Re-export PayoutReport ────────────────────────────────────────────────────
export { TransparencyReport as PayoutReport };
