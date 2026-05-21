// Convex HTTP site URLs (.convex.site) for newsletter, blog feed, YouTube proxy, etc.
// Dev: exciting-gazelle-615 — active `convex dev` deployment with newsletter routes + env
// Prod: lovable-tapir-496 — production deployment (`bunx convex deploy`)
(function () {
  const CONVEX_SITE_DEV = "https://exciting-gazelle-615.convex.site";
  const CONVEX_SITE_PROD = "https://lovable-tapir-496.convex.site";
  const isLocal = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(window.location.hostname);
  window.CONVEX_SITE_URL = isLocal ? CONVEX_SITE_DEV : CONVEX_SITE_PROD;
})();
