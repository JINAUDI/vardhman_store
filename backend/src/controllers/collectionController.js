const mongoose = require("mongoose");
const Collection = require("../models/Collection");
const asyncHandler = require("../utils/asyncHandler");
const buildPagination = require("../utils/buildPagination");

function ensureObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("Invalid resource id");
    error.statusCode = 400;
    throw error;
  }
}

exports.listCollections = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query);
  const filter = {};

  if (req.query.active === "true") {
    filter.status = "active";
  } else if (req.query.status) {
    filter.status = req.query.status;
  }

  const [collections, total] = await Promise.all([
    Collection.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Collection.countDocuments(filter)
  ]);

  res.json({
    items: collections,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});

exports.getCollectionById = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id);
  const collection = await Collection.findById(req.params.id);

  if (!collection) {
    res.status(404);
    throw new Error("Collection not found");
  }

  res.json(collection);
});

exports.createCollection = asyncHandler(async (req, res) => {
  if (!req.body.title || !req.body.slug) {
    res.status(400);
    throw new Error("title and slug are required");
  }

  const collection = await Collection.create(req.body);
  res.status(201).json(collection);
});

exports.updateCollection = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id);
  const collection = await Collection.findById(req.params.id);

  if (!collection) {
    res.status(404);
    throw new Error("Collection not found");
  }

  Object.keys(req.body || {}).forEach(key => {
    collection[key] = req.body[key];
  });

  await collection.save();
  res.json(collection);
});

exports.deleteCollection = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id);
  const collection = await Collection.findByIdAndDelete(req.params.id);

  if (!collection) {
    res.status(404);
    throw new Error("Collection not found");
  }

  res.json({ message: "Collection deleted successfully" });
});
