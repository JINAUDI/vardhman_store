const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const asyncHandler = require("../utils/asyncHandler");
const buildPagination = require("../utils/buildPagination");
const { createShiprocketOrder, isShiprocketConfigured } = require("../services/shiprocketService");

function ensureObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("Invalid resource id");
    error.statusCode = 400;
    throw error;
  }
}

function generateOrderId() {
  return `RAD-${Date.now().toString().slice(-8)}`;
}

function validateCustomer(customer) {
  const requiredFields = ["firstName", "lastName", "email", "phone", "addressLine1", "city", "state", "country", "zipCode"];
  const missingFields = requiredFields.filter(field => !customer || !customer[field]);

  if (missingFields.length > 0) {
    const error = new Error(`Missing customer fields: ${missingFields.join(", ")}`);
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

async function restoreOrderStock(order, note = "Order cancelled") {
  if (!order || order.stockRestoredAt) {
    return;
  }

  await Promise.all(
    order.products.map(async item => {
      const product = await Product.findById(item.product);
      if (!product || product.track_inventory === false) return;

      product.stock = Number(product.stock || 0) + Number(item.quantity || 0);
      product.inventory_status = deriveInventoryStatus(product);
      await product.save();
    })
  );

  order.stockRestoredAt = new Date();
  order.cancellationReason = note || order.cancellationReason || "";
}

exports.listOrders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = buildPagination(req.query);
  const filter = {};

  if (req.query.status) {
    filter.status = req.query.status;
  }

  if (req.query.email) {
    filter["customer.email"] = req.query.email.toLowerCase();
  }

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Order.countDocuments(filter)
  ]);

  res.json({
    items: orders,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});

exports.createOrder = asyncHandler(async (req, res) => {
  const productsPayload = Array.isArray(req.body.products) ? req.body.products : [];
  validateCustomer(req.body.customer);

  if (productsPayload.length === 0) {
    res.status(400);
    throw new Error("At least one order item is required");
  }

  const productIds = productsPayload.map(item => item.productId);
  const dbProducts = await Product.find({ _id: { $in: productIds }, visible: true });
  const productMap = new Map(dbProducts.map(product => [String(product._id), product]));

  const orderItems = productsPayload.map(item => {
    const product = productMap.get(String(item.productId));
    const quantity = Number(item.quantity) || 0;

    if (!product) {
      const error = new Error(`Product not found or unavailable: ${item.productId}`);
      error.statusCode = 400;
      throw error;
    }

    if (quantity < 1) {
      const error = new Error(`Invalid quantity for product ${product.name}`);
      error.statusCode = 400;
      throw error;
    }

    const availableStock = Math.max(Number(product.stock || 0) - Number(product.reserved_stock || 0), 0);
    if (product.track_inventory !== false && product.allow_backorder !== true && availableStock < quantity) {
      const error = new Error(`Insufficient stock for ${product.name}`);
      error.statusCode = 400;
      throw error;
    }

    return {
      product: product._id,
      name: product.name,
      price: product.price,
      quantity,
      image: product.image_url || product.image
    };
  });

  const subtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const requestedDiscount = Math.max(0, Number(req.body?.pricing?.discount) || 0);
  const discountTotal = Math.min(subtotal, requestedDiscount);
  const total = Math.max(0, subtotal - discountTotal);
  const discountPayload = discountTotal > 0 && req.body.discount ? {
    code: req.body.discount.code,
    title: req.body.discount.title,
    discountAmount: discountTotal
  } : undefined;

  const order = await Order.create({
    orderId: generateOrderId(),
    products: orderItems,
    subtotal,
    discountTotal,
    discount: discountPayload,
    total,
    customer: req.body.customer,
    stockDeductedAt: new Date()
  });

  await Promise.all(
    orderItems.map(async item => {
      const product = await Product.findById(item.product);
      if (!product || product.track_inventory === false) return;

      product.stock = product.allow_backorder ? Number(product.stock || 0) - item.quantity : Math.max(Number(product.stock || 0) - item.quantity, 0);
      product.inventory_status = deriveInventoryStatus(product);
      await product.save();
    })
  );

  if (isShiprocketConfigured()) {
    try {
      const shiprocketResult = await createShiprocketOrder({
        order: Object.assign(order.toObject(), {
          paymentMethod: req.body.paymentMethod || req.body.payment_method || "cash_on_delivery"
        })
      });
      order.shippingProvider = {
        name: "shiprocket",
        status: "created",
        orderId: shiprocketResult.summary.shiprocketOrderId,
        shipmentId: shiprocketResult.summary.shipmentId,
        awbCode: shiprocketResult.summary.awbCode,
        courierName: shiprocketResult.summary.courierName,
        syncedAt: new Date(),
        response: shiprocketResult.response
      };
      await order.save();
    } catch (error) {
      console.warn("[Shiprocket] Order sync failed:", error.message);
      order.shippingProvider = {
        name: "shiprocket",
        status: "failed",
        syncedAt: new Date(),
        errorMessage: error.message
      };
      await order.save();
    }
  }

  res.status(201).json(order);
});

exports.updateOrder = asyncHandler(async (req, res) => {
  ensureObjectId(req.params.id);

  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (req.body.status) {
    const allowedStatuses = ["pending", "shipped", "delivered", "cancelled", "refunded", "returned"];
    if (!allowedStatuses.includes(req.body.status)) {
      res.status(400);
      throw new Error("Invalid order status");
    }

    const previousStatus = order.status;
    order.status = req.body.status;

    const cancelledBeforeShipped = req.body.status === "cancelled" && !["shipped", "delivered"].includes(previousStatus);
    const restockReturn = ["refunded", "returned"].includes(req.body.status) && req.body.restock === true;

    if ((cancelledBeforeShipped || restockReturn) && !order.stockRestoredAt) {
      await restoreOrderStock(order, req.body.cancellation_reason || req.body.note || `Order marked ${req.body.status}`);
    }
  }

  await order.save();
  res.json(order);
});
