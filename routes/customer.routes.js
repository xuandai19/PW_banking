const express = require("express");
const router = express.Router();
const customerController = require("../controllers/CustomerController");
const {
    authenticateCustomer,
    requireVerified
} = require("../middlewares/customerAuthMiddleware");

// Công khai
router.post("/login", (req, res) => customerController.login(req, res));
router.post("/logout", (req, res) => customerController.logout(req, res));
router.post("/forgot-password", (req, res) => customerController.forgotPassword(req, res));
router.post("/reset-password", (req, res) => customerController.resetPassword(req, res));

// Đăng nhập – xem số dư, xác thực (đổi MK + OTP)
router.get("/me", authenticateCustomer, (req, res) => customerController.me(req, res));
router.get("/balance", authenticateCustomer, (req, res) => customerController.balance(req, res));
router.post("/change-password", authenticateCustomer, (req, res) => customerController.changePassword(req, res));
router.post("/set-otp", authenticateCustomer, (req, res) => customerController.setOtp(req, res));
router.post("/update-email", authenticateCustomer, (req, res) => customerController.updateEmail(req, res));
router.get("/banks", authenticateCustomer, (req, res) => customerController.listBanks(req, res));
router.get("/lookup-recipient", authenticateCustomer, requireVerified, (req, res) => customerController.lookupRecipient(req, res));

// Giao dịch – chỉ tài khoản đã xác thực
router.post("/deposit", authenticateCustomer, requireVerified, (req, res) => customerController.deposit(req, res));
router.post("/withdraw", authenticateCustomer, requireVerified, (req, res) => customerController.withdraw(req, res));
router.post("/transfer", authenticateCustomer, requireVerified, (req, res) => customerController.transfer(req, res));
router.get("/transactions", authenticateCustomer, requireVerified, (req, res) => customerController.transactions(req, res));

module.exports = router;
