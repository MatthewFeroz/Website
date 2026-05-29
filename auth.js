// Shared Clerk + Convex auth module for the (static, no-build) site.
//
// Loads ClerkJS v6 from the instance Frontend API, wires a reactive Convex client
// whose auth token comes from Clerk's "convex" JWT template, and exposes small
// helpers used by the account page and the course pages.
//
// Usage (ES module):
//   import { getClerk, getConvexClient, api, syncUser, mountAuthControls } from "/auth.js";

import { ConvexHttpClient } from "https://esm.sh/convex@1.31.5/browser";
import {
  CLERK_PUBLISHABLE_KEY,
  CLERK_FRONTEND_API,
  CONVEX_URL,
} from "/auth-config.js";

// Build "module:function" function references without depending on `anyApi`
// (which isn't reliably exported from convex/browser). Same trick the quiz
// index.html uses. e.g. api.identity.syncUser === "identity:syncUser".
export const api = new Proxy(
  {},
  {
    get: (_, module) =>
      new Proxy({}, { get: (_, fn) => `${String(module)}:${String(fn)}` }),
  }
);

let clerkPromise = null;
let convexClient = null;

function loadScript(src, attrs = {}) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.crossOrigin = "anonymous";
    s.type = "text/javascript";
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

/**
 * Load and initialize ClerkJS once. Resolves to the global `Clerk` instance.
 * Uses clerk-js@5 (UI components bundled in — no separate @clerk/ui bundle and no
 * `ui:` argument needed, which is far more robust for a no-build static site).
 */
export function getClerk() {
  if (clerkPromise) return clerkPromise;
  clerkPromise = (async () => {
    await loadScript(
      `https://${CLERK_FRONTEND_API}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`,
      { "data-clerk-publishable-key": CLERK_PUBLISHABLE_KEY }
    );
    if (!window.Clerk) throw new Error("ClerkJS global not found after script load");
    await window.Clerk.load();
    return window.Clerk;
  })();
  return clerkPromise;
}

/**
 * A Convex HTTP client with a fresh Clerk "convex" JWT applied. Call this
 * before each batch of calls so the (short-lived) token is current.
 */
export async function getConvexClient() {
  const clerk = await getClerk();
  if (!convexClient) convexClient = new ConvexHttpClient(CONVEX_URL);
  const token = clerk.session
    ? await clerk.session.getToken({ template: "convex" })
    : null;
  if (token) convexClient.setAuth(token);
  else if (convexClient.clearAuth) convexClient.clearAuth();
  return convexClient;
}

/** Is a user currently signed in? */
export async function isSignedIn() {
  const clerk = await getClerk();
  return !!clerk.user;
}

/**
 * Upsert the Convex user row for the signed-in Clerk identity and link any
 * entitlements held under their email. Safe to call on every page load while
 * signed in. Returns { userId, email, role, hasCourseAccess } or null if signed out.
 */
export async function syncUser() {
  const clerk = await getClerk();
  if (!clerk.user) return null;
  const client = await getConvexClient();
  return await client.mutation(api.identity.syncUser, {});
}

/** Lightweight "who am I" (null if signed out). */
export async function me() {
  const clerk = await getClerk();
  if (!clerk.user) return null;
  const client = await getConvexClient();
  return await client.query(api.identity.me, {});
}

export async function openSignIn(opts = {}) {
  const clerk = await getClerk();
  clerk.openSignIn(opts);
}

export async function signOut() {
  const clerk = await getClerk();
  await clerk.signOut();
}

/**
 * Render auth controls into a container: a "Sign in" button when signed out,
 * or Clerk's UserButton when signed in. Re-renders on auth changes.
 * Calls syncUser() automatically whenever a user becomes/stays signed in.
 */
export async function mountAuthControls(selector, { onChange } = {}) {
  const clerk = await getClerk();
  const el =
    typeof selector === "string" ? document.querySelector(selector) : selector;
  if (!el) return;

  const render = async () => {
    el.innerHTML = "";
    if (clerk.user) {
      const slot = document.createElement("div");
      el.appendChild(slot);
      clerk.mountUserButton(slot, { afterSignOutUrl: window.location.pathname });
      try {
        await syncUser();
      } catch (e) {
        console.error("syncUser failed", e);
      }
    } else {
      const btn = document.createElement("button");
      btn.className = "auth-signin-btn";
      btn.textContent = "Sign in";
      btn.addEventListener("click", () => clerk.openSignIn({}));
      el.appendChild(btn);
    }
    if (onChange) onChange(clerk.user || null);
  };

  await render();
  clerk.addListener(() => {
    render();
  });
}
