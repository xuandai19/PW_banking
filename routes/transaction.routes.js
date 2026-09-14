const express = require("express");
const router = express.Router();
const accountController = require("../controllers/AccountController");
const transactionController = require("../controllers/TransactionController");
const { authenticate, requireRole } = require("../middlewares/authMiddleware");

router.use(authenticate);
router.get("/", transactionController.getAll);
router.get("/account/:id", transactionController.getByAccount);
router.post("/deposit", requireRole("ADMIN", "SUBADMIN", "EMPLOYEE", "BANK", "BRANCH"), (req, res) => accountController.deposit(req, res));
router.post("/withdraw", requireRole("ADMIN", "SUBADMIN", "EMPLOYEE", "BANK", "BRANCH"), (req, res) => accountController.withdraw(req, res));
router.post("/transfer", requireRole("ADMIN", "SUBADMIN", "EMPLOYEE", "BANK", "BRANCH"), (req, res) => accountController.transfer(req, res));

module.exports = router;
