# Auth Overhaul Setup Guide (Clerk + Convex)

> ## ✅ Status (auto-completed via Clerk CLI on the DEV instance)
> - Clerk app **"How AI Works"** (`app_3EN6kqK8J1jFSSYQj7iT0Sqhuo5`) linked to this repo.
> - **Google** sign-in enabled; **password disabled** → effectively Google-only. (Dev uses
>   Clerk's shared Google credentials, so no Google Cloud setup needed for testing.)
> - **`convex` JWT template** created (`jtmp_3EN7x...`) with `aud`, `email`, `email_verified`,
>   `name` claims.
> - Dev keys pulled to `.env.local` (gitignored). Publishable key:
>   `pk_test_ZnJlc2gtbGVtdXItNjQ...`  Issuer: `https://fresh-lemur-64.clerk.accounts.dev`.
> - Convex **dev** env vars set: `CLERK_JWT_ISSUER_DOMAIN`, `ADMIN_EMAILS=matthewferoz@gmail.com`.
> - Backend schema + `identity.ts` deployed to the dev Convex deployment.
>
> ## ⚠️ Still needs you (before PRODUCTION launch only)
> Your Clerk app currently has **no production instance** (dev only). Everything works on
> dev right now for building & testing. See the detailed "Production launch" section below
> when you're ready to go live.

---


This guide covers the **manual dashboard steps** that only you can do. The code in this
repo expects these to be done. Work through them top to bottom; the whole thing takes
~20–30 minutes. Nothing here touches your live site until you choose to deploy.

> **Login method:** Google only (you can add more later in Clerk).
> **Admin email:** `matthewferoz@gmail.com`

---

## 1. Create the Clerk application

1. Go to <https://dashboard.clerk.com> and sign up / log in.
2. Click **Create application**.
3. Name it `Matt Feroz` (or anything).
4. Under **Sign-in options**, enable **Google** only. Turn the rest off.
5. Click **Create application**.

You'll land on the API keys page. Keep this tab open — you need two values:

- **Publishable Key** — starts with `pk_live_...` (or `pk_test_...` while testing).
- **Frontend API URL** — looks like `https://your-app.clerk.accounts.dev` (Clerk also
  calls this the "Issuer"/"Frontend API"). You'll find it on the **API Keys** page; if you
  only see the publishable key, click **Show API URLs**.

> Save both somewhere; you'll paste them in steps 3 and 5.

---

## 2. Create the `convex` JWT template

This is what lets Convex trust Clerk-issued tokens.

1. In the Clerk dashboard, go to **Configure → JWT Templates**.
2. Click **New template** and choose the **Convex** template (Clerk has a built-in one).
3. **Do not rename it** — the name must stay exactly `convex`.
4. Click **Save**.
5. Copy the **Issuer** URL shown on the template page (e.g.
   `https://your-app.clerk.accounts.dev`). This is your `CLERK_JWT_ISSUER_DOMAIN`.

---

## 3. Set Convex environment variables

Open your Convex dashboard at <https://dashboard.convex.dev> → your project →
**Settings → Environment Variables**. Do this for **both** the dev (`exciting-gazelle-615`)
and prod (`kindhearted-swordfish-668`) deployments.

Add:

| Variable | Value |
|---|---|
| `CLERK_JWT_ISSUER_DOMAIN` | The Issuer URL from step 2 (e.g. `https://your-app.clerk.accounts.dev`) |
| `ADMIN_EMAILS` | `matthewferoz@gmail.com` (comma-separated if you add more later) |

You can **leave `ADMIN_SECRET` in place** for now — once the migration is verified we'll
remove the code that reads it, and you can delete the variable.

> Already-set vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`,
> PostHog keys) stay as-is.

---

## 4. (Tell me) your publishable key for the frontend

The frontend needs your Clerk **Publishable Key**. I'll wire it into a single
`auth-config.js` file (analogous to your existing `quizzes/config.js`, auto-switching
test vs live by hostname). **Paste the `pk_...` key(s) into the chat** and I'll drop them
in — they're not secrets (publishable keys are safe in client code), but I don't want to
invent a placeholder you'd forget to replace.

---

## 5. Stripe webhook (no change expected)

Your webhook already points at `https://<convex-prod>.convex.site/stripe-webhook` and that
endpoint stays. After the overhaul the webhook will **grant a course entitlement by email**
instead of emailing an access code — no Stripe dashboard change needed. Just confirm in
**Stripe → Developers → Webhooks** that the endpoint is still listening for
`checkout.session.completed`.

---

## 6. Deploy order (we'll do this together)

1. `bunx convex dev` locally → verify schema + functions compile against the dev deployment.
2. Run the one-time migration (`migrations:backfillEntitlements`) on **dev** first, test
   login + course access, then on **prod**.
3. `bunx convex deploy` to push functions to prod.
4. Push the frontend to `main` (GitHub Pages auto-deploys).

---

## Production launch (detailed steps)

> Dev is fully working; do this only when ready to go live on `matthewferoz.com`.
> Clerk shows the **exact** DNS records + redirect URI in its dashboard — use those values,
> don't guess. Parts A and B are you-only; Part C I can run via the CLI once B verifies.

### Part A — Your own Google OAuth credentials (Google Cloud Console)
Required because Clerk's shared dev Google creds aren't allowed in production.
1. <https://console.cloud.google.com> → create/select a project.
2. **APIs & Services → OAuth consent screen** → **External**; set app name, support email,
   scopes `email`/`profile`/`openid`; publish (or keep "testing" with a user allowlist).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID → Web application**.
4. **Authorized JavaScript origins**: `https://matthewferoz.com` and `https://www.matthewferoz.com`.
5. **Authorized redirect URIs**: paste the URI Clerk gives in Part B step 3
   (looks like `https://clerk.matthewferoz.com/v1/oauth_callback`).
6. Copy the **Client ID** and **Client secret**.

### Part B — Create the production instance in Clerk
1. Clerk Dashboard → instance dropdown (top-left, "Development") → **Create production
   instance** (clone dev settings).
2. Set production domain: `matthewferoz.com`.
3. **Configure → SSO Connections → Google** → **custom credentials** → paste Client ID +
   secret from Part A; copy the displayed **Authorized Redirect URI** back into Google (A.5).
4. **Domains** page → add the **exact DNS records Clerk lists** at your DNS provider
   (CNAMEs ~ `clerk.`, `accounts.`, plus `clkmail`/`clk._domainkey`/`clk2._domainkey` for
   email). Ensure no CAA record blocks LetsEncrypt / Google Trust Services.
5. Wait for DNS verify (mins–48h) → click **Deploy certificates**. Prod issuer becomes
   `https://clerk.matthewferoz.com`; you get a `pk_live_...` key.

### Part C — Wire prod into Convex + frontend (I can run these)
1. `clerk env pull --instance prod` → prod `pk_live_...` + issuer.
2. Recreate the `convex` JWT template on prod (`clerk api /jwt_templates --instance prod ...`).
3. `bunx convex env set` on the **prod** deployment (`kindhearted-swordfish-668`):
   `CLERK_JWT_ISSUER_DOMAIN=https://clerk.matthewferoz.com`, `ADMIN_EMAILS=matthewferoz@gmail.com`.
4. Frontend auto-switches to `pk_live_...` on the live hostname (same pattern as `config.js`).
5. Confirm Stripe webhook still targets the Convex prod `.site` URL (unchanged).

---

## What changes for your existing customers

- People who bought before keep access. On their first Google sign-in, we match their
  **email** to their old purchase and grant the entitlement automatically.
- New buyers: after Stripe checkout they just **sign in with Google** — no code to copy.
- Worth a heads-up email to existing customers that login changed (optional; I can draft it).

---

### Checklist

**Dev (done via CLI):**
- [x] Clerk app linked, Google enabled, password off
- [x] `convex` JWT template created
- [x] `CLERK_JWT_ISSUER_DOMAIN` + `ADMIN_EMAILS` set on dev
- [x] Dev keys pulled to `.env.local`; backend foundation deployed to dev

**Production (when ready — see "Production launch" above):**
- [ ] Google Cloud OAuth credentials created (Part A)
- [ ] Clerk production instance created + DNS verified + certificates deployed (Part B)
- [ ] Prod JWT template + prod Convex env vars + `pk_live_` wired (Part C)
- [ ] Stripe webhook confirmed against prod
