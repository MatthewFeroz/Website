import { describe, expect, test } from "bun:test";
import { CHANNEL_ID, FEED_URL, CACHE_TTL, STALE_TTL, parseYouTubeFeed, getYouTubeFeed, youtubeErrorResponse } from "../lib/youtube";

const entry = (id: string, published: string, title = "AI &amp; software") => `<entry><yt:channelId>${CHANNEL_ID}</yt:channelId><yt:videoId>${id}</yt:videoId><title>${title}</title><published>${published}</published><media:group><media:community><media:statistics views="1200"/></media:community></media:group></entry>`;
const xml = (...entries: string[]) => `<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/"><author><uri>https://www.youtube.com/channel/${CHANNEL_ID}</uri></author>${entries.join("")}</feed>`;
const feedXml = xml(entry("wx1DomKBs2s", "2026-09-17T04:08:08Z"));
const videos = parseYouTubeFeed(feedXml);
const now = Date.parse("2026-10-04T20:00:00Z");
const fail = (async () => new Response("unavailable", { status: 503 })) as typeof fetch;

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
  test("returns at most eight newest uploads", () => {
    expect(parseYouTubeFeed(xml(...Array.from({ length: 12 }, (_, i) => entry(`videoid${String(i).padStart(4, "0")}`, `2026-09-${String(i + 1).padStart(2, "0")}T00:00:00Z`))))).toHaveLength(8);
  });
  test("uses the verified channel feed and records retrieval time", async () => {
    const fetcher = (async (url, options) => {
      expect(url).toBe(FEED_URL);
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      return new Response(feedXml);
    }) as typeof fetch;
    expect(await getYouTubeFeed({ fetcher, now })).toEqual({ videos, fetchedAt: now, stale: false });
  });
  test("fresh cache avoids a network fetch", async () => {
    const fetcher = (async () => { throw new Error("must not fetch"); }) as typeof fetch;
    expect((await getYouTubeFeed({ cached: { videos, fetchedAt: now - 1000 }, fetcher, now })).stale).toBe(false);
  });
  test("refreshes expired cache", async () => {
    const fetcher = (async () => new Response(feedXml)) as typeof fetch;
    expect((await getYouTubeFeed({ cached: { videos, fetchedAt: now - CACHE_TTL }, fetcher, now })).fetchedAt).toBe(now);
  });
  test("upstream failures preserve last successful data with a stale marker", async () => {
    const cached = { videos, fetchedAt: now - CACHE_TTL };
    for (const fetcher of [fail, (async () => { throw new Error("timeout"); }) as typeof fetch, (async () => new Response(xml())) as typeof fetch]) {
      expect(await getYouTubeFeed({ cached, fetcher, now })).toEqual({ ...cached, stale: true });
    }
  });
  test("uncached failures and data older than seven days do not masquerade as recent", async () => {
    await expect(getYouTubeFeed({ fetcher: fail, now })).rejects.toThrow();
    await expect(getYouTubeFeed({ cached: { videos, fetchedAt: now - STALE_TTL }, fetcher: fail, now })).rejects.toThrow();
    const response = youtubeErrorResponse();
    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
