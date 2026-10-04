import { describe, expect, test } from "bun:test";
import { CHANNEL_ID, FEED_URL, LIVE_FEED_URL, CACHE_VERSION, CACHE_TTL, STALE_TTL, parseYouTubeFeed, parseLiveStreamIds, getYouTubeFeed, youtubeErrorResponse } from "../lib/youtube";

const entry = (id: string, published: string, title = "AI &amp; software") => `<entry><yt:channelId>${CHANNEL_ID}</yt:channelId><yt:videoId>${id}</yt:videoId><title>${title}</title><published>${published}</published><media:group><media:community><media:statistics views="1200"/></media:community></media:group></entry>`;
const xml = (...entries: string[]) => `<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/"><author><uri>https://www.youtube.com/channel/${CHANNEL_ID}</uri></author>${entries.join("")}</feed>`;
const feedXml = xml(entry("wx1DomKBs2s", "2026-09-17T04:08:08Z"));
// "T3Code and Chill": an upcoming stream with 0 views, listed in the channel's Live playlist.
const stream = entry("gF1HSuM3mbw", "2026-09-11T02:12:33Z", "T3Code and Chill");
const liveXml = xml(stream, entry("i1ATRFykyn0", "2025-01-15T00:14:00Z", "Past livestream"));
const videos = parseYouTubeFeed(feedXml);
const now = Date.parse("2026-10-04T20:00:00Z");
const fail = (async () => new Response("unavailable", { status: 503 })) as typeof fetch;
const youtube = (uploads: string, streams = liveXml, status = 200) =>
  (async (url) => new Response(url === LIVE_FEED_URL ? streams : uploads, { status: url === LIVE_FEED_URL ? status : 200 })) as typeof fetch;

describe("YouTube feed", () => {
  test("decodes titles, sorts by publication, deduplicates and ignores invalid entries", () => {
    const result = parseYouTubeFeed(xml(
      entry("TGEtkQCvnM8", "2026-09-01T19:14:23Z"),
      entry("wx1DomKBs2s", "2026-09-17T04:08:08Z", "A &quot;real&quot; title &amp; AI"),
      entry("wx1DomKBs2s", "2026-09-17T04:08:08Z"),
      entry("invalid", "2026-10-01T00:00:00Z"),
      entry("gF1HSuM3mbw", "invalid")
    ));
    expect(result.map(v => v.videoId)).toEqual(["wx1DomKBs2s", "TGEtkQCvnM8"]);
    expect(result[0].title).toBe('A "real" title & AI');
    expect(result[0].views).toBe("1,200 views");
    expect(result[0].link).toBe("https://www.youtube.com/watch?v=wx1DomKBs2s");
  });
  test("rejects HTML, wrong channel and empty feeds", () => {
    for (const bad of ["<html>Unavailable</html>", xml(), feedXml.replaceAll(CHANNEL_ID, "wrong-channel"), "<feed>"]) {
      expect(() => parseYouTubeFeed(bad)).toThrow();
    }
  });
  test("reads CDATA and decimal or hexadecimal Unicode entities without double decoding", () => {
    const result = parseYouTubeFeed(xml(
      entry("wx1DomKBs2s", "2026-09-17T04:08:08Z", "<![CDATA[AI & software <tools>]]>"),
      entry("TGEtkQCvnM8", "2026-09-01T19:14:23Z", "Theo&#x2019;s &#128640; &amp;lt; &apos;AI&apos;")
    ));
    expect(result[0].title).toBe("AI & software <tools>");
    expect(result[1].title).toBe("Theo’s 🚀 &lt; 'AI'");
  });
  test("rejects truncated feeds and invalid XML characters", () => {
    for (const bad of [feedXml.replace("</entry>", ""), feedXml.replace("</feed>", ""), xml(entry("wx1DomKBs2s", "2026-09-17T04:08:08Z", "&#x110000;"))]) {
      expect(() => parseYouTubeFeed(bad)).toThrow();
    }
  });
  test("returns at most eight newest uploads", () => {
    expect(parseYouTubeFeed(xml(...Array.from({ length: 12 }, (_, i) => entry(`videoid${String(i).padStart(4, "0")}`, `2026-09-${String(i + 1).padStart(2, "0")}T00:00:00Z`))))).toHaveLength(8);
  });
  test("excludes livestreams and keeps normal videos", () => {
    const result = parseYouTubeFeed(xml(
      entry("wx1DomKBs2s", "2026-09-17T04:08:08Z"), stream, entry("TGEtkQCvnM8", "2026-09-01T19:14:23Z")
    ), parseLiveStreamIds(liveXml));
    expect(result.map(v => v.videoId)).toEqual(["wx1DomKBs2s", "TGEtkQCvnM8"]);
    expect(() => parseYouTubeFeed(xml(stream), parseLiveStreamIds(liveXml))).toThrow();
  });
  test("still returns eight uploads when a livestream is the newest entry", () => {
    const uploads = Array.from({ length: 9 }, (_, i) => entry(`videoid${String(i).padStart(4, "0")}`, `2026-09-${String(i + 1).padStart(2, "0")}T00:00:00Z`));
    const result = parseYouTubeFeed(xml(...uploads, entry("gF1HSuM3mbw", "2026-09-30T00:00:00Z")), parseLiveStreamIds(liveXml));
    expect(result).toHaveLength(8);
    expect(result.map(v => v.videoId)).not.toContain("gF1HSuM3mbw");
  });
  test("uses the verified channel and Live playlist feeds and records retrieval time", async () => {
    const urls: string[] = [];
    const fetcher = (async (url, options) => {
      urls.push(String(url));
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      return new Response(url === LIVE_FEED_URL ? liveXml : xml(entry("wx1DomKBs2s", "2026-09-17T04:08:08Z"), stream));
    }) as typeof fetch;
    expect(await getYouTubeFeed({ fetcher, now })).toEqual({ videos, fetchedAt: now, version: CACHE_VERSION, stale: false });
    expect(urls.sort()).toEqual([FEED_URL, LIVE_FEED_URL].sort());
    expect(LIVE_FEED_URL).toBe("https://www.youtube.com/feeds/videos.xml?playlist_id=UULVXiSA-iF5o-je14bN-UVupA");
  });
  test("fresh cache avoids a network fetch", async () => {
    const fetcher = (async () => { throw new Error("must not fetch"); }) as typeof fetch;
    expect((await getYouTubeFeed({ cached: { videos, fetchedAt: now - 1000, version: CACHE_VERSION }, fetcher, now })).stale).toBe(false);
  });
  test("refreshes expired cache", async () => {
    expect((await getYouTubeFeed({ cached: { videos, fetchedAt: now - CACHE_TTL, version: CACHE_VERSION }, fetcher: youtube(feedXml), now })).fetchedAt).toBe(now);
  });
  test("ignores caches written before livestream filtering", async () => {
    const legacy = { videos: parseYouTubeFeed(xml(stream)), fetchedAt: now - 1000 };
    expect((await getYouTubeFeed({ cached: legacy, fetcher: youtube(xml(stream, entry("wx1DomKBs2s", "2026-09-17T04:08:08Z"))), now })).videos).toEqual(videos);
    await expect(getYouTubeFeed({ cached: legacy, fetcher: fail, now })).rejects.toThrow();
  });
  test("upstream failures preserve last successful data with a stale marker", async () => {
    const cached = { videos, fetchedAt: now - CACHE_TTL, version: CACHE_VERSION };
    for (const fetcher of [fail, (async () => { throw new Error("timeout"); }) as typeof fetch, (async () => new Response(xml())) as typeof fetch,
      youtube(feedXml, "unavailable", 503), youtube(feedXml, "<html>Unavailable</html>")]) {
      expect(await getYouTubeFeed({ cached, fetcher, now })).toEqual({ ...cached, stale: true });
    }
  });
  test("uncached failures and data older than seven days do not masquerade as recent", async () => {
    await expect(getYouTubeFeed({ fetcher: fail, now })).rejects.toThrow();
    await expect(getYouTubeFeed({ fetcher: youtube(feedXml, "not found", 404), now })).rejects.toThrow();
    await expect(getYouTubeFeed({ cached: { videos, fetchedAt: now - STALE_TTL, version: CACHE_VERSION }, fetcher: fail, now })).rejects.toThrow();
    const response = youtubeErrorResponse();
    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
