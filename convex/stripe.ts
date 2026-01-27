import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";
import { Resend } from "resend";

// Generate access code (same pattern as admin.ts)
function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars: I, O, 0, 1
  const segments = [];
  for (let s = 0; s < 3; s++) {
    let segment = "";
    for (let i = 0; i < 4; i++) {
      segment += chars[Math.floor(Math.random() * chars.length)];
    }
    segments.push(segment);
  }
  return segments.join("-");
}

/**
 * Handle Stripe webhook events
 */
export const handleWebhook = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, args) => {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey || !webhookSecret) {
      throw new Error("Missing Stripe environment variables");
    }

    const stripe = new Stripe(stripeSecretKey);

    // Verify the webhook signature (must use async version in Convex)
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        args.payload,
        args.signature,
        webhookSecret
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      throw new Error("Invalid webhook signature");
    }

    // Handle the checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Extract customer email
      const email = session.customer_details?.email || session.customer_email;
      if (!email) {
        console.error("No email found in checkout session");
        throw new Error("Customer email not found");
      }

      // Generate access code
      const accessCode = generateAccessCode();

      // Create purchase record and access code
      await ctx.runMutation(internal.stripe.createPurchaseRecord, {
        email,
        accessCode,
        sessionId: session.id,
        paymentIntentId: typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id,
        amountTotal: session.amount_total || 0,
        currency: session.currency || "usd",
      });

      // Send confirmation email
      await ctx.runAction(internal.stripe.sendAccessCodeEmail, {
        email,
        accessCode,
      });

      return { success: true, email, accessCode };
    }

    return { success: true, message: "Event type not handled" };
  },
});

/**
 * Create purchase record and access code in database
 */
export const createPurchaseRecord = internalMutation({
  args: {
    email: v.string(),
    accessCode: v.string(),
    sessionId: v.string(),
    paymentIntentId: v.optional(v.string()),
    amountTotal: v.number(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check if purchase already exists (idempotency)
    const existingPurchase = await ctx.db
      .query("purchases")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (existingPurchase) {
      console.log("Purchase already exists for session:", args.sessionId);
      return existingPurchase._id;
    }

    // Create access code record
    await ctx.db.insert("accessCodes", {
      code: args.accessCode,
      email: args.email,
      purchasedAt: now,
      isUsed: false,
      stripePaymentId: args.paymentIntentId,
    });

    // Create purchase record
    const purchaseId = await ctx.db.insert("purchases", {
      email: args.email,
      accessCode: args.accessCode,
      sessionId: args.sessionId,
      paymentIntentId: args.paymentIntentId,
      amountTotal: args.amountTotal,
      currency: args.currency,
      createdAt: now,
    });

    console.log("Created purchase record:", purchaseId, "for email:", args.email);
    return purchaseId;
  },
});

/**
 * Get purchase by Stripe session ID (for success page)
 */
export const getPurchaseBySessionId = internalQuery({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("purchases")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

/**
 * Send access code email via Resend
 */
export const sendAccessCodeEmail = internalAction({
  args: {
    email: v.string(),
    accessCode: v.string(),
  },
  handler: async (ctx, args) => {
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.error("Missing RESEND_API_KEY environment variable");
      throw new Error("Email service not configured");
    }

    const resend = new Resend(resendApiKey);

    const { data, error } = await resend.emails.send({
      from: "Matt Feroz <noreply@matthewferoz.com>",
      to: args.email,
      subject: "Your Quiz Platform Access Code",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #171719; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #171719; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1e1e21; border-radius: 12px; overflow: hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #f85f00; padding: 30px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">MATT FEROZ</h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h2 style="color: #ffffff; margin: 0 0 20px; font-size: 24px;">Thank You for Your Purchase!</h2>
                      <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                        Your payment was successful. Here's your access code to unlock the Quiz Platform:
                      </p>

                      <!-- Access Code Box -->
                      <div style="background-color: #252528; border: 2px solid #f85f00; border-radius: 8px; padding: 25px; text-align: center; margin: 30px 0;">
                        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 1px;">Your Access Code</p>
                        <p style="color: #f85f00; font-size: 32px; font-weight: 700; margin: 0; letter-spacing: 3px; font-family: monospace;">${args.accessCode}</p>
                      </div>

                      <p style="color: #cbd5e1; font-size: 16px; line-height: 1.6; margin: 0 0 30px;">
                        To access the platform:
                      </p>
                      <ol style="color: #cbd5e1; font-size: 16px; line-height: 1.8; margin: 0 0 30px; padding-left: 20px;">
                        <li>Go to <a href="https://matthewferoz.com/quizzes/" style="color: #f85f00; text-decoration: none;">matthewferoz.com/quizzes</a></li>
                        <li>Enter the access code above</li>
                        <li>Start practicing!</li>
                      </ol>

                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center" style="padding: 20px 0;">
                            <a href="https://matthewferoz.com/quizzes/" style="background-color: #f85f00; color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">ACCESS THE PLATFORM</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #151517; padding: 25px 30px; text-align: center;">
                      <p style="color: #64748b; font-size: 14px; margin: 0;">
                        Need help? <a href="https://matthewferoz.com/contact/" style="color: #f85f00; text-decoration: none;">Contact Support</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("Failed to send email:", error);
      throw new Error("Failed to send access code email");
    }

    console.log("Access code email sent successfully:", data?.id);
    return { success: true, emailId: data?.id };
  },
});
