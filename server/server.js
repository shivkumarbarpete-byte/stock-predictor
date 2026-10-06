import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import watchlistRoutes from './routes/watchlistRoutes.js';
import portfolioRoutes from './routes/portfolioRoutes.js';
import mlRoutes from './routes/ml.js';

dotenv.config();

const app = express();

// Trust the Vercel proxy.
app.set('trust proxy', 1);

// CORS configuration.
const allowedOrigins = (
  process.env.CORS_ORIGIN || 'http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without an Origin header.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error(`CORS: origin '${origin}' not allowed`)
    );
  },

  credentials: true,

  methods: [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS'
  ],

  allowedHeaders: [
    'Content-Type',
    'Authorization'
  ]
};

// Application-level CORS middleware also handles preflight requests.
app.use(cors(corsOptions));

// Request parsing.
app.use(express.json());
app.use(cookieParser());

// Health endpoints do not require a database connection.
app.get('/api', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Stock Predictor API is running'
  });
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'server'
  });
});

// Connect to MongoDB before processing application requests.
// Reuse the cached connection from config/db.js.
app.use(async (_req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('MongoDB connection error:', err.message);

    return res.status(503).json({
      message: 'Database unavailable. Please try again.'
    });
  }
});

// API routes.
// Keep the /api prefix because Vercel preserves the request path.
app.use('/api/auth', authRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/ml', mlRoutes);

// Local development only.
// Vercel imports the exported Express application.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
export default app;