import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const PLACEHOLDER_MONGODB_URI = "your_mongodb_connection_string_here";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache || {
  conn: null,
  promise: null,
};

global.mongooseCache = cached;

export function isMongoConfigured() {
  return Boolean(
    MONGODB_URI &&
      MONGODB_URI.trim() &&
      MONGODB_URI.trim() !== PLACEHOLDER_MONGODB_URI
  );
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!isMongoConfigured()) {
    throw new Error("MONGODB_URI is not configured with a real MongoDB connection string.");
  }

  if (!cached.promise) {
    const uri = MONGODB_URI as string;
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
