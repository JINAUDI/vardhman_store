const app = require("./app");
const env = require("./config/env");
const { connectDatabase } = require("./config/db");

async function startServer() {
  try {
    await connectDatabase(env.mongoUri, {
      serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs
    });
  } catch (error) {
    if (!env.startWithoutMongo) {
      throw error;
    }

    console.warn(`[db] MongoDB unavailable; starting API without database connection: ${error.message}`);
  }

  app.listen(env.port, () => {
    console.log(`[server] Radios API running on port ${env.port}`);
  });
}

startServer().catch(error => {
  console.error("[server] Failed to start", error);
  process.exit(1);
});
