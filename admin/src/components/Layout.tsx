import { type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../lib/api.js';

const NAV = [
  { to:'/dashboard',    icon:'⬛', label:'Dashboard' },
  { to:'/users',        icon:'👥', label:'Users' },
  { to:'/kyc',          icon:'🪪', label:'KYC' },
  { to:'/challenges',   icon:'🏆', label:'Products' },
  { to:'/accounts',     icon:'📊', label:'Accounts' },
  { to:'/payments',     icon:'💳', label:'Payments' },
  { to:'/payouts',      icon:'💸', label:'Payouts' },
  { to:'/risk',         icon:'🛡️', label:'Risk' },
  null,
  { to:'/marketing',    icon:'📈', label:'Marketing Intel' },
  { to:'/utm-builder',  icon:'🔗', label:'UTM Builder' },
  { to:'/crm',          icon:'🎯', label:'CRM' },
  { to:'/campaigns',    icon:'📧', label:'Campaigns' },
  { to:'/audiences',    icon:'👥', label:'Audiences' },
  { to:'/whatsapp',          icon:'💬', label:'WhatsApp Inbox' },
  { to:'/whatsapp-templates', icon:'📋', label:'WA Templates' },
  { to:'/affiliates',   icon:'🔗', label:'Affiliates' },
  { to:'/attribution',  icon:'📡', label:'Attribution' },
  { to:'/retention',    icon:'♻️', label:'Retention' },
  null,
  { to:'/tournaments',  icon:'🌍', label:'Tournaments' },
  { to:'/reports',      icon:'📈', label:'Reports' },
  { to:'/webhooks',     icon:'🔌', label:'Webhooks' },
  { to:'/integrations', icon:'📡', label:'S2S Integrations' },
  { to:'/payment-gateways', icon:'💳', label:'Payment Gateways' },
  { to:'/email-settings',   icon:'📬', label:'Email / Mailmodo' },
  null,
  null,
  { to:'/trading-platforms', icon:'🔗', label:'Trading Platforms' },
  { to:'/pixels',            icon:'📡', label:'Pixel Manager' },
  { to:'/event-builder',   icon:'🎯', label:'Event Builder' },
  null,
  null,
  { to:'/audit',         icon:'🔍', label:'Audit Log' },
  { to:'/permissions',   icon:'🔐', label:'Permissions' },
  null,
  { to:'/settings',      icon:'⚙️', label:'Settings' },
  null,
  // ── Operations Control Centre ───────────────────────────────────────────────
  { to:'/ops/analytics',        icon:'📊', label:'Analytics', group:'OPS' },
  { to:'/ops/feature-flags',    icon:'🚦', label:'Feature Flags' },
  { to:'/ops/site-content',     icon:'✏️', label:'Site Content' },
  { to:'/ops/promo-codes',      icon:'🎟️', label:'Promo Codes' },
  { to:'/ops/email-templates',  icon:'📧', label:'Email Templates' },
  { to:'/ops/payout-control',   icon:'💸', label:'Payout Control' },
  { to:'/ops/country-controls', icon:'🌍', label:'Country Controls' },
  { to:'/ops/faq',              icon:'❓', label:'FAQ Manager' },
  { to:'/ops/testimonials',     icon:'⭐', label:'Testimonials' },
  { to:'/ops/blog',             icon:'📝', label:'Blog CMS' },
  { to:'/ops/support-tickets',  icon:'🎫', label:'Support Tickets' },
  { to:'/ops/ip-blocklist',     icon:'🚫', label:'IP Blocklist' },
  { to:'/ops/integrations',      icon:'🔌', label:'Integrations Hub' },
];

export function Layout({ children }: { children: ReactNode }) {
  const admin  = useAuthStore(s => s.admin);
  const logout = useAuthStore(s => s.logout);

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <div style={{ width:200, flexShrink:0, background:'#1C1F27', borderRight:'1px solid #353947', display:'flex', flexDirection:'column', overflowY:'auto' }}>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid #353947', display:'flex', alignItems:'center', flexShrink:0 }}>
          <img src="/logo-white.png" alt="Hola Prime" style={{ height:40, width:'auto', objectFit:'contain', maxWidth:160 }} />
        </div>
        <nav style={{ flex:1, padding:'8px 0' }}>
          {NAV.map((item, i) =>
            item === null ? (
              <div key={i} style={{ height:1, background:'#353947', margin:'6px 0' }} />
            ) : (item as any).group ? (
              <div key={i}>
                <div style={{ padding:'10px 16px 4px', fontSize:9, fontWeight:800, color:'#3F8FE0', letterSpacing:'.15em' }}>{(item as any).group}</div>
                <NavLink to={(item as any).to} style={({ isActive }) => ({
                  display:'flex', alignItems:'center', gap:9, padding:'7px 16px',
                  fontSize:12, fontWeight:isActive?700:400,
                  color:isActive?'#F5F8FF':'#878FA4',
                  background:isActive?'#252931':'transparent',
                  borderLeft:isActive?'2px solid #3F8FE0':'2px solid transparent',
                  textDecoration:'none',
                })}>
                  <span style={{ fontSize:13, width:18, textAlign:'center' }}>{(item as any).icon}</span>
                  {(item as any).label}
                </NavLink>
              </div>
            ) : (
              <NavLink key={(item as any).to} to={(item as any).to} style={({ isActive }) => ({
                display:'flex', alignItems:'center', gap:9, padding:'7px 16px',
                fontSize:12, fontWeight:isActive?700:400,
                color:isActive?'#F5F8FF':'#878FA4',
                background:isActive?'#252931':'transparent',
                borderLeft:isActive?'2px solid #3F8FE0':'2px solid transparent',
                textDecoration:'none',
              })}>
                <span style={{ fontSize:13, width:18, textAlign:'center' }}>{(item as any).icon}</span>
                {(item as any).label}
              </NavLink>
            )
          )}
        </nav>
        <div style={{ padding:'10px 16px', borderTop:'1px solid #353947', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <div style={{ width:26, height:26, borderRadius:'50%', background:'#3F8FE0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' }}>
            {admin?.firstName?.[0]}{admin?.lastName?.[0]}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#F5F8FF', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{admin?.firstName} {admin?.lastName}</div>
            <div style={{ fontSize:10, color:'#4F5669', textTransform:'capitalize' }}>{admin?.role}</div>
          </div>
          <button onClick={logout} style={{ background:'none', border:'none', color:'#4F5669', fontSize:14, cursor:'pointer' }} title="Logout">⎋</button>
        </div>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ padding:'0 22px', height:52, background:'#1C1F27', borderBottom:'1px solid #353947', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, position:'sticky', top:0, zIndex:10 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#F5F8FF' }}>
            {NAV.find(n => n && window.location.pathname.startsWith(n.to))?.label ?? 'Admin'}
          </div>
          <div style={{ padding:'4px 10px', background:'#162F4F', border:'1px solid #3F8FE044', borderRadius:6, fontSize:11, color:'#3F8FE0' }}>
            GCP · us-central1
          </div>
        </div>
        <main style={{ flex:1, overflowY:'auto', padding:22 }}>{children}</main>
      </div>
    </div>
  );
}
