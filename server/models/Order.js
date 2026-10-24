import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
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
    side: {
      type: String,
      required: true,
      enum: ['BUY', 'SELL'],
    },
    type: {
      type: String,
      required: true,
      enum: ['MARKET', 'LIMIT'],
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be an integer',
      },
    },
    limitPrice: {
      type: Number,
      default: null,
    },
    executedPrice: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ['EXECUTED', 'PENDING', 'CANCELLED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    rejectReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Order', orderSchema);
