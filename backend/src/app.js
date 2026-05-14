const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { frontendOrigin, adminOrigin, nodeEnv } = require("./config/env");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const collectionRoutes = require("./routes/collectionRoutes");
const discountRoutes = require("./routes/discountRoutes");
const requestLogger = require("./middleware/requestLogger");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

function expandOriginVariants(origin) {
  if (!origin) {
    return [];
  }

  const variants = [origin];

  try {
    const url = new URL(origin);
    const alternateHost = url.hostname === "localhost"
      ? "127.0.0.1"
      : url.hostname === "127.0.0.1"
        ? "localhost"
        : "";

    if (alternateHost) {
      url.hostname = alternateHost;
      variants.push(url.toString().replace(/\/$/, ""));
    }
  } catch (error) {}

  return variants.map(value => value.replace(/\/$/, ""));
}

app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigins = Array.from(new Set(
        expandOriginVariants(frontendOrigin).concat(expandOriginVariants(adminOrigin))
      ));

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

if (nodeEnv !== "production") {
  app.use(morgan("dev"));
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/collections", collectionRoutes);
app.use("/api/discounts", discountRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
