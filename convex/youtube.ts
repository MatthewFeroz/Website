import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getCache = internalQuery({
  args: {},
  handler: async (ctx) => ctx.db.query("youtubeCache").first(),
});

export const saveCache = internalMutation({
  args: {
    fetchedAt: v.number(),
    version: v.number(),
    videos: v.array(v.object({
      title: v.string(), videoId: v.string(), link: v.string(),
      published: v.string(), views: v.string(), thumbnail: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const cached = await ctx.db.query("youtubeCache").first();
    if (cached) {
      if (args.fetchedAt > cached.fetchedAt) await ctx.db.replace(cached._id, args);
    } else await ctx.db.insert("youtubeCache", args);
  },
});
