import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();
const YOUTUBE_VIDEOS_URL = "https://www.youtube.com/@MattFeroz/videos";
const JSON_CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
};
const NEWSLETTER_CONFIRMATION_SUCCESS_URL = "https://matthewferoz.com/newsletter/?confirmed=1";
const NEWSLETTER_CONFIRMATION_ERROR_URL = "https://matthewferoz.com/newsletter/?confirmed=0";

// Newsletter signup endpoint
http.route({
  path: "/newsletter/subscribe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const email = normalizeEmail(body.email);
      const firstName = normalizeText(body.firstName, 80);
      const role = normalizeText(body.role, 80);
      const source = normalizeText(body.source, 80) || "events-page";
      const page = normalizeText(body.page, 200);
      const referrer = normalizeText(body.referrer, 500);
      const userAgent = normalizeText(request.headers.get("user-agent") || body.userAgent, 500);

      if (!email) {
        return jsonResponse({ ok: false, error: "Please enter a valid email address." }, 400);
      }

      const api = internal as any;
      const token = crypto.randomUUID();
      const saved = await ctx.runMutation(api.newsletter.savePendingSubscriber, {
        email,
        firstName,
        role,
        source,
        page,
        referrer,
        userAgent,
        confirmationToken: token,
      });

      if (!saved.alreadyConfirmed) {
        await ctx.runAction(api.newsletter.sendConfirmationEmail, {
          email,
          firstName,
          token,
          confirmationBaseUrl: new URL(request.url).origin,
        });
      }

      return jsonResponse({
        ok: true,
        message: saved.alreadyConfirmed
          ? "You're already confirmed. Watch your inbox for the next issue."
          : "Check your inbox to confirm your subscription.",
      });
    } catch (error) {
      console.error("Newsletter signup error:", error);
      return jsonResponse({ ok: false, error: "Something went wrong. Please try again in a minute." }, 500);
    }
  }),
});

http.route({
  path: "/newsletter/confirm",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const token = new URL(request.url).searchParams.get("token") || "";

    if (!token) {
      return Response.redirect(NEWSLETTER_CONFIRMATION_ERROR_URL, 302);
    }

    try {
      const api = internal as any;
      const confirmation = await ctx.runMutation(api.newsletter.confirmSubscriberByToken, { token });

      if (!confirmation.ok) {
        return Response.redirect(
          `${NEWSLETTER_CONFIRMATION_ERROR_URL}&reason=${confirmation.reason}`,
          302
        );
      }

      const subscriber = confirmation.subscriber;

      try {
        const resendResult = await ctx.runAction(api.newsletter.subscribeToResend, {
          email: subscriber.email,
          firstName: subscriber.firstName,
          role: subscriber.role,
          source: subscriber.source,
          page: subscriber.page,
        });

        await ctx.runMutation(api.newsletter.updateConfirmedSubscriberResend, {
          email: subscriber.email,
          resendContactId: resendResult.contactId,
          resendSegmentId: resendResult.segmentId,
          resendTopicId: resendResult.topicId,
        });
      } catch (error) {
        console.error("Newsletter Resend subscribe error:", error);
      }

      try {
        const welcomeResult = await ctx.runAction(api.newsletter.sendLatestWelcomeEmail, {
          email: subscriber.email,
          firstName: subscriber.firstName,
        });

        await ctx.runMutation(api.newsletter.markLatestWelcomeSent, {
          email: subscriber.email,
          broadcastId: welcomeResult.broadcastId,
        });
      } catch (error) {
        console.error("Newsletter welcome email error:", error);
      }

      return Response.redirect(NEWSLETTER_CONFIRMATION_SUCCESS_URL, 302);
    } catch (error) {
      console.error("Newsletter confirmation error:", error);
      return Response.redirect(NEWSLETTER_CONFIRMATION_ERROR_URL, 302);
    }
  }),
});

// CORS preflight for newsletter signup
http.route({
  path: "/newsletter/subscribe",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

// Stripe webhook endpoint
http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    const body = await request.text();

    try {
      // Process the webhook in an internal action
      const result = await ctx.runAction(internal.stripe.handleWebhook, {
        payload: body,
        signature,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Webhook processing error:", error);
      return new Response(
        JSON.stringify({ error: "Webhook processing failed" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// Get purchase by session ID (for success page)
http.route({
  path: "/get-purchase",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "Missing session_id parameter" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    try {
      const purchase = await ctx.runQuery(internal.stripe.getPurchaseBySessionId, {
        sessionId,
      });

      if (!purchase) {
        return new Response(
          JSON.stringify({ error: "Purchase not found", pending: true }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      return new Response(
        JSON.stringify({
          email: purchase.email,
          accessCode: purchase.accessCode,
          createdAt: purchase.createdAt,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (error) {
      console.error("Error fetching purchase:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch purchase" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  }),
});

// CORS preflight for get-purchase
http.route({
  path: "/get-purchase",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

// Blog RSS feed proxy with DB caching
http.route({
  path: "/blog/feed",
  method: "GET",
  handler: httpAction(async (ctx) => {
    try {
      // Check DB cache first — returns instantly if fresh
      const cachedPosts = await ctx.runQuery(internal.blog.getCachedFeed);
      if (cachedPosts) {
        return new Response(JSON.stringify({ posts: cachedPosts }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=300",
          },
        });
      }

      // Cache miss — fetch from Substack
      const response = await fetch("https://matthewferoz.substack.com/feed");
      if (!response.ok) {
        return new Response(
          JSON.stringify({ posts: [], error: "Failed to fetch RSS feed" }),
          {
            status: 502,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=60",
            },
          }
        );
      }

      const xml = await response.text();
      const posts = parseRSS(xml);

      // Save to DB cache for next request
      await ctx.runMutation(internal.blog.updateFeedCache, { posts });

      return new Response(JSON.stringify({ posts }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300",
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ posts: [], error: "Internal server error" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  }),
});

// CORS preflight for blog feed
http.route({
  path: "/blog/feed",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

// YouTube uploads feed proxy
http.route({
  path: "/youtube/videos",
  method: "GET",
  handler: httpAction(async () => {
    try {
      const response = await fetch(YOUTUBE_VIDEOS_URL, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!response.ok) {
        return new Response(
          JSON.stringify({ videos: [], error: "Failed to fetch YouTube feed" }),
          {
            status: 502,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=60",
            },
          }
        );
      }

      const xml = await response.text();
      const videos = parseYouTubeFeed(xml).slice(0, 8);

      return new Response(JSON.stringify({ videos }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=900",
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({ videos: [], error: "Internal server error" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  }),
});

// CORS preflight for YouTube videos
http.route({
  path: "/youtube/videos",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_CORS_HEADERS,
  });
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizeText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return normalized || undefined;
}

function parseRSS(xml: string) {
  const posts: Array<{
    title: string;
    link: string;
    pubDate: string;
    description: string;
    thumbnail: string;
    author: string;
  }> = [];

  // Extract all <item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch;

  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const item = itemMatch[1];

    const title = extractCDATA(item, "title") || extractTag(item, "title") || "";
    const link = extractTag(item, "link") || "";
    const pubDate = extractTag(item, "pubDate") || "";
    const description =
      extractCDATA(item, "description") || extractTag(item, "description") || "";
    const author =
      extractCDATA(item, "dc:creator") || extractTag(item, "dc:creator") || "";

    // Try to get thumbnail from enclosure
    let thumbnail = "";
    const enclosureMatch = item.match(
      /<enclosure[^>]+url="([^"]+)"[^>]*type="image[^"]*"/
    );
    if (enclosureMatch) {
      thumbnail = enclosureMatch[1];
    }

    // Fallback: extract first <img> from content:encoded
    if (!thumbnail) {
      const contentEncoded =
        extractCDATA(item, "content:encoded") || "";
      const imgMatch = contentEncoded.match(/<img[^>]+src="([^"]+)"/);
      if (imgMatch) {
        thumbnail = imgMatch[1];
      }
    }

    // Clean HTML tags from description
    const cleanDescription = description
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    posts.push({
      title,
      link,
      pubDate,
      description: cleanDescription,
      thumbnail,
      author,
    });
  }

  return posts;
}

function parseYouTubeFeed(html: string) {
  const videos: Array<{
    title: string;
    link: string;
    videoId: string;
    published: string;
    views: string;
    thumbnail: string;
  }> = [];

  const seen = new Set<string>();
  const rendererRegex = /"videoRenderer":\{([\s\S]*?)"showActionMenu"/g;
  let rendererMatch;

  while ((rendererMatch = rendererRegex.exec(html)) !== null) {
    const block = rendererMatch[1];
    const videoId = extractJsonString(block, "videoId");
    if (!videoId || seen.has(videoId)) continue;

    const title =
      extractJsonString(block, "text") ||
      extractJsonString(block, "simpleText") ||
      "Watch on YouTube";
    const published = extractPublishedTime(block);
    const views = extractViewCount(block);
    const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const link = `https://www.youtube.com/watch?v=${videoId}`;

    seen.add(videoId);
    videos.push({
      title: decodeJsonString(title),
      link,
      videoId,
      published: decodeJsonString(published),
      views: decodeJsonString(views),
      thumbnail,
    });

    if (videos.length >= 12) {
      break;
    }
  }

  return videos;
}

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function extractCDATA(xml: string, tag: string): string {
  const regex = new RegExp(
    `<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`
  );
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function extractAttribute(xml: string, tag: string, attribute: string): string {
  const regex = new RegExp(`<${tag}[^>]*\\s${attribute}="([^"]+)"[^>]*>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractJsonString(jsonFragment: string, key: string): string {
  const regex = new RegExp(`"${key}":"((?:\\\\.|[^"\\\\])*)"`);
  const match = jsonFragment.match(regex);
  return match ? match[1] : "";
}

function extractPublishedTime(jsonFragment: string): string {
  const match = jsonFragment.match(/"publishedTimeText":\{"simpleText":"((?:\\.|[^"\\])*)"/);
  return match ? match[1] : "";
}

function extractViewCount(jsonFragment: string): string {
  const match = jsonFragment.match(/"viewCountText":\{"simpleText":"((?:\\.|[^"\\])*)"/);
  return match ? match[1] : "";
}

function decodeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
  } catch {
    return value
      .replace(/\\u0026/g, "&")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
}

export default http;
