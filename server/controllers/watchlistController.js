import User from '../models/User.js';

// @desc   Get logged-in user's watchlist
// @route  GET /api/watchlist
// @access Private
export const getWatchlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ watchlist: user.watchlist });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc   Add a symbol to watchlist
// @route  POST /api/watchlist/add
// @access Private
export const addToWatchlist = async (req, res) => {
  const { symbol } = req.body;

  if (!symbol) {
    return res.status(400).json({ message: 'Symbol is required' });
  }

  const formattedSymbol = symbol.trim().toUpperCase();

  if (!formattedSymbol.endsWith('.NS')) {
    return res.status(400).json({ message: 'Only NIFTY 50 symbols (.NS suffix) are supported' });
  }

  try {
    const user = await User.findById(req.user._id);

    if (user.watchlist.includes(formattedSymbol)) {
      return res.status(400).json({ message: 'Symbol already in watchlist' });
    }

    user.watchlist.push(formattedSymbol);
    await user.save();

    res.status(201).json({ watchlist: user.watchlist });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc   Remove a symbol from watchlist
// @route  DELETE /api/watchlist/remove/:symbol
// @access Private
export const removeFromWatchlist = async (req, res) => {
  const formattedSymbol = req.params.symbol.trim().toUpperCase();

  try {
    const user = await User.findById(req.user._id);

    user.watchlist = user.watchlist.filter((s) => s !== formattedSymbol);
    await user.save();

    res.json({ watchlist: user.watchlist });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};