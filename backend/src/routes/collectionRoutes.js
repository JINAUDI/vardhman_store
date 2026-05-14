const express = require("express");
const collectionController = require("../controllers/collectionController");

const router = express.Router();

router
  .route("/")
  .get(collectionController.listCollections)
  .post(collectionController.createCollection);

router
  .route("/:id")
  .get(collectionController.getCollectionById)
  .put(collectionController.updateCollection)
  .delete(collectionController.deleteCollection);

module.exports = router;
