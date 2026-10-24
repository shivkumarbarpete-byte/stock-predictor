import express from 'express';
import protect from '../middleware/protect.js';
import {
  placeOrder,
  getAccountSummary,
  getPositions,
  getOrders,
  cancelOrder,
  resetTradingAccount,
} from '../controllers/tradeController.js';

const router = express.Router();

// All trading routes are protected
router.use(protect);

router.post('/order', placeOrder);
router.get('/account', getAccountSummary);
router.get('/positions', getPositions);
router.get('/orders', getOrders);
router.post('/orders/:id/cancel', cancelOrder);
router.post('/reset', resetTradingAccount);

export default router;
