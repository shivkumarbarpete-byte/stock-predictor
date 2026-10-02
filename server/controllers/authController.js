import User from '../models/User.js';
import generateToken from '../middleware/generateToken.js';

// ---------------------------------------------------------------------------
// @desc    Register new user
// @route   POST /api/auth/register
// ---------------------------------------------------------------------------
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // --- Validation ---
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }

    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 6 characters' });
    }

    // --- Duplicate check (409 Conflict, not 400) ---
    const userExists = await User.findOne({ email: email.toLowerCase().trim() });
    if (userExists) {
      return res
        .status(409)
        .json({ message: 'An account with this email already exists' });
    }

    // --- Create user ---
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
    });

    generateToken(res, user._id);

    return res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      watchlist: user.watchlist,
    });
  } catch (err) {
    // Mongoose duplicate-key error (race condition fallback)
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ message: 'An account with this email already exists' });
    }
    console.error('[register]', err.message);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// ---------------------------------------------------------------------------
// @desc    Login user
// @route   POST /api/auth/login
// ---------------------------------------------------------------------------
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    generateToken(res, user._id);

    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      watchlist: user.watchlist,
    });
  } catch (err) {
    console.error('[login]', err.message);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};

// ---------------------------------------------------------------------------
// @desc    Logout user
// @route   POST /api/auth/logout
// ---------------------------------------------------------------------------
export const logoutUser = (_req, res) => {
  res.cookie('jwt', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    expires: new Date(0),
  });
  return res.status(200).json({ message: 'Logged out successfully' });
};

// ---------------------------------------------------------------------------
// @desc    Get current logged-in user
// @route   GET /api/auth/me
// ---------------------------------------------------------------------------
export const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      watchlist: req.user.watchlist,
    });
  } catch (err) {
    console.error('[getMe]', err.message);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
};