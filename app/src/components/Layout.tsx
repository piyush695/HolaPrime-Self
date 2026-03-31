import { type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTraderStore, api } from '../lib/api.js';
import { hp } from '../components/ui.js';

const NAV = [
  { to:'/dashboard',           icon:'📊', label:'Dashboard' },
  { to:'/accounts',            icon:'💼', label:'My Accounts' },
  { to:'/challenges',          icon:'🏆', label:'Buy Challenge' },
  null,
  { to:'/payouts',             icon:'💸', label:'Payouts' },
  { to:'/payout-history',      icon:'📋', label:'Payout History' },
  { to:'/certificates',        icon:'🏅', label:'Certificates' },
  null,
  { to:'/affiliate-dashboard', icon:'🔗', label:'Affiliate' },
  { to:'/kyc',                 icon:'🪪', label:'Verification' },
  { to:'/leaderboard',         icon:'🌍', label:'Leaderboard' },
  { to:'/tournaments',         icon:'🥊', label:'Tournaments' },
  null,
  { to:'/support',             icon:'💬', label:'Support' },
  { to:'/profile',             icon:'👤', label:'Profile' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useTraderStore();
  const navigate = useNavigate();

  const { data: notifs } = useQuery({
    queryKey: ['notifications'],
    queryFn:  () => api.get('/notifications').then(r => r.data),
    refetchInterval: 30_000,
  });
  const unreadCount = (notifs ?? []).filter((n: any) => !n.is_read).length;

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:hp.bg, fontFamily:"'DM Sans',system-ui,sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width:210, flexShrink:0, background:hp.surfA, borderRight:`1px solid ${hp.bordA}`, display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh', overflowY:'auto' }}>
        {/* Logo */}
        <div style={{ padding:'14px 16px', borderBottom:`1px solid ${hp.bordA}`, display:'flex', alignItems:'center' }}>
          <img src="/logo-white.png" alt="hola prime" style={{ height:44, width:'auto', objectFit:'contain', maxWidth:160 }} />
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'10px 0' }}>
          {NAV.map((item, i) =>
            item === null ? (
              <div key={i} style={{ height:1, background:hp.bordA, margin:'8px 0' }} />
            ) : (
              <NavLink key={item.to} to={item.to} style={({ isActive }) => ({
                display:'flex', alignItems:'center', gap:9, padding:'8px 16px',
                fontSize:13, fontWeight:isActive?700:400,
                color:isActive?hp.white:hp.txtB,
                background:isActive?hp.surfB:'transparent',
                borderLeft:isActive?`3px solid ${hp.blue}`:'3px solid transparent',
                textDecoration:'none', transition:'background 0.1s',
              })}>
                <span style={{ fontSize:14, width:20, textAlign:'center' }}>{item.icon}</span>
                {item.label}
                {item.to === '/support' && unreadCount > 0 && (
                  <span style={{ marginLeft:'auto', background:hp.red, color:'#fff', borderRadius:10, fontSize:10, fontWeight:700, padding:'1px 6px' }}>
                    {unreadCount}
                  </span>
                )}
              </NavLink>
            )
          )}
        </nav>

        {/* User */}
        <div style={{ padding:'12px 16px', borderTop:`1px solid ${hp.bordA}`, display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:30, height:30, borderRadius:'50%', background:hp.blue, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:600, color:hp.white, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user?.firstName} {user?.lastName}
            </div>
            <div style={{ fontSize:10, color:hp.txtC }}>Trader</div>
          </div>
          <button onClick={handleLogout} style={{ background:'none', border:'none', color:hp.txtC, fontSize:14, cursor:'pointer', padding:'2px 4px' }} title="Sign out">⎋</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {/* Top bar */}
        <div style={{ padding:'0 24px', height:52, background:hp.surfA, borderBottom:`1px solid ${hp.bordA}`, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10 }}>
          <div style={{ fontSize:13, color:hp.txtB }}>Hola Prime</div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            {unreadCount > 0 && (
              <NavLink to="/support" style={{ textDecoration:'none' }}>
                <div style={{ padding:'4px 10px', background:hp.redDim ?? '#3D1313', border:`1px solid ${hp.red}44`, borderRadius:6, fontSize:11, color:hp.red, fontWeight:600 }}>
                  🔔 {unreadCount} new
                </div>
              </NavLink>
            )}
            <NavLink to="/challenges" style={{ textDecoration:'none' }}>
              <div style={{ padding:'6px 14px', background:hp.blue, borderRadius:6, fontSize:12, fontWeight:700, color:'#fff', cursor:'pointer' }}>
                + Buy Challenge
              </div>
            </NavLink>
          </div>
        </div>

        {/* Page content */}
        <main style={{ padding:24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}

// Standalone page wrapper for auth pages (no sidebar)
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight:'100vh', background:hp.bg, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',system-ui,sans-serif" }}>
      {children}
    </div>
  );
}
