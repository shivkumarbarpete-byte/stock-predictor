import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    watchlist: {
      type: [String], // array of stock symbols, e.g. ["RELIANCE.NS", "TCS.NS"]
      default: [],
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt automatically
  }
);

// Pre-save hook: password ko hash karo save hone se pehle
userSchema.pre('save', async function () {
  // agar password field change nahi hui (jaise sirf watchlist update ho rahi hai), toh re-hash mat karo
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Instance method: login ke time entered password ko stored hash se compare karne ke liye
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;