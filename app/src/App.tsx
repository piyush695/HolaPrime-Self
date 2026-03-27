import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useTraderStore } from './lib/api.js';
import { Layout, AuthLayout } from './components/Layout.js';
import { Login, Register, ForgotPassword, ResetPassword } from './pages/Auth.js';
import Landing from './pages/Landing.js';
import PixelLoader from './components/PixelLoader.js';
import Dashboard from './pages/Dashboard.js';
import AccountDetail from './pages/AccountDetail.js';
import {
  Accounts, Challenges, Checkout, Payouts, KYC,
  Profile, Support, Leaderboard, TournamentsPage,
  PayoutHistory, Certificates, AffiliateDashboard,
} from './pages/Pages.js';
import {
  ForexProChallenge, ForexPrimeChallenge, ForexOneChallenge,
  ForexDirectAccount, ScalingPlan, ForexTradingRules,
  TradingPlatforms, TransparencyReport, TradingTools, ForexFAQ,
  FuturesPrimeChallenge, FuturesDirectAccount, FuturesInstruments,
  FuturesTradingRules, FuturesFAQ,
  AboutUs, OurTeam, Awards, OneHourPayouts, PayoutReport,
  NewsMedia, Careers, Contact,
  AffiliatePage, AffiliateFAQ, AffiliateLogin,
  PrimeAcademy, Competition, RiskControl, Blog,
} from './pages/SubPages.js';


// Scroll to top on every route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

function Protected({ children }: { children: React.ReactNode }) {
  const isAuth = useTraderStore(s => s.isAuth);
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ScrollToTop />
        <PixelLoader />
        <Routes>
          {/* ── Marketing site ── */}
          <Route path="/"                          element={<Landing />} />

          {/* ── Forex pages ── */}
          <Route path="/forex"                     element={<ForexProChallenge />} />
          <Route path="/forex/pro-challenge"       element={<ForexProChallenge />} />
          <Route path="/forex/prime-challenge"     element={<ForexPrimeChallenge />} />
          <Route path="/forex/one-challenge"       element={<ForexOneChallenge />} />
          <Route path="/forex/direct-account"      element={<ForexDirectAccount />} />
          <Route path="/forex/scaling"             element={<ScalingPlan />} />
          <Route path="/forex/trading-rules"       element={<ForexTradingRules />} />
          <Route path="/forex/trading-platforms"   element={<TradingPlatforms />} />
          <Route path="/forex/transparency-report" element={<TransparencyReport />} />
          <Route path="/forex/trading-tools"       element={<TradingTools />} />
          <Route path="/forex/faq"                 element={<ForexFAQ />} />

          {/* ── Futures pages ── */}
          <Route path="/futures"                        element={<FuturesPrimeChallenge />} />
          <Route path="/futures/prime-challenge"        element={<FuturesPrimeChallenge />} />
          <Route path="/futures/direct-account"         element={<FuturesDirectAccount />} />
          <Route path="/futures/instruments"            element={<FuturesInstruments />} />
          <Route path="/futures/trading-rules"          element={<FuturesTradingRules />} />
          <Route path="/futures/faq"                    element={<FuturesFAQ />} />

          {/* ── About / Company ── */}
          <Route path="/about"                     element={<AboutUs />} />
          <Route path="/team"                      element={<OurTeam />} />
          <Route path="/awards"                    element={<Awards />} />
          <Route path="/1-hour-payouts"            element={<OneHourPayouts />} />
          <Route path="/payout-report"             element={<PayoutReport />} />
          <Route path="/news"                      element={<NewsMedia />} />
          <Route path="/careers"                   element={<Careers />} />
          <Route path="/contact"                   element={<Contact />} />

          {/* ── Affiliate ── */}
          <Route path="/affiliate"                 element={<AffiliatePage />} />
          <Route path="/affiliate/faq"             element={<AffiliateFAQ />} />
          <Route path="/affiliate/login"           element={<AffiliateLogin />} />

          {/* ── More ── */}
          <Route path="/academy"                   element={<PrimeAcademy />} />
          <Route path="/competition"               element={<Competition />} />
          <Route path="/risk-control"              element={<RiskControl />} />
          <Route path="/blog"                      element={<Blog />} />

          {/* ── Auth pages ── */}
          <Route path="/login"           element={<AuthLayout><Login    /></AuthLayout>} />
          <Route path="/register"        element={<AuthLayout><Register /></AuthLayout>} />
          <Route path="/forgot-password" element={<AuthLayout><ForgotPassword /></AuthLayout>} />
          <Route path="/reset-password"  element={<AuthLayout><ResetPassword /></AuthLayout>} />

          {/* ── Protected trader portal ── */}
          <Route path="/dashboard"      element={<Protected><Layout><Dashboard /></Layout></Protected>} />
          <Route path="/accounts"       element={<Protected><Layout><Accounts /></Layout></Protected>} />
          <Route path="/accounts/:id"   element={<Protected><Layout><AccountDetail /></Layout></Protected>} />
          <Route path="/challenges"     element={<Protected><Layout><Challenges /></Layout></Protected>} />
          <Route path="/checkout/:slug" element={<Protected><Layout><Checkout /></Layout></Protected>} />
          <Route path="/payouts"        element={<Protected><Layout><Payouts /></Layout></Protected>} />
          <Route path="/kyc"            element={<Protected><Layout><KYC /></Layout></Protected>} />
          <Route path="/profile"        element={<Protected><Layout><Profile /></Layout></Protected>} />
          <Route path="/support"        element={<Protected><Layout><Support /></Layout></Protected>} />
          <Route path="/leaderboard"    element={<Protected><Layout><Leaderboard /></Layout></Protected>} />
          <Route path="/tournaments"      element={<Protected><Layout><TournamentsPage /></Layout></Protected>} />
          <Route path="/payout-history"   element={<Protected><Layout><PayoutHistory /></Layout></Protected>} />
          <Route path="/certificates"     element={<Protected><Layout><Certificates /></Layout></Protected>} />
          <Route path="/affiliate-dashboard" element={<Protected><Layout><AffiliateDashboard /></Layout></Protected>} />

          {/* ── Fallback ── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
