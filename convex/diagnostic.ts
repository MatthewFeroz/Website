import { v } from "convex/values";
import { internalAction, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getPostHogClient } from "./posthog";

/**
 * Calculate skill level based on score percentage
 */
function calculateLevel(
  score: number
): "beginner" | "intermediate" | "advanced" {
  if (score <= 40) return "beginner";
  if (score <= 70) return "intermediate";
  return "advanced";
}

/**
 * Get recommendation priority based on skill level
 */
function getPriority(
  level: "beginner" | "intermediate" | "advanced"
): "high" | "medium" | "low" {
  if (level === "beginner") return "high";
  if (level === "intermediate") return "medium";
  return "low";
}

/**
 * Generate recommendation message based on category and level
 */
function getRecommendationMessage(
  categoryDisplayName: string,
  level: "beginner" | "intermediate" | "advanced"
): string {
  if (level === "beginner") {
    return `Focus on building a strong foundation in ${categoryDisplayName}. Start with the basics and practice consistently.`;
  }
  if (level === "intermediate") {
    return `Good progress in ${categoryDisplayName}! Continue practicing to solidify your understanding and tackle more challenging problems.`;
  }
  return `Excellent ${categoryDisplayName} skills! Keep challenging yourself with advanced problems to maintain and further develop your expertise.`;
}

/**
 * Get the active diagnostic quiz (public, no auth required)
 */
export const getActiveDiagnostic = query({
  args: {},
  handler: async (ctx) => {
    const diagnostics = await ctx.db
      .query("diagnosticQuizzes")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    if (diagnostics.length === 0) {
      return null;
    }

    const diagnostic = diagnostics[0];

    // Return diagnostic without correct answers
    return {
      _id: diagnostic._id,
      title: diagnostic.title,
      description: diagnostic.description,
      version: diagnostic.version,
      estimatedMinutes: diagnostic.estimatedMinutes,
      sections: diagnostic.sections.map((section) => ({
        category: section.category,
        categoryDisplayName: section.categoryDisplayName,
        questions: section.questions.map((q) => ({
          id: q.id,
          question: q.question,
          options: q.options,
          difficulty: q.difficulty,
          // Don't include correctOptionIndex!
        })),
      })),
      totalQuestions: diagnostic.sections.reduce(
        (sum, section) => sum + section.questions.length,
        0
      ),
    };
  },
});

/**
 * Submit diagnostic answers and get results (public, no auth required)
 */
export const submitDiagnostic = mutation({
  args: {
    diagnosticQuizId: v.id("diagnosticQuizzes"),
    guestId: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    answers: v.array(
      v.object({
        questionId: v.string(),
        category: v.string(),
        selectedOptionIndex: v.number(),
      })
    ),
    timeSpentSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { diagnosticQuizId, guestId, userId, answers, timeSpentSeconds } =
      args;

    // Must have either guestId or userId
    if (!guestId && !userId) {
      return { success: false, error: "Must provide guestId or userId" };
    }

    // Get the diagnostic quiz with answers
    const diagnostic = await ctx.db.get(diagnosticQuizId);
    if (!diagnostic || !diagnostic.isActive) {
      return { success: false, error: "Diagnostic quiz not found" };
    }

    // If userId provided, verify user exists
    if (userId) {
      const user = await ctx.db.get(userId);
      if (!user) {
        return { success: false, error: "User not found" };
      }
    }

    // Build a map of questions by ID for quick lookup
    const questionMap = new Map<
      string,
      {
        correctOptionIndex: number;
        category: string;
        categoryDisplayName: string;
      }
    >();
    diagnostic.sections.forEach((section) => {
      section.questions.forEach((q) => {
        questionMap.set(q.id, {
          correctOptionIndex: q.correctOptionIndex,
          category: section.category,
          categoryDisplayName: section.categoryDisplayName,
        });
      });
    });

    // Grade the answers
    const gradedAnswers = answers.map((answer) => {
      const questionInfo = questionMap.get(answer.questionId);
      const isCorrect = questionInfo
        ? questionInfo.correctOptionIndex === answer.selectedOptionIndex
        : false;
      return {
        questionId: answer.questionId,
        category: answer.category,
        selectedOptionIndex: answer.selectedOptionIndex,
        isCorrect,
      };
    });

    // Calculate per-category results
    const categoryResultsMap = new Map<
      string,
      {
        category: string;
        categoryDisplayName: string;
        correct: number;
        total: number;
      }
    >();

    diagnostic.sections.forEach((section) => {
      categoryResultsMap.set(section.category, {
        category: section.category,
        categoryDisplayName: section.categoryDisplayName,
        correct: 0,
        total: section.questions.length,
      });
    });

    gradedAnswers.forEach((answer) => {
      const categoryResult = categoryResultsMap.get(answer.category);
      if (categoryResult && answer.isCorrect) {
        categoryResult.correct++;
      }
    });

    const categoryResults = Array.from(categoryResultsMap.values()).map(
      (cat) => {
        const score =
          cat.total > 0 ? Math.round((cat.correct / cat.total) * 100) : 0;
        return {
          category: cat.category,
          score,
          level: calculateLevel(score),
          correctCount: cat.correct,
          totalQuestions: cat.total,
        };
      }
    );

    // Calculate overall score
    const totalCorrect = gradedAnswers.filter((a) => a.isCorrect).length;
    const totalQuestions = diagnostic.sections.reduce(
      (sum, section) => sum + section.questions.length,
      0
    );
    const overallScore =
      totalQuestions > 0
        ? Math.round((totalCorrect / totalQuestions) * 100)
        : 0;
    const overallLevel = calculateLevel(overallScore);

    // Generate recommendations
    const recommendations = categoryResults.map((cat) => {
      const section = diagnostic.sections.find(
        (s) => s.category === cat.category
      );
      return {
        category: cat.category,
        priority: getPriority(cat.level),
        message: getRecommendationMessage(
          section?.categoryDisplayName || cat.category,
          cat.level
        ),
      };
    });

    // Sort recommendations by priority (high first)
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Save the attempt
    const attemptId = await ctx.db.insert("diagnosticAttempts", {
      userId: userId || undefined,
      guestId: guestId || undefined,
      diagnosticQuizId,
      version: diagnostic.version,
      completedAt: Date.now(),
      timeSpentSeconds,
      overallScore,
      overallLevel,
      categoryResults,
      answers: gradedAnswers,
      recommendations,
    });

    // Schedule PostHog tracking (mutations can't make external HTTP calls)
    const distinctId = userId ? userId.toString() : (guestId as string);
    await ctx.scheduler.runAfter(0, internal.diagnostic.trackDiagnosticCompleted, {
      distinctId,
      overallScore,
      overallLevel,
      totalCorrect,
      totalQuestions,
      timeSpentSeconds: timeSpentSeconds ?? null,
      diagnosticVersion: diagnostic.version,
    });

    // Return results
    return {
      success: true,
      attemptId,
      overallScore,
      overallLevel,
      categoryResults,
      recommendations,
      totalCorrect,
      totalQuestions,
    };
  },
});

/**
 * Get diagnostic results by userId or guestId (public)
 */
export const getDiagnosticResults = query({
  args: {
    userId: v.optional(v.id("users")),
    guestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, guestId } = args;

    if (!userId && !guestId) {
      return null;
    }

    let attempt = null;

    // Try userId first, then guestId
    if (userId) {
      const attempts = await ctx.db
        .query("diagnosticAttempts")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect();
      // Get most recent attempt
      if (attempts.length > 0) {
        attempt = attempts.reduce((latest, current) =>
          current.completedAt > latest.completedAt ? current : latest
        );
      }
    }

    if (!attempt && guestId) {
      const attempts = await ctx.db
        .query("diagnosticAttempts")
        .withIndex("by_guestId", (q) => q.eq("guestId", guestId))
        .collect();
      if (attempts.length > 0) {
        attempt = attempts.reduce((latest, current) =>
          current.completedAt > latest.completedAt ? current : latest
        );
      }
    }

    if (!attempt) {
      return null;
    }

    return {
      _id: attempt._id,
      overallScore: attempt.overallScore,
      overallLevel: attempt.overallLevel,
      categoryResults: attempt.categoryResults,
      recommendations: attempt.recommendations,
      completedAt: attempt.completedAt,
      timeSpentSeconds: attempt.timeSpentSeconds,
    };
  },
});

export const trackDiagnosticCompleted = internalAction({
  args: {
    distinctId: v.string(),
    overallScore: v.number(),
    overallLevel: v.string(),
    totalCorrect: v.number(),
    totalQuestions: v.number(),
    timeSpentSeconds: v.union(v.number(), v.null()),
    diagnosticVersion: v.number(),
  },
  handler: async (_ctx, args) => {
    const posthog = getPostHogClient();
    try {
      posthog.capture({
        distinctId: args.distinctId,
        event: "diagnostic completed",
        properties: {
          overall_score: args.overallScore,
          overall_level: args.overallLevel,
          total_correct: args.totalCorrect,
          total_questions: args.totalQuestions,
          time_spent_seconds: args.timeSpentSeconds,
          diagnostic_version: args.diagnosticVersion,
        },
      });
    } finally {
      await posthog.shutdown();
    }
  },
});

/**
 * Migrate guest diagnostic attempt to authenticated user (requires auth)
 */
export const migrateGuestDiagnostic = mutation({
  args: {
    guestId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { guestId, userId } = args;

    // Verify user exists
    const user = await ctx.db.get(userId);
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Find guest attempts
    const guestAttempts = await ctx.db
      .query("diagnosticAttempts")
      .withIndex("by_guestId", (q) => q.eq("guestId", guestId))
      .collect();

    if (guestAttempts.length === 0) {
      return { success: false, error: "No guest diagnostic found" };
    }

    // Migrate each attempt
    let migratedCount = 0;
    for (const attempt of guestAttempts) {
      await ctx.db.patch(attempt._id, {
        userId,
        guestId: undefined,
      });
      migratedCount++;
    }

    return {
      success: true,
      migratedCount,
    };
  },
});
