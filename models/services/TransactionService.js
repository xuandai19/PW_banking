const Transaction = require("../entities/Transaction");
const transactionRepository = require("../repositories/TransactionRepository");

class TransactionService {

    async create(data) {
        const tx = new Transaction(
            null,
            data.type,
            data.amount,
            data.fromAccountId || null,
            data.toAccountId || null,
            data.accountId || null,
            data.branchId || null,
            data.bankId || null,
            data.description || null
        );
        return transactionRepository.create(tx);
    }

    async createWithConnection(conn, data) {
        const tx = new Transaction(
            null,
            data.type,
            data.amount,
            data.fromAccountId || null,
            data.toAccountId || null,
            data.accountId || null,
            data.branchId || null,
            data.bankId || null,
            data.description || null
        );
        return transactionRepository.createWithConnection(conn, tx);
    }

    async findAll() {
        return transactionRepository.findAll();
    }

    async findById(id) {
        return transactionRepository.findById(id);
    }

    async findByAccountId(accountId) { return transactionRepository.findByAccountId(accountId); }
    async findByBankId(bankId) { return transactionRepository.findByBankId(bankId); }
    async findByBranchId(branchId) { return transactionRepository.findByBranchId(branchId); }
}

module.exports = new TransactionService();
