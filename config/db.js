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
}

module.exports = {
    pool,
    query,
    withTransaction,
    testConnection,
    ensureSchema
};
