import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import booksRouter from './routes/books';
import readingLogsRouter from './routes/readingLogs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8114;
const isProduction = process.env.NODE_ENV === 'production';

// Security middleware
app.use(helmet());

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

// CORS config
const corsOptions = {
  origin: isProduction 
    ? process.env.CORS_ORIGIN?.split(',') || []
    : '*',
  credentials: true,
};
app.use(cors(corsOptions));

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

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 ReadDash API running on port ${PORT} [${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
});
