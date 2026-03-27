/**
 * Hola Prime Click Tracker v1.0
 * Drop this script on any landing page or the main app.
 * It auto-captures all ad platform click IDs and UTM params,
 * generates a unique hp_click_id, and stores it in localStorage.
 * 
 * Include with: <script src="/tracker.js" defer></script>
 */
(function() {
  'use strict';

  const API = '/api/v1/utm/record-click';
  const STORAGE_KEY = 'hp_click_data';
  const CLICK_ID_KEY = 'hp_click_id';

  // ── Parse all tracking params from URL ──────────────────────────────────────
  function parseParams() {
    const p = new URLSearchParams(window.location.search);
    return {
      // Ad platform click IDs
      gclid:      p.get('gclid'),
      fbclid:     p.get('fbclid'),
      ttclid:     p.get('ttclid'),
      twclid:     p.get('twclid'),
      msclkid:    p.get('msclkid'),
      li_fat_id:  p.get('li_fat_id'),
      pin_uniq:   p.get('pin_uniq'),
      // UTM params
      utm_source:   p.get('utm_source'),
      utm_medium:   p.get('utm_medium'),
      utm_campaign: p.get('utm_campaign'),
      utm_term:     p.get('utm_term'),
      utm_content:  p.get('utm_content'),
      utm_id:       p.get('utm_id'),
      // Our own click ID (from short link redirect)
      hp_click_id:  p.get('hp_click_id'),
      // Referral
      ref:          p.get('ref'),
    };
  }

  // ── Check if any tracking params are present ─────────────────────────────────
  function hasTrackingParams(params) {
    return Object.values(params).some(v => v !== null);
  }

  // ── Main tracking logic ───────────────────────────────────────────────────────
  function track() {
    const params = parseParams();

    // If we already have an hp_click_id from a short link, just store it
    if (params.hp_click_id) {
      localStorage.setItem(CLICK_ID_KEY, params.hp_click_id);
      return;
    }

    // Only fire if there are tracking params or no previous session
    const existing = localStorage.getItem(CLICK_ID_KEY);
    if (!hasTrackingParams(params) && existing) return;

    const payload = {
      ...params,
      url:      window.location.href,
      referrer: document.referrer || null,
    };

    // Fire to API
    fetch(API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    .then(r => r.json())
    .then(data => {
      if (data.click_id) {
        localStorage.setItem(CLICK_ID_KEY, data.click_id);
        // Also store all params for use during registration
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          click_id:     data.click_id,
          utm_source:   params.utm_source,
          utm_medium:   params.utm_medium,
          utm_campaign: params.utm_campaign,
          utm_term:     params.utm_term,
          utm_content:  params.utm_content,
          gclid:        params.gclid,
          fbclid:       params.fbclid,
          ttclid:       params.ttclid,
          ref:          params.ref,
          captured_at:  new Date().toISOString(),
        }));
      }
    })
    .catch(() => {}); // Silent fail — never break the page
  }

  // ── Public API for use during registration ────────────────────────────────────
  window.HolaPrimeTracker = {
    getClickId:   function() { return localStorage.getItem(CLICK_ID_KEY); },
    getClickData: function() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
      catch { return null; }
    },
    // Call this after successful registration: HolaPrimeTracker.attribute(userId, 'signup', 99)
    attribute: function(userId, event, value) {
      const clickId = this.getClickId();
      if (!clickId || !userId) return;
      fetch('/api/v1/utm/attribute', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ click_id: clickId, user_id: userId, event, value }),
      }).catch(() => {});
    },
    // Clear tracking data (e.g. after successful attribution)
    clear: function() {
      localStorage.removeItem(CLICK_ID_KEY);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', track);
  } else {
    track();
  }
})();
