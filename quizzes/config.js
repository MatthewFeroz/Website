// Quiz Platform Configuration
//
// CONVEX_URL auto-switches based on hostname:
//   - localhost / 127.0.0.1 → dev deployment  (grateful-pony-674)
//   - anywhere else         → prod deployment (kindhearted-swordfish-668)
//
// This keeps local testing safely pointed at dev so test submissions don't
// create real leads or fire real emails, while the live site at
// matthewferoz.com automatically hits prod.

const CONVEX_URL_DEV  = "https://grateful-pony-674.convex.cloud";
const CONVEX_URL_PROD = "https://kindhearted-swordfish-668.convex.cloud";

const _isLocal =
  typeof window !== "undefined" &&
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(window.location.hostname);

export const CONVEX_URL = _isLocal ? CONVEX_URL_DEV : CONVEX_URL_PROD;

// DEV MODE: Set to true to bypass authentication during development
// This will auto-login with the test code and skip session validation
// WARNING: Must be false in production!
export const DEV_MODE = false; // Set to true for local testing only

// Test access code for dev mode - only works when DEV_MODE is true
// In production, this code will not work as DEV_MODE will be false
export const DEV_ACCESS_CODE = ""; // Only used when DEV_MODE is true
