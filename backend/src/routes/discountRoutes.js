const express = require("express");
const discountController = require("../controllers/discountController");

const router = express.Router();

router
  .route("/")
  .get(discountController.listDiscounts)
  .post(discountController.createDiscount);

router
  .route("/:id")
  .get(discountController.getDiscountById)
  .put(discountController.updateDiscount)
  .delete(discountController.deleteDiscount);

module.exports = router;
