import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import watchlistRoutes from './routes/watchlistRoutes.js';

dotenv.config();
connectDB();

const app = express();
app.set('trust proxy', 1);

// Middleware
app.use(cors({
 origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/watchlist', watchlistRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Stock Predictor API is running' });
});

// Health route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'server' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});