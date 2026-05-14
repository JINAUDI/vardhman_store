const express = require("express");
const orderController = require("../controllers/orderController");

const router = express.Router();

router
  .route("/")
  .get(orderController.listOrders)
  .post(orderController.createOrder);

router.put("/:id", orderController.updateOrder);

module.exports = router;
