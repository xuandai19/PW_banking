const accountService = require("../models/services/AccountService");
const authorizationService = require("../models/services/AuthorizationService");
const approvalService = require("../models/services/ApprovalService");

class AccountController {

    async assertAccountScope(account, user) {
        if (!account) throw new Error("Không tìm thấy tài khoản.");
        if (user.role === "BANK" && Number(account.bankId) !== Number(user.bankId)) {
            const error = new Error("Bạn không có quyền thao tác trên tài khoản này."); error.status = 403; throw error;
        }
        if (user.role === "BRANCH" && Number(account.branchId) !== Number(user.branchId)) {
            const error = new Error("Bạn không có quyền thao tác trên tài khoản này."); error.status = 403; throw error;
        }
    }

    async create(req, res) {
        try {
            const { accountNumber, ownerName, balance, branchId, status, email } = req.body;
            if (!email || !String(email).trim()) {
                return res.status(400).json({ message: "Email khách hàng là bắt buộc." });
            }
            const branchService = require("../models/services/BranchService");
            const branch = await branchService.findById(Number(branchId));
            if (!branch) return res.status(400).json({ message: "Tài khoản bắt buộc phải thuộc một Branch hợp lệ." });
            if (req.user.role === "BANK" && Number(branch.bankId) !== Number(req.user.bankId)) return res.status(403).json({ message: "Bank chỉ được tạo Account thuộc Bank của mình." });
            if (req.user.role === "BRANCH" && Number(branch.id) !== Number(req.user.branchId)) return res.status(403).json({ message: "Branch chỉ được tạo Account thuộc Branch của mình." });

            if (authorizationService.requiresApproval("CREATE_ACCOUNT", req.user)) {
                const request = await approvalService.queue({
                    type: "CREATE_ACCOUNT",
                    description: `Tạo tài khoản ${accountNumber}`,
                    requestedBy: req.user.username,
                    requestedRole: req.user.role,
                    payload: { accountNumber, ownerName, balance, branchId, status, email }
                });
                return res.status(202).json({
                    message: "Yêu cầu tạo tài khoản đã gửi chờ duyệt.",
                    request
                });
            }

            const account = await accountService.create({
                accountNumber,
                ownerName,
                balance,
                branchId,
                status,
                email
            });
            res.status(201).json(account);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async findAll(req, res) {
        try {
            const keyword = req.query.keyword;
            let accounts;
            if (req.user.role === "BANK") accounts = await accountService.findByBankId(req.user.bankId);
            else if (req.user.role === "BRANCH") accounts = await accountService.findByBranchId(req.user.branchId);
            else accounts = keyword ? await accountService.search(keyword) : await accountService.findAll();
            if (keyword) {
                const k = String(keyword).toLowerCase();
                accounts = accounts.filter(a => `${a.accountNumber} ${a.ownerName}`.toLowerCase().includes(k));
            }
            res.json(accounts);
        } catch (error) { res.status(500).json({ message: error.message }); }
    }

    async findById(req, res) {
        try {
            const account = await accountService.findById(Number(req.params.id));
            if (req.user.role === "BANK" && Number(account?.bankId) !== Number(req.user.bankId)) return res.status(403).json({ message: "Không có quyền xem tài khoản này." });
            if (req.user.role === "BRANCH" && Number(account?.branchId) !== Number(req.user.branchId)) return res.status(403).json({ message: "Không có quyền xem tài khoản này." });
            if (!account) return res.status(404).json({ message: "Không tìm thấy tài khoản." });
            res.json(account);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async update(req, res) {
        try {
            const id = Number(req.params.id);
            const current = await accountService.findById(id);
            if (!current) return res.status(404).json({ message: "Không tìm thấy tài khoản." });
            if (req.user.role === "BANK" && Number(current.bankId) !== Number(req.user.bankId)) return res.status(403).json({ message: "Bank chỉ được sửa Account thuộc Bank của mình." });
            if (req.user.role === "BRANCH" && Number(current.branchId) !== Number(req.user.branchId)) return res.status(403).json({ message: "Branch chỉ được sửa Account thuộc Branch của mình." });
            if (req.user.role === "BANK" && req.body.branchId !== undefined) {
                const targetBranch = await require("../models/services/BranchService").findById(Number(req.body.branchId));
                if (!targetBranch || Number(targetBranch.bankId) !== Number(req.user.bankId)) return res.status(403).json({ message: "Branch mới phải thuộc Bank của bạn." });
            }
            if (req.user.role === "BRANCH" && req.body.branchId !== undefined && Number(req.body.branchId) !== Number(req.user.branchId)) return res.status(403).json({ message: "Không được chuyển Account sang Branch khác." });

            if (authorizationService.requiresApproval("UPDATE_ACCOUNT", req.user)) {
                const request = await approvalService.queue({
                    type: "UPDATE_ACCOUNT",
                    description: `Cập nhật tài khoản #${id}`,
                    requestedBy: req.user.username,
                    requestedRole: req.user.role,
                    payload: { id, data: req.body }
                });
                return res.status(202).json({
                    message: "Yêu cầu cập nhật tài khoản đã gửi chờ duyệt.",
                    request
                });
            }

            const account = await accountService.update(id, req.body);
            res.json(account);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async delete(req, res) {
        try {
            const id = Number(req.params.id);
            const current = await accountService.findById(id);
            if (!current) return res.status(404).json({ message: "Không tìm thấy tài khoản." });
            if (req.user.role === "BANK" && Number(current.bankId) !== Number(req.user.bankId)) return res.status(403).json({ message: "Bank chỉ được xóa Account thuộc Bank của mình." });
            if (req.user.role === "BRANCH" && Number(current.branchId) !== Number(req.user.branchId)) return res.status(403).json({ message: "Branch chỉ được xóa Account thuộc Branch của mình." });

            if (authorizationService.requiresApproval("DELETE_ACCOUNT", req.user)) {
                const request = await approvalService.queue({
                    type: "DELETE_ACCOUNT",
                    description: `Xóa tài khoản #${id}`,
                    requestedBy: req.user.username,
                    requestedRole: req.user.role,
                    payload: { id }
                });
                return res.status(202).json({
                    message: "Yêu cầu xóa tài khoản đã gửi chờ duyệt.",
                    request
                });
            }

            await accountService.delete(id);
            res.json({ message: "Đã xóa tài khoản." });
        } catch (error) {
            const status = error.code === "ACCOUNT_HAS_TRANSACTIONS" ? 409 : (error.status || 400);
            res.status(status).json({
                message: error.message,
                code: error.code || "ACCOUNT_DELETE_ERROR"
            });
        }
    }

    async deposit(req, res) {
        try {
            const { amount, description } = req.body;
            // Support both /accounts/:id/deposit and /transactions/deposit (body.accountId)
            const accountId = Number(req.params.id ?? req.body.accountId);
            if (!Number.isFinite(accountId) || accountId <= 0) {
                return res.status(400).json({ message: "Thiếu hoặc sai mã tài khoản (accountId)." });
            }
            const targetAccount = await accountService.findById(accountId);
            await this.assertAccountScope(targetAccount, req.user);

            if (authorizationService.requiresApproval("DEPOSIT", req.user)) {
                const request = await approvalService.queue({
                    type: "DEPOSIT",
                    description: `Nạp ${amount} vào tài khoản #${accountId}`,
                    requestedBy: req.user.username,
                    requestedRole: req.user.role,
                    payload: { accountId, amount, description }
                });
                return res.status(202).json({
                    message: "Yêu cầu nạp tiền đã gửi chờ duyệt.",
                    request
                });
            }

            const account = await accountService.deposit(accountId, amount, description);
            res.json(account);
        } catch (error) {
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    async withdraw(req, res) {
        try {
            const { amount, description } = req.body;
            const accountId = Number(req.params.id ?? req.body.accountId);
            if (!Number.isFinite(accountId) || accountId <= 0) {
                return res.status(400).json({ message: "Thiếu hoặc sai mã tài khoản (accountId)." });
            }
            const targetAccount = await accountService.findById(accountId);
            await this.assertAccountScope(targetAccount, req.user);

            if (authorizationService.requiresApproval("WITHDRAW", req.user)) {
                const request = await approvalService.queue({
                    type: "WITHDRAW",
                    description: `Rút ${amount} từ tài khoản #${accountId}`,
                    requestedBy: req.user.username,
                    requestedRole: req.user.role,
                    payload: { accountId, amount, description }
                });
                return res.status(202).json({
                    message: "Yêu cầu rút tiền đã gửi chờ duyệt.",
                    request
                });
            }

            const account = await accountService.withdraw(accountId, amount, description);
            res.json(account);
        } catch (error) {
            res.status(error.status || 400).json({ message: error.message });
        }
    }

    async transfer(req, res) {
        try {
            const { fromAccountId, toAccountId, amount, description } = req.body;
            const from = await accountService.findById(Number(fromAccountId));
            const to = await accountService.findById(Number(toAccountId));
            // Chỉ cần quyền trên tài khoản nguồn; tài khoản đích có thể thuộc scope khác
            await this.assertAccountScope(from, req.user);

            if (authorizationService.requiresApproval("TRANSFER", req.user)) {
                const request = await approvalService.queue({
                    type: "TRANSFER",
                    description: `Chuyển ${amount} từ tài khoản #${fromAccountId} sang #${toAccountId}`,
                    requestedBy: req.user.username,
                    requestedRole: req.user.role,
                    payload: { fromAccountId, toAccountId, amount, description }
                });
                return res.status(202).json({ message: "Yêu cầu chuyển tiền đã gửi chờ duyệt.", request });
            }

            const result = await accountService.transfer(
                Number(fromAccountId),
                Number(toAccountId),
                Number(amount),
                description
            );
            res.json(result);
        } catch (error) {
            res.status(error.status || 400).json({ message: error.message });
        }
    }
}


AccountController.prototype.getAll = AccountController.prototype.findAll;
AccountController.prototype.getById = AccountController.prototype.findById;
AccountController.prototype.remove = AccountController.prototype.delete;

module.exports = new AccountController();
