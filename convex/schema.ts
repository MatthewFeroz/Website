import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Access codes generated after purchase
  accessCodes: defineTable({
    code: v.string(),
    email: v.string(),
    purchasedAt: v.number(), // timestamp
    expiresAt: v.optional(v.number()), // optional expiration
    isUsed: v.boolean(),
    stripePaymentId: v.optional(v.string()),
  })
    .index("by_code", ["code"])
    .index("by_email", ["email"]),

  // Purchases from Stripe
  purchases: defineTable({
    email: v.string(),
    accessCode: v.string(),
    sessionId: v.string(),
    paymentIntentId: v.optional(v.string()),
    amountTotal: v.number(),
    currency: v.string(),
    createdAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_email", ["email"]),

  // Users who have redeemed an access code
  users: defineTable({
    email: v.string(),
    accessCode: v.string(),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
  })
    .index("by_email", ["email"])
    .index("by_accessCode", ["accessCode"]),

  // Quiz definitions
  quizzes: defineTable({
    title: v.string(),
    description: v.string(),
    category: v.string(), // e.g., "arrays", "strings", "python-basics"
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
    passingScore: v.number(), // percentage required to pass (e.g., 70)
    estimatedMinutes: v.optional(v.number()),
    isActive: v.boolean(),
  })
    .index("by_category", ["category"])
    .index("by_isActive", ["isActive"]),

  // Individual quiz attempts
  quizAttempts: defineTable({
    userId: v.id("users"),
    quizId: v.id("quizzes"),
    score: v.number(), // percentage score
    answers: v.array(
      v.object({
        questionId: v.string(),
        selectedOptionIndex: v.number(),
        isCorrect: v.boolean(),
      })
    ),
    completedAt: v.number(),
    passed: v.boolean(),
    timeSpentSeconds: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_quizId", ["quizId"])
    .index("by_userId_quizId", ["userId", "quizId"]),

  // Downloadable resources linked to quizzes
  resources: defineTable({
    quizId: v.id("quizzes"), // which quiz unlocks this resource
    title: v.string(),
    description: v.string(),
    fileId: v.id("_storage"), // Convex file storage ID
    fileName: v.string(),
    fileSize: v.string(), // e.g., "2.4 MB"
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_quizId", ["quizId"]),

  // Track resource downloads for analytics
  resourceDownloads: defineTable({
    userId: v.id("users"),
    resourceId: v.id("resources"),
    downloadedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_resourceId", ["resourceId"]),

  // Diagnostic quiz definitions (multi-category assessment)
  diagnosticQuizzes: defineTable({
    title: v.string(),
    description: v.string(),
    isActive: v.boolean(),
    version: v.number(),
    estimatedMinutes: v.number(),
    sections: v.array(
      v.object({
        category: v.string(),
        categoryDisplayName: v.string(),
        questions: v.array(
          v.object({
            id: v.string(),
            question: v.string(),
            options: v.array(v.string()),
            correctOptionIndex: v.number(),
            difficulty: v.union(
              v.literal("easy"),
              v.literal("medium"),
              v.literal("hard")
            ),
            explanation: v.optional(v.string()),
          })
        ),
      })
    ),
  }).index("by_isActive", ["isActive"]),

  // Leads captured from the AI Proficiency Roadmap lead magnet
  roadmapLeads: defineTable({
    firstName: v.string(),
    lastName: v.optional(v.string()),
    email: v.string(),
    phone: v.optional(v.string()),
    phoneCountryCode: v.optional(v.string()),
    shippingStreet: v.optional(v.string()),
    shippingCity: v.optional(v.string()),
    shippingState: v.optional(v.string()),
    shippingCountry: v.optional(v.string()),
    shippingZip: v.optional(v.string()),
    // AI journey
    aiLevel: v.optional(v.string()), // curious | dabbler | builder | shipper
    primaryGoal: v.optional(v.string()), // automate | product | career | agency
    weeklyHours: v.optional(v.string()), // light | balanced | heavy | obsessed
    stage: v.optional(v.string()), // e.g., "Stage 1: Monetize"
    // Attribution
    source: v.optional(v.string()), // e.g., "ai-proficiency-roadmap"
    referrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_createdAt", ["createdAt"]),

  // Cached blog feed from Substack RSS
  blogCache: defineTable({
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
    fetchedAt: v.number(),
  }),

  // Diagnostic attempts (supports both guests and authenticated users)
  diagnosticAttempts: defineTable({
    userId: v.optional(v.id("users")),
    guestId: v.optional(v.string()),
    diagnosticQuizId: v.id("diagnosticQuizzes"),
    version: v.number(),
    completedAt: v.number(),
    timeSpentSeconds: v.optional(v.number()),
    overallScore: v.number(),
    overallLevel: v.union(
      v.literal("beginner"),
      v.literal("intermediate"),
      v.literal("advanced")
    ),
    categoryResults: v.array(
      v.object({
        category: v.string(),
        score: v.number(),
        level: v.union(
          v.literal("beginner"),
          v.literal("intermediate"),
          v.literal("advanced")
        ),
        correctCount: v.number(),
        totalQuestions: v.number(),
      })
    ),
    answers: v.array(
      v.object({
        questionId: v.string(),
        category: v.string(),
        selectedOptionIndex: v.number(),
        isCorrect: v.boolean(),
      })
    ),
    recommendations: v.array(
      v.object({
        category: v.string(),
        priority: v.union(
          v.literal("high"),
          v.literal("medium"),
          v.literal("low")
        ),
        message: v.string(),
      })
    ),
  })
    .index("by_userId", ["userId"])
    .index("by_guestId", ["guestId"]),
});
