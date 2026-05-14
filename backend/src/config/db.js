const mongoose = require("mongoose");

async function connectDatabase(mongoUri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri);
  console.log("[db] MongoDB connected");
}

module.exports = {
  connectDatabase
};
