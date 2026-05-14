const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    reserved_stock: {
      type: Number,
      min: 0,
      default: 0
    },
    low_stock_threshold: {
      type: Number,
      min: 0,
      default: 5
    },
    track_inventory: {
      type: Boolean,
      default: true
    },
    allow_backorder: {
      type: Boolean,
      default: false
    },
    inventory_status: {
      type: String,
      enum: ["in_stock", "low_stock", "out_of_stock", "not_tracked"],
      default: "in_stock"
    },
    category: {
      type: String,
      required: true,
      trim: true
    },
    image: {
      type: String,
      default: "",
      trim: true
    },
    image_url: {
      type: String,
      default: "",
      trim: true
    },
    images: {
      type: [String],
      default: []
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    visible: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

productSchema.index({ name: "text", sku: "text" });

module.exports = mongoose.model("Product", productSchema);
