import { PageHeader, Card } from '../components/ui.js';

function Placeholder({ title, sub, phase }: { title:string; sub:string; phase:string }) {
  return (
    <>
      <PageHeader title={title} sub={sub} />
      <Card style={{ textAlign:'center', padding:'64px 24px' }}>
        <div style={{ fontSize:40, marginBottom:16 }}>🚧</div>
        <div style={{ fontSize:16, fontWeight:700, color:'#F5F8FF', marginBottom:8 }}>
          Coming in {phase}
        </div>
        <div style={{ fontSize:13, color:'#878FA4', maxWidth:400, margin:'0 auto' }}>
          This module is scheduled for {phase}. The database schema and API routes are
          already scaffolded — the frontend and backend logic will be built next.
        </div>
      </Card>
    </>
  );
}

export function Challenges() {
  return <Placeholder
    title="Challenge Products"
    sub="Create and manage prop firm challenge tiers"
    phase="Phase 1 — Week 3"
  />;
}

export function CRM() {
  return <Placeholder
    title="CRM & Lead Pipeline"
    sub="Lead management, lifecycle stages, and segmentation"
    phase="Phase 2"
  />;
}

export function Campaigns() {
  return <Placeholder
    title="Campaigns & Email Builder"
    sub="Drag-drop email campaigns, WhatsApp flows, A/B testing"
    phase="Phase 3"
  />;
}

export function Affiliates() {
  return <Placeholder
    title="Affiliate System"
    sub="Link generation, click tracking, and commission management"
    phase="Phase 2"
  />;
}

export function Tournaments() {
  return <Placeholder
    title="Tournament Manager"
    sub="World Cup phases, fixtures, seeding, and prize distribution"
    phase="Phase 3"
  />;
}

export function Settings() {
  return <Placeholder
    title="Settings"
    sub="Platform connections, admin users, roles, and system configuration"
    phase="Phase 1 — Week 4"
  />;
}
