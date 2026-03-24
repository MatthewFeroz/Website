// Local development server
// Serves static files + proxies Substack RSS feed for the blog page
// Usage: node dev-server.js

const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");

const PORT = 3000;
const SUBSTACK_FEED = "https://matthewferoz.substack.com/feed";

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function parseRSS(xml) {
  const posts = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title = extractCDATA(item, "title") || extractTag(item, "title") || "";
    const link = extractTag(item, "link") || "";
    const pubDate = extractTag(item, "pubDate") || "";
    const description = extractCDATA(item, "description") || extractTag(item, "description") || "";
    const author = extractCDATA(item, "dc:creator") || extractTag(item, "dc:creator") || "";

    let thumbnail = "";
    const enclosureMatch = item.match(/<enclosure[^>]+url="([^"]+)"[^>]*type="image[^"]*"/);
    if (enclosureMatch) thumbnail = enclosureMatch[1];

    if (!thumbnail) {
      const contentEncoded = extractCDATA(item, "content:encoded") || "";
      const imgMatch = contentEncoded.match(/<img[^>]+src="([^"]+)"/);
      if (imgMatch) thumbnail = imgMatch[1];
    }

    const cleanDescription = description
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    posts.push({ title, link, pubDate, description: cleanDescription, thumbnail, author });
  }

  return posts;
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function extractCDATA(xml, tag) {
  const regex = new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function fetchSubstackFeed() {
  return new Promise((resolve, reject) => {
    https.get(SUBSTACK_FEED, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  // Handle blog feed API
  if (req.url === "/blog/feed") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      return res.end();
    }

    try {
      const xml = await fetchSubstackFeed();
      const posts = parseRSS(xml);
      res.writeHead(200);
      res.end(JSON.stringify({ posts }));
    } catch (err) {
      console.error("RSS fetch error:", err);
      res.writeHead(502);
      res.end(JSON.stringify({ posts: [], error: "Failed to fetch feed" }));
    }
    return;
  }

  // Serve static files
  let filePath = req.url === "/" ? "/index.html" : req.url;

  // Support clean URLs: /blog/ -> /blog/index.html
  if (filePath.endsWith("/")) filePath += "index.html";

  // Remove query string
  filePath = filePath.split("?")[0];

  const fullPath = path.join(__dirname, filePath);

  // Security: prevent directory traversal
  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  const ext = path.extname(fullPath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      // Try adding .html extension
      fs.readFile(fullPath + ".html", (err2, data2) => {
        if (err2) {
          res.writeHead(404, { "Content-Type": "text/html" });
          res.end("<h1>404 Not Found</h1>");
        } else {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(data2);
        }
      });
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n  🚀 Dev server running at http://localhost:${PORT}`);
  console.log(`  📝 Blog page at http://localhost:${PORT}/blog/`);
  console.log(`  📡 RSS proxy at http://localhost:${PORT}/blog/feed`);
  console.log(`\n  Press Ctrl+C to stop\n`);
});
