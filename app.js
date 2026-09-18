require("./config/env");
const express = require("express");
const app = express();
const cors = require("cors");
const accountRoutes = require("./routes/account.routes");
const authRoutes = require("./routes/auth.routes");
const branchRoutes = require("./routes/branch.routes");
const transactionRoutes = require("./routes/transaction.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const approvalRoutes = require("./routes/approval.routes");
<<<<<<< HEAD
=======
const customerRoutes = require("./routes/customer.routes");
>>>>>>> feature/v2_user
const { testConnection, ensureSchema } = require("./config/db");
const { initEmail } = require("./utils/email");
const authService = require("./models/services/AuthService");

app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true
}));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (req, res) => {
    try {
        await testConnection();
        res.json({ status: "ok", database: process.env.DB_NAME || "banking_db" });
    } catch (error) {
        res.status(503).json({ status: "error", message: "Database unavailable" });
    }
});

app.use("/api/auth", authRoutes);
<<<<<<< HEAD
=======
app.use("/api/customer", customerRoutes);
>>>>>>> feature/v2_user
app.use("/api/branches", branchRoutes);
app.use("/api/banks", require("./routes/bank.routes"));
app.use("/api/accounts", accountRoutes);
app.use("/api/transactions", require("./routes/transaction.routes"));
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/approvals", approvalRoutes);

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);

    try {
        await testConnection();
        console.log("[MySQL] Connected:", process.env.DB_NAME || "banking_db");
        await ensureSchema();
        await authService.seedDefaultUsers();
        await require("./models/services/AccountService").cleanupOrphanAccounts();
    } catch (err) {
        console.error("[MySQL] Connection failed:", err.message);
        console.error("→ Chạy: node scripts/initDb.js (và kiểm tra DB_USER/DB_PASSWORD)");
    }

    try {
        await initEmail();
    } catch (err) {
        console.warn("[Email] init warning:", err.message);
    }
});
