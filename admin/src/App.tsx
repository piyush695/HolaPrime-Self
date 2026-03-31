import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './lib/api.js';
import { Layout } from './components/Layout.js';
// Phase 1
import Login      from './pages/Login.js';
import Dashboard  from './pages/Dashboard.js';
import Users      from './pages/Users.js';
import KYC        from './pages/KYC.js';
import Accounts   from './pages/Accounts.js';
import Payments   from './pages/Payments.js';
import Payouts    from './pages/Payouts.js';
import Risk       from './pages/Risk.js';
// Phase 2
import CRM         from './pages/phase2/CRM.js';
import Campaigns   from './pages/phase2/Campaigns.js';
import WhatsApp          from './pages/phase2/WhatsApp.js';
import WhatsAppTemplates from './pages/phase2/WhatsAppTemplates.js';
import Onboarding, { useOnboarding } from './components/Onboarding.js';
import Affiliates  from './pages/phase2/Affiliates.js';
import Attribution from './pages/phase2/Attribution.js';
import Retention   from './pages/phase2/Retention.js';
// Phase 3
import Settings       from './pages/phase3/Settings.js';
import Reports        from './pages/phase3/Reports.js';
import Tournaments    from './pages/phase3/Tournaments.js';
import Webhooks       from './pages/phase3/Webhooks.js';
import PaymentGateways from './pages/phase3/PaymentGateways.js';
import EmailSettings  from './pages/phase3/EmailSettings.js';
import Integrations   from './pages/phase3/Integrations.js';
import Products       from './pages/phase3/Products.js';
// Phase 6
import PixelManager       from './pages/phase6/PixelManager.js';
import TradingPlatforms  from './pages/phase6/TradingPlatforms.js';
import AuditLog         from './pages/phase5/AuditLog.js';
import RolesPermissions from './pages/phase5/RolesPermissions.js';
import EventBuilder  from './pages/phase6/EventBuilder.js';
import FeatureFlags        from './pages/ops/FeatureFlags.js';
import SiteContent         from './pages/ops/SiteContent.js';
import PromoCodes          from './pages/ops/PromoCodes.js';
import CountryControls     from './pages/ops/CountryControls.js';
import PayoutControl       from './pages/ops/PayoutControl.js';
import EmailTemplates      from './pages/ops/EmailTemplates.js';
import FAQManager          from './pages/ops/FAQManager.js';
import TestimonialsManager from './pages/ops/TestimonialsManager.js';
import BlogCMS             from './pages/ops/BlogCMS.js';
import SupportTickets      from './pages/ops/SupportTickets.js';
import AnalyticsDashboard  from './pages/ops/AnalyticsDashboard.js';
import MarketingDashboard from './pages/phase2/MarketingDashboard.js';
import UTMBuilder          from './pages/phase2/UTMBuilder.js';
import IPBlocklist         from './pages/ops/IPBlocklist.js';
import IntegrationsHub     from './pages/ops/IntegrationsHub.js';
import './design/tokens.css';

const qc = new QueryClient({ defaultOptions: { queries: { retry:1, staleTime:30_000 } } });

function Protected({ children }: { children: React.ReactNode }) {
  const isAuth = useAuthStore(s => s.isAuth);
  const { show: showOnboarding, dismiss: dismissOnboarding } = useOnboarding();
  return isAuth ? (
    <>
      {showOnboarding && <Onboarding onDismiss={dismissOnboarding} />}
      {children}
    </>
  ) : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <Protected>
              <Layout>
                <Routes>
                  <Route path="/"            element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard"   element={<Dashboard />} />
                  <Route path="/users"       element={<Users />} />
                  <Route path="/kyc"         element={<KYC />} />
                  <Route path="/challenges"  element={<Products />} />
                  <Route path="/accounts"    element={<Accounts />} />
                  <Route path="/payments"    element={<Payments />} />
                  <Route path="/payouts"     element={<Payouts />} />
                  <Route path="/risk"        element={<Risk />} />
                  <Route path="/crm"         element={<CRM />} />
                  <Route path="/campaigns"   element={<Campaigns />} />
                  <Route path="/whatsapp"            element={<WhatsApp />} />
                  <Route path="/whatsapp-templates" element={<WhatsAppTemplates />} />
                  <Route path="/affiliates"  element={<Affiliates />} />
                  <Route path="/marketing"         element={<MarketingDashboard />} />
                  <Route path="/utm-builder"      element={<UTMBuilder />} />
                  <Route path="/attribution" element={<Attribution />} />
                  <Route path="/retention"   element={<Retention />} />
                  <Route path="/tournaments" element={<Tournaments />} />
                  <Route path="/reports"     element={<Reports />} />
                  <Route path="/webhooks"    element={<Webhooks />} />
                  <Route path="/audit"            element={<AuditLog />} />
                  <Route path="/permissions"      element={<RolesPermissions />} />
                  <Route path="/settings"         element={<Settings />} />
                  <Route path="/payment-gateways" element={<PaymentGateways />} />
                  <Route path="/email-settings"   element={<EmailSettings />} />
                  <Route path="/integrations"     element={<Integrations />} />
                  <Route path="/products"         element={<Products />} />
                  <Route path="/pixels"            element={<PixelManager />} />
                  <Route path="/trading-platforms" element={<TradingPlatforms />} />
                  <Route path="/event-builder"    element={<EventBuilder />} />
                  <Route path="/ops/feature-flags"    element={<FeatureFlags />} />
                  <Route path="/ops/site-content"     element={<SiteContent />} />
                  <Route path="/ops/promo-codes"      element={<PromoCodes />} />
                  <Route path="/ops/country-controls" element={<CountryControls />} />
                  <Route path="/ops/payout-control"   element={<PayoutControl />} />
                  <Route path="/ops/email-templates"  element={<EmailTemplates />} />
                  <Route path="/ops/faq"              element={<FAQManager />} />
                  <Route path="/ops/testimonials"     element={<TestimonialsManager />} />
                  <Route path="/ops/blog"             element={<BlogCMS />} />
                  <Route path="/ops/support-tickets"  element={<SupportTickets />} />
                  <Route path="/ops/analytics"        element={<AnalyticsDashboard />} />
                  <Route path="/ops/ip-blocklist"     element={<IPBlocklist />} />
                  <Route path="/ops/integrations"     element={<IntegrationsHub />} />

                </Routes>
              </Layout>
            </Protected>
          } />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
