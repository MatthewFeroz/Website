import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get all active quizzes
 */
export const getActiveQuizzes = query({
  args: {},
  handler: async (ctx) => {
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    // Return quizzes without the correct answers (for security)
    return quizzes.map((quiz) => ({
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      category: quiz.category,
      difficulty: quiz.difficulty,
      questionCount: quiz.questions.length,
      passingScore: quiz.passingScore,
      estimatedMinutes: quiz.estimatedMinutes,
    }));
  },
});

/**
 * Get a specific quiz for taking (includes questions but not answers)
 */
export const getQuizForTaking = query({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) => {
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz || !quiz.isActive) {
      return null;
    }

    // Return questions without correct answers
    return {
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      category: quiz.category,
      difficulty: quiz.difficulty,
      passingScore: quiz.passingScore,
      estimatedMinutes: quiz.estimatedMinutes,
      questions: quiz.questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        // Don't include correctOptionIndex!
      })),
    };
  },
});

/**
 * Submit quiz answers and get results
 */
export const submitQuiz = mutation({
  args: {
    userId: v.id("users"),
    quizId: v.id("quizzes"),
    answers: v.array(
      v.object({
        questionId: v.string(),
        selectedOptionIndex: v.number(),
      })
    ),
    timeSpentSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, quizId, answers, timeSpentSeconds } = args;

    // Verify user exists
    const user = await ctx.db.get(userId);
    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Get the quiz with answers
    const quiz = await ctx.db.get(quizId);
    if (!quiz) {
      return { success: false, error: "Quiz not found" };
    }

    // Grade the quiz
    const gradedAnswers = answers.map((answer) => {
      const question = quiz.questions.find((q) => q.id === answer.questionId);
      const isCorrect = question
        ? question.correctOptionIndex === answer.selectedOptionIndex
        : false;
      return {
        questionId: answer.questionId,
        selectedOptionIndex: answer.selectedOptionIndex,
        isCorrect,
      };
    });

    const correctCount = gradedAnswers.filter((a) => a.isCorrect).length;
    const score = Math.round((correctCount / quiz.questions.length) * 100);
    const passed = score >= quiz.passingScore;

    // Save the attempt
    const attemptId = await ctx.db.insert("quizAttempts", {
      userId,
      quizId,
      score,
      answers: gradedAnswers,
      completedAt: Date.now(),
      passed,
      timeSpentSeconds,
    });

    // Return results with explanations
    return {
      success: true,
      attemptId,
      score,
      passed,
      correctCount,
      totalQuestions: quiz.questions.length,
      passingScore: quiz.passingScore,
      results: quiz.questions.map((q) => {
        const userAnswer = gradedAnswers.find((a) => a.questionId === q.id);
        return {
          questionId: q.id,
          question: q.question,
          options: q.options,
          correctOptionIndex: q.correctOptionIndex,
          selectedOptionIndex: userAnswer?.selectedOptionIndex ?? -1,
          isCorrect: userAnswer?.isCorrect ?? false,
          explanation: q.explanation,
        };
      }),
    };
  },
});

/**
 * Get user's quiz progress
 */
export const getUserProgress = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get all quizzes
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    // Get all user's attempts
    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    // Build progress for each quiz
    const progress = quizzes.map((quiz) => {
      const quizAttempts = attempts.filter(
        (a) => a.quizId.toString() === quiz._id.toString()
      );
      const bestAttempt = quizAttempts.reduce(
        (best, current) => (current.score > (best?.score ?? 0) ? current : best),
        null as (typeof quizAttempts)[0] | null
      );

      return {
        quizId: quiz._id,
        title: quiz.title,
        category: quiz.category,
        difficulty: quiz.difficulty,
        attemptCount: quizAttempts.length,
        bestScore: bestAttempt?.score ?? null,
        passed: quizAttempts.some((a) => a.passed),
        lastAttemptAt: quizAttempts.length > 0
          ? Math.max(...quizAttempts.map((a) => a.completedAt))
          : null,
      };
    });

    // Calculate category stats
    const categories = [...new Set(quizzes.map((q) => q.category))];
    const categoryProgress = categories.map((category) => {
      const categoryQuizzes = progress.filter((p) => p.category === category);
      const passedCount = categoryQuizzes.filter((p) => p.passed).length;
      return {
        category,
        total: categoryQuizzes.length,
        passed: passedCount,
        percentage: categoryQuizzes.length > 0
          ? Math.round((passedCount / categoryQuizzes.length) * 100)
          : 0,
      };
    });

    return {
      quizzes: progress,
      categories: categoryProgress,
      totalQuizzes: quizzes.length,
      completedQuizzes: progress.filter((p) => p.passed).length,
    };
  },
});
