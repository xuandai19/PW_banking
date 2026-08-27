const bankService = require("../models/services/BankService");

class BankController {

    async create(req, res) {
        try {
            const { name, code, address } = req.body;
            const bank = await bankService.create(name, code, address);
            res.status(201).json(bank);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async findAll(req, res) {
        try {
            const keyword = req.query.keyword;
            let banks;
            if (["BANK","BRANCH"].includes(req.user.role)) banks = [await bankService.findById(req.user.bankId)].filter(Boolean);
            else banks = keyword ? await bankService.search(keyword) : await bankService.findAll();
            res.json(banks);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async findById(req, res) {
        try {
            const bank = await bankService.findById(Number(req.params.id));
            if (["BANK","BRANCH"].includes(req.user.role) && Number(req.user.bankId) !== Number(req.params.id)) return res.status(403).json({ message: "Bạn chỉ được xem dữ liệu Bank của mình." });
            if (!bank) return res.status(404).json({ message: "Không tìm thấy ngân hàng." });
            res.json(bank);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async update(req, res) {
        try {
            const bank = await bankService.update(Number(req.params.id), req.body);
            res.json(bank);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async delete(req, res) {
        try {
            await bankService.delete(Number(req.params.id));
            res.json({ message: "Đã xóa ngân hàng." });
        } catch (error) {
            const status = error.code === "BANK_HAS_BRANCHES" ? 409 : 400;
            res.status(status).json({
                message: error.message,
                code: error.code || "BANK_DELETE_ERROR",
                branches: error.branches || []
            });
        }
    }

    async getBranches(req, res) {
        try {
            const branchService = require("../models/services/BranchService");
            if (["BANK","BRANCH"].includes(req.user.role) && Number(req.user.bankId) !== Number(req.params.id)) return res.status(403).json({ message: "Bạn chỉ được xem dữ liệu Bank của mình." });
            const branches = await branchService.findByBankId(Number(req.params.id));
            res.json(req.user.role === "BRANCH" ? branches.filter(b => Number(b.id) === Number(req.user.branchId)) : branches);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}


// Aliases cho routes
BankController.prototype.getAll = BankController.prototype.findAll;
BankController.prototype.getById = BankController.prototype.findById;
BankController.prototype.remove = BankController.prototype.delete;
BankController.prototype.getBranchesByBank = BankController.prototype.getBranches;

module.exports = new BankController();
