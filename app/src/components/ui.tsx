import { type ReactNode, type CSSProperties } from 'react';

const C = {
  bg:'#13151B', surfA:'#1C1F27', surfB:'#252931', bordA:'#353947',
  blue:'#3F8FE0', green:'#38BA82', gold:'#F5B326', red:'#EB5454',
  white:'#F5F8FF', txtA:'#CCD2E3', txtB:'#878FA4', txtC:'#4F5669',
};

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background:C.surfA, border:`1px solid ${C.bordA}`, borderRadius:12, padding:20, ...style }}>
      {children}
    </div>
  );
}

export function Btn({ children, onClick, variant='primary', size='md', disabled, style }: {
  children:ReactNode; onClick?:()=>void; variant?:'primary'|'secondary'|'danger'|'ghost';
  size?:'sm'|'md'; disabled?:boolean; style?:CSSProperties;
}) {
  const base: CSSProperties = {
    display:'inline-flex', alignItems:'center', gap:6, borderRadius:8,
    fontWeight:600, cursor:disabled?'not-allowed':'pointer',
    opacity:disabled?0.5:1, transition:'background 0.15s', fontFamily:'inherit',
    padding: size==='sm' ? '6px 12px' : '10px 18px',
    fontSize: size==='sm' ? 13 : 14,
  };
  const vars: Record<string,CSSProperties> = {
    primary:   { background:C.blue,   color:'#fff', border:'none' },
    secondary: { background:'transparent', color:C.txtB, border:`1px solid ${C.bordA}` },
    danger:    { background:C.red,    color:'#fff', border:'none' },
    ghost:     { background:'transparent', color:C.blue, border:'none' },
  };
  return <button onClick={disabled?undefined:onClick} style={{ ...base, ...vars[variant], ...style }}>{children}</button>;
}

export function Badge({ label, color }: { label:string; color:string }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', padding:'2px 8px',
      borderRadius:4, fontSize:11, fontWeight:700, color,
      background:color+'22', border:`1px solid ${color}44`,
      letterSpacing:'0.04em', textTransform:'uppercase', whiteSpace:'nowrap',
    }}>{label}</span>
  );
}

export function Spinner({ size=24 }: { size?:number }) {
  return (
    <div style={{ width:size, height:size, border:`2px solid ${C.bordA}`, borderTopColor:C.blue, borderRadius:'50%', animation:'spin 0.7s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export function StatCard({ label, value, color, icon }: { label:string; value:string|number; color?:string; icon?:string }) {
  return (
    <Card style={{ padding:'14px 16px' }}>
      <div style={{ fontSize:11, color:C.txtC, marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
        {icon && <span style={{ fontSize:14 }}>{icon}</span>}
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize:22, fontWeight:700, color:color??C.white }}>{value}</div>
    </Card>
  );
}

export function Empty({ icon='📭', message='', sub='' }: { icon?:string; message?:string; sub?:string }) {
  return (
    <div style={{ textAlign:'center', padding:'48px 24px' }}>
      <div style={{ fontSize:40, marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:14, fontWeight:600, color:C.txtA }}>{message}</div>
      {sub && <div style={{ fontSize:12, color:C.txtC, marginTop:6 }}>{sub}</div>}
    </div>
  );
}

export const hp = C;
