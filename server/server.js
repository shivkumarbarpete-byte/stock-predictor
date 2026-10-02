import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import watchlistRoutes from './routes/watchlistRoutes.js';
import mlRoutes from './routes/ml.js';

dotenv.config();

const app = express();

// Trust the first proxy (Vercel's edge) so that req.ip and secure cookies work.
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
// Allow one or more origins supplied via the CORS_ORIGIN env var (comma-separated).
// In production this should be your Vercel deployment URL, e.g.:
//   CORS_ORIGIN=https://stock-predictor-ten-lime.vercel.app
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no Origin header (e.g. same-origin, Postman, curl).
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Handle preflight OPTIONS requests for all routes BEFORE other middleware.
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// ---------------------------------------------------------------------------
// Body / cookie parsing
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(cookieParser());

// ---------------------------------------------------------------------------
// DB middleware — connects (or reuses cached connection) before every request.
// This is the correct pattern for serverless: do NOT call connectDB() at the
// module top-level because the connection may time out between invocations.
// ---------------------------------------------------------------------------
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    res.status(503).json({ message: 'Database unavailable. Please try again.' });
  }
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/ml', mlRoutes);

// Health / smoke-test routes
app.get('/', (_req, res) => {
  res.json({ message: 'Stock Predictor API is running' });
});
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'server' });
});

// ---------------------------------------------------------------------------
// Local development only — Vercel ignores app.listen() but it must not be
// called in the serverless runtime because it tries to bind a port that
// doesn't exist, causing the function to hang or crash.
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Vercel requires the Express app to be the default export.
export default app;