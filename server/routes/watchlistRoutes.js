import express from 'express';
import protect from '../middleware/protect.js';
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
} from '../controllers/watchlistController.js';

const router = express.Router();

// Saare routes protected hain — bina valid JWT cookie ke access nahi milega
router.get('/', protect, getWatchlist);
router.post('/', protect, addToWatchlist);
router.delete('/:symbol', protect, removeFromWatchlist);

export default router;