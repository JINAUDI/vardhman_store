const mongoose = require("mongoose");
const Discount = require("../models/Discount");
const asyncHandler = require("../utils/asyncHandler");
const buildPagination = require("../utils/buildPagination");

function ensureObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("Invalid resource id");
    error.statusCode = 400;
    throw error;
  }
}

function normalizeDiscountPayload(body = {}) {
  const payload = { ...body };

  if (payload.code !== undefined) {
    payload.code = String(payload.code || "").trim().toUpperCase();
  }

  [
    "value",
    "maxDiscount",
    "minOrderAmount",
    "minQuantity",
    "buyQuantity",
    "getQuantity"
  ].forEach(field => {
    if (payload[field] !== undefined && payload[field] !== "") {
      payload[field] = Number(payload[field]) || 0;
    }
  });

  return payload;
}

exports.listDiscounts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query);
  const filter = {};

  if (req.query.active === "true") {
    filter.status = "active";
  } else if (req.query.status) {
    filter.status = req.query.status;
  }

  if (req.query.method) {
    filter.method = req.query.method;
  }

  if (req.query.code) {
    filter.code = String(req.query.code).trim().toUpperCase();
  }

  const [discounts, total] = await Promise.all([
    Discount.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Discount.countDocuments(filter)
  ]);

  res.json({
    items: discounts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});

exports.getDiscountById = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id);
  const discount = await Discount.findById(req.params.id);

  if (!discount) {
    res.status(404);
    throw new Error("Discount not found");
  }

  res.json(discount);
});

exports.createDiscount = asyncHandler(async (req, res) => {
  const payload = normalizeDiscountPayload(req.body);

  if (!payload.title || !payload.discountCategory) {
    res.status(400);
    throw new Error("title and discountCategory are required");
  }

  const discount = await Discount.create(payload);
  res.status(201).json(discount);
});

exports.updateDiscount = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id);
  const discount = await Discount.findById(req.params.id);

  if (!discount) {
    res.status(404);
    throw new Error("Discount not found");
  }

  const payload = normalizeDiscountPayload(req.body);
  Object.keys(payload).forEach(key => {
    discount[key] = payload[key];
  });

  await discount.save();
  res.json(discount);
});

exports.deleteDiscount = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id);
  const discount = await Discount.findByIdAndDelete(req.params.id);

  if (!discount) {
    res.status(404);
    throw new Error("Discount not found");
  }

  res.json({ message: "Discount deleted successfully" });
});
