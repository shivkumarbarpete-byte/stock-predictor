import mongoose from 'mongoose';

// Cache the connection promise across serverless invocations so we don't
// open a new TCP connection on every request (Atlas has a connection limit).
let cached = global._mongooseCache;
if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null };
}

const connectDB = async () => {
  // Already connected — return immediately.
  if (cached.conn) return cached.conn;

  // Connection is in-flight — await the existing promise instead of starting
  // a second one (avoids duplicate connections on concurrent cold starts).
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(process.env.MONGO_URI, {
        bufferCommands: false,
      })
      .then((m) => m)
      .catch((err) => {
        // Reset so the next invocation can retry.
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
};

export default connectDB;