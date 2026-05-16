#!/usr/bin/env node
import { createServer } from "http";
import { execSync } from "child_process";

const PORT = process.env.PORT || 8020;
const SECRET = process.env.WEBHOOK_SECRET || "irmreads-secret";
const REPO_DIR = "/home/gery/Documents/projects/productivity/irm-reads";
const WEBHOOK_URL = "https://discord.com/api/webhooks/1394595057905958923/Eq7RrMQYPSODInBLmb5drZjyPvfRsqyUvEmZqNCLPbM4HGxwBHove2E-S1Wa31EWl5VD";

function sendDiscord(status, color, desc) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    username: "IRM-Deploy",
    embeds: [{
      title: `Deploy ${status}`,
      description: desc,
      color,
      timestamp: new Date().toISOString(),
    }],
  };
  execSync(`curl -s -X POST "${WEBHOOK_URL}" -H "Content-Type: application/json" -d '${JSON.stringify(payload)}'`, { timeout: 5000 });
}

function deploy() {
  const start = Date.now();
  try {
    console.log("[webhook] Pulling...");
    execSync("git pull origin master", { cwd: REPO_DIR, timeout: 30000 });

    console.log("[webhook] Building frontend...");
    execSync("npm run build", { cwd: `${REPO_DIR}/read-dash`, timeout: 60000 });

    console.log("[webhook] Copy to public...");
    execSync("cp -r dist/* ../public/", { cwd: `${REPO_DIR}/read-dash`, timeout: 10000 });

    console.log("[webhook] Restarting PM2...");
    execSync("pm2 restart irmreads-frontend", { timeout: 10000 });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    sendDiscord("✅ Success", 0x22c55e, `Deployed in ${elapsed}s`);
    console.log("[webhook] Done.");
  } catch (e) {
    sendDiscord("❌ Failed", 0xef4444, `Error: ${e.message}`);
    console.error("[webhook] Error:", e.message);
  }
}

createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405);
    return res.end("Method Not Allowed");
  }

  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    try {
      const event = req.headers["x-github-event"];
      const sig = req.headers["x-hub-signature-256"];
      const payload = JSON.parse(body);

      // Only trigger on push to master
      if (event === "push" && payload.ref === "refs/heads/master") {
        console.log("[webhook] Push to master detected. Deploying...");
        deploy();
      }

      res.writeHead(200);
      res.end("OK");
    } catch (e) {
      console.error("[webhook] Parse error:", e.message);
      res.writeHead(400);
      res.end("Bad Request");
    }
  });
}).listen(PORT, "0.0.0.0", () => {
  console.log(`[webhook] Listening on port ${PORT}`);
});
