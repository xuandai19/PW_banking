const bankService = require("../models/services/BankService");
const branchService = require("../models/services/BranchService");
const accountService = require("../models/services/AccountService");
const transactionService = require("../models/services/TransactionService");

class DashboardController {

    async summary(req, res) {
        try {
            let banks, branches, accounts, transactions;
            if (req.user.role === "BANK") {
                banks = [await bankService.findById(req.user.bankId)].filter(Boolean);
                branches = await branchService.findByBankId(req.user.bankId);
                accounts = await accountService.findByBankId(req.user.bankId);
                transactions = await transactionService.findByBankId(req.user.bankId);
            } else if (req.user.role === "BRANCH") {
                branches = [await branchService.findById(req.user.branchId)].filter(Boolean);
                accounts = await accountService.findByBranchId(req.user.branchId);
                transactions = await transactionService.findByBranchId(req.user.branchId);
                banks = [];
            } else {
                [banks, branches, accounts, transactions] = await Promise.all([bankService.findAll(), branchService.findAll(), accountService.findAll(), transactionService.findAll()]);
            }

            res.json({
                totalBanks: banks.length,
                totalBranches: branches.length,
                totalAccounts: accounts.length,
                totalTransactions: transactions.length,
                totalBalance: accounts.reduce(
                    (sum, a) => sum + Number(a.balance || 0),
                    0
                )
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
}


DashboardController.prototype.getSummary = DashboardController.prototype.summary;

module.exports = new DashboardController();
