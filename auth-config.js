// Shared auth + backend config, auto-switched by hostname (mirrors quizzes/config.js).
//
//   - localhost / 127.0.0.1 → Clerk DEV instance  + Convex dev  (grateful-pony-674)
//   - anywhere else         → Clerk PROD instance + Convex prod (kindhearted-swordfish-668)
//
// Clerk Publishable Keys are safe to expose in client code (that's their purpose).
// The Frontend API host is where ClerkJS is served from; it's encoded in the pub key too.

const DEV = {
  CLERK_PUBLISHABLE_KEY: "pk_test_ZnJlc2gtbGVtdXItNjQuY2xlcmsuYWNjb3VudHMuZGV2JA",
  CLERK_FRONTEND_API: "fresh-lemur-64.clerk.accounts.dev",
  CONVEX_URL: "https://grateful-pony-674.convex.cloud",
};

const PROD = {
  CLERK_PUBLISHABLE_KEY: "pk_live_Y2xlcmsubWF0dGhld2Zlcm96LmNvbSQ",
  CLERK_FRONTEND_API: "clerk.matthewferoz.com",
  CONVEX_URL: "https://kindhearted-swordfish-668.convex.cloud",
};

const _isLocal =
  typeof window !== "undefined" &&
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(window.location.hostname);

const cfg = _isLocal ? DEV : PROD;

export const CLERK_PUBLISHABLE_KEY = cfg.CLERK_PUBLISHABLE_KEY;
export const CLERK_FRONTEND_API = cfg.CLERK_FRONTEND_API;
export const CONVEX_URL = cfg.CONVEX_URL;
