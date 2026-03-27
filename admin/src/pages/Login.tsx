import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuthStore } from '../lib/api.js';

function AnimatedBg() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if(!canvas) return;
    const ctx = canvas.getContext('2d');
    let id, w = canvas.width = window.innerWidth, h = canvas.height = window.innerHeight;
    const onR = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener('resize', onR);
    const nodes = Array.from({length:55},()=>({x:Math.random()*w,y:Math.random()*h,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3}));
    const cands = Array.from({length:12},()=>({x:Math.random()*w,y:Math.random()*h+h*.3,vy:-(Math.random()*.22+.08),h:Math.random()*36+12,cw:Math.random()*5+3,g:Math.random()>.48,op:Math.random()*.05+.015}));
    let t=0;
    const draw=()=>{
      ctx.clearRect(0,0,w,h);
      const bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#030508');bg.addColorStop(1,'#060810');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
      [[w*.2,h*.25,250,'63,143,224',.05],[w*.8,h*.7,200,'244,196,48',.04],[w*.5,h,160,'0,214,143',.03]].forEach(([ox,oy,or,c,a])=>{
        const g=ctx.createRadialGradient(ox,oy,0,ox,oy,or);g.addColorStop(0,`rgba(${c},${a})`);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(ox,oy,or,0,Math.PI*2);ctx.fill();
      });
      ctx.strokeStyle='rgba(255,255,255,.018)';ctx.lineWidth=1;
      for(let x=0;x<w;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
      for(let y=0;y<h;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
      cands.forEach(c=>{c.y+=c.vy;if(c.y<-60){c.y=h+60;c.x=Math.random()*w;}const col=c.g?'0,214,143':'255,76,106';ctx.fillStyle=`rgba(${col},${c.op})`;ctx.fillRect(c.x-c.cw/2,c.y-c.h/2,c.cw,c.h);ctx.fillRect(c.x-.8,c.y-c.h/2-7,1.6,7);ctx.fillRect(c.x-.8,c.y+c.h/2,1.6,6);});
      nodes.forEach(n=>{n.x+=n.vx;n.y+=n.vy;if(n.x<0||n.x>w)n.vx*=-1;if(n.y<0||n.y>h)n.vy*=-1;ctx.beginPath();ctx.arc(n.x,n.y,1.5,0,Math.PI*2);ctx.fillStyle='rgba(63,143,224,.35)';ctx.fill();});
      for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){const dx=nodes[i].x-nodes[j].x,dy=nodes[i].y-nodes[j].y,d=Math.sqrt(dx*dx+dy*dy);if(d<110){ctx.beginPath();ctx.moveTo(nodes[i].x,nodes[i].y);ctx.lineTo(nodes[j].x,nodes[j].y);ctx.strokeStyle=`rgba(63,143,224,${.1*(1-d/110)})`;ctx.lineWidth=.5;ctx.stroke();}}
      ctx.beginPath();ctx.moveTo(0,h);
      for(let x=0;x<=w;x+=3){const y=h-45+Math.sin((x/w)*Math.PI*4+t*.016)*15+Math.sin((x/w)*Math.PI*8+t*.011)*7;ctx.lineTo(x,y);}
      ctx.lineTo(w,h);ctx.closePath();
      const wg=ctx.createLinearGradient(0,h-70,0,h);wg.addColorStop(0,'rgba(244,196,48,.06)');wg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=wg;ctx.fill();
      t++;id=requestAnimationFrame(draw);
    };
    draw();
    return ()=>{cancelAnimationFrame(id);window.removeEventListener('resize',onR);};
  },[]);
  return <canvas ref={ref} style={{position:'fixed',inset:0,width:'100%',height:'100%',zIndex:0,pointerEvents:'none'}}/>;
}

function PwInput({value,onChange}) {
  const [show,setShow]=useState(false);
  return (
    <div style={{position:'relative'}}>
      <input type={show?'text':'password'} value={value} onChange={e=>onChange(e.target.value)} placeholder="••••••••" required
        style={{width:'100%',background:'rgba(255,255,255,.06)',color:'#F4F7FF',border:'1px solid rgba(63,143,224,.25)',borderRadius:9,padding:'13px 44px 13px 16px',fontSize:14,outline:'none',fontFamily:'inherit',transition:'border-color .2s,box-shadow .2s'}}
        onFocus={e=>{e.target.style.borderColor='#4F8EF7';e.target.style.boxShadow='0 0 0 3px rgba(79,142,247,.18)';}}
        onBlur={e=>{e.target.style.borderColor='rgba(63,143,224,.25)';e.target.style.boxShadow='none';}}/>
      <button type="button" onClick={()=>setShow(s=>!s)}
        style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#7A85A8',fontSize:16,lineHeight:1}}>
        {show?'🙈':'👁️'}
      </button>
    </div>
  );
}

export default function Login() {
  const [email,setEmail]=useState('');const[pw,setPw]=useState('');
  const[err,setErr]=useState('');const[loading,setLoading]=useState(false);
  const navigate=useNavigate();const login=useAuthStore(s=>s.login);

  const submit=async(e)=>{e.preventDefault();setErr('');setLoading(true);
    try{const{data}=await api.post('/auth/login',{email,password:pw});login(data.admin,data.accessToken,data.refreshToken);navigate('/dashboard');}
    catch(e:any){
      const data = e.response?.data;
      const msg = (typeof data === 'object' ? data?.error : data) ?? e.message ?? 'Login failed';
      const status = e.response?.status;
      if (!e.response || e.code==='ERR_NETWORK') setErr('Cannot reach server. Is Docker running?');
      else if(status===401) setErr('Incorrect email or password.');
      else if(status===403) setErr('Account disabled. Contact support.');
      else if(status===429) setErr('Too many attempts. Please wait.');
      else setErr(`Server error: ${msg}`);}
    finally{setLoading(false);}};

  return (
    <div style={{minHeight:'100vh',display:'flex',position:'relative',background:'#080D18'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Unbounded:wght@400;700;800;900&family=DM+Sans:wght@300;400;500;600&display=swap');
        @keyframes slideIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes shimmer{from{background-position:-200% center}to{background-position:200% center}}
        .si{animation:slideIn .6s cubic-bezier(.16,1,.3,1) both}
        .fu{animation:fadeUp .5s ease both}
        input::placeholder{color:#4A5278}
        .lbtn{transition:all .2s}
        .lbtn:hover:not(:disabled){filter:brightness(1.1);transform:translateY(-2px);box-shadow:0 10px 32px rgba(244,196,48,.4)!important}
        .lbtn:active:not(:disabled){transform:translateY(0)}
        .stat-item{animation:fadeUp .5s ease both}
      `}</style>

      <AnimatedBg/>

      {/* Left: branding panel */}
      <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',padding:'60px 64px',position:'relative',zIndex:1}}>
        {/* HP Logo mark */}
        <div style={{marginBottom:48}}>
          <div>
            <img src="/logo-white.png" alt="Hola Prime" style={{height:64,width:'auto',objectFit:'contain'}}/>
          </div>
        </div>

        {/* The big headline */}
        <div style={{marginBottom:48}}>
          <div style={{fontFamily:'Unbounded',fontSize:'clamp(36px,4vw,58px)',fontWeight:900,lineHeight:.9,letterSpacing:'-.03em',marginBottom:4}}>
            <span style={{color:'#F4F7FF',display:'block'}}>COMMAND</span>
            <span style={{
              display:'block',
              background:'linear-gradient(90deg,#F4C430 0%,#FFE080 40%,#C9921A 60%,#F4C430 100%)',
              backgroundSize:'200% auto',
              WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',
              animation:'shimmer 3s linear infinite',
            }}>CENTRE</span>
          </div>
          <p style={{fontSize:15,color:'#B0B8D0',lineHeight:1.7,marginTop:16,maxWidth:380}}>
            The intelligence hub behind Hola Prime. Full visibility into every trader, payment, challenge, and metric — in real time.
          </p>
        </div>

        {/* Live stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,maxWidth:400}}>
          {[
            {v:'20,000+',l:'Funded Traders',icon:'👥',d:.1},
            {v:'$4.5M+',l:'Total Paid Out',icon:'💸',d:.2},
            {v:'33m 48s',l:'Avg Payout Time',icon:'⚡',d:.3},
            {v:'175+',l:'Countries Active',icon:'🌍',d:.4},
          ].map((s,i)=>(
            <div key={s.l} className="stat-item" style={{
              padding:'16px 18px',background:'rgba(255,255,255,.04)',
              border:'1px solid rgba(255,255,255,.07)',borderRadius:12,
              animationDelay:`${s.d}s`,
            }}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                <span style={{fontSize:16}}>{s.icon}</span>
                <span style={{fontFamily:'Unbounded',fontSize:18,fontWeight:800,color:'#F4F7FF'}}>{s.v}</span>
              </div>
              <div style={{fontSize:11,color:'#7A85A8'}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Bottom badge */}
        <div style={{marginTop:'auto',paddingTop:48,display:'flex',alignItems:'center',gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',background:'rgba(79,140,247,.1)',border:'1px solid rgba(79,140,247,.25)',borderRadius:20}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'#4F8CF7',animation:'pulse 2s infinite'}}/>
            <span style={{fontSize:11,color:'#93C5FD',fontWeight:700}}>ALL SYSTEMS OPERATIONAL</span>
          </div>
          <span style={{fontSize:11,color:'#7A85A8'}}>FSC Licensed · GB24203729</span>
        </div>
      </div>

      {/* Vertical divider */}
      <div style={{width:1,background:'linear-gradient(180deg,transparent,rgba(63,143,224,.3),transparent)',alignSelf:'stretch',zIndex:1}}/>

      {/* Right: login form */}
      <div className="si" style={{width:480,display:'flex',flexDirection:'column',justifyContent:'center',padding:'60px 52px',position:'relative',zIndex:1,background:'rgba(7,10,20,.6)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)'}}>
        <div className="fu" style={{marginBottom:36}}>
          <img src="/logo-white.png" alt="hola prime" style={{height:52,width:'auto',objectFit:'contain',marginBottom:20,display:'block'}}/>
          <h1 style={{fontFamily:'Unbounded',fontSize:26,fontWeight:800,color:'#F4F7FF',marginBottom:8,letterSpacing:'-.02em'}}>
            Sign In
          </h1>
          <p style={{fontSize:14,color:'#B0B8D0',lineHeight:1.6}}>Access requires an authorised Command Centre account.</p>
        </div>

        <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:18}}>
          <div className="fu" style={{animationDelay:'.1s'}}>
            <label style={{fontSize:12,color:'#B0B8D0',display:'block',marginBottom:7,fontWeight:500,letterSpacing:'.04em'}}>EMAIL ADDRESS</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@holaprime.com" required autoFocus
              style={{width:'100%',background:'rgba(255,255,255,.06)',color:'#F4F7FF',border:'1px solid rgba(63,143,224,.25)',borderRadius:9,padding:'13px 16px',fontSize:14,outline:'none',fontFamily:'inherit',transition:'border-color .2s,box-shadow .2s'}}
              onFocus={e=>{e.target.style.borderColor='#4F8EF7';e.target.style.boxShadow='0 0 0 3px rgba(79,142,247,.18)';}}
              onBlur={e=>{e.target.style.borderColor='rgba(63,143,224,.25)';e.target.style.boxShadow='none';}}/>
          </div>

          <div className="fu" style={{animationDelay:'.15s'}}>
            <label style={{fontSize:12,color:'#B0B8D0',display:'block',marginBottom:7,fontWeight:500,letterSpacing:'.04em'}}>PASSWORD</label>
            <PwInput value={pw} onChange={setPw}/>
          </div>

          {err&&(
            <div style={{padding:'11px 14px',background:'rgba(255,76,106,.1)',border:'1px solid rgba(255,76,106,.3)',borderRadius:9,fontSize:13,color:'#FF4C6A',display:'flex',alignItems:'center',gap:8}}>
              <span>⚠️</span>{err}
            </div>
          )}

          <button type="submit" disabled={loading} className="lbtn fu" style={{
            animationDelay:'.2s',
            marginTop:4,width:'100%',padding:'15px',
            background:'linear-gradient(135deg,#4F8CF7,#1D4ED8)',
            color:'#fff',border:'none',borderRadius:10,
            fontSize:15,fontWeight:800,cursor:loading?'not-allowed':'pointer',
            opacity:loading?.7:1,fontFamily:'Unbounded',letterSpacing:'-.01em',
            boxShadow:'0 4px 22px rgba(79,140,247,.35)',
          }}>
            {loading?'SIGNING IN…':'ACCESS COMMAND CENTRE'}
          </button>
        </form>

        <div className="fu" style={{animationDelay:'.25s',marginTop:28,paddingTop:24,borderTop:'1px solid rgba(255,255,255,.06)'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
            {[['🔒','End-to-End\nEncrypted'],['🛡️','Role-Based\nAccess'],['📋','Full Audit\nTrail']].map(([icon,txt])=>(
              <div key={txt} style={{textAlign:'center',padding:'10px 8px',background:'rgba(255,255,255,.03)',borderRadius:8,border:'1px solid rgba(255,255,255,.06)'}}>
                <div style={{fontSize:18,marginBottom:4}}>{icon}</div>
                <div style={{fontSize:10,color:'#7A85A8',lineHeight:1.4,whiteSpace:'pre-line'}}>{txt}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{marginTop:20,textAlign:'center',fontSize:11,color:'#2A3356'}}>
          <div style={{marginBottom:10,padding:'10px 14px',background:'rgba(79,140,247,.06)',border:'1px solid rgba(79,140,247,.15)',borderRadius:8,fontSize:11,color:'#60A9F0'}}>
            Default: <strong style={{color:'#fff'}}>admin@holaprime.com</strong> / <strong style={{color:'#fff'}}>Admin@HolaPrime1</strong>
          </div>
          © 2025 Hola Prime · Command Centre v1.0
        </div>
      </div>
    </div>
  );
}
