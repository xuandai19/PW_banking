const express = require("express");
const router = express.Router();
const branchController = require("../controllers/BranchController");
const { authenticate, requireRole } = require("../middlewares/authMiddleware");

router.use(authenticate);

router.get("/", branchController.getAll);
router.get("/:id", branchController.getById);
router.get(
    "/:id/accounts",
    branchController.getAccounts
);
router.post("/", requireRole("ADMIN", "SUBADMIN", "BANK"), branchController.create);
router.put("/:id", requireRole("ADMIN", "SUBADMIN", "BANK"), branchController.update);
router.delete("/:id", requireRole("ADMIN", "SUBADMIN", "BANK"), branchController.remove);

module.exports = router;
