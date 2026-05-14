const mongoose = require("mongoose");

const collectionConditionSchema = new mongoose.Schema(
  {
    field: { type: String, trim: true, default: "" },
    operator: { type: String, trim: true, default: "equals" },
    value: { type: String, trim: true, default: "" }
  },
  { _id: false }
);

const collectionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    status: {
      type: String,
      trim: true,
      default: "draft"
    },
    collectionType: {
      type: String,
      trim: true,
      default: "manual"
    },
    productIds: {
      type: [String],
      default: []
    },
    conditionsMatch: {
      type: String,
      trim: true,
      default: "all"
    },
    conditions: {
      type: [collectionConditionSchema],
      default: []
    }
  },
  {
    timestamps: true,
    strict: false
  }
);

collectionSchema.index({ slug: 1, status: 1 });

module.exports = mongoose.model("Collection", collectionSchema);
