const http = require("http");
const fs = require("fs");
const path = require("path");
const httpProxy = require("http-proxy");

const PORT = process.env.PORT || 3000;
const LAVALINK_PORT = process.env.SERVER_PORT || 2333;
const LAVALINK_PASSWORD = process.env.LAVALINK_SERVER_PASSWORD || "";
const NODE_NAME = process.env.NODE_NAME || "zetachei";

const LAVALINK_TARGET = `http://127.0.0.1:${LAVALINK_PORT}`;
const publicDir = path.join(__dirname, "public");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const proxy = httpProxy.createProxyServer({ target: LAVALINK_TARGET, ws: true });
proxy.on("error", (err, req, res) => {
  console.error("[proxy] error:", err.message);
  if (res && res.writeHead && !res.headersSent) {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Lavalink belum siap, coba lagi sebentar.");
  }
});

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

function fetchLavalinkStats() {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: LAVALINK_PORT,
        path: "/v4/stats",
        headers: { Authorization: LAVALINK_PASSWORD },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function checkLavalinkHealthy() {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: LAVALINK_PORT,
        path: "/version",
        headers: { Authorization: LAVALINK_PASSWORD },
        timeout: 3000,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(false));
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  // Health check untuk Render. /version bawaan Lavalink butuh Authorization (401 tanpa itu),
  // jadi Render tidak bisa memakainya langsung. Endpoint ini yang mengecek Lavalink pakai password.
  if (url === "/healthz") {
    const ok = await checkLavalinkHealthy();
    res.writeHead(ok ? 200 : 503, { "Content-Type": "text/plain", "Cache-Control": "no-store" });
    res.end(ok ? "ok" : "lavalink belum siap");
    return;
  }

  // Halaman status publik (info koneksi + statistik live) - tidak butuh login,
  // ini memang dimaksudkan untuk dilihat orang lain yang mau pakai node ini.
  if (url === "/status" || url === "/status/") {
    return serveStatic(res, path.join(publicDir, "index.html"));
  }
  if (url.startsWith("/status/")) {
    const relative = url.replace("/status/", "");
    return serveStatic(res, path.join(publicDir, relative));
  }

  // API stats untuk halaman status. Cuma expose angka agregat (CPU/RAM/players),
  // tidak ada data sensitif, jadi aman dibuat publik.
  if (url === "/api/stats") {
    try {
      const stats = await fetchLavalinkStats();
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify({ name: NODE_NAME, ...stats }));
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Lavalink belum siap" }));
    }
    return;
  }

  // Semua request lain (/, /version, /v4/*) diteruskan apa adanya ke Lavalink,
  // supaya bot Discord siapa pun tetap bisa connect lewat 1 port publik ini.
  proxy.web(req, res, {}, () => {
    if (!res.headersSent) {
      res.writeHead(502);
      res.end("Bad gateway");
    }
  });
});

// WebSocket (dipakai bot untuk /v4/websocket) diteruskan langsung ke Lavalink
server.on("upgrade", (req, socket, head) => {
  proxy.ws(req, socket, head);
});

server.listen(PORT, () => {
  console.log(`[dashboard] listening on port ${PORT}, forwarding to Lavalink at ${LAVALINK_TARGET}`);
});
