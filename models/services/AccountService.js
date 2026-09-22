const Account = require("../entities/Account");
const accountRepository = require("../repositories/AccountRepository");
const transactionService = require("./TransactionService");
const { withTransaction } = require("../../config/db");

class AccountService {

    async create(...args) {
        let accountNumber, ownerName, balance = 0, status = "ACTIVE", branchId = null, email = null;

        if (typeof args[0] === "number") {
            accountNumber = args[1];
            ownerName = args[2];
            balance = args[3] || 0;
            branchId = args[4];
            status = args[5] || "ACTIVE";
            email = args[6] || null;
        } else if (typeof args[0] === "object" && args[0] !== null && !Array.isArray(args[0])) {
            ({ accountNumber, ownerName, balance = 0, branchId, status = "ACTIVE", email = null } = args[0]);
        } else {
            accountNumber = args[0];
            ownerName = args[1];
            balance = args[2] || 0;
            branchId = args[3];
            status = args[4] || "ACTIVE";
            email = args[5] || null;
        }

        if (!accountNumber || !ownerName) {
            throw new Error("Thiếu thông tin tài khoản.");
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
            throw new Error("Email khách hàng là bắt buộc và phải hợp lệ.");
        }

        const branchService = require("./BranchService");
        const branch = await branchService.findById(Number(branchId));
        if (!branch) {
            throw new Error("Không tìm thấy chi nhánh.");
        }

        balance = Number(balance);
        if (!Number.isFinite(balance) || balance < 0) throw new Error("Số dư ban đầu không hợp lệ.");

        const account = new Account(
            null,
            String(accountNumber).trim(),
            String(ownerName).trim(),
            balance,
            status,
            Number(branchId),
            Number(branch.bankId)
        );
        account.branchId = Number(branchId);
        account.bankId = Number(branch.bankId);

        const created = await accountRepository.create(account);

        // Tự động tạo login khách hàng (username = số TK, email riêng, mật khẩu mặc định)
        try {
            const customerService = require("./CustomerService");
            const customer = await customerService.createForAccount(created, email);
            created.customerLogin = {
                username: customer.username,
                email: customer.email || String(email).trim().toLowerCase(),
                defaultPassword: customer._defaultPassword || customerService.getDefaultPassword(),
                mustChangePassword: true
            };
        } catch (err) {
            // Rollback account nếu không tạo được customer (bắt buộc có email)
            try {
                await accountRepository.delete(created.id);
            } catch {
                /* ignore */
            }
            throw new Error(err.message || "Không thể tạo tài khoản khách hàng.");
        }

        return created;
    }

    async cleanupOrphanAccounts() {
        const { query } = require("../../config/db");
        const result = await query("DELETE FROM accounts WHERE branch_id IS NULL");
        return result.affectedRows;
    }

    async findAll() {
        return accountRepository.findAll();
    }

    async findById(id) {
        return accountRepository.findById(id);
    }

    async findByBranchId(branchId) { return accountRepository.findByBranchId(branchId); }
    async findByBankId(bankId) { return accountRepository.findByBankId(bankId); }

    async search(keyword) {
        return accountRepository.search(keyword);
    }

    async update(id, data) {
        const account = await accountRepository.findById(id);
        if (!account) throw new Error("Không tìm thấy Account.");

        // Số tài khoản không được thay đổi sau khi tạo
        if (data.accountNumber !== undefined && String(data.accountNumber).trim() !== String(account.accountNumber)) {
            throw new Error("Số tài khoản không được thay đổi.");
        }
        if (data.ownerName) account.ownerName = data.ownerName;
        if (data.status) account.status = data.status;
        // Không cho phép cập nhật số dư trực tiếp — chỉ qua deposit/withdraw/transfer
        if (data.balance !== undefined) {
            throw new Error("Không được sửa số dư trực tiếp. Hãy dùng giao dịch nạp/rút/chuyển tiền.");
        }
        if (data.branchId !== undefined) {
            const branchService = require("./BranchService");
            const branch = await branchService.findById(Number(data.branchId));
            if (!branch) throw new Error("Không tìm thấy chi nhánh.");
            account.branchId = Number(data.branchId);
            account.bankId = Number(branch.bankId);
        }

        return accountRepository.update(account);
    }

    async delete(id) {
        const account = await this.findById(id);
        if (!account) throw new Error("Không tìm thấy tài khoản.");
        try {
            await accountRepository.delete(id);
        } catch (error) {
            if (error.code === "ER_ROW_IS_REFERENCED_2") {
                const e = new Error("Không thể xóa tài khoản vì tài khoản đã có lịch sử giao dịch.");
                e.code = "ACCOUNT_HAS_TRANSACTIONS";
                throw e;
            }
            throw error;
        }
    }

    async deposit(accountId, amount, description) {
        amount = Number(amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Số tiền không hợp lệ.");
        return withTransaction(async (conn) => {
            const account = await accountRepository.findByIdWithConnection(conn, Number(accountId));
            if (!account) throw new Error("Không tìm thấy tài khoản.");
            if (account.status !== "ACTIVE") throw new Error("Tài khoản không ở trạng thái ACTIVE.");
            account.balance = Number(account.balance) + amount;
            await accountRepository.updateWithConnection(conn, account);
            await transactionService.createWithConnection(conn, {
                type: "DEPOSIT", amount, fromAccountId: null, toAccountId: account.id,
                accountId: account.id, branchId: account.branchId, bankId: account.bankId,
                description: description || null
            });
            return account;
        });
    }

    async withdraw(accountId, amount, description) {
        amount = Number(amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Số tiền không hợp lệ.");
        return withTransaction(async (conn) => {
            const account = await accountRepository.findByIdWithConnection(conn, Number(accountId));
            if (!account) throw new Error("Không tìm thấy tài khoản.");
            if (account.status !== "ACTIVE") throw new Error("Tài khoản không ở trạng thái ACTIVE.");
            if (Number(account.balance) < amount) throw new Error("Số dư không đủ.");
            account.balance = Number(account.balance) - amount;
            await accountRepository.updateWithConnection(conn, account);
            await transactionService.createWithConnection(conn, {
                type: "WITHDRAW", amount, fromAccountId: account.id, toAccountId: null,
                accountId: account.id, branchId: account.branchId, bankId: account.bankId,
                description: description || null
            });
            return account;
        });
    }

    async transfer(fromAccountId, toAccountId, amount, description) {
        amount = Number(amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("Số tiền không hợp lệ.");
        if (Number(fromAccountId) === Number(toAccountId)) throw new Error("Tài khoản nguồn và đích không được trùng nhau.");

        return withTransaction(async (conn) => {
            const from = await accountRepository.findByIdWithConnection(conn, Number(fromAccountId));
            const to = await accountRepository.findByIdWithConnection(conn, Number(toAccountId));
            if (!from || !to) throw new Error("Không tìm thấy tài khoản.");
            if (from.status !== "ACTIVE" || to.status !== "ACTIVE") throw new Error("Cả hai tài khoản phải ở trạng thái ACTIVE.");
            if (Number(from.balance) < amount) throw new Error("Số dư không đủ.");

            from.balance = Number(from.balance) - amount;
            to.balance = Number(to.balance) + amount;
            await accountRepository.updateWithConnection(conn, from);
            await accountRepository.updateWithConnection(conn, to);
            // Ghi 1 giao dịch TRANSFER; hiển thị cho cả bên chuyển và bên nhận qua from/to account
            await transactionService.createWithConnection(conn, {
                type: "TRANSFER", amount, fromAccountId: from.id, toAccountId: to.id,
                accountId: from.id, branchId: from.branchId, bankId: from.bankId,
                description: description || null
            });
            return { from, to };
        });
    }

}

module.exports = new AccountService();
