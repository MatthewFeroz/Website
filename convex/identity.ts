import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

export const COURSE_PRODUCT = "course-access";

/**
 * Parse the ADMIN_EMAILS env var (comma-separated) into a lowercased Set.
 * This is the source of truth for who is an admin.
 */
function adminEmailSet(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return adminEmailSet().has(email.toLowerCase());
}

/**
 * Get the Clerk identity for the current request, or null if unauthenticated.
 */
export async function getIdentity(ctx: QueryCtx | MutationCtx) {
  return await ctx.auth.getUserIdentity();
}

/**
 * Look up the user row for the current Clerk identity (by tokenIdentifier).
 * Returns null if unauthenticated or no row exists yet (i.e. syncUser hasn't run).
 */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .first();
}

/**
 * Require an authenticated, synced user. Throws otherwise.
 */
export async function requireUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Unauthenticated: please sign in");
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .first();
  if (!user) {
    throw new Error("No account found: call identity.syncUser after sign-in");
  }
  return user;
}

/**
 * Require an admin. Admin status is governed by the ADMIN_EMAILS env var
 * (authoritative); a cached role === "admin" is also accepted.
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role === "admin" || isAdminEmail(user.email)) {
    return user;
  }
  throw new Error("Unauthorized: admin access required");
}

/**
 * Whether the given user currently holds a non-revoked entitlement for a product.
 */
export async function hasEntitlement(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  product: string = COURSE_PRODUCT
): Promise<boolean> {
  // Admins always have access.
  if (user.role === "admin" || isAdminEmail(user.email)) return true;

  const byEmail = await ctx.db
    .query("entitlements")
    .withIndex("by_email_product", (q) =>
      q.eq("email", user.email.toLowerCase()).eq("product", product)
    )
    .collect();
  return byEmail.some((e) => !e.revokedAt);
}

/**
 * Require an authenticated user who holds the entitlement for a product.
 */
export async function requireEntitlement(
  ctx: QueryCtx | MutationCtx,
  product: string = COURSE_PRODUCT
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!(await hasEntitlement(ctx, user, product))) {
    throw new Error("No active entitlement: this content requires a purchase");
  }
  return user;
}

/**
 * Called by the frontend right after Clerk sign-in. Idempotently:
 *  1. Finds/creates the user row keyed by Clerk tokenIdentifier.
 *  2. Links a legacy access-code user (matched by email) to this identity, so
 *     existing customers keep their history.
 *  3. Sets role from the ADMIN_EMAILS allowlist.
 *  4. Links any entitlements matching this email to the user's _id.
 *
 * This is the migration bridge for pre-existing customers.
 */
export const syncUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated: please sign in");
    }

    const email = (identity.email ?? "").toLowerCase();
    const now = Date.now();
    const role: "user" | "admin" = isAdminEmail(email) ? "admin" : "user";

    // 1. Already linked by token?
    let user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .first();

    // 2. Legacy row by email (created via access code) — adopt it.
    if (!user && email) {
      const legacy = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first();
      if (legacy) user = legacy;
    }

    if (user) {
      await ctx.db.patch(user._id, {
        tokenIdentifier: identity.tokenIdentifier,
        email: email || user.email,
        role,
        lastLoginAt: now,
      });
    } else {
      const userId = await ctx.db.insert("users", {
        email,
        tokenIdentifier: identity.tokenIdentifier,
        role,
        createdAt: now,
        lastLoginAt: now,
      });
      user = await ctx.db.get(userId);
    }

    if (!user) throw new Error("Failed to create user");

    // 4. Link entitlements held under this email to the user's _id.
    if (email) {
      const unlinked = await ctx.db
        .query("entitlements")
        .withIndex("by_email", (q) => q.eq("email", email))
        .collect();
      for (const ent of unlinked) {
        if (ent.userId !== user._id) {
          await ctx.db.patch(ent._id, { userId: user._id });
        }
      }
    }

    const hasAccess = await hasEntitlement(ctx, user, COURSE_PRODUCT);
    return {
      userId: user._id,
      email: user.email,
      role: user.role ?? "user",
      hasCourseAccess: hasAccess,
    };
  },
});

/**
 * Lightweight "who am I" for the frontend to gate UI.
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    const hasAccess = await hasEntitlement(ctx, user, COURSE_PRODUCT);
    return {
      userId: user._id,
      email: user.email,
      role: user.role ?? "user",
      isAdmin: user.role === "admin" || isAdminEmail(user.email),
      hasCourseAccess: hasAccess,
    };
  },
});
