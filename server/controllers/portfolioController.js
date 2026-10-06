import Portfolio from '../models/Portfolio.js';

// @desc    Get user's portfolio holdings
// @route   GET /api/portfolio
// @access  Private
export const getPortfolio = async (req, res) => {
  try {
    const portfolio = await Portfolio.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ portfolio });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch portfolio', error: error.message });
  }
};

// @desc    Add a holding to user's portfolio
// @route   POST /api/portfolio
// @access  Private
export const addHolding = async (req, res) => {
  try {
    const { symbol, quantity, buyPrice } = req.body;

    if (!symbol || !quantity || buyPrice === undefined) {
      return res.status(400).json({ message: 'Symbol, quantity, and buy price are required' });
    }

    const formattedSymbol = symbol.trim().toUpperCase();
    const qty = Number(quantity);
    const price = Number(buyPrice);

    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ message: 'Quantity must be a positive number' });
    }

    if (isNaN(price) || price < 0) {
      return res.status(400).json({ message: 'Buy price must be non-negative' });
    }

    const newHolding = await Portfolio.create({
      user: req.user._id,
      symbol: formattedSymbol,
      quantity: qty,
      buyPrice: price,
    });

    const portfolio = await Portfolio.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(201).json({ message: 'Holding added successfully', holding: newHolding, portfolio });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add holding', error: error.message });
  }
};

// @desc    Remove a holding from user's portfolio
// @route   DELETE /api/portfolio/:id
// @access  Private
export const deleteHolding = async (req, res) => {
  try {
    const { id } = req.params;

    const holding = await Portfolio.findOneAndDelete({ _id: id, user: req.user._id });

    if (!holding) {
      return res.status(404).json({ message: 'Holding not found or unauthorized' });
    }

    const portfolio = await Portfolio.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ message: 'Holding removed successfully', portfolio });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete holding', error: error.message });
  }
};
