import { useState } from 'react';

export const A = { bg:'#0F1117',surf:'#161B27',surf2:'#1C2333',bord:'#252D3D',bordL:'#2E3850',blue:'#3F8FE0',blueL:'#60A9F0',blueD:'#1E5FAE',white:'#F5F8FF',txtA:'#D8E0F0',txtB:'#8892B0',txtC:'#4F5669',green:'#38BA82',red:'#FF4C6A',gold:'#F4C430',orange:'#F97316' };
export const getToken = () => { try { return JSON.parse(localStorage.getItem('hp-admin-auth-v2')!).state?.accessToken; } catch { return null; } };
export const api = (p: string, o?: RequestInit) => fetch(p, { ...o, headers: { 'Content-Type':'application/json', ...(getToken() ? { Authorization:`Bearer ${getToken()}` } : {}), ...(o?.headers ?? {}) } }).then(r => r.json());
export const inp: React.CSSProperties = { width:'100%',background:'rgba(255,255,255,.05)',color:A.white,border:`1px solid ${A.bord}`,borderRadius:8,padding:'10px 14px',fontSize:14,outline:'none',fontFamily:'inherit' };
export const sel: React.CSSProperties = { width:'100%',background:A.surf2,color:A.white,border:`1px solid ${A.bord}`,borderRadius:8,padding:'10px 14px',fontSize:14,outline:'none',fontFamily:'inherit',cursor:'pointer' };
export function Card({ children, style = {} }: any) { return <div style={{ background:A.surf,border:`1px solid ${A.bord}`,borderRadius:12,padding:20,...style }}>{children}</div>; }
export function Pill({ label, color }: any) { return <span style={{ fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:20,background:`${color}18`,border:`1px solid ${color}44`,color,letterSpacing:'.05em' }}>{label?.toUpperCase()}</span>; }
export function Btn({ children, onClick, variant='primary', disabled=false, style={} }: any) {
  const vars: any = { primary:{background:`linear-gradient(135deg,${A.blue},${A.blueD})`,color:'#fff',border:'none',boxShadow:`0 3px 12px rgba(63,143,224,.3)`}, ghost:{background:A.surf2,color:A.txtA,border:`1px solid ${A.bord}`}, danger:{background:'rgba(255,76,106,.12)',color:A.red,border:`1px solid rgba(255,76,106,.3)`}, success:{background:'rgba(56,186,130,.12)',color:A.green,border:`1px solid rgba(56,186,130,.3)`} };
  return <button onClick={onClick} disabled={disabled} style={{ display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,padding:'9px 18px',borderRadius:8,fontSize:13,fontWeight:700,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',opacity:disabled?0.65:1,transition:'all .18s',...vars[variant],...style }}>{children}</button>;
}
export function Toggle({ checked, onChange, label }: any) {
  return <label style={{ display:'flex',alignItems:'center',gap:10,cursor:'pointer' }}>
    <div onClick={() => onChange(!checked)} style={{ width:44,height:24,borderRadius:12,position:'relative',cursor:'pointer',background:checked?A.blue:A.surf2,border:`1px solid ${checked?A.blue:A.bord}`,transition:'all .2s' }}>
      <div style={{ position:'absolute',top:2,left:checked?22:2,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left .2s',boxShadow:'0 2px 4px rgba(0,0,0,.3)' }}/>
    </div>
    {label && <span style={{ fontSize:14,color:A.txtA }}>{label}</span>}
  </label>;
}
export function Section({ title, children, action }: any) {
  return <div style={{ marginBottom:28 }}><div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}><h2 style={{ fontSize:18,fontWeight:700,color:A.white }}>{title}</h2>{action}</div>{children}</div>;
}
