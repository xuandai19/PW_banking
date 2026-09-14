const express = require("express");
const router = express.Router();
const authController = require("../controllers/AuthController");
const { authenticate, requireRole } = require("../middlewares/authMiddleware");

router.get("/test", (req, res) => {
    res.send("Auth route OK");
});

// ===== Công khai (không cần token) =====
router.post("/login", (req, res) => authController.login(req, res));
router.post("/verify-email", (req, res) => authController.verifyEmail(req, res));
router.get("/verify-email", (req, res) => authController.verifyEmail(req, res));
router.post("/forgot-password", (req, res) => authController.forgotPassword(req, res));
router.post("/reset-password", (req, res) => authController.resetPassword(req, res));

// ===== Cần đăng nhập =====
router.get("/me", authenticate, (req, res) => authController.me(req, res));
router.post("/logout", authenticate, (req, res) => authController.logout(req, res));

router.get(
    "/users",
    authenticate,
    requireRole("ADMIN", "SUBADMIN"),
    (req, res) => authController.getUsers(req, res)
);

router.post(
    "/users",
    authenticate,
    requireRole("ADMIN", "SUBADMIN"),
    (req, res) => authController.createUser(req, res)
);

router.put(
    "/users/:id",
    authenticate,
    requireRole("ADMIN"),
    (req, res) => authController.updateUser(req, res)
);

router.delete(
    "/users/:id",
    authenticate,
    requireRole("ADMIN"),
    (req, res) => authController.deleteUser(req, res)
);

module.exports = router;
