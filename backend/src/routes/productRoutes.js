const express = require("express");
const productController = require("../controllers/productController");

const router = express.Router();

router
  .route("/")
  .get(productController.listProducts)
  .post(productController.createProduct);

router
  .route("/:id")
  .get(productController.getProductById)
  .put(productController.updateProduct)
  .delete(productController.deleteProduct);

router.put("/:id/visibility", productController.toggleProductVisibility);

module.exports = router;
