import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

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

export default http;
