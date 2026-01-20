import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Validate an access code and create a user session
 */
export const validateAccessCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const { code } = args;

    // Find the access code
    const accessCode = await ctx.db
      .query("accessCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();

    if (!accessCode) {
      return { success: false, error: "Invalid access code" };
    }

    if (accessCode.isUsed) {
      // Check if there's already a user with this code - allow re-login
      const existingUser = await ctx.db
        .query("users")
        .withIndex("by_accessCode", (q) => q.eq("accessCode", code))
        .first();

      if (existingUser) {
        // Update last login time
        await ctx.db.patch(existingUser._id, {
          lastLoginAt: Date.now(),
        });
        return {
          success: true,
          userId: existingUser._id,
          email: existingUser.email,
          isReturningUser: true,
        };
      }

      return { success: false, error: "This access code has already been used" };
    }

    // Check expiration if set
    if (accessCode.expiresAt && accessCode.expiresAt < Date.now()) {
      return { success: false, error: "This access code has expired" };
    }

    // Mark code as used
    await ctx.db.patch(accessCode._id, { isUsed: true });

    // Create new user
    const userId = await ctx.db.insert("users", {
      email: accessCode.email,
      accessCode: code,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
    });

    return {
      success: true,
      userId,
      email: accessCode.email,
      isReturningUser: false,
    };
  },
});

/**
 * Get user by ID (for session validation)
 */
export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Check if a user session is valid
 */
export const validateSession = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { valid: false };
    }
    return { valid: true, user };
  },
});
