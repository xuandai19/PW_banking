const express = require("express");
const router = express.Router();

const bankController = require("../controllers/BankController");
const { authenticate, requireRole } = require("../middlewares/authMiddleware");

router.use(authenticate);

router.get("/", bankController.getAll);

router.get("/:id/branches", bankController.getBranchesByBank);

router.get("/:id", bankController.getById);

router.post("/", requireRole("ADMIN"), bankController.create);
router.put("/:id", requireRole("ADMIN"), bankController.update);
router.delete("/:id", requireRole("ADMIN"), bankController.remove);

module.exports = router;
