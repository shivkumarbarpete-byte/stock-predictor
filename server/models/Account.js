import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      required: true,
      default: 1000000,
      min: [0, 'Balance cannot be negative'],
    },
    startingBalance: {
      type: Number,
      required: true,
      default: 1000000,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Account', accountSchema);
