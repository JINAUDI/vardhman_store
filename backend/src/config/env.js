const path = require("path");
const dotenv = require("dotenv");

dotenv.config({
  path: path.resolve(__dirname, "../../.env")
});

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/radios",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5500",
  adminOrigin: process.env.ADMIN_ORIGIN || "http://localhost:3000"
};
