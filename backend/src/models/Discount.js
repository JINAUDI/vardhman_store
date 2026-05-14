const mongoose = require("mongoose");

const discountSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      sparse: true
    },
    method: {
      type: String,
      trim: true,
      default: "code"
    },
    status: {
      type: String,
      trim: true,
      default: "draft"
    },
    discountCategory: {
      type: String,
      trim: true,
      required: true
    },
    type: {
      type: String,
      trim: true,
      default: "percentage"
    },
    value: {
      type: Number,
      default: 0,
      min: 0
    },
    maxDiscount: {
      type: Number,
      default: 0,
      min: 0
    },
    startsAt: {
      type: Date
    },
    endsAt: {
      type: Date
    },
    expiresAt: {
      type: Date
    },
    requirementType: {
      type: String,
      trim: true,
      default: ""
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    minQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    buyQuantity: {
      type: Number,
      default: 1,
      min: 1
    },
    getQuantity: {
      type: Number,
      default: 1,
      min: 1
    },
    targetScope: {
      type: String,
      trim: true,
      default: "all_products"
    },
    buyTargetScope: {
      type: String,
      trim: true,
      default: "all_products"
    },
    getTargetScope: {
      type: String,
      trim: true,
      default: "all_products"
    },
    targetProductIds: {
      type: [String],
      default: []
    },
    selectedProductIds: {
      type: [String],
      default: []
    },
    buyProductIds: {
      type: [String],
      default: []
    },
    getProductIds: {
      type: [String],
      default: []
    },
    targetCollectionIds: {
      type: [String],
      default: []
    },
    buyCollectionIds: {
      type: [String],
      default: []
    },
    getCollectionIds: {
      type: [String],
      default: []
    },
    targetCategorySlugs: {
      type: [String],
      default: []
    },
    buyCategorySlugs: {
      type: [String],
      default: []
    },
    getCategorySlugs: {
      type: [String],
      default: []
    },
    combinesWithProductDiscounts: {
      type: Boolean,
      default: false
    },
    combinesWithOrderDiscounts: {
      type: Boolean,
      default: false
    },
    combinesWithShippingDiscounts: {
      type: Boolean,
      default: false
    },
    autoApply: {
      type: Boolean,
      default: true
    },
    appliesAutomatically: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    strict: false
  }
);

discountSchema.index({ status: 1, method: 1, discountCategory: 1, code: 1 });

module.exports = mongoose.model("Discount", discountSchema);
