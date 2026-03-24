import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/blog/feed",
  method: "GET",
  handler: httpAction(async () => {
    try {
      const response = await fetch("https://matthewferoz.substack.com/feed");
      if (!response.ok) {
        return new Response(
          JSON.stringify({ posts: [], error: "Failed to fetch RSS feed" }),
          {
            status: 502,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=300",
            },
          }
        );
      }

      const xml = await response.text();
      const posts = parseRSS(xml);

      return new Response(JSON.stringify({ posts }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600",
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

// Handle CORS preflight
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
