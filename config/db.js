const mysql = require("mysql2/promise");

/**
 * Pool kết nối MySQL.
 * Cấu hình qua biến môi trường hoặc giá trị mặc định bên dưới.
 */
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "123456a@",
    database: process.env.DB_NAME || "banking_db",
    waitForConnections: true,
    connectionLimit: 10,
    timezone: "+00:00",
    dateStrings: false
});

async function query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
}

async function withTransaction(work) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const result = await work(conn);
        await conn.commit();
        return result;
    } catch (error) {
        try { await conn.rollback(); } catch {}
        throw error;
    } finally {
        conn.release();
    }
}

async function testConnection() {
    const conn = await pool.getConnection();
    try {
        await conn.ping();
        return true;
    } finally {
        conn.release();
    }
}

/**
 * Tự động bổ sung cột còn thiếu trên DB cũ (không phá dữ liệu).
 */
async function ensureSchema() {
    const migrations = [
        {
            name: "transactions.description",
            check: `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = 'transactions'
                      AND COLUMN_NAME = 'description'`,
            apply: `ALTER TABLE transactions ADD COLUMN description VARCHAR(255) NULL AFTER bank_id`
        }
    ];

    for (const m of migrations) {
        try {
            const rows = await query(m.check);
            if (Number(rows[0]?.c) === 0) {
                await query(m.apply);
            }
        } catch (err) {
            console.warn(`[MySQL] Migration ${m.name} skipped:`, err.message);
        }
    }

    // Bảng customers – portal khách hàng (login, số dư, nạp/rút, chuyển khoản, log)
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS customers (
              id INT PRIMARY KEY AUTO_INCREMENT,
              account_id INT NOT NULL UNIQUE,
              username VARCHAR(50) NOT NULL UNIQUE,
              password VARCHAR(255) NOT NULL,
              full_name VARCHAR(150) NOT NULL,
              email VARCHAR(150) NULL,
              otp_hash VARCHAR(255) NULL,
              must_change_password TINYINT(1) NOT NULL DEFAULT 1,
              status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
              reset_token VARCHAR(128) NULL,
              reset_token_expires DATETIME NULL,
              created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              CONSTRAINT fk_customers_account FOREIGN KEY (account_id) REFERENCES accounts(id)
                ON DELETE CASCADE ON UPDATE CASCADE,
              INDEX idx_customers_username (username),
              INDEX idx_customers_email (email)
            )
        `);
    } catch (err) {
        console.warn("[MySQL] Ensure customers table:", err.message);
    }

    // Migrations bổ sung cột cho customers (DB cũ)
    const customerMigrations = [
        {
            name: "customers.email",
            check: `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'email'`,
            apply: `ALTER TABLE customers ADD COLUMN email VARCHAR(150) NULL AFTER full_name`
        },
        {
            name: "customers.otp_hash",
            check: `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'otp_hash'`,
            apply: `ALTER TABLE customers ADD COLUMN otp_hash VARCHAR(255) NULL AFTER email`
        },
        {
            name: "customers.reset_token",
            check: `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'reset_token'`,
            apply: `ALTER TABLE customers ADD COLUMN reset_token VARCHAR(128) NULL AFTER status`
        },
        {
            name: "customers.reset_token_expires",
            check: `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'reset_token_expires'`,
            apply: `ALTER TABLE customers ADD COLUMN reset_token_expires DATETIME NULL AFTER reset_token`
        }
    ];
    for (const m of customerMigrations) {
        try {
            const rows = await query(m.check);
            if (Number(rows[0]?.c) === 0) {
                await query(m.apply);
                console.log(`[MySQL] Migration applied: ${m.name}`);
            }
        } catch (err) {
            console.warn(`[MySQL] Migration ${m.name} skipped:`, err.message);
        }
    }
}

module.exports = {
    pool,
    query,
    withTransaction,
    testConnection,
    ensureSchema
};
