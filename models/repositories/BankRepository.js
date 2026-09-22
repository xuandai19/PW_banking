const { query } = require("../../config/db");
const BranchRepository = require("./BranchRepository");

function removeVietnameseTones(str) {
    return String(str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D");
}

function mapRow(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        code: row.code,
        address: row.address,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        branches: [],
        updateTime() {
            this.updatedAt = new Date();
        }
    };
}

class BankRepository {

    async create(bank) {
        const result = await query(
            "INSERT INTO banks (name, code, address) VALUES (?, ?, ?)",
            [bank.name, bank.code, bank.address]
        );
        bank.id = result.insertId;
        return this.findById(bank.id);
    }

    async findAll() {
        const rows = await query("SELECT * FROM banks ORDER BY id ASC");
        const banks = rows.map(mapRow);
        for (const bank of banks) {
            bank.branches = await BranchRepository.findByBankId(bank.id);
        }
        return banks;
    }

    async findById(id) {
        const rows = await query("SELECT * FROM banks WHERE id = ? LIMIT 1", [id]);
        const bank = mapRow(rows[0]);
        if (bank) {
            bank.branches = await BranchRepository.findByBankId(bank.id);
        }
        return bank;
    }

    async getNextId() {
        const rows = await query("SELECT IFNULL(MAX(id), 0) + 1 AS nextId FROM banks");
        return rows[0].nextId;
    }

    async update(bank) {
        await query(
            "UPDATE banks SET name = ?, code = ?, address = ? WHERE id = ?",
            [bank.name, bank.code, bank.address, bank.id]
        );
        return this.findById(bank.id);
    }

    async delete(id) {
        await query("DELETE FROM banks WHERE id = ?", [id]);
    }

    async resetAutoIncrement() {
        const rows = await query("SELECT IFNULL(MAX(id), 0) + 1 AS nextId FROM banks");
        await query("ALTER TABLE banks AUTO_INCREMENT = " + Number(rows[0].nextId));
    }

    async search(keyword) {
        const all = await this.findAll();
        const k = removeVietnameseTones(keyword).toLowerCase();
        if (!k) return all;
        return all.filter(b => {
            const name = removeVietnameseTones(b.name).toLowerCase();
            const code = removeVietnameseTones(b.code).toLowerCase();
            const address = removeVietnameseTones(b.address).toLowerCase();
            return name.includes(k) || code.includes(k) || address.includes(k);
        });
    }
}

module.exports = new BankRepository();
