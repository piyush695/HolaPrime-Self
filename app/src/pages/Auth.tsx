import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, useTraderStore } from '../lib/api.js';

const C = {
  bg:'#0D0F14', surfA:'#13151C', surfB:'#1C1F27', surfC:'#252931',
  bord:'#2E3340', blue:'#3F8FE0', blueD:'#1E5FAE', green:'#38BA82',
  red:'#EB5454', white:'#F5F8FF', txtA:'#CCD2E3', txtB:'#878FA4', txtC:'#4F5669',
};

const inp: React.CSSProperties = {
  width:'100%', background:C.surfC, color:C.white, border:`1px solid ${C.bord}`,
  borderRadius:8, padding:'11px 14px', fontSize:14, outline:'none',
  fontFamily:'inherit', transition:'border-color 0.15s',
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'DM Sans',sans-serif; background:${C.bg}; color:${C.white}; -webkit-font-smoothing:antialiased; }
  input:focus { border-color:${C.blue}!important; box-shadow:0 0 0 3px ${C.blue}18; }
  input::placeholder { color:${C.txtC}; }
  .auth-btn { transition:filter 0.15s,transform 0.1s,opacity 0.15s; }
  .auth-btn:hover:not(:disabled) { filter:brightness(1.1); transform:translateY(-1px); }
  .auth-btn:active:not(:disabled) { transform:translateY(0); }
  .lnk { color:${C.blue}; text-decoration:none; font-weight:600; }
  .lnk:hover { text-decoration:underline; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  .fade-up { animation:fadeUp 0.4s ease forwards; }
`;

const COUNTRIES = [
  {code:'AF',name:'Afghanistan',dial:'+93',flag:'\u{1F1E6}\u{1F1EB}'},{code:'AL',name:'Albania',dial:'+355',flag:'\u{1F1E6}\u{1F1F1}'},
  {code:'DZ',name:'Algeria',dial:'+213',flag:'\u{1F1E9}\u{1F1FF}'},{code:'AR',name:'Argentina',dial:'+54',flag:'\u{1F1E6}\u{1F1F7}'},
  {code:'AU',name:'Australia',dial:'+61',flag:'\u{1F1E6}\u{1F1FA}'},{code:'AT',name:'Austria',dial:'+43',flag:'\u{1F1E6}\u{1F1F9}'},
  {code:'BD',name:'Bangladesh',dial:'+880',flag:'\u{1F1E7}\u{1F1E9}'},{code:'BE',name:'Belgium',dial:'+32',flag:'\u{1F1E7}\u{1F1EA}'},
  {code:'BR',name:'Brazil',dial:'+55',flag:'\u{1F1E7}\u{1F1F7}'},{code:'BG',name:'Bulgaria',dial:'+359',flag:'\u{1F1E7}\u{1F1EC}'},
  {code:'CM',name:'Cameroon',dial:'+237',flag:'\u{1F1E8}\u{1F1F2}'},{code:'CA',name:'Canada',dial:'+1',flag:'\u{1F1E8}\u{1F1E6}'},
  {code:'CL',name:'Chile',dial:'+56',flag:'\u{1F1E8}\u{1F1F1}'},{code:'CO',name:'Colombia',dial:'+57',flag:'\u{1F1E8}\u{1F1F4}'},
  {code:'HR',name:'Croatia',dial:'+385',flag:'\u{1F1ED}\u{1F1F7}'},{code:'CY',name:'Cyprus',dial:'+357',flag:'\u{1F1E8}\u{1F1FE}'},
  {code:'CZ',name:'Czech Republic',dial:'+420',flag:'\u{1F1E8}\u{1F1FF}'},{code:'DK',name:'Denmark',dial:'+45',flag:'\u{1F1E9}\u{1F1F0}'},
  {code:'EG',name:'Egypt',dial:'+20',flag:'\u{1F1EA}\u{1F1EC}'},{code:'ET',name:'Ethiopia',dial:'+251',flag:'\u{1F1EA}\u{1F1F9}'},
  {code:'FI',name:'Finland',dial:'+358',flag:'\u{1F1EB}\u{1F1EE}'},{code:'FR',name:'France',dial:'+33',flag:'\u{1F1EB}\u{1F1F7}'},
  {code:'GE',name:'Georgia',dial:'+995',flag:'\u{1F1EC}\u{1F1EA}'},{code:'DE',name:'Germany',dial:'+49',flag:'\u{1F1E9}\u{1F1EA}'},
  {code:'GH',name:'Ghana',dial:'+233',flag:'\u{1F1EC}\u{1F1ED}'},{code:'GR',name:'Greece',dial:'+30',flag:'\u{1F1EC}\u{1F1F7}'},
  {code:'HK',name:'Hong Kong',dial:'+852',flag:'\u{1F1ED}\u{1F1F0}'},{code:'HU',name:'Hungary',dial:'+36',flag:'\u{1F1ED}\u{1F1FA}'},
  {code:'IN',name:'India',dial:'+91',flag:'\u{1F1EE}\u{1F1F3}'},{code:'ID',name:'Indonesia',dial:'+62',flag:'\u{1F1EE}\u{1F1E9}'},
  {code:'IQ',name:'Iraq',dial:'+964',flag:'\u{1F1EE}\u{1F1F6}'},{code:'IE',name:'Ireland',dial:'+353',flag:'\u{1F1EE}\u{1F1EA}'},
  {code:'IL',name:'Israel',dial:'+972',flag:'\u{1F1EE}\u{1F1F1}'},{code:'IT',name:'Italy',dial:'+39',flag:'\u{1F1EE}\u{1F1F9}'},
  {code:'JP',name:'Japan',dial:'+81',flag:'\u{1F1EF}\u{1F1F5}'},{code:'JO',name:'Jordan',dial:'+962',flag:'\u{1F1EF}\u{1F1F4}'},
  {code:'KZ',name:'Kazakhstan',dial:'+7',flag:'\u{1F1F0}\u{1F1FF}'},{code:'KE',name:'Kenya',dial:'+254',flag:'\u{1F1F0}\u{1F1EA}'},
  {code:'KW',name:'Kuwait',dial:'+965',flag:'\u{1F1F0}\u{1F1FC}'},{code:'LV',name:'Latvia',dial:'+371',flag:'\u{1F1F1}\u{1F1FB}'},
  {code:'LB',name:'Lebanon',dial:'+961',flag:'\u{1F1F1}\u{1F1E7}'},{code:'MY',name:'Malaysia',dial:'+60',flag:'\u{1F1F2}\u{1F1FE}'},
  {code:'MX',name:'Mexico',dial:'+52',flag:'\u{1F1F2}\u{1F1FD}'},{code:'MA',name:'Morocco',dial:'+212',flag:'\u{1F1F2}\u{1F1E6}'},
  {code:'NP',name:'Nepal',dial:'+977',flag:'\u{1F1F3}\u{1F1F5}'},{code:'NL',name:'Netherlands',dial:'+31',flag:'\u{1F1F3}\u{1F1F1}'},
  {code:'NZ',name:'New Zealand',dial:'+64',flag:'\u{1F1F3}\u{1F1FF}'},{code:'NG',name:'Nigeria',dial:'+234',flag:'\u{1F1F3}\u{1F1EC}'},
  {code:'NO',name:'Norway',dial:'+47',flag:'\u{1F1F3}\u{1F1F4}'},{code:'OM',name:'Oman',dial:'+968',flag:'\u{1F1F4}\u{1F1F2}'},
  {code:'PK',name:'Pakistan',dial:'+92',flag:'\u{1F1F5}\u{1F1F0}'},{code:'PE',name:'Peru',dial:'+51',flag:'\u{1F1F5}\u{1F1EA}'},
  {code:'PH',name:'Philippines',dial:'+63',flag:'\u{1F1F5}\u{1F1ED}'},{code:'PL',name:'Poland',dial:'+48',flag:'\u{1F1F5}\u{1F1F1}'},
  {code:'PT',name:'Portugal',dial:'+351',flag:'\u{1F1F5}\u{1F1F9}'},{code:'QA',name:'Qatar',dial:'+974',flag:'\u{1F1F6}\u{1F1E6}'},
  {code:'RO',name:'Romania',dial:'+40',flag:'\u{1F1F7}\u{1F1F4}'},{code:'RU',name:'Russia',dial:'+7',flag:'\u{1F1F7}\u{1F1FA}'},
  {code:'SA',name:'Saudi Arabia',dial:'+966',flag:'\u{1F1F8}\u{1F1E6}'},{code:'SN',name:'Senegal',dial:'+221',flag:'\u{1F1F8}\u{1F1F3}'},
  {code:'RS',name:'Serbia',dial:'+381',flag:'\u{1F1F7}\u{1F1F8}'},{code:'SG',name:'Singapore',dial:'+65',flag:'\u{1F1F8}\u{1F1EC}'},
  {code:'ZA',name:'South Africa',dial:'+27',flag:'\u{1F1FF}\u{1F1E6}'},{code:'KR',name:'South Korea',dial:'+82',flag:'\u{1F1F0}\u{1F1F7}'},
  {code:'ES',name:'Spain',dial:'+34',flag:'\u{1F1EA}\u{1F1F8}'},{code:'LK',name:'Sri Lanka',dial:'+94',flag:'\u{1F1F1}\u{1F1F0}'},
  {code:'SE',name:'Sweden',dial:'+46',flag:'\u{1F1F8}\u{1F1EA}'},{code:'CH',name:'Switzerland',dial:'+41',flag:'\u{1F1E8}\u{1F1ED}'},
  {code:'TW',name:'Taiwan',dial:'+886',flag:'\u{1F1F9}\u{1F1FC}'},{code:'TZ',name:'Tanzania',dial:'+255',flag:'\u{1F1F9}\u{1F1FF}'},
  {code:'TH',name:'Thailand',dial:'+66',flag:'\u{1F1F9}\u{1F1ED}'},{code:'TN',name:'Tunisia',dial:'+216',flag:'\u{1F1F9}\u{1F1F3}'},
  {code:'TR',name:'Turkey',dial:'+90',flag:'\u{1F1F9}\u{1F1F7}'},{code:'UG',name:'Uganda',dial:'+256',flag:'\u{1F1FA}\u{1F1EC}'},
  {code:'UA',name:'Ukraine',dial:'+380',flag:'\u{1F1FA}\u{1F1E6}'},{code:'AE',name:'United Arab Emirates',dial:'+971',flag:'\u{1F1E6}\u{1F1EA}'},
  {code:'GB',name:'United Kingdom',dial:'+44',flag:'\u{1F1EC}\u{1F1E7}'},{code:'UZ',name:'Uzbekistan',dial:'+998',flag:'\u{1F1FA}\u{1F1FF}'},
  {code:'VN',name:'Vietnam',dial:'+84',flag:'\u{1F1FB}\u{1F1F3}'},{code:'YE',name:'Yemen',dial:'+967',flag:'\u{1F1FE}\u{1F1EA}'},
  {code:'ZM',name:'Zambia',dial:'+260',flag:'\u{1F1FF}\u{1F1F2}'},{code:'ZW',name:'Zimbabwe',dial:'+263',flag:'\u{1F1FF}\u{1F1FC}'},
];

function AuthPage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{STYLES}</style>
      <div style={{
        minHeight:'100vh', background:C.bg, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', padding:'24px 16px',
        backgroundImage:`radial-gradient(ellipse at 20% 20%,${C.blue}0A 0%,transparent 60%),radial-gradient(ellipse at 80% 80%,${C.blueD}08 0%,transparent 60%)`,
      }}>
        <Link to="/" style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:10, marginBottom:24 }}>
          <div style={{ width:38,height:38,borderRadius:9,background:`linear-gradient(135deg,${C.blue},${C.blueD})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:'#fff',boxShadow:`0 0 20px ${C.blue}44` }}>HP</div>
          <span style={{ fontSize:17, fontWeight:700, color:C.white }}>Hola Prime</span>
        </Link>
        {children}
      </div>
    </>
  );
}

function PasswordInput({ value, onChange, placeholder='••••••••', label }: { value:string; onChange:(v:string)=>void; placeholder?:string; label?:string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      {label && <div style={{ fontSize:13, color:C.txtB, marginBottom:6, fontWeight:500 }}>{label}</div>}
      <div style={{ position:'relative' }}>
        <input type={show?'text':'password'} value={value} onChange={e=>onChange(e.target.value)}
          placeholder={placeholder} style={{ ...inp, paddingRight:44 }} required />
        <button type="button" onClick={()=>setShow(s=>!s)}
          style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:C.txtB, fontSize:16, padding:2 }}
          title={show?'Hide password':'Show password'}>{show?'🙈':'👁️'}</button>
      </div>
    </div>
  );
}

function CountrySelect({ value, onChange }: { value:string; onChange:(code:string)=>void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = COUNTRIES.find(c=>c.code===value);
  const filtered = COUNTRIES.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.code.toLowerCase().includes(search.toLowerCase()));
  useEffect(()=>{ const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false); }; document.addEventListener('mousedown',h); return()=>document.removeEventListener('mousedown',h); },[]);
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button type="button" onClick={()=>setOpen(o=>!o)} style={{ ...inp, display:'flex', alignItems:'center', gap:8, cursor:'pointer', justifyContent:'space-between', textAlign:'left' }}>
        {selected?<span style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ fontSize:18 }}>{selected.flag}</span><span style={{ color:C.white }}>{selected.name}</span></span>:<span style={{ color:C.txtC }}>Select your country</span>}
        <span style={{ color:C.txtC, fontSize:11 }}>{open?'▲':'▼'}</span>
      </button>
      {open&&(
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:300, background:C.surfA, border:`1px solid ${C.bord}`, borderRadius:8, boxShadow:'0 8px 32px rgba(0,0,0,0.5)', overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'8px 10px', borderBottom:`1px solid ${C.bord}` }}>
            <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search country…" style={{ ...inp, padding:'7px 10px', fontSize:13 }} />
          </div>
          <div style={{ overflowY:'auto', maxHeight:220 }}>
            {filtered.map(c=>(
              <button key={c.code} type="button" onClick={()=>{ onChange(c.code); setOpen(false); setSearch(''); }}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 14px', border:'none', cursor:'pointer', textAlign:'left', background:c.code===value?C.surfB:'transparent', color:C.white, fontSize:13, fontFamily:'inherit' }}
                onMouseEnter={e=>(e.currentTarget.style.background=C.surfB)} onMouseLeave={e=>(e.currentTarget.style.background=c.code===value?C.surfB:'transparent')}>
                <span style={{ fontSize:18, flexShrink:0 }}>{c.flag}</span>
                <span style={{ flex:1 }}>{c.name}</span>
                <span style={{ color:C.txtC, fontSize:12 }}>{c.dial}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PhoneInput({ dialCode, onDialChange, phone, onPhoneChange }: { dialCode:string; onDialChange:(c:string)=>void; phone:string; onPhoneChange:(v:string)=>void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = COUNTRIES.find(c=>c.code===dialCode);
  const filtered = COUNTRIES.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.dial.includes(search));
  useEffect(()=>{ const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false); }; document.addEventListener('mousedown',h); return()=>document.removeEventListener('mousedown',h); },[]);
  return (
    <div style={{ display:'flex', gap:8 }}>
      <div ref={ref} style={{ position:'relative', flexShrink:0 }}>
        <button type="button" onClick={()=>setOpen(o=>!o)} style={{ ...inp, width:'auto', display:'flex', alignItems:'center', gap:6, cursor:'pointer', padding:'11px 12px', whiteSpace:'nowrap' }}>
          <span style={{ fontSize:16 }}>{selected?.flag??'🌍'}</span>
          <span style={{ color:C.txtA, fontSize:13 }}>{selected?.dial??'+?'}</span>
          <span style={{ color:C.txtC, fontSize:10 }}>▼</span>
        </button>
        {open&&(
          <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, width:260, zIndex:300, background:C.surfA, border:`1px solid ${C.bord}`, borderRadius:8, boxShadow:'0 8px 32px rgba(0,0,0,0.5)', overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'7px 9px', borderBottom:`1px solid ${C.bord}` }}>
              <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{ ...inp, padding:'6px 9px', fontSize:12 }} />
            </div>
            <div style={{ overflowY:'auto', maxHeight:200 }}>
              {filtered.map(c=>(
                <button key={c.code} type="button" onClick={()=>{ onDialChange(c.code); setOpen(false); setSearch(''); }}
                  style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'8px 12px', border:'none', cursor:'pointer', background:c.code===dialCode?C.surfB:'transparent', color:C.white, fontSize:12, fontFamily:'inherit' }}
                  onMouseEnter={e=>(e.currentTarget.style.background=C.surfB)} onMouseLeave={e=>(e.currentTarget.style.background=c.code===dialCode?C.surfB:'transparent')}>
                  <span style={{ fontSize:15 }}>{c.flag}</span>
                  <span style={{ flex:1, textAlign:'left' }}>{c.name}</span>
                  <span style={{ color:C.txtB }}>{c.dial}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <input type="tel" value={phone} onChange={e=>onPhoneChange(e.target.value)} placeholder="Phone number" style={{ ...inp, flex:1 }} />
    </div>
  );
}

function ErrBanner({ msg }: { msg:string }) {
  return <div style={{ padding:'10px 14px', background:'#3D1313', border:`1px solid ${C.red}44`, borderRadius:8, fontSize:13, color:C.red, display:'flex', alignItems:'center', gap:8 }}><span>⚠️</span>{msg}</div>;
}
function OkBanner({ msg }: { msg:string }) {
  return <div style={{ padding:'10px 14px', background:'#0E2E1F', border:`1px solid ${C.green}44`, borderRadius:8, fontSize:13, color:C.green, display:'flex', alignItems:'center', gap:8 }}><span>✅</span>{msg}</div>;
}

function SubmitBtn({ loading, label }: { loading:boolean; label:string }) {
  return (
    <button type="submit" disabled={loading} className="auth-btn" style={{
      width:'100%', padding:'13px', background:`linear-gradient(135deg,${C.blue},${C.blueD})`,
      border:'none', borderRadius:8, color:'#fff', fontSize:15, fontWeight:700,
      cursor:loading?'not-allowed':'pointer', opacity:loading?0.7:1,
      fontFamily:'inherit', boxShadow:loading?'none':`0 4px 18px ${C.blue}40`,
    }}>{loading?'⏳ Please wait…':label}</button>
  );
}

export function Login() {
  const [email,setEmail]=useState('');const[password,setPassword]=useState('');
  const[error,setError]=useState('');const[loading,setLoading]=useState(false);
  const{login}=useTraderStore();const navigate=useNavigate();
  const submit=async(e:React.FormEvent)=>{ e.preventDefault();setError('');setLoading(true);
    try{ const{data}=await api.post('/login',{email:email.trim().toLowerCase(),password});login(data.token,data.user);navigate('/dashboard'); }
    catch(err:any){ setError(err.response?.data?.error??'Login failed. Please check your credentials.'); }
    finally{ setLoading(false); } };
  return (
    <AuthPage>
      <div className="fade-up" style={{ width:'100%', maxWidth:420, background:C.surfA, border:`1px solid ${C.bord}`, borderRadius:16, padding:'32px 28px', boxShadow:'0 20px 60px rgba(0,0,0,0.4)' }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:C.white, marginBottom:6 }}>Welcome back</h1>
        <p style={{ fontSize:14, color:C.txtB, marginBottom:28 }}>Sign in to your Hola Prime account</p>
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <div style={{ fontSize:13, color:C.txtB, marginBottom:6, fontWeight:500 }}>Email Address</div>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inp} placeholder="you@example.com" required autoFocus />
          </div>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:13, color:C.txtB, fontWeight:500 }}>Password</span>
              <Link to="/forgot-password" className="lnk" style={{ fontSize:12 }}>Forgot password?</Link>
            </div>
            <PasswordInput value={password} onChange={setPassword} />
          </div>
          {error&&<ErrBanner msg={error}/>}
          <SubmitBtn loading={loading} label="Sign In" />
        </form>
        <div style={{ textAlign:'center', marginTop:20, fontSize:14, color:C.txtB }}>
          Don't have an account?{'  '}<Link to="/register" className="lnk">Create account</Link>
        </div>
      </div>
    </AuthPage>
  );
}

export function Register() {
  const[form,setForm]=useState({ firstName:'',lastName:'',email:'',password:'',confirmPassword:'',countryCode:'',dialCode:'IN',phone:'',referralCode:'',agreeTerms:false });
  const[error,setError]=useState('');const[loading,setLoading]=useState(false);
  const{login}=useTraderStore();const navigate=useNavigate();
  const setF=(k:string)=>(v:string|boolean)=>setForm(p=>({...p,[k]:v}));
  const submit=async(e:React.FormEvent)=>{ e.preventDefault();setError('');
    if(form.password!==form.confirmPassword){setError('Passwords do not match.');return;}
    if(form.password.length<8){setError('Password must be at least 8 characters.');return;}
    if(!form.agreeTerms){setError('Please agree to the Terms & Conditions to continue.');return;}
    setLoading(true);
    try{
      const dc=COUNTRIES.find(c=>c.code===form.dialCode);
      const fullPhone=dc&&form.phone?`${dc.dial}${form.phone.replace(/^0+/,'')}`:form.phone||undefined;
      const{data}=await api.post('/register',{ firstName:form.firstName.trim(), lastName:form.lastName.trim(), email:form.email.trim().toLowerCase(), password:form.password, countryCode:form.countryCode||undefined, phone:fullPhone, referralCode:form.referralCode.trim()||undefined });
      login(data.token,{id:data.userId,email:form.email,firstName:form.firstName,lastName:form.lastName});
      navigate('/dashboard');
    }catch(err:any){ setError(err.response?.data?.error??'Registration failed. Please try again.'); }
    finally{ setLoading(false); } };
  return (
    <AuthPage>
      <div className="fade-up" style={{ width:'100%', maxWidth:460, background:C.surfA, border:`1px solid ${C.bord}`, borderRadius:16, padding:'32px 28px', boxShadow:'0 20px 60px rgba(0,0,0,0.4)', maxHeight:'90vh', overflowY:'auto' }}>
        <h1 style={{ fontSize:22, fontWeight:700, color:C.white, marginBottom:4 }}>Create Your Account</h1>
        <p style={{ fontSize:14, color:C.txtB, marginBottom:28 }}>Join 50,000+ funded traders. Free to sign up.</p>
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><div style={{ fontSize:13,color:C.txtB,marginBottom:6,fontWeight:500 }}>First Name <span style={{color:C.red}}>*</span></div><input value={form.firstName} onChange={e=>setF('firstName')(e.target.value)} style={inp} placeholder="John" required /></div>
            <div><div style={{ fontSize:13,color:C.txtB,marginBottom:6,fontWeight:500 }}>Last Name <span style={{color:C.red}}>*</span></div><input value={form.lastName} onChange={e=>setF('lastName')(e.target.value)} style={inp} placeholder="Doe" required /></div>
          </div>
          <div><div style={{ fontSize:13,color:C.txtB,marginBottom:6,fontWeight:500 }}>Email Address <span style={{color:C.red}}>*</span></div><input type="email" value={form.email} onChange={e=>setF('email')(e.target.value)} style={inp} placeholder="you@example.com" required /></div>
          <PasswordInput label="Password *" value={form.password} onChange={setF('password') as (v:string)=>void} placeholder="Min. 8 characters" />
          <PasswordInput label="Confirm Password *" value={form.confirmPassword} onChange={setF('confirmPassword') as (v:string)=>void} placeholder="Repeat your password" />
          <div><div style={{ fontSize:13,color:C.txtB,marginBottom:6,fontWeight:500 }}>Country <span style={{color:C.red}}>*</span></div><CountrySelect value={form.countryCode} onChange={setF('countryCode') as (v:string)=>void} /></div>
          <div><div style={{ fontSize:13,color:C.txtB,marginBottom:6,fontWeight:500 }}>Phone Number <span style={{color:C.txtC,fontWeight:400}}>(optional)</span></div><PhoneInput dialCode={form.dialCode} onDialChange={setF('dialCode') as (v:string)=>void} phone={form.phone} onPhoneChange={setF('phone') as (v:string)=>void} /></div>
          <div><div style={{ fontSize:13,color:C.txtB,marginBottom:6,fontWeight:500 }}>Referral Code <span style={{color:C.txtC,fontWeight:400}}>(optional)</span></div><input value={form.referralCode} onChange={e=>setF('referralCode')(e.target.value)} style={inp} placeholder="Enter referral code if you have one" /></div>
          <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', marginTop:4 }}>
            <input type="checkbox" checked={form.agreeTerms} onChange={e=>setF('agreeTerms')(e.target.checked)} style={{ marginTop:2, width:16, height:16, flexShrink:0, accentColor:C.blue }} />
            <span style={{ fontSize:13, color:C.txtB, lineHeight:1.5 }}>I agree to the{' '}<a href="https://holaprime.com/terms" target="_blank" rel="noreferrer" className="lnk">Terms & Conditions</a>{' '}and{' '}<a href="https://holaprime.com/privacy" target="_blank" rel="noreferrer" className="lnk">Privacy Policy</a></span>
          </label>
          {error&&<ErrBanner msg={error}/>}
          <SubmitBtn loading={loading} label="Create Account →" />
        </form>
        <div style={{ textAlign:'center', marginTop:20, fontSize:14, color:C.txtB }}>
          Already have an account?{'  '}<Link to="/login" className="lnk">Sign in</Link>
        </div>
      </div>
    </AuthPage>
  );
}

export function ForgotPassword() {
  const[email,setEmail]=useState('');const[loading,setLoading]=useState(false);
  const[sent,setSent]=useState(false);const[error,setError]=useState('');
  const submit=async(e:React.FormEvent)=>{ e.preventDefault();setError('');setLoading(true);
    try{ await api.post('/forgot-password',{email:email.trim().toLowerCase()});setSent(true); }
    catch{ setError('Something went wrong. Please try again.'); }
    finally{ setLoading(false); } };
  return (
    <AuthPage>
      <div className="fade-up" style={{ width:'100%', maxWidth:400, background:C.surfA, border:`1px solid ${C.bord}`, borderRadius:16, padding:'32px 28px', boxShadow:'0 20px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize:36, textAlign:'center', marginBottom:16 }}>🔐</div>
        <h1 style={{ fontSize:22, fontWeight:700, color:C.white, marginBottom:8, textAlign:'center' }}>Forgot Password?</h1>
        <p style={{ fontSize:14, color:C.txtB, marginBottom:28, textAlign:'center', lineHeight:1.6 }}>Enter your email and we'll send you a link to reset your password.</p>
        {sent?(
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <OkBanner msg={`Reset link sent to ${email}. Check your inbox (and spam folder).`}/>
            <div style={{ textAlign:'center', fontSize:13, color:C.txtB }}>Didn't receive it?{'  '}<button onClick={()=>setSent(false)} style={{ background:'none', border:'none', color:C.blue, cursor:'pointer', fontWeight:600, fontFamily:'inherit', fontSize:13 }}>Send again</button></div>
          </div>
        ):(
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <div><div style={{ fontSize:13, color:C.txtB, marginBottom:6, fontWeight:500 }}>Email Address</div><input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inp} placeholder="you@example.com" required autoFocus /></div>
            {error&&<ErrBanner msg={error}/>}
            <SubmitBtn loading={loading} label="Send Reset Link" />
          </form>
        )}
        <div style={{ textAlign:'center', marginTop:20, fontSize:14 }}><Link to="/login" className="lnk">← Back to Sign In</Link></div>
      </div>
    </AuthPage>
  );
}

export function ResetPassword() {
  const[searchParams]=useSearchParams();const token=searchParams.get('token')??'';
  const[password,setPassword]=useState('');const[confirm,setConfirm]=useState('');
  const[loading,setLoading]=useState(false);const[done,setDone]=useState(false);
  const[error,setError]=useState('');const navigate=useNavigate();

  const strengthScore=(p:string)=>[p.length>=8,/[A-Z]/.test(p),/[0-9]/.test(p),/[^a-zA-Z0-9]/.test(p)].filter(Boolean).length;
  const strengthLabel=(n:number)=>n<=1?'Weak':n<=2?'Fair':n<=3?'Good':'Strong';
  const strengthColor=(n:number)=>[C.red,C.red,'#F5B326',C.blue,C.green][n];

  const submit=async(e:React.FormEvent)=>{ e.preventDefault();setError('');
    if(password!==confirm){setError('Passwords do not match.');return;}
    if(password.length<8){setError('Password must be at least 8 characters.');return;}
    setLoading(true);
    try{ await api.post('/reset-password',{token,password});setDone(true);setTimeout(()=>navigate('/login'),2500); }
    catch(err:any){ setError(err.response?.data?.error??'Reset failed. The link may have expired.'); }
    finally{ setLoading(false); } };

  if(!token) return (
    <AuthPage>
      <div className="fade-up" style={{ width:'100%', maxWidth:400, background:C.surfA, border:`1px solid ${C.bord}`, borderRadius:16, padding:'32px 28px', textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:16 }}>⚠️</div>
        <div style={{ color:C.white, fontWeight:700, marginBottom:8 }}>Invalid Reset Link</div>
        <div style={{ color:C.txtB, fontSize:14, marginBottom:20 }}>This link is missing a token. Please request a new one.</div>
        <Link to="/forgot-password" className="lnk">Request new link →</Link>
      </div>
    </AuthPage>
  );

  return (
    <AuthPage>
      <div className="fade-up" style={{ width:'100%', maxWidth:400, background:C.surfA, border:`1px solid ${C.bord}`, borderRadius:16, padding:'32px 28px', boxShadow:'0 20px 60px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize:36, textAlign:'center', marginBottom:16 }}>🔑</div>
        <h1 style={{ fontSize:22, fontWeight:700, color:C.white, marginBottom:8, textAlign:'center' }}>Set New Password</h1>
        <p style={{ fontSize:14, color:C.txtB, marginBottom:28, textAlign:'center' }}>Choose a strong password for your account.</p>
        {done?(
          <div style={{ display:'flex', flexDirection:'column', gap:16, textAlign:'center' }}>
            <OkBanner msg="Password updated! Redirecting to sign in…"/>
            <Link to="/login" className="lnk" style={{ fontSize:13 }}>Click here if not redirected</Link>
          </div>
        ):(
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
            <PasswordInput label="New Password" value={password} onChange={setPassword} placeholder="Min. 8 characters" />
            <PasswordInput label="Confirm New Password" value={confirm} onChange={setConfirm} placeholder="Repeat new password" />
            {password.length>0&&(
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                {[...Array(4)].map((_,i)=>{ const s=strengthScore(password); return <div key={i} style={{ flex:1, height:3, borderRadius:2, background:i<s?strengthColor(s):C.surfC, transition:'background 0.2s' }}/>; })}
                <span style={{ fontSize:11, color:C.txtC, marginLeft:6, whiteSpace:'nowrap' }}>{strengthLabel(strengthScore(password))}</span>
              </div>
            )}
            {error&&<ErrBanner msg={error}/>}
            <SubmitBtn loading={loading} label="Update Password" />
          </form>
        )}
      </div>
    </AuthPage>
  );
}
