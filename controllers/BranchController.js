const branchService = require("../models/services/BranchService");
const authorizationService = require("../models/services/AuthorizationService");
const approvalService = require("../models/services/ApprovalService");

class BranchController {

    async create(req, res) {
        try {
            const { name, address, phone } = req.body;
            let bankId = req.body.bankId;
            if (req.user.role === "BANK") bankId = Number(req.user.bankId);
            if (req.user.role === "BRANCH") return res.status(403).json({ message: "Tài khoản Branch không được tạo chi nhánh." });

            if (authorizationService.requiresApproval("CREATE_BRANCH", req.user)) {
                const request = await approvalService.queue({
                    type: "CREATE_BRANCH",
                    description: `Tạo chi nhánh ${name}`,
                    requestedBy: req.user.username,
                    requestedRole: req.user.role,
                    payload: { name, address, phone, bankId }
                });
                return res.status(202).json({
                    message: "Yêu cầu tạo chi nhánh đã gửi chờ duyệt.",
                    request
                });
            }

            const branch = await branchService.create(name, address, phone, bankId);
            res.status(201).json(branch);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async findAll(req, res) {
        try {
            const keyword = req.query.keyword;
            let branches;
            if (req.user.role === "BANK") branches = await branchService.findByBankId(req.user.bankId);
            else if (req.user.role === "BRANCH") branches = [await branchService.findById(req.user.branchId)].filter(Boolean);
            else branches = keyword ? await branchService.search(keyword) : await branchService.findAll();
            if (keyword) {
                const k = String(keyword).toLowerCase();
                branches = branches.filter(b => `${b.name} ${b.address} ${b.phone || ""}`.toLowerCase().includes(k));
            }
            res.json(branches);
        } catch (error) { res.status(500).json({ message: error.message }); }
    }

    async findById(req, res) {
        try {
            const branch = await branchService.findById(Number(req.params.id));
            if (req.user.role === "BANK" && Number(branch?.bankId) !== Number(req.user.bankId)) return res.status(403).json({ message: "Bạn chỉ được xem Branch thuộc Bank của mình." });
            if (req.user.role === "BRANCH" && Number(req.params.id) !== Number(req.user.branchId)) return res.status(403).json({ message: "Bạn chỉ được xem Branch của mình." });
            if (!branch) return res.status(404).json({ message: "Không tìm thấy chi nhánh." });
            res.json(branch);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async update(req, res) {
        try {
            const branchId = Number(req.params.id);
            const existing = await branchService.findById(branchId);
            if (!existing) return res.status(404).json({ message: "Không tìm thấy chi nhánh." });
            if (req.user.role === "BANK" && Number(existing.bankId) !== Number(req.user.bankId)) return res.status(403).json({ message: "Bạn chỉ được quản lý Branch thuộc Bank của mình." });
            if (req.user.role === "BRANCH") return res.status(403).json({ message: "Tài khoản Branch không được sửa chi nhánh." });
            const data = { ...req.body };
            if (req.user.role === "BANK") data.bankId = Number(req.user.bankId);
            const branch = await branchService.update(branchId, data);
            res.json(branch);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async delete(req, res) {
        try {
            const branchId = Number(req.params.id);
            const existing = await branchService.findById(branchId);
            if (!existing) return res.status(404).json({ message: "Không tìm thấy chi nhánh." });
            if (req.user.role === "BANK" && Number(existing.bankId) !== Number(req.user.bankId)) return res.status(403).json({ message: "Bạn chỉ được xóa Branch thuộc Bank của mình." });
            await branchService.delete(branchId);
            res.json({ message: "Đã xóa chi nhánh." });
        } catch (error) {
            const status = error.code === "BRANCH_HAS_ACCOUNTS" ? 409 : 400;
            res.status(status).json({
                message: error.message,
                code: error.code || "BRANCH_DELETE_ERROR",
                accounts: error.accounts || []
            });
        }
    }
}


BranchController.prototype.getAll = BranchController.prototype.findAll;
BranchController.prototype.getById = BranchController.prototype.findById;
BranchController.prototype.remove = BranchController.prototype.delete;
BranchController.prototype.getAccounts = async function(req, res) {
    try {
        const accountService = require("../models/services/AccountService");
        const branch = await branchService.findById(Number(req.params.id));
        if (req.user.role === "BANK" && Number(branch?.bankId) !== Number(req.user.bankId)) return res.status(403).json({ message: "Không có quyền xem Branch này." });
        if (req.user.role === "BRANCH" && Number(req.params.id) !== Number(req.user.branchId)) return res.status(403).json({ message: "Không có quyền xem Branch này." });
        const accounts = await accountService.findByBranchId(Number(req.params.id));
        res.json(accounts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = new BranchController();
