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
    return {
        id: row.id,
        name: row.name,
        address: row.address,
        phone: row.phone,
        bankId: row.bank_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        accounts: [],
        updateTime() {
            this.updatedAt = new Date();
        }
    };
}

class BranchRepository {

    async create(branch) {
        const result = await query(
            "INSERT INTO branches (name, address, phone, bank_id) VALUES (?, ?, ?, ?)",
            [branch.name, branch.address, branch.phone || null, branch.bankId || null]
        );
        branch.id = result.insertId;
        return this.findById(branch.id);
    }

    async findAll() {
        const rows = await query("SELECT * FROM branches ORDER BY id ASC");
        return rows.map(mapRow);
    }

    async findById(id) {
        const rows = await query("SELECT * FROM branches WHERE id = ? LIMIT 1", [id]);
        return mapRow(rows[0]);
    }

    async findByBankId(bankId) {
        const rows = await query("SELECT * FROM branches WHERE bank_id = ? ORDER BY id ASC", [bankId]);
        return rows.map(mapRow);
    }

    async findByBankIdPaged(bankId, limit, offset) {
        const rows = await query("SELECT * FROM branches WHERE bank_id = ? ORDER BY id ASC LIMIT ? OFFSET ?", [Number(bankId), Number(limit), Number(offset)]);
        return rows.map(mapRow);
    }

    async getNextId() {
        const rows = await query("SELECT IFNULL(MAX(id), 0) + 1 AS nextId FROM branches");
        return rows[0].nextId;
    }

    async update(branch) {
        await query(
            "UPDATE branches SET name = ?, address = ?, phone = ?, bank_id = ? WHERE id = ?",
            [branch.name, branch.address, branch.phone || null, branch.bankId || null, branch.id]
        );
        return this.findById(branch.id);
    }

    async delete(id) {
        await query("DELETE FROM branches WHERE id = ?", [id]);
    }

    async resetAutoIncrement() {
        const rows = await query("SELECT IFNULL(MAX(id), 0) + 1 AS nextId FROM branches");
        await query("ALTER TABLE branches AUTO_INCREMENT = " + Number(rows[0].nextId));
    }

    async search(keyword) {
        const all = await this.findAll();
        const k = removeVietnameseTones(keyword).toLowerCase();
        if (!k) return all;
        return all.filter(b => {
            const name = removeVietnameseTones(b.name).toLowerCase();
            const address = removeVietnameseTones(b.address).toLowerCase();
            const phone = removeVietnameseTones(b.phone).toLowerCase();
            return name.includes(k) || address.includes(k) || phone.includes(k);
        });
    }
}

module.exports = new BranchRepository();
