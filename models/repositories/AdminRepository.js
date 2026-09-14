const { query } = require("../../config/db");

function mapRow(row) {
    if (!row) return null;
    return {
        id: row.id,
        username: row.username,
        password: row.password,
        fullName: row.full_name,
        role: row.role,
        email: row.email || "",
        emailVerified: Boolean(row.email_verified),
        verifyToken: row.verify_token || null,
        verifyTokenExpires: row.verify_token_expires || null,
        resetToken: row.reset_token || null,
        resetTokenExpires: row.reset_token_expires || null,
        bankId: row.bank_id ?? null,
        branchId: row.branch_id ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        updateTime() { this.updatedAt = new Date(); }
    };
}

class AdminRepository {
    async create(admin) {
        const result = await query(
            `INSERT INTO admins
             (username, password, full_name, role, email, email_verified,
              verify_token, verify_token_expires, reset_token, reset_token_expires,
              bank_id, branch_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                admin.username, admin.password, admin.fullName, admin.role,
                admin.email || null, admin.emailVerified ? 1 : 0,
                admin.verifyToken || null, admin.verifyTokenExpires || null,
                admin.resetToken || null, admin.resetTokenExpires || null,
                admin.bankId || null, admin.branchId || null
            ]
        );
        admin.id = result.insertId;
        return this.findById(admin.id);
    }
    async findAll() {
        return (await query("SELECT * FROM admins ORDER BY id ASC")).map(mapRow);
    }
    async findById(id) {
        return mapRow((await query("SELECT * FROM admins WHERE id = ? LIMIT 1", [id]))[0]);
    }
    async findByUsername(username) {
        return mapRow((await query("SELECT * FROM admins WHERE username = ? LIMIT 1", [username]))[0]);
    }
    async findByEmail(email) {
        const normalized = String(email || "").trim().toLowerCase();
        if (!normalized) return null;
        return mapRow((await query("SELECT * FROM admins WHERE LOWER(email) = ? LIMIT 1", [normalized]))[0]);
    }
    async findByVerifyToken(token) {
        if (!token) return null;
        return mapRow((await query("SELECT * FROM admins WHERE verify_token = ? LIMIT 1", [token]))[0]);
    }
    async findByResetToken(token) {
        if (!token) return null;
        return mapRow((await query("SELECT * FROM admins WHERE reset_token = ? LIMIT 1", [token]))[0]);
    }
    async getNextId() {
        return (await query("SELECT IFNULL(MAX(id), 0) + 1 AS nextId FROM admins"))[0].nextId;
    }
    async update(id, data) {
        const existing = await this.findById(id);
        if (!existing) return null;
        const merged = { ...existing, ...data };
        await query(
            `UPDATE admins SET
               username=?, password=?, full_name=?, role=?, email=?, email_verified=?,
               verify_token=?, verify_token_expires=?, reset_token=?, reset_token_expires=?,
               bank_id=?, branch_id=?
             WHERE id=?`,
            [
                merged.username, merged.password, merged.fullName, merged.role,
                merged.email || null, merged.emailVerified ? 1 : 0,
                merged.verifyToken || null, merged.verifyTokenExpires || null,
                merged.resetToken || null, merged.resetTokenExpires || null,
                merged.bankId || null, merged.branchId || null, id
            ]
        );
        return this.findById(id);
    }
    async delete(id) {
        await query("DELETE FROM admins WHERE id = ?", [id]);
    }
}
module.exports = new AdminRepository();
