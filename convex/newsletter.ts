import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_SEGMENT_ID = "44bab4be-c391-40b0-aa87-c35b7addf73a";
const DEFAULT_TOPIC_ID = "4acd0291-67fd-4817-ae17-aa079c750315";
const CONFIRMATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SITE_URL = "https://matthewferoz.com";
const NEWSLETTER_FROM = "Matt Feroz <noreply@howaiworks.io>";

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
      status: "confirmed" as const,
      confirmedAt: existing?.confirmedAt || now,
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

export const savePendingSubscriber = internalMutation({
  args: {
    email: v.string(),
    firstName: v.optional(v.string()),
    role: v.optional(v.string()),
    source: v.optional(v.string()),
    page: v.optional(v.string()),
    referrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    confirmationToken: v.string(),
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
      status: "pending" as const,
      confirmationToken: args.confirmationToken,
      confirmationTokenExpiresAt: now + CONFIRMATION_TTL_MS,
      updatedAt: now,
    };

    if (existing) {
      if (existing.status === "confirmed" && args.source !== "newsletter-test") {
        await ctx.db.patch(existing._id, {
          firstName: args.firstName,
          role: args.role,
          source: args.source,
          page: args.page,
          referrer: args.referrer,
          userAgent: args.userAgent,
          status: "confirmed",
          updatedAt: now,
        });
        return { id: existing._id, status: "confirmed" as const, alreadyConfirmed: true };
      }

      await ctx.db.patch(existing._id, update);
      return { id: existing._id, status: update.status, alreadyConfirmed: false };
    }

    const id = await ctx.db.insert("newsletterSubscribers", {
      email,
      ...update,
      createdAt: now,
    });

    return { id, status: update.status, alreadyConfirmed: false };
  },
});

export const confirmSubscriberByToken = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const subscriber = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_confirmationToken", (q) => q.eq("confirmationToken", args.token))
      .first();

    if (!subscriber) {
      return { ok: false as const, reason: "invalid" as const };
    }

    if (
      subscriber.confirmationTokenExpiresAt &&
      subscriber.confirmationTokenExpiresAt < Date.now()
    ) {
      return { ok: false as const, reason: "expired" as const };
    }

    const now = Date.now();
    await ctx.db.patch(subscriber._id, {
      status: "confirmed",
      confirmedAt: subscriber.confirmedAt || now,
      confirmationToken: undefined,
      confirmationTokenExpiresAt: undefined,
      updatedAt: now,
    });

    return {
      ok: true as const,
      subscriber: {
        id: subscriber._id,
        email: subscriber.email,
        firstName: subscriber.firstName,
        role: subscriber.role,
        source: subscriber.source,
        page: subscriber.page,
      },
    };
  },
});

export const updateConfirmedSubscriberResend = internalMutation({
  args: {
    email: v.string(),
    resendContactId: v.optional(v.string()),
    resendSegmentId: v.optional(v.string()),
    resendTopicId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const subscriber = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (!subscriber) return;

    await ctx.db.patch(subscriber._id, {
      resendContactId: args.resendContactId,
      resendSegmentId: args.resendSegmentId,
      resendTopicId: args.resendTopicId,
      updatedAt: Date.now(),
    });
  },
});

export const markLatestWelcomeSent = internalMutation({
  args: {
    email: v.string(),
    broadcastId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const subscriber = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (!subscriber) return;

    await ctx.db.patch(subscriber._id, {
      latestWelcomeSentAt: Date.now(),
      latestWelcomeBroadcastId: args.broadcastId,
      updatedAt: Date.now(),
    });
  },
});

export const sendConfirmationEmail = internalAction({
  args: {
    email: v.string(),
    firstName: v.optional(v.string()),
    token: v.string(),
    confirmationBaseUrl: v.string(),
  },
  handler: async (_ctx, args): Promise<{ emailId?: string }> => {
    const apiKey = getResendApiKey();
    const confirmUrl = `${args.confirmationBaseUrl}/newsletter/confirm?token=${encodeURIComponent(args.token)}`;
    const greeting = args.firstName ? `Hi ${escapeHtml(args.firstName)},` : "Hi,";

    const sent = await resendFetch(apiKey, "/emails", {
      method: "POST",
      body: JSON.stringify({
        from: NEWSLETTER_FROM,
        to: args.email,
        subject: "Confirm your newsletter subscription",
        html: buildEmailHtml({
          title: "Confirm your subscription",
          body: `
            <p>${greeting}</p>
            <p>Click below to confirm that you want to receive Matt Feroz's newsletter.</p>
            <p>After you confirm, I'll send you the latest How AI Works issue when one is available.</p>
          `,
          ctaUrl: confirmUrl,
          ctaLabel: "Confirm subscription",
          footer: "If you did not request this, you can ignore this email.",
        }),
        text: `${greeting}\n\nConfirm your subscription:\n${confirmUrl}\n\nIf you did not request this, you can ignore this email.`,
      }),
    });

    if (!sent.ok) {
      console.error("Confirmation email failed", sent.status, sent.body);
      throw new Error("Could not send confirmation email");
    }

    return { emailId: sent.body?.id };
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
    const apiKey = getResendApiKey();

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

export const sendLatestWelcomeEmail = internalAction({
  args: {
    email: v.string(),
    firstName: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<{ emailId?: string; broadcastId?: string }> => {
    const apiKey = getResendApiKey();
    const latestBroadcast = await getLatestHowAiWorksBroadcast(apiKey);
    const greeting = args.firstName ? `Hi ${escapeHtml(args.firstName)},` : "Hi,";

    if (latestBroadcast) {
      const sent = await resendFetch(apiKey, "/emails", {
        method: "POST",
        body: JSON.stringify({
          from: latestBroadcast.from || NEWSLETTER_FROM,
          to: args.email,
          subject: latestBroadcast.subject,
          html: latestBroadcast.html,
          text: latestBroadcast.text,
        }),
      });

      if (!sent.ok) {
        console.error("Latest How AI Works send failed", sent.status, sent.body);
        throw new Error("Could not send latest How AI Works issue");
      }

      return { emailId: sent.body?.id, broadcastId: latestBroadcast.id };
    }

    const body = `
      <p>${greeting}</p>
      <p>You're confirmed. I couldn't find a sent How AI Works issue to replay, so you'll get the next newsletter when it goes out.</p>
    `;

    const sent = await resendFetch(apiKey, "/emails", {
      method: "POST",
      body: JSON.stringify({
        from: NEWSLETTER_FROM,
        to: args.email,
        subject: "You're confirmed",
        html: buildEmailHtml({
          title: "You're confirmed",
          body,
          ctaUrl: `${SITE_URL}/newsletter/`,
          ctaLabel: "Visit the newsletter",
          footer: "You can unsubscribe from future emails using the link included in newsletter sends.",
        }),
        text: `${greeting}\n\nYou're confirmed. I couldn't find a sent How AI Works issue to replay, so you'll get the next newsletter when it goes out.`,
      }),
    });

    if (!sent.ok) {
      console.error("Welcome email failed", sent.status, sent.body);
      throw new Error("Could not send welcome email");
    }

    return { emailId: sent.body?.id };
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

function getResendApiKey() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Missing RESEND_API_KEY environment variable");
    throw new Error("Newsletter service is not configured");
  }
  return apiKey;
}

type ResendBroadcastSummary = {
  id: string;
  name?: string;
  subject?: string;
  status?: string;
  sent_at?: string | null;
  segment_id?: string | null;
  topic_id?: string | null;
};

type ResendBroadcast = ResendBroadcastSummary & {
  from?: string;
  html?: string;
  text?: string;
};

async function getLatestHowAiWorksBroadcast(apiKey: string): Promise<ResendBroadcast | undefined> {
  const listed = await resendFetch(apiKey, "/broadcasts");
  if (!listed.ok || !Array.isArray(listed.body?.data)) {
    console.warn("Could not list Resend broadcasts", listed.status, listed.body);
    return undefined;
  }

  const segmentId = process.env.RESEND_HOWAIWORKS_SEGMENT_ID;
  const topicId = process.env.RESEND_HOWAIWORKS_TOPIC_ID;
  const keyword = normalizeBroadcastText(process.env.RESEND_HOWAIWORKS_BROADCAST_KEYWORD || "HOWAIWORKS");

  const sentBroadcasts = (listed.body.data as ResendBroadcastSummary[])
    .filter((broadcast) => broadcast.status === "sent" && broadcast.sent_at)
    .filter((broadcast) => !segmentId || broadcast.segment_id === segmentId)
    .filter((broadcast) => !topicId || broadcast.topic_id === topicId)
    .filter((broadcast) => {
      if (segmentId || topicId) return true;
      return normalizeBroadcastText(`${broadcast.name || ""} ${broadcast.subject || ""}`).includes(keyword);
    })
    .sort((a, b) => Date.parse(b.sent_at || "") - Date.parse(a.sent_at || ""));

  const latest = sentBroadcasts[0];
  if (!latest) return undefined;

  const retrieved = await resendFetch(apiKey, `/broadcasts/${encodeURIComponent(latest.id)}`);
  if (!retrieved.ok) {
    console.warn("Could not retrieve latest Resend broadcast", retrieved.status, retrieved.body);
    return undefined;
  }

  const broadcast = retrieved.body as ResendBroadcast;
  if (!broadcast.subject || (!broadcast.html && !broadcast.text)) return undefined;

  return broadcast;
}

function normalizeBroadcastText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml(args: {
  title: string;
  body: string;
  ctaUrl: string;
  ctaLabel: string;
  footer: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#171719;font-family:Arial,Helvetica,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#171719;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#1f2024;border-radius:10px;overflow:hidden;">
              <tr>
                <td style="padding:28px 30px;background:#f85f00;">
                  <h1 style="margin:0;color:#ffffff;font-size:24px;line-height:1.2;">${escapeHtml(args.title)}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:32px 30px;color:#e5e7eb;font-size:16px;line-height:1.6;">
                  ${args.body}
                  <p style="margin:30px 0;">
                    <a href="${args.ctaUrl}" style="display:inline-block;background:#f85f00;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:8px;">${escapeHtml(args.ctaLabel)}</a>
                  </p>
                  <p style="color:#9ca3af;font-size:13px;line-height:1.5;margin:24px 0 0;">${escapeHtml(args.footer)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
