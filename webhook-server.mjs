#!/usr/bin/env node
import { createServer } from "http";
import { execSync } from "child_process";

const PORT = process.env.PORT || 8020;
const SECRET = process.env.WEBHOOK_SECRET || "irmreads-secret";

// ── PROJECTS ──
const PROJECTS = {
  "grayscale636/irm-reads": {
    dir: "/home/gery/Documents/projects/productivity/irm-reads",
    name: "IRM Reads",
    webhook: "https://discord.com/api/webhooks/1394595057905958923/Eq7RrMQYPSODInBLmb5drZjyPvfRsqyUvEmZqNCLPbM4HGxwBHove2E-S1Wa31EWl5VD",
    deploy: () => {
      const start = Date.now();
      execSync("git pull origin master", { cwd: PROJECTS["grayscale636/irm-reads"].dir, timeout: 30000 });
      execSync("npm run build", { cwd: `${PROJECTS["grayscale636/irm-reads"].dir}/read-dash`, timeout: 60000 });
      execSync("cp -r dist/* ../public/", { cwd: `${PROJECTS["grayscale636/irm-reads"].dir}/read-dash`, timeout: 10000 });
      execSync("pm2 restart irmreads-frontend", { timeout: 10000 });
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      return { elapsed };
    },
  },
  "grayscale636/kei-personal-assistant": {
    dir: "/home/gery/Documents/projects/AI/bot_dc",
    name: "Kei Bot DC",
    webhook: "https://discord.com/api/webhooks/1394595057905958923/Eq7RrMQYPSODInBLmb5drZjyPvfRsqyUvEmZqNCLPbM4HGxwBHove2E-S1Wa31EWl5VD",
    deploy: () => {
      const start = Date.now();
      execSync("git fetch origin master", { cwd: PROJECTS["grayscale636/kei-personal-assistant"].dir, timeout: 30000 });
      execSync("git reset --hard origin/master", { cwd: PROJECTS["grayscale636/kei-personal-assistant"].dir, timeout: 30000 });
      execSync("docker compose up -d --build", { cwd: PROJECTS["grayscale636/kei-personal-assistant"].dir, timeout: 120000 });
      execSync("docker image prune -f", { timeout: 10000 });
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      return { elapsed };
    },
  },
};

// ── HELPERS ──
function sendDiscord(project, status, color, msg) {
  const payload = {
    username: `${project.name}-Deploy`,
    embeds: [{
      title: `${project.name} Deploy ${status}`,
      description: msg,
      color,
      timestamp: new Date().toISOString(),
    }],
  };
  execSync(`curl -s -X POST "${project.webhook}" -H "Content-Type: application/json" -d '${JSON.stringify(payload)}'`, { timeout: 5000 });
}

function handlePayload(payload) {
  const repo = payload.repository?.full_name;
  const project = PROJECTS[repo];
  if (!project) {
    console.log(`[webhook] Unknown repo: ${repo}`);
    return;
  }

  const event = payload.headers?.["x-github-event"];
  console.log(`[webhook] Push to ${repo} detected. Deploying ${project.name}...`);

  try {
    const result = project.deploy();
    sendDiscord(project, "✅ Success", 0x22c55e, `Deployed in ${result.elapsed}s`);
    console.log(`[webhook] ${project.name} deployed in ${result.elapsed}s`);
  } catch (e) {
    sendDiscord(project, "❌ Failed", 0xef4444, `Error: ${e.message}`);
    console.error(`[webhook] ${project.name} Error:`, e.message);
  }
}

// ── SERVER ──
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
      const payload = JSON.parse(body);

      if (event === "push" && payload.ref === "refs/heads/master") {
        payload.headers = req.headers;
        handlePayload(payload);
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
  console.log(`[webhook] Registered projects:`);
  Object.entries(PROJECTS).forEach(([repo, p]) => console.log(`  - ${repo} → ${p.name}`));
});
