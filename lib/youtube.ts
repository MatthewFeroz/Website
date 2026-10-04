import { XMLParser, XMLValidator } from "fast-xml-parser";

// Verified from @MattFeroz's channel metadata, not a display-name search.
export const CHANNEL_ID = "UCXiSA-iF5o-je14bN-UVupA";
export const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
export const CACHE_TTL = 15 * 60 * 1000;
export const STALE_TTL = 7 * 24 * 60 * 60 * 1000;
export type Video = {
  title: string; videoId: string; link: string;
  published: string; views: string; thumbnail: string;
};
export type FeedCache = { videos: Video[]; fetchedAt: number };

export function parseYouTubeFeed(xml: string): Video[] {
  if (XMLValidator.validate(xml) !== true) throw new Error("Invalid YouTube XML");
  const feed = new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(xml).feed;
  if (feed?.author?.uri !== `https://www.youtube.com/channel/${CHANNEL_ID}`) {
    throw new Error("Unexpected YouTube channel");
  }
  const entries = Array.isArray(feed.entry) ? feed.entry : feed.entry ? [feed.entry] : [];
  const seen = new Set<string>();
  const videos: Video[] = [];
  for (const entry of entries) {
    const videoId = entry["yt:videoId"];
    if (entry["yt:channelId"] !== CHANNEL_ID || !/^[\w-]{11}$/.test(videoId || "") ||
        seen.has(videoId) || typeof entry.title !== "string" || !entry.title.trim() ||
        !Number.isFinite(Date.parse(entry.published))) continue;
    seen.add(videoId);
    const views = entry["media:group"]?.["media:community"]?.["media:statistics"]?.["@_views"];
    videos.push({
      videoId, title: entry.title,
      link: `https://www.youtube.com/watch?v=${videoId}`,
      published: entry.published,
      views: /^\d+$/.test(String(views ?? "")) ? `${Number(views).toLocaleString("en-US")} views` : "",
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });
  }
  if (!videos.length) throw new Error("No YouTube uploads found");
  return videos.sort((a, b) => Date.parse(b.published) - Date.parse(a.published)).slice(0, 8);
}

export async function getYouTubeFeed(options: {
  cached?: FeedCache | null; fetcher?: typeof fetch; now?: number;
} = {}) {
  const now = options.now ?? Date.now();
  const cached = options.cached;
  const age = cached ? now - cached.fetchedAt : Infinity;
  if (cached?.videos.length && age >= 0 && age < CACHE_TTL) return { ...cached, stale: false };
  try {
    const response = await (options.fetcher ?? fetch)(FEED_URL, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`YouTube returned ${response.status}`);
    return { videos: parseYouTubeFeed(await response.text()), fetchedAt: now, stale: false };
  } catch (error) {
    if (cached?.videos.length && age >= 0 && age < STALE_TTL) return { ...cached, stale: true };
    throw error;
  }
}

export function youtubeResponse(feed: FeedCache & { stale: boolean }) {
  // Return only the public fields, not Convex document metadata.
  return new Response(JSON.stringify({ videos: feed.videos, fetchedAt: feed.fetchedAt, stale: feed.stale }), {
    headers: {
      "Content-Type": "application/json", "Access-Control-Allow-Origin": "*",
      "Cache-Control": `public, max-age=${feed.stale ? 60 : 300}`,
    },
  });
}

export function youtubeErrorResponse() {
  return new Response(JSON.stringify({ videos: [], error: "YouTube is temporarily unavailable" }), {
    status: 502,
    headers: {
      "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store",
    },
  });
}
