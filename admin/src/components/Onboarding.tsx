import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/api.js';

interface Step {
  id:          string;
  title:       string;
  description: string;
  icon:        string;
  action?:     string;
  actionPath?: string;
  tip?:        string;
}

const STEPS_BY_ROLE: Record<string, Step[]> = {
  superadmin: [
    { id:'welcome',     icon:'👋', title:'Welcome to Command Centre',
      description:'You have full platform access as Super Admin. This walkthrough will get you oriented in 2 minutes.',
      tip:'Super Admins can do everything — including inviting other admins and changing all settings.' },
    { id:'dashboard',   icon:'📊', title:'Your Live Dashboard',
      description:'The dashboard shows real-time KPIs: active traders, revenue, payouts, KYC queue, and recent activity. Check this first every day.',
      action:'Go to Dashboard', actionPath:'/dashboard' },
    { id:'admins',      icon:'👥', title:'Invite Your Team',
      description:'Head to Settings → Admin Users to invite your team. Each person gets a role: Admin, Compliance, Support, Finance, or Risk.',
      action:'Manage Admin Users', actionPath:'/settings',
      tip:'Start by inviting at least one Compliance and one Support admin.' },
    { id:'integrations', icon:'🔌', title:'Connect Your Services',
      description:'Go to OPS → Integrations Hub to connect payment gateways, KYC providers, email services, and trading platforms.',
      action:'Open Integrations Hub', actionPath:'/ops/integrations' },
    { id:'ops',         icon:'🌍', title:'Configure Your Platform',
      description:'Set up Country Controls, Feature Flags, and Site Content. These go live instantly — no redeploy needed.',
      action:'Open OPS Controls', actionPath:'/ops/feature-flags' },
    { id:'email',       icon:'📧', title:'Set Up Email Delivery',
      description:'Connect SendGrid for transactional emails (OTP, account events) and Mailmodo for campaigns. Go to Settings → Email Configuration.',
      action:'Configure Email', actionPath:'/email-settings',
      tip:'Without SendGrid, traders cannot receive OTP codes or account notifications.' },
    { id:'products',    icon:'🏆', title:'Create Challenge Products',
      description:'Set up your challenge plans (e.g. $25K, $50K, $100K) with profit targets, drawdown limits, and pricing.',
      action:'Manage Products', actionPath:'/challenges' },
    { id:'done',        icon:'🎉', title:'You\'re All Set!',
      description:'Command Centre is ready. Your team can now start managing traders, processing payouts, and running campaigns.' },
  ],
  admin: [
    { id:'welcome',     icon:'👋', title:'Welcome to Command Centre',
      description:'You have admin access to Hola Prime. Here is a quick orientation to get you up to speed.' },
    { id:'dashboard',   icon:'📊', title:'Your Dashboard',
      description:'The dashboard shows all live KPIs. Check here daily for the platform pulse.',
      action:'Go to Dashboard', actionPath:'/dashboard' },
    { id:'traders',     icon:'👥', title:'Managing Traders',
      description:'Go to Users to search and manage trader accounts, view their history, and handle support cases.',
      action:'View Users', actionPath:'/users' },
    { id:'payouts',     icon:'💸', title:'Processing Payouts',
      description:'Payouts requiring manual review show here. Approve or reject with notes — traders are notified automatically.',
      action:'View Payouts', actionPath:'/payouts' },
    { id:'ops',         icon:'🌍', title:'Operations Centre',
      description:'The OPS section lets you control Country settings, Feature Flags, Email Templates, and more — all live.',
      action:'Explore OPS', actionPath:'/ops/feature-flags' },
    { id:'done',        icon:'🎉', title:'Ready to Go!',
      description:'You now know your way around. Click any section in the sidebar to get started.' },
  ],
  compliance: [
    { id:'welcome',     icon:'👋', title:'Welcome — Compliance Role',
      description:'Your role focuses on KYC verification, risk monitoring, and regulatory compliance.' },
    { id:'kyc',         icon:'🪪', title:'KYC Queue',
      description:'Your primary workspace. Review submitted documents, approve or reject with reason codes.',
      action:'Open KYC Queue', actionPath:'/kyc' },
    { id:'risk',        icon:'🛡️', title:'Risk Dashboard',
      description:'Monitor fraud flags, velocity alerts, and suspicious trading patterns in real-time.',
      action:'Open Risk', actionPath:'/risk' },
    { id:'country',     icon:'🌍', title:'Country Controls',
      description:'Manage which countries can register, trade, and receive payouts. Changes are instant.',
      action:'Country Controls', actionPath:'/ops/country-controls' },
    { id:'done',        icon:'✅', title:'Compliance Overview Complete',
      description:'Check the KYC queue and Risk dashboard daily to stay on top of verification and compliance.' },
  ],
  support: [
    { id:'welcome',     icon:'👋', title:'Welcome — Support Role',
      description:'Your role is to help traders. You can view accounts, respond to tickets, and handle common issues.' },
    { id:'users',       icon:'👥', title:'Finding Traders',
      description:'Search traders by email or name. View their accounts, payment history, and challenge status.',
      action:'Search Users', actionPath:'/users' },
    { id:'tickets',     icon:'🎫', title:'Support Tickets',
      description:'All incoming support requests land here. Respond, escalate, and close tickets.',
      action:'Open Tickets', actionPath:'/ops/support-tickets' },
    { id:'done',        icon:'✅', title:'Support Overview Complete',
      description:'Check Support Tickets regularly. When in doubt, escalate to Compliance or Finance.' },
  ],
  finance: [
    { id:'welcome',     icon:'👋', title:'Welcome — Finance Role',
      description:'Your role covers payouts, payments, and financial reporting.' },
    { id:'payouts',     icon:'💸', title:'Payout Processing',
      description:'Review and approve payout requests. You can batch-approve low-risk payouts and reject with reason.',
      action:'Open Payouts', actionPath:'/payouts' },
    { id:'payments',    icon:'💳', title:'Payment Records',
      description:'All challenge purchases and payment history. Use for reconciliation and refund processing.',
      action:'View Payments', actionPath:'/payments' },
    { id:'reports',     icon:'📈', title:'Financial Reports',
      description:'Export revenue, payout, and settlement reports by date range.',
      action:'Open Reports', actionPath:'/reports' },
    { id:'done',        icon:'✅', title:'Finance Overview Complete',
      description:'Process the payout queue daily. Set payout rules in OPS → Payout Control to automate approvals.' },
  ],
  risk: [
    { id:'welcome',     icon:'👋', title:'Welcome — Risk Role',
      description:'Your role monitors trading behaviour, fraud, and platform risk.' },
    { id:'risk',        icon:'🛡️', title:'Risk Dashboard',
      description:'Your main workspace. Monitor fraud flags, velocity alerts, and unusual patterns.',
      action:'Open Risk', actionPath:'/risk' },
    { id:'accounts',    icon:'📊', title:'Trading Accounts',
      description:'Review active accounts, breaches, and unusual performance metrics.',
      action:'View Accounts', actionPath:'/accounts' },
    { id:'done',        icon:'✅', title:'Risk Overview Complete',
      description:'Review the risk dashboard daily. Flag suspicious accounts for compliance review.' },
  ],
};

const ONBOARDING_KEY = 'hp-onboarding-completed-v1';

export function useOnboarding() {
  const admin = useAuthStore(s => s.admin);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!admin) return;
    const completed = localStorage.getItem(`${ONBOARDING_KEY}-${admin.id}`);
    if (!completed) {
      // Small delay so dashboard renders first
      setTimeout(() => setShow(true), 800);
    }
  }, [admin?.id]);

  function dismiss() {
    if (admin) localStorage.setItem(`${ONBOARDING_KEY}-${admin.id}`, '1');
    setShow(false);
  }

  return { show, dismiss };
}

interface OnboardingProps {
  onDismiss: () => void;
}

export default function Onboarding({ onDismiss }: OnboardingProps) {
  const admin = useAuthStore(s => s.admin);
  const navigate = useNavigate();
  const role = admin?.role ?? 'support';
  const steps = STEPS_BY_ROLE[role] ?? STEPS_BY_ROLE.support;
  const [current, setCurrent] = useState(0);
  const step = steps[current];
  const isLast = current === steps.length - 1;
  const progress = ((current + 1) / steps.length) * 100;

  function next() {
    if (isLast) { onDismiss(); return; }
    setCurrent(c => c + 1);
  }

  function back() { setCurrent(c => Math.max(0, c - 1)); }

  function goTo(path: string) {
    onDismiss();
    navigate(path);
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.85)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#161B27', border:'1px solid #252D3D', borderRadius:20, width:520, maxWidth:'90vw', overflow:'hidden', boxShadow:'0 40px 100px rgba(0,0,0,.8)' }}>

        {/* Progress bar */}
        <div style={{ height:3, background:'#1E2535' }}>
          <div style={{ height:'100%', background:'linear-gradient(90deg,#3F8FE0,#38BA82)', width:`${progress}%`, transition:'width .4s ease' }} />
        </div>

        {/* Header */}
        <div style={{ padding:'20px 24px 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontSize:11, color:'#4F5669', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em' }}>
            SETUP GUIDE — {current + 1} / {steps.length}
          </div>
          <button onClick={onDismiss} style={{ background:'none', border:'none', color:'#4F5669', fontSize:18, cursor:'pointer', padding:4 }}
            title="Skip walkthrough">✕</button>
        </div>

        {/* Content */}
        <div style={{ padding:'20px 32px 28px' }}>
          <div style={{ fontSize:48, marginBottom:16, lineHeight:1 }}>{step.icon}</div>

          <h2 style={{ fontSize:22, fontWeight:900, color:'#F5F8FF', margin:'0 0 12px', lineHeight:1.3 }}>
            {step.title}
          </h2>

          <p style={{ fontSize:14, color:'#8892B0', lineHeight:1.7, margin:'0 0 20px' }}>
            {step.description}
          </p>

          {step.tip && (
            <div style={{ padding:'10px 14px', background:'rgba(63,143,224,.08)', border:'1px solid rgba(63,143,224,.2)', borderRadius:8, fontSize:12, color:'#60A9F0', marginBottom:20, lineHeight:1.6 }}>
              💡 {step.tip}
            </div>
          )}

          {/* Step dots */}
          <div style={{ display:'flex', gap:6, marginBottom:24, justifyContent:'center' }}>
            {steps.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} style={{
                width: i === current ? 24 : 8, height:8, borderRadius:4,
                background: i === current ? '#3F8FE0' : i < current ? '#38BA82' : '#252D3D',
                border:'none', cursor:'pointer', transition:'all .2s',
              }} />
            ))}
          </div>

          {/* Actions */}
          <div style={{ display:'flex', gap:10, flexDirection:'column' }}>
            {step.actionPath && step.action && (
              <button onClick={() => goTo(step.actionPath!)} style={{
                padding:'12px 20px', borderRadius:10, border:'1px solid rgba(63,143,224,.3)',
                background:'rgba(63,143,224,.1)', color:'#60A9F0', fontSize:14, fontWeight:700,
                cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                transition:'all .15s',
              }}
                onMouseEnter={e => { (e.currentTarget as any).style.background='rgba(63,143,224,.2)'; }}
                onMouseLeave={e => { (e.currentTarget as any).style.background='rgba(63,143,224,.1)'; }}>
                {step.action} →
              </button>
            )}

            <div style={{ display:'flex', gap:10 }}>
              {current > 0 && (
                <button onClick={back} style={{ flex:1, padding:'11px 0', borderRadius:10, border:'1px solid #252D3D',
                  background:'transparent', color:'#8892B0', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                  ← Back
                </button>
              )}
              <button onClick={next} style={{ flex:2, padding:'11px 0', borderRadius:10, border:'none',
                background: isLast ? 'linear-gradient(135deg,#38BA82,#16A34A)' : 'linear-gradient(135deg,#3F8FE0,#2563EB)',
                color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer',
                boxShadow: isLast ? '0 4px 16px rgba(56,186,130,.4)' : '0 4px 16px rgba(63,143,224,.4)',
              }}>
                {isLast ? '🎉 Get Started' : 'Next →'}
              </button>
            </div>

            <button onClick={onDismiss} style={{ background:'none', border:'none', color:'#4F5669', fontSize:12, cursor:'pointer', padding:'4px 0' }}>
              Skip walkthrough
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
