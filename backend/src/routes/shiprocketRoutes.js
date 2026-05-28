const express = require("express");
const shiprocketController = require("../controllers/shiprocketController");

const router = express.Router();

router.get("/config", shiprocketController.getConfigStatus);
router.post("/orders", shiprocketController.createOrder);

module.exports = router;
