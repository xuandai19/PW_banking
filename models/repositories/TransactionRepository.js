const { query } = require("../../config/db");

function mapRow(row) {
    if (!row) return null;
    return {
        id: row.id,
        type: row.type,
        amount: Number(row.amount),
        fromAccountId: row.from_account_id,
        toAccountId: row.to_account_id,
        accountId: row.account_id,
        branchId: row.branch_id,
        bankId: row.bank_id,
        description: row.description || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

class TransactionRepository {

    async create(tx) {
        const result = await query(
            `INSERT INTO transactions
             (type, amount, from_account_id, to_account_id, account_id, branch_id, bank_id, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                tx.type,
                tx.amount,
                tx.fromAccountId || null,
                tx.toAccountId || null,
                tx.accountId || null,
                tx.branchId || null,
                tx.bankId || null,
                tx.description || null
            ]
        );
        tx.id = result.insertId;
        return this.findById(tx.id);
    }

    async createWithConnection(conn, tx) {
        const [result] = await conn.query(
            `INSERT INTO transactions (type, amount, from_account_id, to_account_id, account_id, branch_id, bank_id, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [tx.type, tx.amount, tx.fromAccountId || null, tx.toAccountId || null, tx.accountId || null, tx.branchId || null, tx.bankId || null, tx.description || null]
        );
        tx.id = result.insertId;
        const [rows] = await conn.query("SELECT * FROM transactions WHERE id=? LIMIT 1", [tx.id]);
        return mapRow(rows[0]);
    }

    async findAll() {
        const rows = await query("SELECT * FROM transactions ORDER BY id DESC");
        return rows.map(mapRow);
    }

    async findById(id) {
        const rows = await query("SELECT * FROM transactions WHERE id = ? LIMIT 1", [id]);
        return mapRow(rows[0]);
    }

    async findByAccountId(accountId) {
        const rows = await query(
            `SELECT * FROM transactions
             WHERE account_id = ? OR from_account_id = ? OR to_account_id = ?
             ORDER BY id DESC`,
            [accountId, accountId, accountId]
        );
        return rows.map(mapRow);
    }

    /**
     * Giao dịch thuộc bank: bank_id khớp HOẶC liên quan tài khoản thuộc bank
     * (để bên nhận TRANSFER vẫn thấy khi đăng nhập role BANK).
     */
    async findByBankId(bankId) {
        const rows = await query(
            `SELECT DISTINCT t.* FROM transactions t
             LEFT JOIN accounts a_from ON t.from_account_id = a_from.id
             LEFT JOIN accounts a_to   ON t.to_account_id   = a_to.id
             LEFT JOIN accounts a_acc  ON t.account_id      = a_acc.id
             WHERE t.bank_id = ?
                OR a_from.bank_id = ?
                OR a_to.bank_id = ?
                OR a_acc.bank_id = ?
             ORDER BY t.id DESC`,
            [bankId, bankId, bankId, bankId]
        );
        return rows.map(mapRow);
    }

    /**
     * Giao dịch thuộc branch: branch_id khớp HOẶC liên quan tài khoản thuộc branch
     * (để bên nhận TRANSFER vẫn thấy khi đăng nhập role BRANCH).
     */
    async findByBranchId(branchId) {
        const rows = await query(
            `SELECT DISTINCT t.* FROM transactions t
             LEFT JOIN accounts a_from ON t.from_account_id = a_from.id
             LEFT JOIN accounts a_to   ON t.to_account_id   = a_to.id
             LEFT JOIN accounts a_acc  ON t.account_id      = a_acc.id
             WHERE t.branch_id = ?
                OR a_from.branch_id = ?
                OR a_to.branch_id = ?
                OR a_acc.branch_id = ?
             ORDER BY t.id DESC`,
            [branchId, branchId, branchId, branchId]
        );
        return rows.map(mapRow);
    }

    async getNextId() {
        const rows = await query("SELECT IFNULL(MAX(id), 0) + 1 AS nextId FROM transactions");
        return rows[0].nextId;
    }

    async delete(id) {
        await query("DELETE FROM transactions WHERE id = ?", [id]);
    }
}

module.exports = new TransactionRepository();
