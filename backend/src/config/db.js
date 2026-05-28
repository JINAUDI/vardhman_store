const mongoose = require("mongoose");

async function connectDatabase(mongoUri, options = {}) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri, options);
  console.log("[db] MongoDB connected");
}

module.exports = {
  connectDatabase
};
