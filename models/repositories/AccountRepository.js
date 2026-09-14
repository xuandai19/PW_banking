const { query } = require("../../config/db");

function removeVietnameseTones(str) {
    return String(str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D");
}

function mapRow(row) {
    if (!row) return null;
    const account = {
        id: row.id,
        accountNumber: row.account_number,
        ownerName: row.owner_name,
        balance: Number(row.balance),
        status: row.status,
        branchId: row.branch_id,
        bankId: row.bank_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        transactions: [],
        updateTime() {
            this.updatedAt = new Date();
        }
    };
    return account;
}

class AccountRepository {

    async create(account) {
        const existing = await this.findByAccountNumber(account.accountNumber);
        if (existing) {
            throw new Error("Số tài khoản đã tồn tại.");
        }
        const result = await query(
            `INSERT INTO accounts
             (account_number, owner_name, balance, status, branch_id, bank_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                account.accountNumber,
                account.ownerName,
                account.balance || 0,
                account.status || "ACTIVE",
                account.branchId || null,
                account.bankId || null
            ]
        );
        account.id = result.insertId;
        return this.findById(account.id);
    }

    async findAll() {
        const rows = await query("SELECT * FROM accounts ORDER BY id ASC");
        return rows.map(mapRow);
    }

    async findById(id) {
        const rows = await query("SELECT * FROM accounts WHERE id = ? LIMIT 1", [id]);
        return mapRow(rows[0]);
    }

    async findByBankId(bankId) {
        const rows = await query("SELECT * FROM accounts WHERE bank_id = ? ORDER BY id ASC", [bankId]);
        return rows.map(mapRow);
    }

    async findByBranchId(branchId) {
        const rows = await query("SELECT * FROM accounts WHERE branch_id = ? ORDER BY id ASC", [branchId]);
        return rows.map(mapRow);
    }

    async findByAccountNumber(accountNumber) {
        const rows = await query(
            "SELECT * FROM accounts WHERE account_number = ? LIMIT 1",
            [accountNumber]
        );
        return mapRow(rows[0]);
    }

    async getNextId() {
        const rows = await query("SELECT IFNULL(MAX(id), 0) + 1 AS nextId FROM accounts");
        return rows[0].nextId;
    }

    async update(account) {
        await query(
            `UPDATE accounts SET
               account_number = ?, owner_name = ?, balance = ?, status = ?,
               branch_id = ?, bank_id = ?
             WHERE id = ?`,
            [
                account.accountNumber,
                account.ownerName,
                account.balance,
                account.status || "ACTIVE",
                account.branchId || null,
                account.bankId || null,
                account.id
            ]
        );
        return this.findById(account.id);
    }

    async findByIdWithConnection(conn, id) {
        const [rows] = await conn.query("SELECT * FROM accounts WHERE id = ? LIMIT 1 FOR UPDATE", [id]);
        return mapRow(rows[0]);
    }

    async updateWithConnection(conn, account) {
        await conn.query(
            `UPDATE accounts SET account_number=?, owner_name=?, balance=?, status=?, branch_id=?, bank_id=? WHERE id=?`,
            [account.accountNumber, account.ownerName, account.balance, account.status || "ACTIVE", account.branchId || null, account.bankId || null, account.id]
        );
    }

    async delete(id) {
        await query("DELETE FROM accounts WHERE id = ?", [id]);
    }

    async resetAutoIncrement() {
        const rows = await query("SELECT IFNULL(MAX(id), 0) + 1 AS nextId FROM accounts");
        await query("ALTER TABLE accounts AUTO_INCREMENT = " + Number(rows[0].nextId));
    }

    async search(keyword) {
        const all = await this.findAll();
        const k = removeVietnameseTones(keyword).toLowerCase();
        if (!k) return all;
        return all.filter(a => {
            const num = removeVietnameseTones(a.accountNumber).toLowerCase();
            const owner = removeVietnameseTones(a.ownerName).toLowerCase();
            return num.includes(k) || owner.includes(k);
        });
    }
}

module.exports = new AccountRepository();
