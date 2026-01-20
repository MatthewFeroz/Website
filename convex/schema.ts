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
});
