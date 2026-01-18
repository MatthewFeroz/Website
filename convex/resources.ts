import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get all resources available to a user (based on passed quizzes)
 */
export const getAvailableResources = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get all quizzes the user has passed
    const passedAttempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("passed"), true))
      .collect();

    const passedQuizIds = [...new Set(passedAttempts.map((a) => a.quizId))];

    // Get all resources
    const allResources = await ctx.db.query("resources").collect();

    // Mark which resources are unlocked
    const resourcesWithAccess = await Promise.all(
      allResources.map(async (resource) => {
        const isUnlocked = passedQuizIds.some(
          (id) => id.toString() === resource.quizId.toString()
        );

        // Get quiz info for this resource
        const quiz = await ctx.db.get(resource.quizId);

        return {
          _id: resource._id,
          title: resource.title,
          description: resource.description,
          fileName: resource.fileName,
          fileSize: resource.fileSize,
          updatedAt: resource.updatedAt,
          quizTitle: quiz?.title ?? "Unknown Quiz",
          quizCategory: quiz?.category ?? "Unknown",
          isUnlocked,
        };
      })
    );

    return resourcesWithAccess;
  },
});

/**
 * Get download URL for a resource (only if user has unlocked it)
 */
export const getResourceDownloadUrl = query({
  args: {
    userId: v.id("users"),
    resourceId: v.id("resources"),
  },
  handler: async (ctx, args) => {
    const { userId, resourceId } = args;

    // Get the resource
    const resource = await ctx.db.get(resourceId);
    if (!resource) {
      return { success: false, error: "Resource not found" };
    }

    // Check if user has passed the required quiz
    const passedAttempt = await ctx.db
      .query("quizAttempts")
      .withIndex("by_userId_quizId", (q) =>
        q.eq("userId", userId).eq("quizId", resource.quizId)
      )
      .filter((q) => q.eq(q.field("passed"), true))
      .first();

    if (!passedAttempt) {
      return {
        success: false,
        error: "You must pass the associated quiz to download this resource",
      };
    }

    // Get the download URL from Convex storage
    const downloadUrl = await ctx.storage.getUrl(resource.fileId);
    if (!downloadUrl) {
      return { success: false, error: "File not found in storage" };
    }

    return {
      success: true,
      downloadUrl,
      fileName: resource.fileName,
    };
  },
});

/**
 * Record a resource download for analytics
 */
export const recordDownload = mutation({
  args: {
    userId: v.id("users"),
    resourceId: v.id("resources"),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("resourceDownloads", {
      userId: args.userId,
      resourceId: args.resourceId,
      downloadedAt: Date.now(),
    });
  },
});

/**
 * Generate upload URL for adding new resources (admin use)
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Create a new resource after file upload (admin use)
 */
export const createResource = mutation({
  args: {
    quizId: v.id("quizzes"),
    title: v.string(),
    description: v.string(),
    fileId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const resourceId = await ctx.db.insert("resources", {
      quizId: args.quizId,
      title: args.title,
      description: args.description,
      fileId: args.fileId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      createdAt: now,
      updatedAt: now,
    });
    return resourceId;
  },
});
