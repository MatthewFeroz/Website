import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Create an access code (admin use - after Stripe payment or manual creation)
 */
export const createAccessCode = mutation({
  args: {
    email: v.string(),
    expiresInDays: v.optional(v.number()),
    stripePaymentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
  },
  handler: async (ctx, args) => {
    const quizId = await ctx.db.insert("quizzes", {
      ...args,
      isActive: true,
    });
    return quizId;
  },
});

/**
 * List all access codes (admin use)
 */
export const listAccessCodes = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("accessCodes").collect();
  },
});

/**
 * List all quizzes including inactive ones (admin use)
 */
export const listAllQuizzes = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("quizzes").collect();
  },
});

/**
 * Toggle quiz active status (admin use)
 */
export const toggleQuizActive = mutation({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz) return { success: false };
    await ctx.db.patch(args.quizId, { isActive: !quiz.isActive });
    return { success: true, isActive: !quiz.isActive };
  },
});

/**
 * Get download analytics (admin use)
 */
export const getDownloadStats = query({
  args: {},
  handler: async (ctx) => {
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
