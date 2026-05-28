const asyncHandler = require("../utils/asyncHandler");
const {
  createShiprocketOrder,
  getShiprocketConfigStatus
} = require("../services/shiprocketService");
const {
  syncSupabaseOrderShiprocketFailure,
  syncSupabaseOrderShiprocketSuccess
} = require("../services/supabaseOrderService");

exports.getConfigStatus = asyncHandler(async (_req, res) => {
  res.json(getShiprocketConfigStatus());
});

exports.createOrder = asyncHandler(async (req, res) => {
  const order = req.body.order || req.body;
  const createdOrder = req.body.createdOrder || req.body.supabaseOrder || req.body.created_order || {};

  try {
    const result = await createShiprocketOrder({ order, createdOrder });

    try {
      await syncSupabaseOrderShiprocketSuccess(createdOrder, result.summary);
    } catch (syncError) {
      console.warn("[Shiprocket] Supabase shipping sync failed:", syncError.message);
    }

    res.status(201).json({
      status: "success",
      message: "Order sent to Shiprocket.",
      data: result.summary
    });
  } catch (error) {
    try {
      await syncSupabaseOrderShiprocketFailure(createdOrder, error);
    } catch (syncError) {
      console.warn("[Shiprocket] Supabase failure sync failed:", syncError.message);
    }

    throw error;
  }
});
