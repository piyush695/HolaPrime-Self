import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api.js';

// ── Page scope mapping ────────────────────────────────────────────────────────
function getPageScope(pathname: string): string {
  if (pathname === '/' || pathname === '/register' || pathname === '/login') return 'landing';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/checkout')) return 'checkout';
  return 'app';
}

// ── Pixel snippet generators ──────────────────────────────────────────────────
function buildPixelScript(pixel: any): string {
  const id = pixel.pixel_id ?? '';
  switch (pixel.platform) {
    case 'meta_pixel':
      return `
        (function() {
          if (window.fbq) return;
          var fbq = window.fbq = function() {
            fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
          };
          fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
          var s = document.createElement('script');
          s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js';
          document.head.appendChild(s);
          fbq('init', '${id}');
          fbq('track', 'PageView');
          window.__hp_pixels = window.__hp_pixels || {};
          window.__hp_pixels['meta_pixel_${id}'] = true;
        })();
      `;

    case 'gtm':
      return `
        (function(w,d,s,l,i){
          w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
          var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
          j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
          f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${id}');
        window.__hp_pixels = window.__hp_pixels || {};
        window.__hp_pixels['gtm_${id}'] = true;
      `;

    case 'google_ads':
      return `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${id}');
        var s = document.createElement('script');
        s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=${id}';
        document.head.appendChild(s);
        window.__hp_pixels = window.__hp_pixels || {};
        window.__hp_pixels['google_ads_${id}'] = true;
      `;

    case 'tiktok_pixel':
      return `
        (function(w,d,t){
          w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
          ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];
          ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
          for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
          ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
          ttq.load=function(e,n){var i='https://analytics.tiktok.com/i18n/pixel/events.js';
          ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};
          var o=document.createElement('script');o.type='text/javascript',o.async=!0,o.src=i+'?sdkid='+e+'&lib='+t;
          var a=document.getElementsByTagName('script')[0];a.parentNode.insertBefore(o,a)};
          ttq.load('${id}');ttq.page();
        })(window,document,'ttq');
        window.__hp_pixels = window.__hp_pixels || {};
        window.__hp_pixels['tiktok_${id}'] = true;
      `;

    case 'taboola_pixel':
      return `
        window._tfa = window._tfa || [];
        window._tfa.push({notify: 'event', name: 'page_view', id: ${id}});
        !function(t,f,a,x){
          if(!document.getElementById(x)){t.async=1;t.src=a;t.id=x;
          f.parentNode.insertBefore(t,f);}
        }(document.createElement('script'),document.getElementsByTagName('script')[0],
          '//cdn.taboola.com/libtrc/unip/${id}/tfa.js','tb_tfa_script');
        window.__hp_pixels = window.__hp_pixels || {};
        window.__hp_pixels['taboola_${id}'] = true;
      `;

    case 'outbrain_pixel':
      return `
        (function(_window,_document){
          var OB_ADV_ID='${id}';
          if(_window.obApi){var toArray=function(object){return Object.prototype.toString.call(object)==='[object Array]'?object:[object];};_window.obApi.marketerId=toArray(_window.obApi.marketerId).concat(toArray(OB_ADV_ID));return;}
          var api=_window.obApi=function(){api.dispatch?api.dispatch.apply(api,arguments):api.queue.push(arguments);};api.version='1.1';api.loaded=true;api.marketerId=OB_ADV_ID;api.queue=[];
          var tag=_document.createElement('script');tag.async=true;tag.src='https://amplify.outbrain.com/cp/obtp.js';
          var script=_document.getElementsByTagName('script')[0];script.parentNode.insertBefore(tag,script);
        })(window,document);
        obApi('track','PAGE_VIEW');
        window.__hp_pixels = window.__hp_pixels || {};
        window.__hp_pixels['outbrain_${id}'] = true;
      `;

    case 'snapchat_pixel':
      return `
        (function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script',r=t.createElement(s);r.async=!0;r.src='https://sc-static.net/scevent.min.js';
        var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})(window,document);
        snaptr('init', '${id}');
        snaptr('track', 'PAGE_VIEW');
        window.__hp_pixels = window.__hp_pixels || {};
        window.__hp_pixels['snapchat_${id}'] = true;
      `;

    case 'pinterest_pixel':
      return `
        (function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version='3.0';var t=document.createElement('script');t.async=!0,t.src=e;var r=document.getElementsByTagName('script')[0];r.parentNode.insertBefore(t,r)}}('https://s.pinimg.com/ct/core.js'));
        pintrk('load','${id}');
        pintrk('page');
        window.__hp_pixels = window.__hp_pixels || {};
        window.__hp_pixels['pinterest_${id}'] = true;
      `;

    case 'linkedin_insight':
      return `
        _linkedin_partner_id = "${id}";
        window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
        window._linkedin_data_partner_ids.push(_linkedin_partner_id);
        (function(l) {if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}
        var s = document.getElementsByTagName("script")[0];var b = document.createElement("script");
        b.type = "text/javascript";b.async = true;b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
        s.parentNode.insertBefore(b, s);})(window.lintrk);
        window.__hp_pixels = window.__hp_pixels || {};
        window.__hp_pixels['linkedin_${id}'] = true;
      `;

    case 'custom_script':
      return pixel.custom_script ?? '';

    default:
      return '';
  }
}

// ── Helper to fire pixel events from the browser ─────────────────────────────
export function firePixelEvent(eventName: string, params: Record<string, unknown> = {}) {
  const w = window as any;

  // Meta Pixel
  if (w.fbq) w.fbq('track', eventName, params);

  // TikTok
  if (w.ttq) w.ttq.track(eventName, params);

  // Snapchat
  if (w.snaptr) w.snaptr('track', eventName, params);

  // Pinterest
  if (w.pintrk) w.pintrk('track', eventName, params);

  // Taboola
  if (w._tfa) w._tfa.push({ notify: 'event', name: eventName, id: undefined });

  // Outbrain
  if (w.obApi) w.obApi('track', eventName);

  // GTM dataLayer
  if (w.dataLayer) w.dataLayer.push({ event: eventName, ...params });
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PixelLoader() {
  const location = useLocation();

  useEffect(() => {
    const page = getPageScope(location.pathname);

    // Fetch active pixels from API
    api.get(`/pixels/public?page=${page}`)
      .then(res => {
        const pixels: any[] = res.data ?? [];

        pixels.forEach(pixel => {
          // Skip already loaded pixels
          const key = `hp_pixel_${pixel.id}`;
          if ((window as any).__hp_loaded_pixels?.[key]) return;

          const code = buildPixelScript(pixel);
          if (!code.trim()) return;

          try {
            // Execute the script
            const fn = new Function(code);
            fn();

            // Mark as loaded
            (window as any).__hp_loaded_pixels = (window as any).__hp_loaded_pixels || {};
            (window as any).__hp_loaded_pixels[key] = true;
          } catch (err) {
            console.warn(`[PixelLoader] Failed to load pixel ${pixel.name}:`, err);
          }
        });
      })
      .catch(() => {
        // Silently fail — pixel loader must never break the app
      });
  }, []);

  // Fire PageView on every route change
  useEffect(() => {
    firePixelEvent('PageView', { page: location.pathname });
  }, [location.pathname]);

  return null; // No UI
}
