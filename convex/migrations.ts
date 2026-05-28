import { internalMutation } from "./_generated/server";
import { COURSE_PRODUCT } from "./identity";

/**
 * One-time (idempotent) backfill: convert every existing customer into a
 * `course-access` entitlement so the new Clerk-based auth grants them access
 * after they sign in. Sources, by email:
 *   - accessCodes  (every code ever issued = someone with access)
 *   - users        (anyone who redeemed a code, in case a code row is missing)
 *
 * Entitlements are keyed/looked-up by lowercased email; syncUser links them to a
 * Clerk account on first sign-in. Re-running this is safe — it skips emails that
 * already hold an active entitlement.
 *
 * Run:  bunx convex run migrations:backfillEntitlements           (dev)
 *       bunx convex run migrations:backfillEntitlements --prod    (prod)
 */
export const backfillEntitlements = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let created = 0;
    let skipped = 0;
    const handled = new Set<string>();

    const grant = async (rawEmail: string | undefined | null) => {
      const email = (rawEmail ?? "").trim().toLowerCase();
      if (!email) return;
      if (handled.has(email)) return;
      handled.add(email);

      const existing = await ctx.db
        .query("entitlements")
        .withIndex("by_email_product", (q) =>
          q.eq("email", email).eq("product", COURSE_PRODUCT)
        )
        .collect();
      if (existing.some((e) => !e.revokedAt)) {
        skipped++;
        return;
      }

      await ctx.db.insert("entitlements", {
        email,
        product: COURSE_PRODUCT,
        source: "legacy-code",
        grantedAt: now,
      });
      created++;
    };

    for (const code of await ctx.db.query("accessCodes").collect()) {
      await grant(code.email);
    }
    for (const user of await ctx.db.query("users").collect()) {
      await grant(user.email);
    }

    return { created, skipped, totalEmails: handled.size };
  },
});
