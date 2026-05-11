import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import booksRouter from './routes/books';
import readingLogsRouter from './routes/readingLogs';
import notesRouter from './routes/notes';

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
  max: 10, // 10 auth attempts per 15 min
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: '50mb' })); // For base64 images

// Health check (no rate limit)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Public routes (with auth rate limiter)
app.use('/api/auth', authLimiter, authRouter);

// Protected routes (middleware applied in each router)
app.use('/api/books', booksRouter);
app.use('/api/reading-logs', readingLogsRouter);
app.use('/api/notes', notesRouter);

// Error handler - include CORS headers even on errors
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
  
  res.status(500).json({ error: 'Internal server error' });
});

// Listen on all interfaces (0.0.0.0) so external clients can connect
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 ReadDash API running on 0.0.0.0:${PORT} [${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
  console.log(`   Allowed origins: ${allowedOrigins.length ? allowedOrigins.join(', ') : 'any (dev mode)'}`);
});
