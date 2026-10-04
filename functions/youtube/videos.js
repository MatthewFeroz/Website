import { getYouTubeFeed, youtubeResponse, youtubeErrorResponse, STALE_TTL } from "../../lib/youtube";

export async function onRequestGet({ request, waitUntil }) {
  // Keep the last successful fetch for outages, separately from the HTTP response cache.
  const cache = caches.default;
  const key = new Request(new URL("/youtube/feed-cache-v2", request.url));
  const stored = await cache.match(key);
  const cached = stored ? await stored.json() : null;
  try {
    const feed = await getYouTubeFeed({ cached });
    if (!feed.stale && feed.fetchedAt !== cached?.fetchedAt) {
      waitUntil(cache.put(key, new Response(JSON.stringify(feed), {
        headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${STALE_TTL / 1000}` },
      })));
    }
    return youtubeResponse(feed);
  } catch {
    return youtubeErrorResponse();
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400",
    },
  });
}
