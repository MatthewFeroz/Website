import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  requireUser,
  requireAdmin,
  requireEntitlement,
  hasEntitlement,
  getCurrentUser,
} from "./identity";

// ---------- helpers ----------

async function lessonsForCourse(ctx: QueryCtx | MutationCtx, courseId: Id<"courses">) {
  const lessons = await ctx.db
    .query("lessons")
    .withIndex("by_courseId", (q) => q.eq("courseId", courseId))
    .collect();
  return lessons
    .filter((l) => l.isActive)
    .sort((a, b) => a.order - b.order);
}

// ---------- public catalog (no entitlement needed to browse) ----------

/**
 * Active courses for the catalog, with thumbnail URL, lesson count and total
 * duration. Browsable without sign-in; content is gated elsewhere.
 */
export const getActiveCourses = query({
  args: {},
  handler: async (ctx) => {
    const courses = await ctx.db
      .query("courses")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();
    courses.sort((a, b) => a.order - b.order);

    const user = await getCurrentUser(ctx);
    const access = user ? await hasEntitlement(ctx, user) : false;

    return await Promise.all(
      courses.map(async (c) => {
        const lessons = await lessonsForCourse(ctx, c._id);
        const totalSeconds = lessons.reduce((s, l) => s + (l.durationSeconds || 0), 0);
        return {
          _id: c._id,
          slug: c.slug,
          title: c.title,
          description: c.description,
          thumbnailUrl: c.thumbnailFileId
            ? await ctx.storage.getUrl(c.thumbnailFileId)
            : null,
          lessonCount: lessons.length,
          totalSeconds,
        };
      })
    ).then((list) => ({ courses: list, hasAccess: access, signedIn: !!user }));
  },
});

/**
 * A course with its lessons and the signed-in user's progress. Requires sign-in.
 * Lesson video URLs are NOT included here — fetch them per-lesson (entitlement-gated).
 */
export const getCourse = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const course = await ctx.db
      .query("courses")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!course || !course.isActive) return null;

    const access = await hasEntitlement(ctx, user);
    const lessons = await lessonsForCourse(ctx, course._id);

    const progressRows = await ctx.db
      .query("lessonProgress")
      .withIndex("by_userId_courseId", (q) =>
        q.eq("userId", user._id).eq("courseId", course._id)
      )
      .collect();
    const progressByLesson = new Map(
      progressRows.map((p) => [p.lessonId.toString(), p])
    );

    const lessonViews = lessons.map((l) => {
      const p = progressByLesson.get(l._id.toString());
      return {
        _id: l._id,
        title: l.title,
        description: l.description ?? "",
        durationSeconds: l.durationSeconds,
        order: l.order,
        completed: p?.completed ?? false,
        lastPositionSeconds: p?.lastPositionSeconds ?? 0,
      };
    });

    const completedCount = lessonViews.filter((l) => l.completed).length;

    return {
      _id: course._id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      hasAccess: access,
      lessons: lessonViews,
      completedCount,
      lessonCount: lessonViews.length,
      percentComplete:
        lessonViews.length > 0
          ? Math.round((completedCount / lessonViews.length) * 100)
          : 0,
    };
  },
});

/**
 * Signed, time-limited URLs for a lesson's video (and poster). Entitlement-gated.
 */
export const getLessonVideoUrl = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args) => {
    await requireEntitlement(ctx);
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson || !lesson.isActive) return null;
    return {
      videoUrl: await ctx.storage.getUrl(lesson.videoFileId),
      posterUrl: lesson.posterFileId
        ? await ctx.storage.getUrl(lesson.posterFileId)
        : null,
      title: lesson.title,
      durationSeconds: lesson.durationSeconds,
    };
  },
});

// ---------- progress (signed-in) ----------

async function upsertProgress(
  ctx: MutationCtx,
  lessonId: Id<"lessons">,
  patch: { completed?: boolean; lastPositionSeconds?: number }
) {
  const user = await requireUser(ctx);
  const lesson = await ctx.db.get(lessonId);
  if (!lesson) throw new Error("Lesson not found");

  const existing = await ctx.db
    .query("lessonProgress")
    .withIndex("by_userId_lessonId", (q) =>
      q.eq("userId", user._id).eq("lessonId", lessonId)
    )
    .first();

  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, {
      ...patch,
      ...(patch.completed ? { completedAt: now } : {}),
      updatedAt: now,
    });
    return existing._id;
  }
  return await ctx.db.insert("lessonProgress", {
    userId: user._id,
    courseId: lesson.courseId,
    lessonId,
    completed: patch.completed ?? false,
    lastPositionSeconds: patch.lastPositionSeconds ?? 0,
    completedAt: patch.completed ? now : undefined,
    updatedAt: now,
  });
}

export const markLessonComplete = mutation({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args) => {
    await upsertProgress(ctx, args.lessonId, { completed: true });
    return { success: true };
  },
});

export const setLessonPosition = mutation({
  args: { lessonId: v.id("lessons"), positionSeconds: v.number() },
  handler: async (ctx, args) => {
    await upsertProgress(ctx, args.lessonId, {
      lastPositionSeconds: Math.max(0, Math.floor(args.positionSeconds)),
    });
    return { success: true };
  },
});

// ---------- admin (requireAdmin) ----------

/** Upload URL for video/poster/thumbnail files (admin only). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const adminListCourses = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const courses = await ctx.db.query("courses").collect();
    courses.sort((a, b) => a.order - b.order);
    return await Promise.all(
      courses.map(async (c) => {
        const lessons = await ctx.db
          .query("lessons")
          .withIndex("by_courseId", (q) => q.eq("courseId", c._id))
          .collect();
        return {
          _id: c._id,
          slug: c.slug,
          title: c.title,
          description: c.description,
          isActive: c.isActive,
          order: c.order,
          lessonCount: lessons.length,
        };
      })
    );
  },
});

export const adminCreateCourse = mutation({
  args: {
    title: v.string(),
    slug: v.string(),
    description: v.string(),
    order: v.optional(v.number()),
    thumbnailFileId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const slug = args.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new Error("Slug must be lowercase letters, numbers, and hyphens");
    }
    const existing = await ctx.db
      .query("courses")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) throw new Error("A course with that slug already exists");

    const now = Date.now();
    return await ctx.db.insert("courses", {
      title: args.title.trim(),
      slug,
      description: args.description.trim(),
      thumbnailFileId: args.thumbnailFileId,
      order: args.order ?? now,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const adminCreateLesson = mutation({
  args: {
    courseId: v.id("courses"),
    title: v.string(),
    description: v.optional(v.string()),
    videoFileId: v.id("_storage"),
    posterFileId: v.optional(v.id("_storage")),
    durationSeconds: v.number(),
    order: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const course = await ctx.db.get(args.courseId);
    if (!course) throw new Error("Course not found");

    // Default order: append after existing lessons.
    let order = args.order;
    if (order === undefined) {
      const existing = await ctx.db
        .query("lessons")
        .withIndex("by_courseId", (q) => q.eq("courseId", args.courseId))
        .collect();
      order = existing.length;
    }

    return await ctx.db.insert("lessons", {
      courseId: args.courseId,
      title: args.title.trim(),
      description: args.description?.trim(),
      videoFileId: args.videoFileId,
      posterFileId: args.posterFileId,
      durationSeconds: Math.max(0, Math.floor(args.durationSeconds)),
      order,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const adminSetCourseActive = mutation({
  args: { courseId: v.id("courses"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.courseId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});
