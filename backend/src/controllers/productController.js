const mongoose = require("mongoose");
const Product = require("../models/Product");
const asyncHandler = require("../utils/asyncHandler");
const buildPagination = require("../utils/buildPagination");

function validateProductPayload(body, isPartial = false) {
  const requiredFields = ["name", "price", "sku", "stock", "category", "description"];
  const missingFields = requiredFields.filter(field => !isPartial && (body[field] === undefined || body[field] === ""));

  if (!isPartial && !body.image && !body.image_url) {
    missingFields.push("image");
  }

  if (missingFields.length > 0) {
    const error = new Error(`Missing required fields: ${missingFields.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }

  if (body.price !== undefined && Number(body.price) < 0) {
    const error = new Error("Price must be 0 or greater");
    error.statusCode = 400;
    throw error;
  }

  if (body.stock !== undefined && Number(body.stock) < 0) {
    const error = new Error("Stock must be 0 or greater");
    error.statusCode = 400;
    throw error;
  }
}

function deriveInventoryStatus(product) {
  if (product.track_inventory === false) {
    return "not_tracked";
  }

  const availableStock = Math.max((Number(product.stock) || 0) - (Number(product.reserved_stock) || 0), 0);
  const threshold = Number(product.low_stock_threshold) || 5;

  if (availableStock <= 0 && product.allow_backorder !== true) {
    return "out_of_stock";
  }

  if (availableStock > 0 && availableStock <= threshold) {
    return "low_stock";
  }

  return "in_stock";
}

function ensureObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("Invalid resource id");
    error.statusCode = 400;
    throw error;
  }
}

exports.listProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query);
  const filter = {};
  const trimmedSearch = (req.query.search || "").trim();
  const includeHidden = req.query.includeHidden === "true";

  if (!includeHidden) {
    filter.visible = true;
  }

  if (req.query.category) {
    filter.category = req.query.category;
  }

  if (trimmedSearch) {
    filter.$or = [
      { name: { $regex: trimmedSearch, $options: "i" } },
      { sku: { $regex: trimmedSearch, $options: "i" } }
    ];
  }

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Product.countDocuments(filter)
  ]);

  res.json({
    items: products,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});

exports.getProductById = asyncHandler(async (req, res) => {
  console.log(`[products] GET /api/products/${req.params.id}`);
  ensureObjectId(req.params.id);
  const product = await Product.findById(req.params.id);

  if (!product) {
    console.log(`[products] Product not found for id ${req.params.id}`);
    res.status(404);
    throw new Error("Product not found");
  }

  console.log(`[products] Product found: ${product._id} (${product.name})`);
  res.json(product);
});

exports.createProduct = asyncHandler(async (req, res) => {
  validateProductPayload(req.body);
  const productImage = req.body.image || req.body.image_url || "";

  const product = await Product.create({
    name: req.body.name,
    price: Number(req.body.price),
    sku: req.body.sku,
    stock: Number(req.body.stock),
    category: req.body.category,
    image: productImage,
    image_url: req.body.image_url || productImage,
    images: Array.isArray(req.body.images) ? req.body.images : [],
    low_stock_threshold: req.body.low_stock_threshold !== undefined ? Number(req.body.low_stock_threshold) : 5,
    track_inventory: req.body.track_inventory !== undefined ? Boolean(req.body.track_inventory) : true,
    allow_backorder: req.body.allow_backorder !== undefined ? Boolean(req.body.allow_backorder) : false,
    description: req.body.description,
    visible: req.body.visible !== undefined ? Boolean(req.body.visible) : true
  });

  product.inventory_status = deriveInventoryStatus(product);
  await product.save();

  res.status(201).json(product);
});

exports.updateProduct = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id);
  validateProductPayload(req.body, true);

  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const updatableFields = ["name", "price", "sku", "stock", "reserved_stock", "low_stock_threshold", "track_inventory", "allow_backorder", "category", "image", "image_url", "images", "description", "visible"];
  updatableFields.forEach(field => {
    if (req.body[field] !== undefined) {
      if (field === "price" || field === "stock" || field === "reserved_stock" || field === "low_stock_threshold") {
        product[field] = Number(req.body[field]);
      } else if (field === "images") {
        product[field] = Array.isArray(req.body[field]) ? req.body[field] : [];
      } else {
        product[field] = req.body[field];
      }
    }
  });

  product.inventory_status = deriveInventoryStatus(product);

  await product.save();
  res.json(product);
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id);
  const product = await Product.findByIdAndDelete(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  res.json({ message: "Product deleted successfully" });
});

exports.toggleProductVisibility = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id);

  if (typeof req.body.visible !== "boolean") {
    res.status(400);
    throw new Error("visible must be a boolean");
  }

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    { visible: req.body.visible },
    { new: true, runValidators: true }
  );

  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  res.json(product);
});
