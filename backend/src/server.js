const app = require("./app");
const env = require("./config/env");
const { connectDatabase } = require("./config/db");

async function startServer() {
  await connectDatabase(env.mongoUri);

  app.listen(env.port, () => {
    console.log(`[server] Radios API running on port ${env.port}`);
  });
}

startServer().catch(error => {
  console.error("[server] Failed to start", error);
  process.exit(1);
});
