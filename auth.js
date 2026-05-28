// Shared Clerk + Convex auth module for the (static, no-build) site.
//
// Loads ClerkJS v6 from the instance Frontend API, wires a reactive Convex client
// whose auth token comes from Clerk's "convex" JWT template, and exposes small
// helpers used by the account page and the course pages.
//
// Usage (ES module):
//   import { getClerk, getConvexClient, api, syncUser, mountAuthControls } from "/auth.js";

import { ConvexClient, anyApi } from "https://esm.sh/convex@1.31.5/browser";
import {
  CLERK_PUBLISHABLE_KEY,
  CLERK_FRONTEND_API,
  CONVEX_URL,
} from "/auth-config.js";

export const api = anyApi;

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
 */
export function getClerk() {
  if (clerkPromise) return clerkPromise;
  clerkPromise = (async () => {
    const base = `https://${CLERK_FRONTEND_API}/npm`;
    // UI bundle must load before clerk-js (it registers window.__internal_ClerkUICtor).
    await loadScript(`${base}/@clerk/ui@1/dist/ui.browser.js`);
    await loadScript(`${base}/@clerk/clerk-js@6/dist/clerk.browser.js`, {
      "data-clerk-publishable-key": CLERK_PUBLISHABLE_KEY,
    });
    if (!window.Clerk) throw new Error("ClerkJS failed to initialize");
    await window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });
    return window.Clerk;
  })();
  return clerkPromise;
}

/**
 * A reactive Convex client whose auth token is fetched from Clerk on demand
 * (Convex refreshes it automatically via this callback).
 */
export async function getConvexClient() {
  const clerk = await getClerk();
  if (!convexClient) {
    convexClient = new ConvexClient(CONVEX_URL);
    convexClient.setAuth(async () => {
      if (!clerk.session) return null;
      return await clerk.session.getToken({ template: "convex" });
    });
  }
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
