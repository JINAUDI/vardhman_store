const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env")
});

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/radios",
  startWithoutMongo: process.env.START_WITHOUT_MONGO === "true",
  mongoServerSelectionTimeoutMs: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || (process.env.START_WITHOUT_MONGO === "true" ? 5000 : 30000)),
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5500",
  adminOrigin: process.env.ADMIN_ORIGIN || "http://localhost:3000",
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  shiprocket: {
    baseUrl: process.env.SHIPROCKET_BASE_URL || "https://apiv2.shiprocket.in/v1/external",
    email: process.env.SHIPROCKET_API_EMAIL || "",
    password: process.env.SHIPROCKET_API_PASSWORD || "",
    pickupLocation: process.env.SHIPROCKET_PICKUP_LOCATION || "",
    channelId: process.env.SHIPROCKET_CHANNEL_ID || "",
    defaultLengthCm: Number(process.env.SHIPROCKET_DEFAULT_LENGTH_CM || 10),
    defaultBreadthCm: Number(process.env.SHIPROCKET_DEFAULT_BREADTH_CM || 10),
    defaultHeightCm: Number(process.env.SHIPROCKET_DEFAULT_HEIGHT_CM || 10),
    defaultWeightKg: Number(process.env.SHIPROCKET_DEFAULT_WEIGHT_KG || 0.5)
  }
};
