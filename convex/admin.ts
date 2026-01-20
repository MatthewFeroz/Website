import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 255;
}

function validateAdminSecret(adminSecret: string | undefined): boolean {
  const expectedSecret = process.env.ADMIN_SECRET;
  if (!expectedSecret) {
    // In development without ADMIN_SECRET set, block all admin access for safety
    return false;
  }
  return adminSecret === expectedSecret;
}

/**
 * Create an access code (admin use - after Stripe payment or manual creation)
 * Protected by admin secret
 */
export const createAccessCode = mutation({
  args: {
    email: v.string(),
    expiresInDays: v.optional(v.number()),
    stripePaymentId: v.optional(v.string()),
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (!validateAdminSecret(args.adminSecret)) {
      throw new Error("Unauthorized: Invalid admin credentials");
    }

    if (!validateEmail(args.email)) {
      throw new Error("Invalid email format");
    }

    if (args.expiresInDays !== undefined && (args.expiresInDays < 1 || args.expiresInDays > 365)) {
      throw new Error("expiresInDays must be between 1 and 365");
    }
    // Generate a unique code (format: XXXX-XXXX-XXXX)
    const generateCode = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars: I, O, 0, 1
      const segments = [];
      for (let s = 0; s < 3; s++) {
        let segment = "";
        for (let i = 0; i < 4; i++) {
          segment += chars[Math.floor(Math.random() * chars.length)];
        }
        segments.push(segment);
      }
      return segments.join("-");
    };

    const code = generateCode();
    const now = Date.now();
    const expiresAt = args.expiresInDays
      ? now + args.expiresInDays * 24 * 60 * 60 * 1000
      : undefined;

    await ctx.db.insert("accessCodes", {
      code,
      email: args.email,
      purchasedAt: now,
      expiresAt,
      isUsed: false,
      stripePaymentId: args.stripePaymentId,
    });

    return { code, email: args.email, expiresAt };
  },
});

/**
 * Create a quiz (admin use)
 * Protected by admin secret
 */
export const createQuiz = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard")),
    questions: v.array(
      v.object({
        id: v.string(),
        question: v.string(),
        options: v.array(v.string()),
        correctOptionIndex: v.number(),
        explanation: v.optional(v.string()),
      })
    ),
    passingScore: v.number(),
    estimatedMinutes: v.optional(v.number()),
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (!validateAdminSecret(args.adminSecret)) {
      throw new Error("Unauthorized: Invalid admin credentials");
    }

    if (!args.title.trim() || args.title.length > 200) {
      throw new Error("Title must be between 1 and 200 characters");
    }

    if (!args.category.trim() || args.category.length > 100) {
      throw new Error("Category must be between 1 and 100 characters");
    }

    const { adminSecret, ...quizData } = args;
    const quizId = await ctx.db.insert("quizzes", {
      ...quizData,
      isActive: true,
    });
    return quizId;
  },
});

/**
 * List all access codes (admin use)
 * Protected by admin secret
 */
export const listAccessCodes = query({
  args: {
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (!validateAdminSecret(args.adminSecret)) {
      throw new Error("Unauthorized: Invalid admin credentials");
    }
    return await ctx.db.query("accessCodes").collect();
  },
});

/**
 * List all quizzes including inactive ones (admin use)
 * Protected by admin secret
 */
export const listAllQuizzes = query({
  args: {
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (!validateAdminSecret(args.adminSecret)) {
      throw new Error("Unauthorized: Invalid admin credentials");
    }
    return await ctx.db.query("quizzes").collect();
  },
});

/**
 * Toggle quiz active status (admin use)
 * Protected by admin secret
 */
export const toggleQuizActive = mutation({
  args: {
    quizId: v.id("quizzes"),
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (!validateAdminSecret(args.adminSecret)) {
      throw new Error("Unauthorized: Invalid admin credentials");
    }
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) return { success: false };
    await ctx.db.patch(args.quizId, { isActive: !quiz.isActive });
    return { success: true, isActive: !quiz.isActive };
  },
});

/**
 * Get download analytics (admin use)
 * Protected by admin secret
 */
export const getDownloadStats = query({
  args: {
    adminSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (!validateAdminSecret(args.adminSecret)) {
      throw new Error("Unauthorized: Invalid admin credentials");
    }
    const downloads = await ctx.db.query("resourceDownloads").collect();
    const resources = await ctx.db.query("resources").collect();

    const stats = resources.map((resource) => {
      const resourceDownloads = downloads.filter(
        (d) => d.resourceId.toString() === resource._id.toString()
      );
      return {
        resourceId: resource._id,
        title: resource.title,
        downloadCount: resourceDownloads.length,
      };
    });

    return {
      totalDownloads: downloads.length,
      resourceStats: stats,
    };
  },
});
