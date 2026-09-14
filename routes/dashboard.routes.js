const express = require("express");
const router = express.Router();

const dashboardController = require("../controllers/DashboardController");
const { authenticate } = require("../middlewares/authMiddleware");

router.get("/summary", authenticate, dashboardController.getSummary);

module.exports = router;
