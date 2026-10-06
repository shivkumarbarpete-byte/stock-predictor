import mongoose from 'mongoose';

const portfolioSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.001, 'Quantity must be greater than 0'],
    },
    buyPrice: {
      type: Number,
      required: true,
      min: [0, 'Buy price must be at least 0'],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Portfolio', portfolioSchema);
