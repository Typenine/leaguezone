/* Public research uses static HTML, outside Next's React application.
 * Register the same site-wide worker so installs work when Research is
 * someone's first LeagueZone page. This script makes no data/API requests.
 */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  if (!window.isSecureContext) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {
      // Research remains usable if offline capability is not supported.
    });
  }, { once: true });
})();

(function(){var script=document.createElement('script');script.src='/research/app-shell.js';script.defer=true;document.head.appendChild(script)})();

(function(){var link=document.createElement('link');link.rel='stylesheet';link.href='/research/app-shell.css';document.head.appendChild(link)})();
