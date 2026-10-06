import express from 'express';
import protect from '../middleware/protect.js';
import {
  getPortfolio,
  addHolding,
  deleteHolding,
} from '../controllers/portfolioController.js';

const router = express.Router();

router.get('/', protect, getPortfolio);
router.post('/', protect, addHolding);
router.delete('/:id', protect, deleteHolding);

export default router;
