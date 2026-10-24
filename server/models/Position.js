import mongoose from 'mongoose';

const positionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
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
      min: [0, 'Quantity must be non-negative'],
    },
    avgPrice: {
      type: Number,
      required: true,
      min: [0, 'Average price must be non-negative'],
    },
  },
  {
    timestamps: true,
  }
);

// Unique index on (user, symbol) to ensure 1 position per stock per user
positionSchema.index({ user: 1, symbol: 1 }, { unique: true });

export default mongoose.model('Position', positionSchema);
