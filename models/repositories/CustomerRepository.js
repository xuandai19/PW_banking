const { query } = require("../../config/db");
const Customer = require("../entities/Customer");

function mapRow(row) {
    if (!row) return null;
    const c = new Customer(
        row.id,
        row.account_id,
        row.username,
        row.password,
        row.full_name,
        row.must_change_password === 1 || row.must_change_password === true,
        row.status || "ACTIVE",
        row.email || null,
        row.otp_hash || null
    );
    c.resetToken = row.reset_token || null;
    c.resetTokenExpires = row.reset_token_expires || null;
    c.createdAt = row.created_at;
    c.updatedAt = row.updated_at;
    return c;
}

class CustomerRepository {
    async create(customer) {
        const result = await query(
            `INSERT INTO customers
             (account_id, username, password, full_name, email, otp_hash, must_change_password, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                customer.accountId,
                customer.username,
                customer.password,
                customer.fullName,
                customer.email || null,
                customer.otpHash || null,
                customer.mustChangePassword ? 1 : 0,
                customer.status || "ACTIVE"
            ]
        );
        return this.findById(result.insertId);
    }

    async findById(id) {
        const rows = await query("SELECT * FROM customers WHERE id = ? LIMIT 1", [id]);
        return mapRow(rows[0]);
    }

    async findByUsername(username) {
        const rows = await query(
            "SELECT * FROM customers WHERE username = ? LIMIT 1",
            [String(username).trim()]
        );
        return mapRow(rows[0]);
    }

    async findByEmail(email) {
        if (!email) return null;
        const rows = await query(
            "SELECT * FROM customers WHERE email = ? LIMIT 1",
            [String(email).trim().toLowerCase()]
        );
        return mapRow(rows[0]);
    }

    async findByAccountId(accountId) {
        const rows = await query(
            "SELECT * FROM customers WHERE account_id = ? LIMIT 1",
            [accountId]
        );
        return mapRow(rows[0]);
    }

    async findByResetToken(token) {
        if (!token) return null;
        const rows = await query(
            "SELECT * FROM customers WHERE reset_token = ? LIMIT 1",
            [String(token).trim()]
        );
        return mapRow(rows[0]);
    }

    async update(id, fields) {
        const allowed = {
            password: "password",
            fullName: "full_name",
            email: "email",
            otpHash: "otp_hash",
            mustChangePassword: "must_change_password",
            status: "status",
            resetToken: "reset_token",
            resetTokenExpires: "reset_token_expires"
        };
        const sets = [];
        const params = [];
        for (const [key, col] of Object.entries(allowed)) {
            if (fields[key] !== undefined) {
                sets.push(`${col} = ?`);
                if (key === "mustChangePassword") {
                    params.push(fields[key] ? 1 : 0);
                } else if (key === "email" && fields[key]) {
                    params.push(String(fields[key]).trim().toLowerCase());
                } else {
                    params.push(fields[key]);
                }
            }
        }
        if (!sets.length) return this.findById(id);
        params.push(id);
        await query(`UPDATE customers SET ${sets.join(", ")} WHERE id = ?`, params);
        return this.findById(id);
    }

    async deleteByAccountId(accountId) {
        await query("DELETE FROM customers WHERE account_id = ?", [accountId]);
    }
}

module.exports = new CustomerRepository();
