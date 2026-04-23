import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Resend } from "resend";

/* ------------------------------------------------------------------ */
/*  Shared arg shape                                                  */
/* ------------------------------------------------------------------ */

const roadmapLeadArgs = {
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
  aiLevel: v.optional(v.string()),
  primaryGoal: v.optional(v.string()),
  weeklyHours: v.optional(v.string()),
  stage: v.optional(v.string()),
  source: v.optional(v.string()),
  referrer: v.optional(v.string()),
  userAgent: v.optional(v.string()),
};

/* ------------------------------------------------------------------ */
/*  Public action — called from the browser.                          */
/*  1) Persists the lead row.                                         */
/*  2) Fires the personalized roadmap email via Resend.               */
/*  Email failures are logged but do NOT fail the request — the       */
/*  user still sees the thank-you page and the lead is already saved. */
/* ------------------------------------------------------------------ */

export const submitRoadmapLead = action({
  args: roadmapLeadArgs,
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return { success: false, error: "Invalid email address" };
    }

    const id: string = await ctx.runMutation(
      internal.leads.insertRoadmapLead,
      { ...args, email }
    );

    try {
      await ctx.runAction(internal.leads.sendRoadmapEmail, {
        email,
        firstName: args.firstName.trim(),
        stage: args.stage ?? "Stage 1: Monetize",
        aiLevel: args.aiLevel ?? "curious",
        primaryGoal: args.primaryGoal ?? "automate",
        weeklyHours: args.weeklyHours ?? "balanced",
      });
    } catch (err) {
      // Lead is already saved — don't fail the submission just because
      // the email bounced. Matt can follow up manually from the dashboard.
      console.error("[roadmap] email send failed (lead still saved):", err);
    }

    return { success: true, id };
  },
});

/* ------------------------------------------------------------------ */
/*  Internal mutation — writes the lead row.                          */
/*  Not callable from the browser directly; only reachable via the    */
/*  submitRoadmapLead action above.                                   */
/* ------------------------------------------------------------------ */

export const insertRoadmapLead = internalMutation({
  args: roadmapLeadArgs,
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("roadmapLeads", {
      ...args,
      email: args.email.trim().toLowerCase(),
      firstName: args.firstName.trim(),
      lastName: args.lastName?.trim() || undefined,
      createdAt: Date.now(),
    });
    return id;
  },
});

/* ------------------------------------------------------------------ */
/*  Internal action — sends the roadmap email via Resend.             */
/* ------------------------------------------------------------------ */

type AiLevelKey = "curious" | "dabbler" | "builder" | "shipper";
type GoalKey = "automate" | "product" | "career" | "agency";
type HoursKey = "light" | "balanced" | "heavy" | "obsessed";

const STAGE_BY_LEVEL: Record<
  AiLevelKey,
  { idx: number; label: string; headline: string; whatItMeans: string }
> = {
  curious: {
    idx: 0,
    label: "Stage 1: Monetize",
    headline: "You're at Stage 1 — Monetize.",
    whatItMeans:
      "You've seen what AI can do. The next move is turning that awareness into your first real dollar (or reclaimed hour) of output.",
  },
  dabbler: {
    idx: 1,
    label: "Stage 2: Scale",
    headline: "You're at Stage 2 — Scale.",
    whatItMeans:
      "You already use AI in your day-to-day. Now the goal is to take what works for you personally and get it working across projects, teammates, or paying customers.",
  },
  builder: {
    idx: 2,
    label: "Stage 3: Systemize",
    headline: "You're at Stage 3 — Systemize.",
    whatItMeans:
      "You've shipped. The bottleneck isn't \"can I build it\" anymore — it's turning your prototypes into reliable, repeatable systems.",
  },
  shipper: {
    idx: 3,
    label: "Stage 4: Exit",
    headline: "You're at Stage 4 — Exit.",
    whatItMeans:
      "You're running AI in production. Now it's about leverage: hiring, teaching, or building an asset that runs without you.",
  },
};

const GOAL_COPY: Record<GoalKey, string> = {
  automate:
    "Reclaim 5–10 hours a week by automating the things you do every day — email triage, writing, research, and repetitive busywork.",
  product:
    "Ship a real AI product in the next 90 days — from spec to deployed app to first real users.",
  career:
    "Level up your role. Become the person on your team who actually understands how to use AI as leverage, not a toy.",
  agency:
    "Turn your AI skills into revenue. Build an offer, land your first clients, and scale a small AI agency.",
};

const HOURS_COPY: Record<HoursKey, string> = {
  light: "1–3 hours a week — slow and steady wins as long as it's every week.",
  balanced: "4–7 hours a week — the sweet spot. Enough to compound fast without burning out.",
  heavy: "8–12 hours a week — serious pace. Expect real progress inside 30 days.",
  obsessed: "13+ hours a week — full-send. You'll outpace 95% of people with this cadence.",
};

const RUNGS: Array<{ idx: number; label: string }> = [
  { idx: 0, label: "Monetize" },
  { idx: 1, label: "Scale" },
  { idx: 2, label: "Systemize" },
  { idx: 3, label: "Exit" },
];

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const sendRoadmapEmail = internalAction({
  args: {
    email: v.string(),
    firstName: v.string(),
    stage: v.string(),
    aiLevel: v.string(),
    primaryGoal: v.string(),
    weeklyHours: v.string(),
  },
  handler: async (_ctx, args) => {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("Missing RESEND_API_KEY environment variable");
      throw new Error("Email service not configured");
    }

    const resend = new Resend(resendApiKey);

    const level =
      (args.aiLevel as AiLevelKey) in STAGE_BY_LEVEL
        ? (args.aiLevel as AiLevelKey)
        : "curious";
    const goal =
      (args.primaryGoal as GoalKey) in GOAL_COPY
        ? (args.primaryGoal as GoalKey)
        : "automate";
    const hours =
      (args.weeklyHours as HoursKey) in HOURS_COPY
        ? (args.weeklyHours as HoursKey)
        : "balanced";

    const stage = STAGE_BY_LEVEL[level];
    const goalCopy = GOAL_COPY[goal];
    const hoursCopy = HOURS_COPY[hours];

    const rungsHtml = RUNGS.map((r) => {
      const isCurrent = r.idx === stage.idx;
      const isDone = r.idx < stage.idx;
      const bg = isCurrent ? "#f85f00" : "#252528";
      const border = isCurrent
        ? "2px solid #f85f00"
        : "1px solid rgba(255,255,255,.12)";
      const numColor = isCurrent ? "#ffffff" : "#94a3b8";
      const labelColor = isCurrent
        ? "#ffffff"
        : isDone
          ? "#64748b"
          : "#cbd5e1";
      return `
        <td width="25%" valign="top" style="padding: 4px;">
          <div style="background-color: ${bg}; border: ${border}; border-radius: 10px; padding: 14px 6px; text-align: center;">
            <div style="color: ${numColor}; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px;">0${r.idx + 1}</div>
            <div style="color: ${labelColor}; font-size: 14px; font-weight: 700;">${r.label}</div>
          </div>
        </td>
      `;
    }).join("");

    const firstName = esc(args.firstName || "friend");

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your AI Proficiency Roadmap</title>
</head>
<body style="margin: 0; padding: 0; background-color: #171719; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #171719; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1e1e21; border-radius: 12px; overflow: hidden; max-width: 600px;">

          <!-- Header -->
          <tr>
            <td style="background-color: #f85f00; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 2px;">MATT FEROZ</h1>
              <p style="color: #ffd8bf; margin: 8px 0 0; font-size: 13px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase;">Your AI Proficiency Roadmap</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 40px 30px 10px;">
              <h2 style="color: #ffffff; margin: 0 0 16px; font-size: 24px; font-weight: 800;">Hey ${firstName} 👋</h2>
              <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Thanks for filling out the roadmap. Based on what you told me, here's where you are and what I'd actually do next if I were you.
              </p>
            </td>
          </tr>

          <!-- Stage callout -->
          <tr>
            <td style="padding: 10px 30px;">
              <div style="background-color: #252528; border-left: 4px solid #f85f00; border-radius: 8px; padding: 22px 24px;">
                <div style="color: #94a3b8; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px;">Your stage</div>
                <div style="color: #ffffff; font-size: 22px; font-weight: 800; margin-bottom: 10px;">${esc(stage.headline)}</div>
                <div style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">${esc(stage.whatItMeans)}</div>
              </div>
            </td>
          </tr>

          <!-- 4-phase dial -->
          <tr>
            <td style="padding: 24px 26px 10px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>${rungsHtml}</tr>
              </table>
            </td>
          </tr>

          <!-- Your next 90 days -->
          <tr>
            <td style="padding: 20px 30px 10px;">
              <h3 style="color: #ffffff; margin: 0 0 14px; font-size: 18px; font-weight: 800;">Your next 90 days</h3>
              <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0 0 14px;">
                <b style="color: #ffffff;">Your goal:</b> ${esc(goalCopy)}
              </p>
              <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0 0 14px;">
                <b style="color: #ffffff;">Your cadence:</b> ${esc(hoursCopy)}
              </p>
              <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0;">
                The 4 phases above aren't just stages — they're a decision tree. At every level, your next move is the <i>smallest thing you can ship this week</i> that moves you toward the next rung. Not the biggest. The smallest.
              </p>
            </td>
          </tr>

          <!-- CTA: YouTube course -->
          <tr>
            <td style="padding: 30px 30px 10px;" align="center">
              <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0 0 18px; text-align: center;">
                I made a free video version of this course on YouTube — start there:
              </p>
              <a href="https://www.youtube.com/@MattFeroz" style="background-color: #f85f00; color: #ffffff; padding: 16px 36px; text-decoration: none; border-radius: 999px; font-weight: 800; font-size: 14px; display: inline-block; letter-spacing: 1px; text-transform: uppercase;">Watch the scaling roadmap →</a>
            </td>
          </tr>

          <!-- CTA: Book a call -->
          <tr>
            <td style="padding: 30px 30px 40px;">
              <div style="background-color: #252528; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 20px 22px;">
                <div style="color: #ffffff; font-size: 16px; font-weight: 800; margin-bottom: 8px;">Want me to look at your situation directly?</div>
                <div style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin-bottom: 14px;">
                  I do a limited number of free intro calls each week. If you'd like me to walk through your specific setup and give you a personalized 1-on-1 plan, grab a slot here:
                </div>
                <a href="https://form.typeform.com/to/T2ZPmUED" style="color: #f85f00; font-weight: 700; font-size: 14px; text-decoration: underline; text-underline-offset: 3px;">Book a free 1-on-1 call →</a>
              </div>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="padding: 0 30px 30px;">
              <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0;">Talk soon,</p>
              <p style="color: #ffffff; font-size: 16px; font-weight: 700; margin: 6px 0 0;">— Matt</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #151517; padding: 22px 30px; text-align: center;">
              <p style="color: #64748b; font-size: 13px; margin: 0 0 6px;">
                You're getting this because you requested your AI Proficiency Roadmap at
                <a href="https://matthewferoz.com/roadmap/" style="color: #f85f00; text-decoration: none;">matthewferoz.com/roadmap</a>.
              </p>
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                Questions? Just hit reply — it goes straight to me.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const text = [
      `Hey ${args.firstName || "friend"},`,
      ``,
      `Thanks for filling out the AI Proficiency Roadmap.`,
      ``,
      `${stage.headline}`,
      `${stage.whatItMeans}`,
      ``,
      `Your goal: ${goalCopy}`,
      `Your cadence: ${hoursCopy}`,
      ``,
      `The 4 phases (Monetize → Scale → Systemize → Exit) aren't just stages — they're a decision tree. At every level, your next move is the smallest thing you can ship this week that moves you toward the next rung.`,
      ``,
      `Watch the free video course: https://www.youtube.com/@MattFeroz`,
      `Book a free 1-on-1 call: https://form.typeform.com/to/T2ZPmUED`,
      ``,
      `Talk soon,`,
      `— Matt`,
    ].join("\n");

    const { data, error } = await resend.emails.send({
      from: "Matt Feroz <noreply@matthewferoz.com>",
      to: args.email,
      subject: `${args.firstName || "Your"}, here's your AI Proficiency Roadmap — ${stage.label}`,
      html,
      text,
      replyTo: "matthew@pioneeringminds.ai",
    });

    if (error) {
      console.error("Failed to send roadmap email:", error);
      throw new Error("Failed to send roadmap email");
    }

    console.log("Roadmap email sent successfully:", data?.id);
    return { success: true, emailId: data?.id };
  },
});

/* ------------------------------------------------------------------ */
/*  Admin queries (unchanged).                                        */
/* ------------------------------------------------------------------ */

export const listRoadmapLeads = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const leads = await ctx.db
      .query("roadmapLeads")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
    return leads;
  },
});

export const countRoadmapLeads = query({
  args: {},
  handler: async (ctx) => {
    const leads = await ctx.db.query("roadmapLeads").collect();
    return leads.length;
  },
});
