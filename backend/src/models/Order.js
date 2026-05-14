const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true
    },
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
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    image: {
      type: String,
      trim: true
    }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true
    },
    products: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: items => Array.isArray(items) && items.length > 0,
        message: "At least one product is required"
      }
    },
    total: {
      type: Number,
      required: true,
      min: 0
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0
    },
    discountTotal: {
      type: Number,
      default: 0,
      min: 0
    },
    discount: {
      code: { type: String, trim: true, uppercase: true },
      title: { type: String, trim: true, default: "" },
      discountAmount: { type: Number, default: 0, min: 0 }
    },
    status: {
      type: String,
      enum: ["pending", "shipped", "delivered", "cancelled", "refunded", "returned"],
      default: "pending"
    },
    stockDeductedAt: {
      type: Date
    },
    stockRestoredAt: {
      type: Date
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: ""
    },
    customer: {
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true },
      addressLine1: { type: String, required: true, trim: true },
      addressLine2: { type: String, trim: true, default: "" },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      country: { type: String, required: true, trim: true },
      zipCode: { type: String, required: true, trim: true }
    }
  },
  {
    timestamps: true
  }
);

orderSchema.index({ orderId: 1, status: 1, "customer.email": 1 });

module.exports = mongoose.model("Order", orderSchema);
