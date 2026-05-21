import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_SEGMENT_ID = "44bab4be-c391-40b0-aa87-c35b7addf73a";
const DEFAULT_TOPIC_ID = "4acd0291-67fd-4817-ae17-aa079c750315";

type SubscribeToResendArgs = {
  email: string;
  firstName?: string;
  role?: string;
  source?: string;
  page?: string;
};

export const getSubscriberByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
  },
});

export const saveSubscriber = internalMutation({
  args: {
    email: v.string(),
    firstName: v.optional(v.string()),
    role: v.optional(v.string()),
    source: v.optional(v.string()),
    page: v.optional(v.string()),
    referrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    resendContactId: v.optional(v.string()),
    resendSegmentId: v.optional(v.string()),
    resendTopicId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const email = args.email.toLowerCase();
    const existing = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    const update = {
      firstName: args.firstName,
      role: args.role,
      source: args.source,
      page: args.page,
      referrer: args.referrer,
      userAgent: args.userAgent,
      resendContactId: args.resendContactId,
      resendSegmentId: args.resendSegmentId,
      resendTopicId: args.resendTopicId,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, update);
      return { id: existing._id, created: false };
    }

    const id = await ctx.db.insert("newsletterSubscribers", {
      email,
      ...update,
      createdAt: now,
    });
    return { id, created: true };
  },
});

export const subscribeToResend = internalAction({
  args: {
    email: v.string(),
    firstName: v.optional(v.string()),
    role: v.optional(v.string()),
    source: v.optional(v.string()),
    page: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{ contactId?: string; segmentId: string; topicId: string }> => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("Missing RESEND_API_KEY environment variable");
      throw new Error("Newsletter service is not configured");
    }

    const segmentId = process.env.RESEND_NYC_AI_EVENTS_SEGMENT_ID || DEFAULT_SEGMENT_ID;
    const topicId = process.env.RESEND_NYC_AI_EVENTS_TOPIC_ID || DEFAULT_TOPIC_ID;

    const payload = buildCreateContactPayload({ ...args, source: args.source || "events-page" }, segmentId, topicId);
    const created = await resendFetch(apiKey, "/contacts", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (created.ok) {
      return { contactId: created.body?.id, segmentId, topicId };
    }

    const duplicate = created.status === 409 || /already exists|already exist|duplicate/i.test(created.body?.message || created.body?.error?.message || "");
    if (!duplicate) {
      console.error("Resend contact create failed", created.status, created.body);
      throw new Error("Could not add contact to newsletter");
    }

    const updated = await resendFetch(apiKey, `/contacts/${encodeURIComponent(args.email)}`, {
      method: "PATCH",
      body: JSON.stringify({
        unsubscribed: false,
        properties: buildProperties(args),
      }),
    });

    if (!updated.ok) {
      console.warn("Resend contact update failed", updated.status, updated.body);
    }

    await resendFetch(apiKey, `/contacts/${encodeURIComponent(args.email)}/segments/${segmentId}`, {
      method: "POST",
    });

    await resendFetch(apiKey, `/contacts/${encodeURIComponent(args.email)}/topics`, {
      method: "PATCH",
      body: JSON.stringify({ topics: [{ id: topicId, subscription: "opt_in" }] }),
    });

    return { contactId: updated.body?.id, segmentId, topicId };
  },
});

function buildCreateContactPayload(args: SubscribeToResendArgs, segmentId: string, topicId: string) {
  return {
    email: args.email,
    unsubscribed: false,
    properties: buildProperties(args),
    segments: [{ id: segmentId }],
    topics: [{ id: topicId, subscription: "opt_in" }],
  };
}

function buildProperties(args: SubscribeToResendArgs) {
  const properties: Record<string, string> = {
    SOURCE: args.source || "events-page",
    INTEREST: "nyc-ai-events",
  };

  if (args.firstName) properties.FIRST_NAME = args.firstName;
  if (args.role) properties.ROLE = args.role;
  if (args.page) properties.SIGNUP_PAGE = args.page;

  return properties;
}

async function resendFetch(apiKey: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }

  return { ok: response.ok, status: response.status, body };
}
