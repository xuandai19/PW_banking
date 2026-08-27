const express = require("express");
const router = express.Router();
const approvalController = require("../controllers/ApprovalController");
const { authenticate, requireRole } = require("../middlewares/authMiddleware");

router.use(authenticate);
router.use(requireRole("ADMIN"));

router.get("/", approvalController.getAll);
router.get("/pending", approvalController.getPending);
router.post("/:id/approve", approvalController.approve);
router.post("/:id/reject", approvalController.reject);

module.exports = router;
