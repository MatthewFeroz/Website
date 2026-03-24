import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export const getCachedFeed = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cached = await ctx.db.query("blogCache").order("desc").first();
    if (!cached) return null;
    if (Date.now() - cached.fetchedAt > CACHE_TTL) return null;
    return cached.posts;
  },
});

export const updateFeedCache = internalMutation({
  args: {
    posts: v.array(
      v.object({
        title: v.string(),
        link: v.string(),
        pubDate: v.string(),
        description: v.string(),
        thumbnail: v.string(),
        author: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Delete all existing cache rows (keep only latest)
    const existing = await ctx.db.query("blogCache").collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }
    // Insert fresh cache
    await ctx.db.insert("blogCache", {
      posts: args.posts,
      fetchedAt: Date.now(),
    });
  },
});
