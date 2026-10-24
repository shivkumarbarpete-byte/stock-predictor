import mongoose from 'mongoose';
import Account from '../models/Account.js';
import Position from '../models/Position.js';
import Order from '../models/Order.js';

const ML_BASE = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const round2 = (num) => Math.round((Number(num) + Number.EPSILON) * 100) / 100;

/**
 * Fetch real-time price from the ML service GET /quote/{symbol}.
 * NEVER trusts client-supplied prices.
 */
async function fetchLivePrice(symbol) {
  try {
    const url = new URL(`quote/${encodeURIComponent(symbol)}`, ML_BASE);
    const r = await fetch(url);
    if (!r.ok) {
      throw new Error(`ML quote HTTP ${r.status}`);
    }
    const data = await r.json();
    const price = Number(data.close);
    if (isNaN(price) || price <= 0) {
      throw new Error(`Invalid price returned for ${symbol}`);
    }
    return price;
  } catch (err) {
    throw new Error(`Failed to fetch current market price for ${symbol}: ${err.message}`);
  }
}

/**
 * Validates NSE trading hours (Mon-Fri 09:15 - 15:30 IST)
 * Only enforced if TRADING_HOURS_ENFORCED env flag is true.
 */
function isTradingHoursOpen() {
  if (process.env.TRADING_HOURS_ENFORCED !== 'true') {
    return true;
  }

  const now = new Date();
  // Convert UTC to IST (+5:30)
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);

  const day = istDate.getUTCDay(); // 0 is Sun, 6 is Sat
  if (day === 0 || day === 6) return false;

  const hours = istDate.getUTCHours();
  const minutes = istDate.getUTCMinutes();
  const currentMinutes = hours * 60 + minutes;

  const marketOpenMinutes = 9 * 60 + 15;  // 09:15
  const marketCloseMinutes = 15 * 60 + 30; // 15:30

  return currentMinutes >= marketOpenMinutes && currentMinutes <= marketCloseMinutes;
}

/**
 * Lazy creation of user account with default starting balance (1,000,000 ₹).
 */
export async function getOrCreateAccount(userId, session = null) {
  let account = await Account.findOne({ user: userId }).session(session);
  if (!account) {
    account = (await Account.create(
      [
        {
          user: userId,
          balance: 1000000,
          startingBalance: 1000000,
        },
      ],
      session ? { session } : {}
    ))[0];
  }
  return account;
}

/**
 * Atomic trade execution using Mongoose transaction session.
 * Balance, Position, and Order are updated together in an all-or-nothing manner.
 */
async function executeOrderAtomically({ userId, orderId, symbol, side, quantity, price }) {
  const session = await mongoose.startSession();
  try {
    let executedOrder = null;
    await session.withTransaction(async () => {
      const account = await getOrCreateAccount(userId, session);
      let position = await Position.findOne({ user: userId, symbol }).session(session);
      const totalAmount = round2(price * quantity);

      if (side === 'BUY') {
        if (account.balance < totalAmount) {
          throw new Error('Insufficient balance to execute order');
        }

        account.balance = round2(account.balance - totalAmount);
        await account.save({ session });

        if (position) {
          const newQty = position.quantity + quantity;
          const newAvg = round2((position.quantity * position.avgPrice + totalAmount) / newQty);
          position.quantity = newQty;
          position.avgPrice = newAvg;
          await position.save({ session });
        } else {
          await Position.create(
            [
              {
                user: userId,
                symbol,
                quantity,
                avgPrice: price,
              },
            ],
            { session }
          );
        }
      } else if (side === 'SELL') {
        if (!position || position.quantity < quantity) {
          throw new Error('Insufficient held quantity to execute sell order');
        }

        account.balance = round2(account.balance + totalAmount);
        await account.save({ session });

        const remainingQty = position.quantity - quantity;
        if (remainingQty <= 0) {
          await Position.deleteOne({ _id: position._id }).session(session);
        } else {
          position.quantity = remainingQty;
          await position.save({ session });
        }
      }

      if (orderId) {
        executedOrder = await Order.findByIdAndUpdate(
          orderId,
          {
            status: 'EXECUTED',
            executedPrice: price,
            rejectReason: null,
          },
          { new: true, session }
        );
      } else {
        executedOrder = (
          await Order.create(
            [
              {
                user: userId,
                symbol,
                side,
                type: 'MARKET',
                quantity,
                executedPrice: price,
                status: 'EXECUTED',
              },
            ],
            { session }
          )
        )[0];
      }
    });

    return executedOrder;
  } finally {
    await session.endSession();
  }
}

/**
 * Lazy settlement of pending LIMIT orders:
 * Checks each pending order against the current market quote and executes it
 * if limit price condition is satisfied (BUY: price <= limit; SELL: price >= limit).
 * Note: This is an on-demand/lazy settlement for simulation, not a continuous matching engine.
 */
export async function settlePendingOrders(userId) {
  try {
    const pendingOrders = await Order.find({ user: userId, status: 'PENDING' });
    if (pendingOrders.length === 0) return;

    // Cache quotes during this settlement run
    const quotesCache = {};

    for (const ord of pendingOrders) {
      try {
        if (!quotesCache[ord.symbol]) {
          quotesCache[ord.symbol] = await fetchLivePrice(ord.symbol);
        }
        const currentPrice = quotesCache[ord.symbol];

        const isMarketable =
          (ord.side === 'BUY' && currentPrice <= ord.limitPrice) ||
          (ord.side === 'SELL' && currentPrice >= ord.limitPrice);

        if (isMarketable) {
          await executeOrderAtomically({
            userId,
            orderId: ord._id,
            symbol: ord.symbol,
            side: ord.side,
            quantity: ord.quantity,
            price: currentPrice,
          });
        }
      } catch (ordErr) {
        // If settlement execution fails (e.g. balance dropped or position sold earlier), mark or keep pending
        console.warn(`[Trade Settlement] Order ${ord._id} could not execute: ${ordErr.message}`);
      }
    }
  } catch (err) {
    console.error('[Trade Settlement] Error settling pending orders:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Route Controllers
// ---------------------------------------------------------------------------

/**
 * POST /api/trade/order
 * Place a new paper trading order (MARKET or LIMIT)
 */
export const placeOrder = async (req, res) => {
  try {
    const { symbol, side, type, quantity, limitPrice } = req.body;

    if (!symbol || !side || !type || quantity === undefined) {
      return res.status(400).json({ message: 'Symbol, side, type, and quantity are required' });
    }

    const formattedSymbol = symbol.trim().toUpperCase();
    if (!formattedSymbol.endsWith('.NS')) {
      return res.status(400).json({ message: 'Only NSE symbols (.NS suffix) are supported' });
    }

    const upperSide = side.trim().toUpperCase();
    if (!['BUY', 'SELL'].includes(upperSide)) {
      return res.status(400).json({ message: 'Side must be either BUY or SELL' });
    }

    const upperType = type.trim().toUpperCase();
    if (!['MARKET', 'LIMIT'].includes(upperType)) {
      return res.status(400).json({ message: 'Type must be either MARKET or LIMIT' });
    }

    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      return res.status(400).json({ message: 'Quantity must be an integer >= 1' });
    }

    let parsedLimit = null;
    if (upperType === 'LIMIT') {
      parsedLimit = Number(limitPrice);
      if (isNaN(parsedLimit) || parsedLimit <= 0) {
        return res.status(400).json({ message: 'Valid limitPrice > 0 is required for LIMIT orders' });
      }
      parsedLimit = round2(parsedLimit);
    }

    // Check trading hours for MARKET orders if enforced
    if (upperType === 'MARKET' && !isTradingHoursOpen()) {
      return res.status(400).json({
        message: 'Market is closed. Trading hours are Mon-Fri 09:15 to 15:30 IST.',
      });
    }

    // Fetch current quote from ML service
    const currentPrice = await fetchLivePrice(formattedSymbol);

    // Initial validations against Account and Positions
    const account = await getOrCreateAccount(req.user._id);

    if (upperSide === 'SELL') {
      const position = await Position.findOne({ user: req.user._id, symbol: formattedSymbol });
      if (!position || position.quantity < qty) {
        return res.status(400).json({
          message: `Insufficient quantity. You hold ${position ? position.quantity : 0} shares of ${formattedSymbol}.`,
        });
      }
    }

    if (upperSide === 'BUY') {
      const requiredEstimate = round2((parsedLimit || currentPrice) * qty);
      if (account.balance < requiredEstimate) {
        return res.status(400).json({
          message: `Insufficient balance. Required: ₹${requiredEstimate.toLocaleString('en-IN')}, Available: ₹${account.balance.toLocaleString('en-IN')}`,
        });
      }
    }

    // Determine execution for MARKET or marketable LIMIT
    const isMarketable =
      upperType === 'MARKET' ||
      (upperType === 'LIMIT' &&
        ((upperSide === 'BUY' && currentPrice <= parsedLimit) ||
          (upperSide === 'SELL' && currentPrice >= parsedLimit)));

    if (isMarketable) {
      const executed = await executeOrderAtomically({
        userId: req.user._id,
        symbol: formattedSymbol,
        side: upperSide,
        quantity: qty,
        price: currentPrice,
      });

      return res.status(201).json({
        message: `${upperSide} order executed successfully at ₹${currentPrice}`,
        order: executed,
      });
    }

    // Non-marketable LIMIT order -> save as PENDING
    const pendingOrder = await Order.create({
      user: req.user._id,
      symbol: formattedSymbol,
      side: upperSide,
      type: 'LIMIT',
      quantity: qty,
      limitPrice: parsedLimit,
      status: 'PENDING',
    });

    return res.status(201).json({
      message: `Limit order placed successfully (Pending at ₹${parsedLimit})`,
      order: pendingOrder,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

/**
 * GET /api/trade/account
 * Returns balance, startingBalance, investedValue, currentValue, totalPnL, totalPnLPercent
 */
export const getAccountSummary = async (req, res) => {
  try {
    await settlePendingOrders(req.user._id);

    const account = await getOrCreateAccount(req.user._id);
    const positions = await Position.find({ user: req.user._id });

    let investedValue = 0;
    let currentValue = 0;

    if (positions.length > 0) {
      const quotes = await Promise.all(
        positions.map(async (pos) => {
          try {
            const p = await fetchLivePrice(pos.symbol);
            return { symbol: pos.symbol, price: p };
          } catch {
            return { symbol: pos.symbol, price: pos.avgPrice }; // fallback to avgPrice
          }
        })
      );

      const priceMap = {};
      quotes.forEach((q) => {
        priceMap[q.symbol] = q.price;
      });

      positions.forEach((pos) => {
        const cost = pos.quantity * pos.avgPrice;
        const live = pos.quantity * (priceMap[pos.symbol] || pos.avgPrice);
        investedValue += cost;
        currentValue += live;
      });
    }

    investedValue = round2(investedValue);
    currentValue = round2(currentValue);

    // Total PnL = (currentValue - investedValue)
    const totalPnL = round2(currentValue - investedValue);
    const totalPnLPercent = investedValue > 0 ? round2((totalPnL / investedValue) * 100) : 0;

    return res.status(200).json({
      balance: round2(account.balance),
      startingBalance: round2(account.startingBalance),
      investedValue,
      currentValue,
      totalPnL,
      totalPnLPercent,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch account summary', error: error.message });
  }
};

/**
 * GET /api/trade/positions
 * Returns all holdings with live price, currentValue, pnl, pnlPercent
 */
export const getPositions = async (req, res) => {
  try {
    await settlePendingOrders(req.user._id);

    const positions = await Position.find({ user: req.user._id }).sort({ symbol: 1 });

    const enriched = await Promise.all(
      positions.map(async (pos) => {
        let ltp = null;
        try {
          ltp = await fetchLivePrice(pos.symbol);
        } catch {
          ltp = null;
        }

        const effectivePrice = ltp ?? pos.avgPrice;
        const curVal = round2(pos.quantity * effectivePrice);
        const costVal = round2(pos.quantity * pos.avgPrice);
        const pnl = round2(curVal - costVal);
        const pnlPercent = costVal > 0 ? round2((pnl / costVal) * 100) : 0;

        return {
          _id: pos._id,
          symbol: pos.symbol,
          quantity: pos.quantity,
          avgPrice: round2(pos.avgPrice),
          ltp: ltp ? round2(ltp) : null,
          currentValue: curVal,
          pnl,
          pnlPercent,
        };
      })
    );

    return res.status(200).json({ positions: enriched });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch positions', error: error.message });
  }
};

/**
 * GET /api/trade/orders?status=&limit=
 * Returns user orders sorted newest first
 */
export const getOrders = async (req, res) => {
  try {
    await settlePendingOrders(req.user._id);

    const { status, limit } = req.query;
    const filter = { user: req.user._id };

    if (status) {
      filter.status = status.toUpperCase();
    }

    const maxLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200) : 50;

    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(maxLimit);

    return res.status(200).json({ orders });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
  }
};

/**
 * POST /api/trade/orders/:id/cancel
 * Cancels a PENDING order
 */
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, user: req.user._id });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.status !== 'PENDING') {
      return res.status(400).json({ message: `Cannot cancel order with status ${order.status}` });
    }

    order.status = 'CANCELLED';
    await order.save();

    return res.status(200).json({ message: 'Order cancelled successfully', order });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to cancel order', error: error.message });
  }
};

/**
 * POST /api/trade/reset
 * Resets account: wipes positions, cancels orders, restores balance to 1,000,000 ₹
 * Requires body { confirm: true }
 */
export const resetTradingAccount = async (req, res) => {
  try {
    const { confirm } = req.body;
    if (!confirm) {
      return res.status(400).json({ message: 'Confirmation required ({ confirm: true }) to reset account' });
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Position.deleteMany({ user: req.user._id }).session(session);
        await Order.deleteMany({ user: req.user._id }).session(session);

        const account = await getOrCreateAccount(req.user._id, session);
        account.balance = account.startingBalance || 1000000;
        await account.save({ session });
      });
    } finally {
      await session.endSession();
    }

    return res.status(200).json({
      message: 'Paper trading account reset successfully. Balance restored to ₹10,00,000.',
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to reset account', error: error.message });
  }
};
