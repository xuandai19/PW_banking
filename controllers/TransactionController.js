const transactionService = require("../models/services/TransactionService");
const accountService = require("../models/services/AccountService");

class TransactionController {

    async findAll(req, res) {
        try {
            let list;
            if (req.user.role === "BANK") list = await transactionService.findByBankId(req.user.bankId);
            else if (req.user.role === "BRANCH") list = await transactionService.findByBranchId(req.user.branchId);
            else list = await transactionService.findAll();
            res.json(list);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async findById(req, res) {
        try {
            const tx = await transactionService.findById(Number(req.params.id));
            if (req.user.role === "BANK" && Number(tx?.bankId) !== Number(req.user.bankId)) return res.status(403).json({ message: "Không có quyền xem giao dịch này." });
            if (req.user.role === "BRANCH" && Number(tx?.branchId) !== Number(req.user.branchId)) return res.status(403).json({ message: "Không có quyền xem giao dịch này." });
            if (!tx) return res.status(404).json({ message: "Không tìm thấy giao dịch." });
            res.json(tx);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async deposit(req, res) {
        try {
            const { accountId, amount } = req.body;
            const account = await accountService.deposit(Number(accountId), Number(amount));
            res.json(account);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async withdraw(req, res) {
        try {
            const { accountId, amount } = req.body;
            const account = await accountService.withdraw(Number(accountId), Number(amount));
            res.json(account);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async transfer(req, res) {
        try {
            const { fromAccountId, toAccountId, amount } = req.body;
            const result = await accountService.transfer(
                Number(fromAccountId),
                Number(toAccountId),
                Number(amount)
            );
            res.json(result);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
}


TransactionController.prototype.getAll = TransactionController.prototype.findAll;
TransactionController.prototype.getByAccount = async function(req, res) {
    try {
        const account = await accountService.findById(Number(req.params.id));
        if (req.user.role === "BANK" && Number(account?.bankId) !== Number(req.user.bankId)) return res.status(403).json({ message: "Không có quyền xem tài khoản này." });
        if (req.user.role === "BRANCH" && Number(account?.branchId) !== Number(req.user.branchId)) return res.status(403).json({ message: "Không có quyền xem tài khoản này." });
        const list = await transactionService.findByAccountId(Number(req.params.id));
        res.json(list);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = new TransactionController();
