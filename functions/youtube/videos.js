const YOUTUBE_VIDEOS_URL = "https://www.youtube.com/@MattFeroz/videos";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=900",
};

export async function onRequestGet() {
  try {
    const response = await fetch(YOUTUBE_VIDEOS_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MattFerozWebsite/1.0; +https://matthewferoz.com)",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      return json({ videos: [], error: "Failed to fetch YouTube feed" }, 502, {
        "Cache-Control": "public, max-age=60",
      });
    }

    const html = await response.text();
    const videos = parseYouTubeFeed(html).slice(0, 8);
    if (!videos.length) {
      return json({ videos: [], error: "No YouTube videos found" }, 502, {
        "Cache-Control": "public, max-age=60",
      });
    }

    return json({ videos });
  } catch (error) {
    return json({ videos: [], error: "Internal server error" }, 500, {
      "Cache-Control": "public, max-age=60",
    });
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function parseYouTubeFeed(html) {
  const videos = [];
  const seen = new Set();
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

    seen.add(videoId);
    videos.push({
      title: decodeJsonString(title),
      link: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
      published: decodeJsonString(published),
      views: decodeJsonString(views),
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });

    if (videos.length >= 12) break;
  }

  return videos;
}

function extractJsonString(jsonFragment, key) {
  const regex = new RegExp(`"${key}":"((?:\\\\.|[^"\\\\])*)"`);
  const match = jsonFragment.match(regex);
  return match ? match[1] : "";
}

function extractPublishedTime(jsonFragment) {
  const match = jsonFragment.match(
    /"publishedTimeText":\{"simpleText":"((?:\\.|[^"\\])*)"/
  );
  return match ? match[1] : "";
}

function extractViewCount(jsonFragment) {
  const match = jsonFragment.match(
    /"viewCountText":\{"simpleText":"((?:\\.|[^"\\])*)"/
  );
  return match ? match[1] : "";
}

function decodeJsonString(value) {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
  } catch {
    return value
      .replace(/\\u0026/g, "&")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
}
