// Verified from @MattFeroz's channel metadata, not a display-name search.
export const CHANNEL_ID = "UCXiSA-iF5o-je14bN-UVupA";
export const FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
// The uploads feed doesn't mark livestreams, and watch pages hit YouTube's bot check
// from servers. The auto-generated "UULV" playlist mirrors the channel's Live tab:
// past, upcoming and live-now streams, in the same Atom format.
export const LIVE_FEED_URL = `https://www.youtube.com/feeds/videos.xml?playlist_id=UULV${CHANNEL_ID.slice(2)}`;
// Bump to discard cached lists built by older filtering rules.
export const CACHE_VERSION = 2;
export const CACHE_TTL = 15 * 60 * 1000;
export const STALE_TTL = 7 * 24 * 60 * 60 * 1000;
export type Video = {
  title: string; videoId: string; link: string;
  published: string; views: string; thumbnail: string;
};
export type FeedCache = { videos: Video[]; fetchedAt: number; version?: number };

// YouTube's public Atom feed has a fixed schema. Keep this reader self-contained
// because Pages compiles Functions without installing packages in this project.
function xmlText(xml: string, tag: string): string {
  const value = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`))?.[1] ?? "";
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>|&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (_, cdata: string | undefined, entity: string | undefined) => {
      if (cdata !== undefined) return cdata;
      if (!entity) return "";
      if (!entity.startsWith("#")) return entities[entity.toLowerCase()];
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      if (code < 1 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) throw new Error("Invalid XML character");
      return String.fromCodePoint(code);
    }).trim();
}

function feedEntries(xml: string): string[] {
  const feed = xml.replace(/<!--[\s\S]*?-->/g, "").trim().replace(/^<\?xml[^>]*\?>\s*/, "");
  if (!/^<feed(?:\s[^>]*)?>[\s\S]*<\/feed>$/.test(feed) || /<!DOCTYPE/i.test(feed)) {
    throw new Error("Invalid YouTube feed");
  }
  // Verify feed-level identity before reading any entries.
  const metadata = feed.split(/<entry(?:\s[^>]*)?>/)[0];
  const author = metadata.match(/<author(?:\s[^>]*)?>([\s\S]*?)<\/author>/)?.[1] ?? "";
  if (xmlText(author, "uri") !== `https://www.youtube.com/channel/${CHANNEL_ID}`) {
    throw new Error("Unexpected YouTube channel");
  }
  const entries = [...feed.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/g)];
  if (entries.length !== (feed.match(/<entry(?:\s[^>]*)?>/g) ?? []).length ||
      entries.length !== (feed.match(/<\/entry>/g) ?? []).length) throw new Error("Incomplete YouTube entries");
  return entries.map(([, entry]) => entry);
}

export function parseLiveStreamIds(xml: string): Set<string> {
  return new Set(feedEntries(xml).map(entry => xmlText(entry, "yt:videoId")));
}

export function parseYouTubeFeed(xml: string, exclude: ReadonlySet<string> = new Set()): Video[] {
  const seen = new Set<string>();
  const videos: Video[] = [];
  for (const entry of feedEntries(xml)) {
    const videoId = xmlText(entry, "yt:videoId");
    const title = xmlText(entry, "title");
    const published = xmlText(entry, "published");
    if (xmlText(entry, "yt:channelId") !== CHANNEL_ID || !/^[\w-]{11}$/.test(videoId) ||
        seen.has(videoId) || exclude.has(videoId) || !title || !Number.isFinite(Date.parse(published))) continue;
    seen.add(videoId);
    const views = entry.match(/<media:statistics\b[^>]*\bviews\s*=\s*["'](\d+)["']/)?.[1];
    videos.push({
      videoId, title,
      link: `https://www.youtube.com/watch?v=${videoId}`,
      published,
      views: views === undefined ? "" : `${Number(views).toLocaleString("en-US")} views`,
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
  const cached = options.cached?.version === CACHE_VERSION && options.cached.videos.length ? options.cached : null;
  const age = cached ? now - cached.fetchedAt : Infinity;
  if (cached && age >= 0 && age < CACHE_TTL) return { ...cached, version: CACHE_VERSION, stale: false };
  try {
    const fetcher = options.fetcher ?? fetch;
    // Fail the refresh if the stream list is unavailable rather than risk showing streams.
    const [uploads, streams] = await Promise.all([FEED_URL, LIVE_FEED_URL].map(async (url) => {
      const response = await fetcher(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`YouTube returned ${response.status}`);
      return response.text();
    }));
    return {
      videos: parseYouTubeFeed(uploads, parseLiveStreamIds(streams)),
      fetchedAt: now, version: CACHE_VERSION, stale: false,
    };
  } catch (error) {
    if (cached && age >= 0 && age < STALE_TTL) return { ...cached, version: CACHE_VERSION, stale: true };
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
