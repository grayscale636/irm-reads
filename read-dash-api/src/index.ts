import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import booksRouter from './routes/books';
import readingLogsRouter from './routes/readingLogs';
import notesRouter from './routes/notes';
import goalsRouter from './routes/goals';
import aiRouter from './routes/ai';
import { execSync } from 'child_process';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8211;
const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy - required when behind reverse proxy (Cloudflare, nginx, etc.)
// This allows express-rate-limit to correctly identify clients via X-Forwarded-For
app.set('trust proxy', 1);

// CORS config - MUST be before other middleware
// In development we reflect the request origin (allow credentials + browser requests).
// In production we validate against an allow-list provided via CORS_ORIGIN env (comma-separated).
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : [];

const corsOptions: cors.CorsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) {
    // Allow non-browser requests (curl, Postman) which don't set an origin
    if (!origin) return callback(null, true);

    // In development allow any origin (reflect it back)
    if (!isProduction) return callback(null, origin);

    // In production, check allow-list
    if (allowedOrigins.length === 0) {
      return callback(new Error('CORS not configured'), false);
    }

    if (allowedOrigins.includes(origin)) return callback(null, origin);

    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Apply CORS first (handles preflight OPTIONS)
app.use(cors(corsOptions));

// Security middleware (after CORS)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Rate limiting - general
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per 15 min
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 auth attempts per 15 min
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '50mb' })); // For base64 images

// Health check (no rate limit)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Deploy webhook (GitHub push → auto-deploy)
// Expects JSON body with repository.full_name
app.post('/api/deploy', (req, res) => {
  res.json({ ok: true, message: 'Webhook received.' });

  const repo = req.body?.repository?.full_name;
  const event = req.headers['x-github-event'];

  if (event !== 'push' || !repo) return;

  const PROJECTS: Record<string, {
    name: string;
    dir: string;
    deploy: () => void;
  }> = {
    'grayscale636/irm-reads': {
      name: 'IRM Reads',
      dir: '/home/gery/Documents/projects/productivity/irm-reads',
      deploy: () => {
        execSync('git pull origin master', { cwd: `/home/gery/Documents/projects/productivity/irm-reads`, timeout: 30000 });
        execSync('npx vite build', { cwd: `/home/gery/Documents/projects/productivity/irm-reads/read-dash`, timeout: 60000 });
        execSync('cp -r dist/* ../public/', { cwd: `/home/gery/Documents/projects/productivity/irm-reads/read-dash`, timeout: 10000 });
        execSync('pm2 restart irmreads-frontend', { timeout: 10000 });
      },
    },
    'grayscale636/kei-personal-assistant': {
      name: 'Kei Bot DC',
      dir: '/home/gery/Documents/projects/AI/bot_dc',
      deploy: () => {
        execSync('git fetch origin master', { cwd: `/home/gery/Documents/projects/AI/bot_dc`, timeout: 30000 });
        execSync('git reset --hard origin/master', { cwd: `/home/gery/Documents/projects/AI/bot_dc`, timeout: 30000 });
        execSync('docker compose up -d --build', { cwd: `/home/gery/Documents/projects/AI/bot_dc`, timeout: 120000 });
        execSync('docker image prune -f', { timeout: 10000 });
      },
    },
  };

  const project = PROJECTS[repo];
  if (!project) return;

  const WEBHOOK = 'https://discord.com/api/webhooks/1394595057905958923/Eq7RrMQYPSODInBLmb5drZjyPvfRsqyUvEmZqNCLPbM4HGxwBHove2E-S1Wa31EWl5VD';
  const start = Date.now();

  setTimeout(() => {
    try {
      project.deploy();
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      execSync(`curl -s -X POST "${WEBHOOK}" -H "Content-Type: application/json" -d '{"username":"${project.name}-Deploy","embeds":[{"title":"✅ ${project.name} Deploy Successful","description":"Deployed in ${elapsed}s","color":2276157}]}'`, { timeout: 5000 });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      execSync(`curl -s -X POST "${WEBHOOK}" -H "Content-Type: application/json" -d '{"username":"${project.name}-Deploy","embeds":[{"title":"❌ ${project.name} Deploy Failed","description":"Error: ${errMsg.slice(0, 400)}","color":15728644}]}'`, { timeout: 5000 });
    }
  }, 100);
});

// Public routes (with auth rate limiter)
app.use('/api/auth', authLimiter, authRouter);

// Protected routes (middleware applied in each router)
app.use('/api/books', booksRouter);
app.use('/api/reading-logs', readingLogsRouter);
app.use('/api/notes', notesRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/ai', aiRouter);

// Error handler - include CORS headers even on errors
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err.message);

  // Ensure CORS headers are set even on errors
  const origin = req.headers.origin;
  if (origin) {
    const isAllowed = !isProduction || allowedOrigins.includes(origin);
    if (isAllowed) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
  }

  // Malformed JSON body from a client → return 400 with a descriptive message
  // instead of a generic 500 that suggests our server crashed.
  const type = (err as Error & { type?: string }).type;
  if (err instanceof SyntaxError && type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
});

// Listen on all interfaces (0.0.0.0) so external clients can connect
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 ReadDash API running on 0.0.0.0:${PORT} [${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
  console.log(`   Allowed origins: ${allowedOrigins.length ? allowedOrigins.join(', ') : 'any (dev mode)'}`);
});
