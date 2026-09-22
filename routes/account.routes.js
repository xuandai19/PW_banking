const express = require("express");
const router = express.Router();

const accountController = require("../controllers/AccountController");
const { authenticate, requireRole } = require("../middlewares/authMiddleware");

router.use(authenticate);

router.get("/", accountController.getAll);
router.get("/:id", accountController.getById);
router.post("/", requireRole("ADMIN", "SUBADMIN", "EMPLOYEE", "BANK", "BRANCH"), accountController.create);
router.put("/:id", requireRole("ADMIN", "SUBADMIN", "EMPLOYEE", "BANK", "BRANCH"), accountController.update);
router.delete("/:id", requireRole("ADMIN", "SUBADMIN", "EMPLOYEE", "BANK", "BRANCH"), accountController.remove);

module.exports = router;
