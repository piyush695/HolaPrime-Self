import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// ── EXACT Hola Prime colour palette (from live site screenshots) ──────────────
// The site uses a deep blue-navy dark theme, NOT pure black
// Primary bg: deep navy #0D1117 → #0A0E1A range
// Cards/surfaces: slightly lighter navy #111827 / #131C2E
// Accent blue: bright electric blue #3B82F6 / #60A5FA
// Text: pure white headings, #9CA3AF body, #6B7280 muted
// CTA button: electric blue with gradient
// Green for profit/positive: #10B981
// Border: #1E2A3B / #1F2937
const B = {
  // Backgrounds — deep navy blues matching the site
  bg0:   '#080D18',   // darkest (hero sections)
  bg1:   '#0B1120',   // main site background
  bg2:   '#0F1629',   // card background
  bg3:   '#141D32',   // elevated card
  bg4:   '#1A2440',   // hover states
  bord:  '#1E2A3B',   // default border
  bordL: '#253147',   // lighter border
  // Electric blue — primary accent
  blue:  '#4F8CF7',   // primary blue
  blueD: '#1D4ED8',   // darker blue
  blueL: '#93C5FD',   // light blue
  blueGlow: 'rgba(79,140,247,0.25)',
  // Text
  white:  '#FFFFFF',
  txtA:   '#F1F5F9',   // primary text — near white
  txtB:   '#CBD5E1',   // body text — light blue-grey
  txtC:   '#94A3B8',   // secondary — medium grey-blue
  txtD:   '#64748B',   // muted
  // Accents
  green:  '#10B981',
  greenL: '#34D399',
  red:    '#EF4444',
  gold:   '#F59E0B',
};

const CDN = 'https://d3e6em9gfrqmqr.cloudfront.net/corporate';

// ── Global CSS ────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#0B1120;color:#F1F5F9;-webkit-font-smoothing:antialiased;overflow-x:hidden}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#080D18}::-webkit-scrollbar-thumb{background:#253147;border-radius:3px}::-webkit-scrollbar-thumb:hover{background:#4F8CF7}

@keyframes mq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
.mqr{display:flex;width:max-content;animation:mq 30s linear infinite}
.mqr:hover{animation-play-state:paused}
@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(79,140,247,0.3)}50%{box-shadow:0 0 40px rgba(79,140,247,0.6)}}
.fu{animation:fadeUp .6s cubic-bezier(.16,1,.3,1) both}
.fu1{animation-delay:.1s}.fu2{animation-delay:.2s}.fu3{animation-delay:.3s}
.rv{opacity:0;transform:translateY(28px);transition:opacity .6s ease,transform .6s ease}
.rv.in{opacity:1;transform:translateY(0)}
.d1{transition-delay:.1s}.d2{transition-delay:.2s}.d3{transition-delay:.3s}.d4{transition-delay:.4s}

/* Primary CTA — electric blue gradient, matching site */
.btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;cursor:pointer;padding:13px 28px;background:linear-gradient(135deg,#4F8CF7,#1D4ED8);color:#fff;border:none;border-radius:8px;font-size:14px;text-decoration:none;box-shadow:0 4px 16px rgba(79,140,247,0.35);transition:all .2s}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(79,140,247,0.5);filter:brightness(1.08)}

/* Outline button */
.btn-outline{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:'Plus Jakarta Sans',sans-serif;font-weight:600;cursor:pointer;padding:12px 24px;background:rgba(79,140,247,0.08);color:#93C5FD;border:1px solid rgba(79,140,247,0.3);border-radius:8px;font-size:14px;text-decoration:none;transition:all .2s}
.btn-outline:hover{background:rgba(79,140,247,0.15);border-color:rgba(79,140,247,0.6);color:#fff;transform:translateY(-1px)}

/* Nav */
.nav-btn{background:none;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:500;color:#94A3B8;padding:8px 14px;border-radius:8px;display:flex;align-items:center;gap:5px;transition:color .15s;white-space:nowrap}
.nav-btn:hover{color:#F1F5F9}

/* Cards */
.card-hover{transition:transform .25s ease,border-color .25s ease,box-shadow .25s ease}
.card-hover:hover{transform:translateY(-4px);border-color:#253147 !important;box-shadow:0 8px 32px rgba(0,0,0,0.4)}

/* Plan tabs */
.ptab{transition:all .2s;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;border-radius:8px}
.ptab.on{background:linear-gradient(135deg,#4F8CF7,#1D4ED8) !important;color:#fff !important;border-color:transparent !important;box-shadow:0 4px 14px rgba(79,140,247,0.4)}

/* Size buttons */
.sbtn{transition:all .18s;cursor:pointer}
.sbtn.on{background:#4F8CF7 !important;color:#fff !important;border-color:#4F8CF7 !important}
.sbtn:not(.on):hover{border-color:#4F8CF7 !important;color:#93C5FD !important}

/* Platform cards */
.plt{transition:all .22s}
.plt:hover{border-color:#4F8CF7 !important;background:#141D32 !important;transform:translateY(-3px);box-shadow:0 8px 24px rgba(79,140,247,0.15)}

/* FAQ */
.faq-item{border-bottom:1px solid #1E2A3B;transition:border-color .2s}

/* Grain overlay */
.grain::after{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");opacity:.018;pointer-events:none;z-index:9999}
`;

function useReveal() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      es => es.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); }),
      { threshold: .08, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.rv').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  });
}

// ── ANNOUNCEMENT BAR ──────────────────────────────────────────────────────────
function AnnBar() {
  const [show, setShow] = useState(true);
  if (!show) return null;
  return (
    <div style={{ background: 'linear-gradient(90deg,#1D4ED8,#4F8CF7,#1D4ED8)', padding: '9px 20px', textAlign: 'center', position: 'relative', zIndex: 100 }}>
      <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
        🎮 Play Dunk Trade & Get 15% OFF Your Challenge —{' '}
        <Link to="/register" style={{ color: '#fff', textDecoration: 'underline', fontWeight: 800 }}>Play Now →</Link>
      </span>
      <button onClick={() => setShow(false)} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 18 }}>×</button>
    </div>
  );
}

// ── TICKER ────────────────────────────────────────────────────────────────────
const TICKS = [
  {p:'EUR/USD',v:'1.08542',c:'+0.0012',u:true},{p:'GBP/USD',v:'1.26831',c:'+0.0024',u:true},
  {p:'USD/JPY',v:'149.832',c:'-0.421',u:false},{p:'GOLD',v:'2,341.50',c:'+8.40',u:true},
  {p:'BTC/USD',v:'67,842',c:'+1,241',u:true},{p:'S&P 500',v:'5,234',c:'+12.4',u:true},
  {p:'AUD/USD',v:'0.65241',c:'-0.0008',u:false},{p:'CRUDE OIL',v:'79.42',c:'-0.58',u:false},
  {p:'USD/CHF',v:'0.89763',c:'+0.0006',u:true},{p:'EUR/JPY',v:'162.14',c:'+0.32',u:true},
];
function Ticker() {
  const items = [...TICKS,...TICKS,...TICKS];
  return (
    <div style={{ background: '#080D18', borderBottom: `1px solid ${B.bord}`, padding: '6px 0', overflow: 'hidden', position: 'relative' }}>
      <div style={{ position:'absolute',left:0,top:0,bottom:0,width:60,background:`linear-gradient(90deg,#080D18,transparent)`,zIndex:2 }}/>
      <div style={{ position:'absolute',right:0,top:0,bottom:0,width:60,background:`linear-gradient(-90deg,#080D18,transparent)`,zIndex:2 }}/>
      <div className="mqr" style={{ gap:36 }}>
        {items.map((t,i) => (
          <div key={i} style={{ display:'flex',alignItems:'center',gap:8,flexShrink:0 }}>
            <span style={{ fontSize:11,fontWeight:700,color:B.txtD,letterSpacing:'.05em' }}>{t.p}</span>
            <span style={{ fontSize:12,fontWeight:600,color:B.txtA,fontFamily:'monospace' }}>{t.v}</span>
            <span style={{ fontSize:10,fontWeight:700,color:t.u?B.green:B.red,background:t.u?'rgba(16,185,129,.1)':'rgba(239,68,68,.1)',padding:'1px 6px',borderRadius:3 }}>
              {t.u?'▲':'▼'} {t.c}
            </span>
            <span style={{ width:1,height:10,background:B.bord,flexShrink:0 }}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NAVBAR ────────────────────────────────────────────────────────────────────
const NAV = [
  {label:'Forex',menu:[
    {hd:'Plans',items:[
      ['Pro Challenge','1-step & 2-step from $59','/forex/pro-challenge'],
      ['Prime Challenge','From $39','/forex/prime-challenge'],
      ['One Challenge','Single phase, fast track','/forex/one-challenge'],
      ['Direct Account','Instant funding','/forex/direct-account'],
      ['Scaling Plan','Up to $4M','/forex/scaling'],
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
      ['Prime Challenge','1-step futures challenge','/futures/prime-challenge'],
      ['Direct Account','Instant futures funding','/futures/direct-account'],
      ['Instruments','50+ futures instruments','/futures/instruments'],
      ['Trading Rules','Futures guidelines','/futures/trading-rules'],
      ['FAQs','Common questions','/futures/faq'],
    ]},
  ]},
  {label:'About',menu:[
    {hd:'Company',items:[
      ['Who We Are','Our story & mission','/about'],
      ['Our Team','Meet the team','/team'],
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

function Navbar() {
  const [scrolled,setScrolled]=useState(false);
  const [hover,setHover]=useState(null);
  useEffect(()=>{
    const h=()=>setScrolled(window.scrollY>10);
    window.addEventListener('scroll',h);return()=>window.removeEventListener('scroll',h);
  },[]);
  return (
    <nav style={{ position:'sticky',top:0,zIndex:999,background:scrolled?'rgba(11,17,32,.97)':'rgba(11,17,32,.75)',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',borderBottom:`1px solid ${scrolled?B.bord:'transparent'}`,transition:'all .3s' }}>
      <div style={{ maxWidth:1280,margin:'0 auto',padding:'0 28px',display:'flex',alignItems:'center',height:68 }}>
        {/* LOGO — full-width, prominent */}
        <Link to="/" style={{ textDecoration:'none',flexShrink:0,display:'flex',alignItems:'center' }}>
          <img src="/logo-white.png" alt="hola prime" style={{ height:52,width:'auto',objectFit:'contain',display:'block' }}/>
        </Link>
        {/* Nav */}
        <div style={{ display:'flex',alignItems:'center',gap:0,marginLeft:44,flex:1 }}>
          {NAV.map(item=>(
            <div key={item.label} style={{ position:'relative' }} onMouseEnter={()=>setHover(item.label)} onMouseLeave={()=>setHover(null)}>
              <button className="nav-btn" style={{ color:hover===item.label?B.white:B.txtC }}>
                {item.label}
                {item.tag&&<span style={{ fontSize:9,padding:'2px 6px',background:B.blue,color:'#fff',borderRadius:20,fontWeight:800,marginLeft:2 }}>{item.tag}</span>}
                <span style={{ fontSize:9,color:B.txtD,transition:'transform .2s',transform:hover===item.label?'rotate(180deg)':'none',display:'inline-block' }}>▼</span>
              </button>
              {hover===item.label&&item.menu&&(
                <div style={{ position:'absolute',top:'100%',left:'50%',transform:'translateX(-50%)',marginTop:8,background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14,padding:'20px 22px',minWidth:440,boxShadow:'0 20px 60px rgba(0,0,0,.7)',display:'flex',gap:24,animation:'fadeUp .15s ease' }}>
                  {item.menu.map(sec=>(
                    <div key={sec.hd} style={{ flex:1 }}>
                      <div style={{ fontSize:10,fontWeight:800,color:B.blue,letterSpacing:'.14em',marginBottom:12 }}>{sec.hd.toUpperCase()}</div>
                      {sec.items.map(([lbl,sub,href])=>(
                        <Link key={lbl} to={href} style={{ textDecoration:'none',display:'block',padding:'8px 10px',borderRadius:8,marginBottom:2,transition:'background .12s' }}
                          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=B.bg3}
                          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
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
        {/* CTAs */}
        <div style={{ display:'flex',alignItems:'center',gap:10,flexShrink:0 }}>
          <a href="https://discord.com/invite/hjDcUcEfgA" target="_blank" rel="noreferrer" className="btn-outline" style={{ padding:'8px 16px',fontSize:13 }}>Join</a>
          <Link to="/login" style={{ padding:'8px 16px',borderRadius:8,textDecoration:'none',fontSize:13,color:B.txtC,fontWeight:500,transition:'color .15s' }}
            onMouseEnter={e=>e.currentTarget.style.color=B.white}
            onMouseLeave={e=>e.currentTarget.style.color=B.txtC}>Login</Link>
          <Link to="/register" className="btn-primary" style={{ fontSize:14,padding:'10px 24px' }}>Get Funded</Link>
        </div>
      </div>
    </nav>
  );
}

// ── HERO CANVAS ───────────────────────────────────────────────────────────────
function HeroCanvas() {
  const ref=useRef(null);
  useEffect(()=>{
    const canvas=ref.current;if(!canvas)return;
    const ctx=canvas.getContext('2d');
    let id,w=canvas.width=canvas.offsetWidth,h=canvas.height=canvas.offsetHeight;
    const onR=()=>{w=canvas.width=canvas.offsetWidth;h=canvas.height=canvas.offsetHeight;};
    window.addEventListener('resize',onR);
    function genPrices(n,start,vol){const a=[start];for(let i=1;i<n;i++)a.push(Math.max(a[i-1]*(1+(Math.random()-.47)*vol),start*.9));return a;}
    const prices=genPrices(160,1.0850,0.0007);
    const candles=Array.from({length:50},(_,i)=>{
      const o=prices[i*3]||prices[0],c=prices[i*3+2]||o;
      return{o,c,hi:Math.max(o,c)*(1+Math.random()*.0003),lo:Math.min(o,c)*(1-Math.random()*.0003)};
    });
    const pts=Array.from({length:55},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.22,vy:(Math.random()-.5)*.22}));
    let t=0;
    const draw=()=>{
      ctx.clearRect(0,0,w,h);
      // Deep navy bg
      const bg=ctx.createLinearGradient(0,0,w,h);
      bg.addColorStop(0,'#080D18');bg.addColorStop(1,'#0B1120');
      ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
      // Blue glow top-right
      const g1=ctx.createRadialGradient(w*.8,h*.15,0,w*.8,h*.15,w*.55);
      g1.addColorStop(0,'rgba(79,140,247,0.08)');g1.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g1;ctx.fillRect(0,0,w,h);
      const g2=ctx.createRadialGradient(w*.15,h*.7,0,w*.15,h*.7,w*.4);
      g2.addColorStop(0,'rgba(29,78,216,0.06)');g2.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g2;ctx.fillRect(0,0,w,h);
      // Grid
      ctx.strokeStyle='rgba(79,140,247,0.05)';ctx.lineWidth=1;
      for(let x=0;x<w;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
      for(let y=0;y<h;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
      // Chart
      const cX=w*.36,cW=w*.58,cH=h*.5,cY=h*.2;
      const minP=Math.min(...prices)*.9999,maxP=Math.max(...prices)*1.0001,range=maxP-minP;
      const toY=p=>cY+cH*(1-(p-minP)/range);
      const cw=cW/candles.length;
      candles.forEach((c,i)=>{
        const x=cX+i*cw,bull=c.c>=c.o;
        const alpha=0.2+(i/candles.length)*0.6;
        const col=bull?`rgba(79,140,247,${alpha})`:`rgba(239,68,68,${alpha*.7})`;
        ctx.strokeStyle=col;ctx.lineWidth=.8;
        ctx.beginPath();ctx.moveTo(x+cw/2,toY(c.hi));ctx.lineTo(x+cw/2,toY(c.lo));ctx.stroke();
        ctx.fillStyle=col;ctx.fillRect(x+1,Math.min(toY(c.o),toY(c.c)),cw-2,Math.max(Math.abs(toY(c.o)-toY(c.c)),1));
      });
      // Price line blue
      ctx.beginPath();
      prices.forEach((p,i)=>{const x=cX+(i/prices.length)*cW,y=toY(p);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
      const lg=ctx.createLinearGradient(cX,0,cX+cW,0);
      lg.addColorStop(0,'rgba(79,140,247,0)');lg.addColorStop(1,'rgba(79,140,247,0.9)');
      ctx.strokeStyle=lg;ctx.lineWidth=2;ctx.stroke();
      // Area fill
      ctx.beginPath();
      prices.forEach((p,i)=>{const x=cX+(i/prices.length)*cW,y=toY(p);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
      ctx.lineTo(cX+cW,cY+cH);ctx.lineTo(cX,cY+cH);ctx.closePath();
      const ag=ctx.createLinearGradient(0,cY,0,cY+cH);
      ag.addColorStop(0,'rgba(79,140,247,0.12)');ag.addColorStop(1,'rgba(79,140,247,0)');
      ctx.fillStyle=ag;ctx.fill();
      // Live dot
      const lp=prices[prices.length-1],ly=toY(lp);
      ctx.beginPath();ctx.arc(cX+cW,ly,4,0,Math.PI*2);ctx.fillStyle='#4F8CF7';ctx.fill();
      ctx.beginPath();ctx.arc(cX+cW,ly,9,0,Math.PI*2);ctx.fillStyle='rgba(79,140,247,0.2)';ctx.fill();
      // Y axis labels
      [0,.25,.5,.75,1].forEach(f=>{
        const pval=(minP+range*(1-f)).toFixed(4);
        ctx.font='9px monospace';ctx.fillStyle='rgba(148,163,184,0.3)';
        ctx.fillText(pval,cX-46,cY+cH*f+3);
        ctx.strokeStyle='rgba(79,140,247,0.05)';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(cX,cY+cH*f);ctx.lineTo(cX+cW,cY+cH*f);ctx.stroke();
      });
      // Particles
      pts.forEach(p=>{
        p.x+=p.vx;p.y+=p.vy;
        if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1;
        ctx.beginPath();ctx.arc(p.x,p.y,1,0,Math.PI*2);
        ctx.fillStyle='rgba(79,140,247,0.25)';ctx.fill();
      });
      for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){
        const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy);
        if(d<80){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);
          ctx.strokeStyle=`rgba(79,140,247,${.07*(1-d/80)})`;ctx.lineWidth=.5;ctx.stroke();}
      }
      t++;id=requestAnimationFrame(draw);
    };
    draw();
    return()=>{cancelAnimationFrame(id);window.removeEventListener('resize',onR);};
  },[]);
  return <canvas ref={ref} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}/>;
}

// ── HERO ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ position:'relative',minHeight:'92vh',display:'flex',alignItems:'center',background:B.bg0,overflow:'hidden' }}>
      <HeroCanvas/>
      <div style={{ position:'relative',zIndex:2,maxWidth:1280,margin:'0 auto',padding:'80px 28px',width:'100%' }}>
        {/* Badge */}
        <div className="fu" style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'6px 16px',background:'rgba(79,140,247,0.1)',border:'1px solid rgba(79,140,247,0.3)',borderRadius:50,marginBottom:32 }}>
          <span style={{ width:6,height:6,borderRadius:'50%',background:B.blue,animation:'pulse 2s infinite',boxShadow:`0 0 8px ${B.blue}` }}/>
          <span style={{ fontSize:11,fontWeight:700,color:B.blueL,letterSpacing:'.1em' }}>BACKED BY A REGULATED, AWARD-WINNING BROKER</span>
        </div>
        {/* Headline — exact title case from holaprime.com */}
        <div className="fu fu1">
          <h1 style={{ fontSize:'clamp(52px,7vw,88px)',fontWeight:800,lineHeight:1.05,letterSpacing:'-.03em',color:B.white,marginBottom:4 }}>We are</h1>
          <h1 style={{ fontSize:'clamp(52px,7vw,88px)',fontWeight:800,lineHeight:1.05,letterSpacing:'-.03em',color:B.white,marginBottom:24 }}>Traders</h1>
        </div>
        <p className="fu fu2" style={{ fontSize:18,color:B.txtB,lineHeight:1.75,maxWidth:500,marginBottom:36 }}>
          We live the same battles you do and build solutions that truly help you succeed.
        </p>
        <div className="fu fu3" style={{ display:'flex',gap:14,flexWrap:'wrap',marginBottom:56 }}>
          <Link to="/register" className="btn-primary" style={{ fontSize:15,padding:'14px 32px' }}>Trade Our Money</Link>
          <a href="#plans" className="btn-outline" style={{ fontSize:15,padding:'13px 28px' }}>View Challenges</a>
        </div>
        {/* Stats */}
        <div className="fu" style={{ animationDelay:'.4s',display:'flex',gap:12,flexWrap:'wrap' }}>
          {[['$0','ZERO PAYOUT DENIAL'],['33m 48s','AVG PAYOUT TIME'],['20K+','FUNDED TRADERS'],['175+','COUNTRIES'],['$4,500','AVG PAYOUT/TRADER']].map(([v,l])=>(
            <div key={l} style={{ display:'flex',flexDirection:'column',padding:'12px 20px',background:'rgba(79,140,247,0.06)',border:`1px solid rgba(79,140,247,0.18)`,borderRadius:10 }}>
              <span style={{ fontSize:18,fontWeight:800,color:B.white,lineHeight:1 }}>{v}</span>
              <span style={{ fontSize:10,color:B.txtD,letterSpacing:'.06em',marginTop:4 }}>{l}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ position:'absolute',bottom:28,left:'50%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:4,opacity:.3 }}>
        <div style={{ width:1,height:28,background:`linear-gradient(${B.blue},transparent)` }}/>
        <span style={{ fontSize:9,color:B.txtD,letterSpacing:'.12em' }}>SCROLL</span>
      </div>
    </section>
  );
}

// ── ZERO DENIAL BAND ──────────────────────────────────────────────────────────
function ZeroBand() {
  return (
    <section style={{ background:B.bg0,padding:'64px 28px',borderTop:`1px solid ${B.bord}` }}>
      <div style={{ maxWidth:1280,margin:'0 auto',display:'flex',alignItems:'center',gap:60,flexWrap:'wrap' }}>
        <div className="rv" style={{ flex:'0 0 auto' }}>
          <div style={{ fontSize:'clamp(80px,13vw,160px)',fontWeight:800,letterSpacing:'-.04em',color:'transparent',WebkitTextStroke:`1.5px rgba(79,140,247,0.2)`,lineHeight:1,userSelect:'none' }}>ZERO</div>
        </div>
        <div className="rv d1" style={{ flex:1,minWidth:240 }}>
          <div style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'4px 12px',background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:4,marginBottom:14 }}>
            <span style={{ width:5,height:5,borderRadius:'50%',background:B.green }}/>
            <span style={{ fontSize:10,fontWeight:800,color:B.green,letterSpacing:'.1em' }}>INDUSTRY FIRST</span>
          </div>
          <h2 style={{ fontSize:'clamp(28px,3.5vw,48px)',fontWeight:800,color:B.white,lineHeight:1.1,marginBottom:14 }}>Zero Payout<br/>Denial Policy</h2>
          <p style={{ fontSize:16,color:B.txtB,lineHeight:1.75,maxWidth:440 }}>
            If you've followed the rules and earned your profits, we pay. Every time. No excuses, no delays, no denials.
          </p>
        </div>
        <div className="rv d2" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
          {[['33m 48s','Average Payout Time'],['3m 37s','Fastest Payout'],['$4,500','Average / Trader'],['95%','Max Profit Split']].map(([v,l])=>(
            <div key={l} style={{ padding:'20px 24px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:12,textAlign:'center' }}>
              <div style={{ fontSize:22,fontWeight:800,color:B.blue,marginBottom:4 }}>{v}</div>
              <div style={{ fontSize:11,color:B.txtD }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CELEBRATING ───────────────────────────────────────────────────────────────
function Celebrating() {
  return (
    <section style={{ background:B.bg1,padding:'48px 28px',borderTop:`1px solid ${B.bord}` }}>
      <div style={{ maxWidth:1280,margin:'0 auto' }}>
        <div className="rv" style={{ textAlign:'center',marginBottom:28 }}>
          <h2 style={{ fontSize:'clamp(20px,2.8vw,34px)',fontWeight:800,color:B.white,marginBottom:6 }}>Celebrating the Global Trader</h2>
        </div>
        <div className="rv d1" style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:0,border:`1px solid ${B.bord}`,borderRadius:14,overflow:'hidden' }}>
          {[['$38','Starting fee'],['1-Hour','Payouts'],['$300K','Account Size'],['175+','Countries']].map(([v,l],i)=>(
            <div key={l} style={{ padding:'28px 24px',borderRight:i<3?`1px solid ${B.bord}`:'none',textAlign:'center',background:B.bg2 }}>
              <div style={{ fontSize:32,fontWeight:800,color:B.white,marginBottom:6 }}>{v}</div>
              <div style={{ fontSize:13,color:B.txtC,fontWeight:500 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── PRESS — actual holaprime CDN images ───────────────────────────────────────
function Press() {
  const logos=[
    {src:`${CDN}/dailyforex.webp`,alt:'DailyForex'},
    {src:`${CDN}/forbes.webp`,alt:'Forbes'},
    {src:`${CDN}/yahoo.webp`,alt:'Yahoo Finance'},
    {src:`${CDN}/marketwatch.webp`,alt:'MarketWatch'},
    {src:`${CDN}/fxempire.webp`,alt:'FXEmpire'},
    {src:`${CDN}/fxmag.webp`,alt:'FXMag'},
    {src:`${CDN}/fxstreet.webp`,alt:'FXStreet'},
  ];
  const d=[...logos,...logos,...logos];
  return (
    <div style={{ padding:'28px 0',borderTop:`1px solid ${B.bord}`,borderBottom:`1px solid ${B.bord}`,overflow:'hidden',background:B.bg0,position:'relative' }}>
      <div style={{ position:'absolute',left:0,top:0,bottom:0,width:100,background:`linear-gradient(90deg,${B.bg0},transparent)`,zIndex:2 }}/>
      <div style={{ position:'absolute',right:0,top:0,bottom:0,width:100,background:`linear-gradient(-90deg,${B.bg0},transparent)`,zIndex:2 }}/>
      <div style={{ fontSize:9,fontWeight:800,color:B.txtD,letterSpacing:'.2em',textAlign:'center',marginBottom:14 }}>AS FEATURED IN</div>
      <div className="mqr" style={{ gap:52,animationDuration:'28s',alignItems:'center' }}>
        {d.map((logo,i)=>(
          <img key={i} src={logo.src} alt={logo.alt}
            style={{ height:20,width:'auto',objectFit:'contain',opacity:.45,flexShrink:0,filter:'brightness(0) invert(1)',transition:'opacity .2s' }}
            onMouseEnter={e=>e.currentTarget.style.opacity='0.85'}
            onMouseLeave={e=>e.currentTarget.style.opacity='0.45'}
            onError={e=>e.currentTarget.style.display='none'}
          />
        ))}
      </div>
    </div>
  );
}

// ── CHALLENGE PLANS ───────────────────────────────────────────────────────────
const PLANS=[
  {id:'pro',name:'Pro Challenge',tag:'MOST POPULAR',
   desc:'For traders ready to fast-track with clear rules and maximum flexibility.',
   steps:['1-Step','2-Step'],
   sizes:[{l:'5K',p1:44,p2:69},{l:'10K',p1:84,p2:119},{l:'25K',p1:174,p2:229},{l:'50K',p1:289,p2:369},{l:'100K',p1:449,p2:549},{l:'200K',p1:749,p2:849}],
   r1:[['Profit Target','8%'],['Daily Loss Limit','4%'],['Max Drawdown','8%'],['Min Trading Days','5'],['Leverage','1:100'],['Profit Split','up to 95%']],
   r2:[['Phase 1 Target','8%'],['Phase 2 Target','5%'],['Daily Loss Limit','4%'],['Max Drawdown','8%'],['Leverage','1:100'],['Profit Split','up to 95%']],
  },
  {id:'prime',name:'Prime Challenge',tag:'BEST VALUE',
   desc:'Start your funded journey from just $39 with generous rules and swift evaluation.',
   steps:['1-Step','2-Step'],
   sizes:[{l:'5K',p1:39,p2:59},{l:'10K',p1:75,p2:99},{l:'25K',p1:149,p2:189},{l:'50K',p1:249,p2:299},{l:'100K',p1:399,p2:449},{l:'200K',p1:649,p2:729}],
   r1:[['Profit Target','10%'],['Daily Loss Limit','5%'],['Max Drawdown','10%'],['Min Trading Days','3'],['Leverage','1:100'],['Profit Split','up to 90%']],
   r2:[['Phase 1 Target','10%'],['Phase 2 Target','5%'],['Daily Loss','5%'],['Max Drawdown','10%'],['Leverage','1:100'],['Profit Split','up to 90%']],
  },
  {id:'direct',name:'Direct Account',tag:'INSTANT FUNDING',
   desc:'Skip evaluation entirely. Get funded instantly and start earning from day one.',
   steps:['Instant'],
   sizes:[{l:'5K',p1:199,p2:199},{l:'10K',p1:349,p2:349},{l:'25K',p1:749,p2:749},{l:'50K',p1:1299,p2:1299}],
   r1:[['No Evaluation','✓ Instant'],['Daily Loss Limit','3%'],['Max Drawdown','6%'],['Min Trading Days','None'],['Leverage','1:20'],['Profit Split','up to 80%']],
   r2:[],
  },
];
function Plans() {
  const[aP,setAP]=useState(0);const[aS,setAS]=useState(0);const[aSz,setASz]=useState(2);
  const pl=PLANS[aP],sd=pl.sizes[aSz]??pl.sizes[0],price=aS===0?sd.p1:sd.p2;
  const rules=aS===0?pl.r1:(pl.r2.length?pl.r2:pl.r1);
  return (
    <section id="plans" style={{ padding:'96px 28px',background:B.bg1 }}>
      <div style={{ maxWidth:1280,margin:'0 auto' }}>
        <div className="rv" style={{ textAlign:'center',marginBottom:48 }}>
          <div style={{ fontSize:11,fontWeight:700,color:B.blue,letterSpacing:'.15em',marginBottom:14 }}>BUILT FOR YOUR SUCCESS</div>
          <h2 style={{ fontSize:'clamp(32px,5vw,60px)',fontWeight:800,color:B.white,letterSpacing:'-.02em',lineHeight:1.05,marginBottom:14 }}>Choose Your Challenge</h2>
          <p style={{ fontSize:16,color:B.txtB,maxWidth:480,margin:'0 auto' }}>Three challenge types. Six account sizes. Get funded and paid.</p>
        </div>
        {/* Tabs */}
        <div className="rv d1" style={{ display:'flex',justifyContent:'center',gap:8,marginBottom:36,flexWrap:'wrap' }}>
          {PLANS.map((p,i)=>(
            <button key={p.id} onClick={()=>{setAP(i);setAS(0);setASz(2);}} className={`ptab ${i===aP?'on':''}`}
              style={{ padding:'10px 24px',border:`1px solid ${i===aP?'transparent':B.bordL}`,background:i===aP?'':'transparent',color:i===aP?'#fff':B.txtC,fontSize:14,fontWeight:600 }}>
              {p.name}
              {i!==aP&&<span style={{ marginLeft:8,fontSize:9,padding:'1px 6px',borderRadius:3,background:B.bg3,color:B.txtC,fontWeight:700 }}>{p.tag}</span>}
            </button>
          ))}
        </div>
        {/* Card */}
        <div className="rv d2" style={{ background:B.bg2,borderRadius:20,border:`1px solid ${B.bord}`,overflow:'hidden',boxShadow:'0 0 80px rgba(0,0,0,0.4)' }}>
          <div style={{ height:2,background:`linear-gradient(90deg,${B.blue},${B.bg2})` }}/>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr' }}>
            <div style={{ padding:'40px 44px',borderRight:`1px solid ${B.bord}` }}>
              <div style={{ display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',background:'rgba(79,140,247,0.1)',border:'1px solid rgba(79,140,247,0.25)',borderRadius:4,marginBottom:18 }}>
                <span style={{ width:5,height:5,borderRadius:'50%',background:B.blue }}/>
                <span style={{ fontSize:9,fontWeight:800,color:B.blueL,letterSpacing:'.1em' }}>{pl.tag}</span>
              </div>
              <h3 style={{ fontSize:28,fontWeight:800,color:B.white,marginBottom:10 }}>{pl.name}</h3>
              <p style={{ fontSize:14,color:B.txtC,marginBottom:28,lineHeight:1.65 }}>{pl.desc}</p>
              {pl.steps.length>1&&(
                <div style={{ marginBottom:22 }}>
                  <div style={{ fontSize:10,fontWeight:700,color:B.txtD,letterSpacing:'.1em',marginBottom:10 }}>TYPE</div>
                  <div style={{ display:'flex',gap:8 }}>
                    {pl.steps.map((s,i)=>(
                      <button key={s} onClick={()=>setAS(i)} className={`sbtn ${i===aS?'on':''}`}
                        style={{ padding:'9px 22px',borderRadius:8,border:`1px solid ${i===aS?B.blue:B.bordL}`,background:'transparent',color:i===aS?'#fff':B.txtC,fontFamily:'Plus Jakarta Sans,sans-serif',fontSize:13,fontWeight:600 }}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ marginBottom:30 }}>
                <div style={{ fontSize:10,fontWeight:700,color:B.txtD,letterSpacing:'.1em',marginBottom:10 }}>ACCOUNT SIZE</div>
                <div style={{ display:'flex',flexWrap:'wrap',gap:8 }}>
                  {pl.sizes.map((s,i)=>(
                    <button key={s.l} onClick={()=>setASz(i)} className={`sbtn ${i===aSz?'on':''}`}
                      style={{ padding:'9px 16px',borderRadius:8,border:`1px solid ${i===aSz?B.blue:B.bordL}`,background:'transparent',color:i===aSz?'#fff':B.txtC,fontFamily:'Plus Jakarta Sans,sans-serif',fontSize:13,fontWeight:600 }}>${s.l}</button>
                  ))}
                </div>
              </div>
              <div style={{ padding:'20px 24px',background:'rgba(79,140,247,0.06)',border:'1px solid rgba(79,140,247,0.15)',borderRadius:12,marginBottom:24 }}>
                <div style={{ fontSize:11,color:B.txtD,marginBottom:4 }}>CHALLENGE FEE</div>
                <div style={{ display:'flex',alignItems:'flex-end',gap:10 }}>
                  <span style={{ fontSize:52,fontWeight:800,color:B.white,lineHeight:1 }}>${price}</span>
                  <span style={{ fontSize:14,color:B.txtD,paddingBottom:8 }}>one-time · refundable</span>
                </div>
                <div style={{ fontSize:12,color:B.txtD,marginTop:5 }}>100% fee refunded on first payout</div>
              </div>
              <Link to="/register" className="btn-primary" style={{ display:'flex',justifyContent:'center',borderRadius:10,padding:'15px',fontSize:16 }}>
                Start {pl.name} →
              </Link>
            </div>
            <div style={{ padding:'40px 44px' }}>
              <div style={{ fontSize:10,fontWeight:700,color:B.txtD,letterSpacing:'.12em',marginBottom:22 }}>TRADING RULES</div>
              {rules.map(([lbl,val],i)=>(
                <div key={lbl} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'13px 0',borderBottom:i<rules.length-1?`1px solid ${B.bord}`:'none' }}>
                  <span style={{ fontSize:14,color:B.txtB }}>{lbl}</span>
                  <span style={{ fontSize:15,fontWeight:700,color:B.white }}>{val}</span>
                </div>
              ))}
              <div style={{ marginTop:28,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
                {[['⚡','1-Hour Payouts'],['♾️','Unlimited Days'],['📰','News Trading OK'],['🤖','EA / Algo OK'],['💰','100% Fee Refund'],['📈','Scale to $4M']].map(([icon,txt])=>(
                  <div key={txt} style={{ display:'flex',alignItems:'center',gap:8,padding:'10px 12px',background:B.bg3,border:`1px solid ${B.bord}`,borderRadius:8,fontSize:12,color:B.txtB }}>
                    <span>{icon}</span>{txt}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── HOW IT WORKS ──────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps=[
    {n:'01',icon:'🎯',t:'Choose Your Challenge',d:'Pick your plan and account size. Get started in under 2 minutes with no paperwork.'},
    {n:'02',icon:'📊',t:'Pass the Evaluation',d:'Trade on a live-like demo account. Hit your profit target while following simple risk rules.'},
    {n:'03',icon:'✅',t:'Quick KYC',d:'Fast identity verification. Most traders complete it in under 10 minutes.'},
    {n:'04',icon:'💸',t:'Get Funded & Paid',d:'You\'re a funded trader. Withdraw your profits in as little as 1 hour, every time.'},
  ];
  return (
    <section id="how-it-works" style={{ padding:'96px 28px',background:B.bg0 }}>
      <div style={{ maxWidth:1280,margin:'0 auto' }}>
        <div className="rv" style={{ textAlign:'center',marginBottom:64 }}>
          <div style={{ fontSize:11,fontWeight:700,color:B.blue,letterSpacing:'.15em',marginBottom:14 }}>YOUR JOURNEY</div>
          <h2 style={{ fontSize:'clamp(30px,4.5vw,54px)',fontWeight:800,color:B.white,letterSpacing:'-.02em',lineHeight:1.1 }}>Signup to Funded in 4 Steps</h2>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:0,position:'relative' }}>
          <div style={{ position:'absolute',top:52,left:'12%',right:'12%',height:1,background:`linear-gradient(90deg,transparent,${B.blue},transparent)`,opacity:.25 }}/>
          {steps.map((s,i)=>(
            <div key={s.n} className={`rv d${i+1}`} style={{ padding:'0 24px',textAlign:'center' }}>
              <div style={{ width:68,height:68,margin:'0 auto 20px',borderRadius:'50%',background:B.bg2,border:`1px solid ${B.bord}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,position:'relative',zIndex:1 }}>
                {s.icon}
                <div style={{ position:'absolute',top:-8,right:-8,width:24,height:24,borderRadius:'50%',background:`linear-gradient(135deg,${B.blue},${B.blueD})`,display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <span style={{ fontSize:9,fontWeight:900,color:'#fff' }}>{s.n}</span>
                </div>
              </div>
              <h3 style={{ fontSize:15,fontWeight:700,color:B.white,marginBottom:8,lineHeight:1.3 }}>{s.t}</h3>
              <p style={{ fontSize:13,color:B.txtC,lineHeight:1.7 }}>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── FEATURES ──────────────────────────────────────────────────────────────────
function Features() {
  const feats=[
    {icon:'⚡',t:'1-Hour Payouts',d:'Industry-leading speed. Your profits in your wallet within 60 minutes — guaranteed every time.'},
    {icon:'🛡️',t:'Zero Payout Denial',d:'The first prop firm to formally eliminate payout denial. Follow the rules, get paid. Full stop.'},
    {icon:'📈',t:'Scale to $4 Million',d:'Our Alpha Prime scaling plan lets top performers access up to $4M in trading capital.'},
    {icon:'🔄',t:'Unlimited Resets',d:'Reset your challenge at a discounted fee and start fresh whenever you need to.'},
    {icon:'🌐',t:'175+ Countries',d:'Available globally. Full multi-currency support and international payment methods.'},
    {icon:'🎓',t:'Prime Academy',d:'Free trading education, live webinars, and 1-on-1 coaching for all funded traders.'},
    {icon:'🤖',t:'EAs & Algo Trading',d:'Fully automated trading permitted across all challenge types. Any expert advisor works.'},
    {icon:'📰',t:'News Trading OK',d:'Trade any economic event without restriction. No NFP lockouts or FOMC blackouts.'},
    {icon:'🏆',t:'Award-Winning',d:'Recognised as Fastest Payout Prop Firm at iFX Expo Dubai and multiple global awards.'},
  ];
  return (
    <section style={{ padding:'96px 28px',background:B.bg1 }}>
      <div style={{ maxWidth:1280,margin:'0 auto' }}>
        <div className="rv" style={{ textAlign:'center',marginBottom:52 }}>
          <h2 style={{ fontSize:'clamp(30px,4.5vw,54px)',fontWeight:800,color:B.white,letterSpacing:'-.02em',lineHeight:1.1,marginBottom:12 }}>Why 20,000+ Traders Choose Hola Prime</h2>
          <p style={{ fontSize:16,color:B.txtB,maxWidth:460,margin:'0 auto' }}>Every feature built by traders, for traders — addressing real problems the industry has ignored.</p>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14 }}>
          {feats.map((f,i)=>(
            <div key={f.t} className={`rv card-hover d${(i%3)+1}`} style={{ padding:'28px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14,borderTop:`2px solid ${B.blue}`,position:'relative',overflow:'hidden' }}>
              <div style={{ position:'absolute',top:-20,right:-20,width:80,height:80,borderRadius:'50%',background:'rgba(79,140,247,0.06)',pointerEvents:'none' }}/>
              <div style={{ width:46,height:46,borderRadius:12,background:'rgba(79,140,247,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,marginBottom:14 }}>{f.icon}</div>
              <h3 style={{ fontSize:16,fontWeight:700,color:B.white,marginBottom:8 }}>{f.t}</h3>
              <p style={{ fontSize:13,color:B.txtB,lineHeight:1.7 }}>{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── PLATFORMS ─────────────────────────────────────────────────────────────────
function Platforms() {
  const pls=[
    {n:'MetaTrader 5',sub:'MT5',icon:'📊',d:'Advanced charting and automation for professional forex trading.'},
    {n:'cTrader',sub:'cTrader',icon:'📉',d:'Professional ECN platform for speed and precision trading.'},
    {n:'DXTrade',sub:'DXT',icon:'💎',d:'Cloud-based platform with a customisable workspace.'},
    {n:'MatchTrader',sub:'MT',icon:'🔄',d:'Seamless real-time execution and comprehensive market data.'},
    {n:'TradeLocker',sub:'TL',icon:'🔐',d:'Next-generation platform with a clean modern interface.'},
  ];
  return (
    <section id="platforms" style={{ padding:'96px 28px',background:B.bg0 }}>
      <div style={{ maxWidth:1280,margin:'0 auto' }}>
        <div className="rv" style={{ textAlign:'center',marginBottom:52 }}>
          <div style={{ fontSize:11,fontWeight:700,color:B.blue,letterSpacing:'.15em',marginBottom:14 }}>TRADING PLATFORMS</div>
          <h2 style={{ fontSize:'clamp(30px,4.5vw,54px)',fontWeight:800,color:B.white,letterSpacing:'-.02em',lineHeight:1.1,marginBottom:14 }}>Trade on the Best Platforms</h2>
          <p style={{ fontSize:16,color:B.txtB,maxWidth:460,margin:'0 auto' }}>All Hola Prime accounts available across 5 world-class trading platforms.</p>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:14 }}>
          {pls.map((p,i)=>(
            <div key={p.n} className={`plt rv d${i+1}`} style={{ padding:'28px 16px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14,textAlign:'center',cursor:'pointer' }}>
              <div style={{ width:52,height:52,borderRadius:12,background:'rgba(79,140,247,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,margin:'0 auto 12px' }}>{p.icon}</div>
              <div style={{ fontSize:11,fontWeight:800,color:B.blue,letterSpacing:'.1em',marginBottom:4 }}>{p.sub}</div>
              <div style={{ fontSize:13,fontWeight:700,color:B.white,marginBottom:8 }}>{p.n}</div>
              <div style={{ fontSize:11,color:B.txtC,lineHeight:1.6 }}>{p.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── TESTIMONIALS ──────────────────────────────────────────────────────────────
function Testimonials() {
  const revs=[
    {n:'James K.',c:'🇬🇧 United Kingdom',r:5,a:'$4,200',t:'I\'ve been with 4 prop firms. Hola Prime is the only one that paid me in under an hour. $4,200 before my next trade closed.'},
    {n:'Priya M.',c:'🇮🇳 India',r:5,a:'$1,850',t:'Fair rules, fast payout, incredible support. First payout in 41 minutes. Hola Prime treated me like any other trader.'},
    {n:'Ahmed S.',c:'🇦🇪 UAE',r:5,a:'$8,500',t:'$8,500 processed same day. No questions, no delays. The zero denial policy isn\'t just marketing.'},
    {n:'Lucas B.',c:'🇧🇷 Brazil',r:5,a:'$2,100',t:'Passed the 1-step in 8 days. KYC took 12 minutes. First payout of $2,100 — 43 minutes after requesting.'},
    {n:'Fatima A.',c:'🇳🇬 Nigeria',r:5,a:'$3,400',t:'Started at $25K, now trading $100K after 6 months. The scaling plan is genuine. Hola Prime changed everything.'},
    {n:'Kai T.',c:'🇩🇪 Germany',r:5,a:'$6,700',t:'Trade exclusively with EAs. HP doesn\'t restrict it. Bot passed, got funded, and I\'ve made $6,700 in payouts.'},
  ];
  return (
    <section style={{ padding:'96px 28px',background:B.bg1 }}>
      <div style={{ maxWidth:1280,margin:'0 auto' }}>
        <div className="rv" style={{ textAlign:'center',marginBottom:48 }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:3,marginBottom:10 }}>
            {[0,1,2,3,4].map(j=><span key={j} style={{ fontSize:16,color:B.gold }}>★</span>)}
            <span style={{ marginLeft:8,fontSize:13,fontWeight:600,color:B.txtC }}>4.9 / 5 on Trustpilot</span>
          </div>
          <h2 style={{ fontSize:'clamp(30px,4.5vw,54px)',fontWeight:800,color:B.white,letterSpacing:'-.02em',lineHeight:1.1 }}>Real Traders. Real Payouts.</h2>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14 }}>
          {revs.map((r,i)=>(
            <div key={r.n} className={`rv card-hover d${(i%3)+1}`} style={{ padding:'24px',background:B.bg2,border:`1px solid ${B.bord}`,borderRadius:14 }}>
              <div style={{ display:'flex',gap:3,marginBottom:12 }}>{[0,1,2,3,4].map(j=><span key={j} style={{fontSize:13,color:B.gold}}>★</span>)}</div>
              <p style={{ fontSize:14,color:B.txtB,lineHeight:1.75,marginBottom:16,fontStyle:'italic' }}>"{r.t}"</p>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <div>
                  <div style={{ fontSize:14,fontWeight:700,color:B.white }}>{r.n}</div>
                  <div style={{ fontSize:12,color:B.txtD }}>{r.c}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:16,fontWeight:800,color:B.green }}>{r.a}</div>
                  <div style={{ fontSize:10,color:B.txtD }}>PAID OUT</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA ───────────────────────────────────────────────────────────────────────
function CTA() {
  return (
    <section style={{ padding:'80px 28px',background:B.bg0,borderTop:`1px solid ${B.bord}`,position:'relative',overflow:'hidden' }}>
      <div style={{ position:'absolute',inset:0,background:'radial-gradient(ellipse at 50% 50%,rgba(79,140,247,0.06) 0%,transparent 70%)',pointerEvents:'none' }}/>
      <div style={{ maxWidth:760,margin:'0 auto',textAlign:'center',position:'relative' }}>
        <div className="rv" style={{ display:'inline-flex',alignItems:'center',gap:8,padding:'5px 14px',background:'rgba(79,140,247,0.1)',border:'1px solid rgba(79,140,247,0.25)',borderRadius:50,marginBottom:22 }}>
          <span style={{ width:6,height:6,borderRadius:'50%',background:B.blue,animation:'pulse 2s infinite' }}/>
          <span style={{ fontSize:10,fontWeight:700,color:B.blueL,letterSpacing:'.1em' }}>START TODAY — TAKES UNDER 2 MINUTES</span>
        </div>
        <h2 className="rv" style={{ fontSize:'clamp(34px,5vw,68px)',fontWeight:800,color:B.white,letterSpacing:'-.02em',lineHeight:1.0,marginBottom:18 }}>
          Trade Our Money.<br/>Keep The Profits.
        </h2>
        <p className="rv d1" style={{ fontSize:17,color:B.txtB,lineHeight:1.7,marginBottom:36 }}>
          Join 20,000+ funded traders across 175+ countries. Starting from just $38 — with a full fee refund on your first payout.
        </p>
        <div className="rv d2" style={{ display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap' }}>
          <Link to="/register" className="btn-primary" style={{ fontSize:16,padding:'15px 36px' }}>Get Funded Today</Link>
          <a href="#plans" className="btn-outline" style={{ fontSize:16,padding:'14px 32px' }}>Compare Plans</a>
        </div>
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────
const FAQS=[
  ['How long does it take to get funded?','Once you pass your challenge (which can happen in 3–5 days), complete a quick KYC check (usually 10–15 minutes), and your funded account is set up immediately. The full process from signup to funded can be under a week.'],
  ['Are payouts really processed in 1 hour?','Yes — our average payout time is 33 minutes and 48 seconds. We process payouts within 1 hour during business hours. Our Zero Payout Denial Policy means if you followed the rules, you will be paid.'],
  ['What trading styles are allowed?','Virtually all styles are permitted including scalping, day trading, swing trading, news trading, and algorithmic/EA trading. The only restriction is strategies that exploit platform pricing inefficiencies.'],
  ['Is the challenge fee refunded?','Yes. Your full challenge fee is refunded with your first payout. Request a payout of at least $100 and the fee is automatically refunded on top of your profit share.'],
  ['Can I trade on any platform?','Hola Prime accounts are available on MetaTrader 5, cTrader, DXTrade, MatchTrader, and TradeLocker. Choose your preferred platform when setting up your challenge.'],
  ['What is the maximum account size?','Challenges go up to $200,000. Through our Alpha Prime Scaling Plan, top performers can scale up to $4,000,000 while keeping up to 95% of profits.'],
  ['Can I have multiple accounts?','Yes — there is no limit. Many traders run multiple accounts simultaneously to diversify their strategies.'],
  ['What happens if I breach a rule?','Your account will be closed if you exceed the daily loss or maximum drawdown limits. You can purchase a new challenge or a discounted reset to start again.'],
];
function FAQ() {
  const[open,setOpen]=useState(0);
  return (
    <section id="faq" style={{ padding:'96px 28px',background:B.bg1 }}>
      <div style={{ maxWidth:820,margin:'0 auto' }}>
        <div className="rv" style={{ textAlign:'center',marginBottom:52 }}>
          <h2 style={{ fontSize:'clamp(30px,4.5vw,54px)',fontWeight:800,color:B.white,letterSpacing:'-.02em',lineHeight:1.1,marginBottom:12 }}>Frequently Asked Questions</h2>
          <p style={{ fontSize:15,color:B.txtC }}>Everything you need to know about Hola Prime.</p>
        </div>
        {FAQS.map(([q,a],i)=>(
          <div key={i} className="rv faq-item">
            <button onClick={()=>setOpen(open===i?-1:i)} style={{ width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 0',background:'none',border:'none',cursor:'pointer',textAlign:'left',gap:16 }}>
              <span style={{ fontSize:15,fontWeight:600,color:open===i?B.white:B.txtA }}>{q}</span>
              <span style={{ color:open===i?B.blue:B.txtD,fontSize:20,fontWeight:300,flexShrink:0,transition:'transform .25s',transform:open===i?'rotate(45deg)':'none',display:'inline-block' }}>+</span>
            </button>
            <div style={{ maxHeight:open===i?260:0,overflow:'hidden',transition:'max-height .35s ease' }}>
              <div style={{ padding:'0 0 20px',fontSize:14,color:B.txtB,lineHeight:1.8 }}>{a}</div>
            </div>
          </div>
        ))}
        <div className="rv" style={{ textAlign:'center',marginTop:28,fontSize:14,color:B.txtC }}>
          Still have questions? <a href="#" style={{ color:B.blue,textDecoration:'none',fontWeight:600 }}>Chat with us 24/7 →</a>
        </div>
      </div>
    </section>
  );
}

// ── FOOTER ────────────────────────────────────────────────────────────────────
function Footer() {
  const cols = [
    {t:'Forex Plans',ls:[
      ['Pro Challenge','/forex/pro-challenge'],
      ['Prime Challenge','/forex/prime-challenge'],
      ['One Challenge','/forex/one-challenge'],
      ['Direct Account','/forex/direct-account'],
      ['Scaling Plan','/forex/scaling'],
    ]},
    {t:'Futures',ls:[
      ['Prime Challenge','/futures/prime-challenge'],
      ['Direct Account','/futures/direct-account'],
      ['Instruments','/futures/instruments'],
      ['Trading Rules','/futures/trading-rules'],
      ['FAQs','/futures/faq'],
    ]},
    {t:'Company',ls:[
      ['About Us','/about'],
      ['Our Team','/team'],
      ['Awards','/awards'],
      ['News & Media','/news'],
      ['Careers','/careers'],
      ['Contact','/contact'],
    ]},
    {t:'Resources',ls:[
      ['Prime Academy','/academy'],
      ['Transparency Report','/forex/transparency-report'],
      ['Trading Tools','/forex/trading-tools'],
      ['Risk Control','/risk-control'],
      ['Blog','/blog'],
    ]},
    {t:'Affiliate',ls:[
      ['Partner Program','/affiliate'],
      ['Affiliate FAQs','/affiliate/faq'],
      ['Affiliate Login','/affiliate/login'],
    ]},
  ];
  return (
    <footer style={{ background:B.bg0,borderTop:`1px solid ${B.bord}`,padding:'60px 28px 32px' }}>
      <div style={{ maxWidth:1280,margin:'0 auto' }}>
        <div style={{ display:'grid',gridTemplateColumns:'260px repeat(5,1fr)',gap:28,marginBottom:48 }}>
          <div>
            <div style={{ marginBottom:18 }}>
              <img src="/logo-white.png" alt="hola prime" style={{ height:52,width:'auto',objectFit:'contain' }}/>
            </div>
            <p style={{ fontSize:12,color:B.txtD,lineHeight:1.8,marginBottom:18 }}>
              The most transparent prop firm. Built by traders, for traders.<br/>FSC Licensed · GB24203729.
            </p>
            <div style={{ display:'flex',gap:10 }}>
              {['💬','𝕏','▶️','📷'].map((ic,i)=>(
                <a key={i} href="#" style={{ width:32,height:32,borderRadius:8,background:B.bg2,border:`1px solid ${B.bord}`,display:'flex',alignItems:'center',justifyContent:'center',textDecoration:'none',fontSize:14,transition:'all .15s' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=B.blue;e.currentTarget.style.background=B.bg3;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=B.bord;e.currentTarget.style.background=B.bg2;}}>{ic}</a>
              ))}
            </div>
          </div>
          {cols.map(col=>(
            <div key={col.t}>
              <div style={{ fontSize:9,fontWeight:800,color:B.blue,letterSpacing:'.15em',marginBottom:16 }}>{col.t.toUpperCase()}</div>
              {col.ls.map(([label,path])=>(
                <Link key={label} to={path} style={{ display:'block',fontSize:13,color:B.txtD,textDecoration:'none',marginBottom:10,transition:'color .15s' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color=B.txtA}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color=B.txtD}>{label}</Link>
              ))}
            </div>
          ))}
        </div>
        <div style={{ paddingTop:24,borderTop:`1px solid ${B.bord}`,display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:24,flexWrap:'wrap' }}>
          <p style={{ fontSize:10,color:B.txtD,lineHeight:1.8,maxWidth:720 }}>
            <strong style={{ color:B.txtC }}>RISK WARNING:</strong>{' '}Hola Prime accounts are simulated and do not represent live trading accounts. Trading involves significant risk. Past performance is not indicative of future results. FSC Licensed · GB24203729. Not available in certain jurisdictions.
          </p>
          <div style={{ fontSize:11,color:B.txtD,textAlign:'right',flexShrink:0 }}>
            <div>© 2025 Hola Prime Limited</div>
            <div style={{ marginTop:4,display:'flex',gap:14 }}>
              {['Privacy Policy','Terms of Service','Cookie Policy'].map(l=>(
                <a key={l} href="#" style={{ color:B.txtD,textDecoration:'none',transition:'color .15s' }}
                  onMouseEnter={e=>e.currentTarget.style.color=B.txtB}
                  onMouseLeave={e=>e.currentTarget.style.color=B.txtD}>{l}</a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Landing() {
  useReveal();
  return (
    <div className="grain" style={{ background:B.bg1,minHeight:'100vh' }}>
      <style>{CSS}</style>
      <AnnBar/>
      <Ticker/>
      <Navbar/>
      <Hero/>
      <ZeroBand/>
      <Celebrating/>
      <Press/>
      <Plans/>
      <HowItWorks/>
      <Features/>
      <Platforms/>
      <Testimonials/>
      <CTA/>
      <FAQ/>
      <Footer/>
    </div>
  );
}
