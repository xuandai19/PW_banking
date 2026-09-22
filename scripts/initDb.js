require("../config/env");
/**
 * Khởi tạo database MySQL + migrate dữ liệu từ file JSON (nếu có).
 *
 * Cách chạy:
 *   cd backend
 *   npm install
 *   node scripts/initDb.js
 *
 * Biến môi trường (tuỳ chọn):
 *   DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const { hashPassword } = require("../utils/password");

const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || "123456a@";
const DB_NAME = process.env.DB_NAME || "banking_db";

function readJson(name) {
    const file = path.join(__dirname, "..", "data", name);
    if (!fs.existsSync(file)) return [];
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
        return [];
    }
}

async function main() {
    console.log("Connecting to MySQL...", { host: DB_HOST, user: DB_USER, database: DB_NAME });

    // Kết nối không chọn DB để tạo database
    const rootConn = await mysql.createConnection({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        multipleStatements: true
    });

    const schemaPath = path.join(__dirname, "..", "sql", "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    await rootConn.query(schemaSql);
    console.log("Schema applied.");

    // Migration cho database cũ: bổ sung role BANK/BRANCH và liên kết tài khoản quản lý.
    const migrations = [
        `ALTER TABLE admins MODIFY role ENUM('ADMIN','SUBADMIN','EMPLOYEE','BANK','BRANCH') NOT NULL`,
        `ALTER TABLE admins ADD COLUMN bank_id INT NULL`,
        `ALTER TABLE admins ADD COLUMN branch_id INT NULL`,
        `ALTER TABLE approvals ADD COLUMN reason TEXT NULL`,
        `ALTER TABLE approvals ADD COLUMN rejected_by VARCHAR(50) NULL`
    ];
    for (const sql of migrations) {
        try { await rootConn.query(`USE ${DB_NAME}; ${sql}`); } catch (err) {
            // Cột/kiểu dữ liệu đã tồn tại thì bỏ qua.
            if (!/duplicate column|duplicate key|already exists/i.test(err.message)) {
                console.warn("[Migration]", err.message);
            }
        }
    }
    await rootConn.end();

    const pool = await mysql.createPool({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME
    });

    const [adminCount] = await pool.query("SELECT COUNT(*) AS c FROM admins");
    if (adminCount[0].c === 0) {
        const admins = readJson("admins.json");
        if (admins.length === 0) {
            // seed mặc định
            await pool.query(`INSERT INTO admins (username, password, full_name, role, email, email_verified) VALUES (?,?,?,?,?,1),(?,?,?,?,?,1),(?,?,?,?,?,1)`, [
                'admin', await hashPassword('123456'), 'System Admin', 'ADMIN', 'admin@banking.local',
                'subadmin', await hashPassword('123456'), 'Sub Admin', 'SUBADMIN', 'subadmin@banking.local',
                'employee', await hashPassword('123456'), 'Transaction Staff', 'EMPLOYEE', 'employee@banking.local'
            ]);
            console.log("Seeded default admins.");
        } else {
            for (const a of admins) {
                await pool.query(
                    `INSERT INTO admins
                     (id, username, password, full_name, role, email, email_verified,
                      verify_token, verify_token_expires, reset_token, reset_token_expires, created_at, updated_at)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                     ON DUPLICATE KEY UPDATE username=VALUES(username)`,
                    [
                        a.id,
                        a.username,
                        await hashPassword(a.password),
                        a.fullName,
                        a.role,
                        a.email || null,
                        a.emailVerified === false ? 0 : 1,
                        a.verifyToken || null,
                        a.verifyTokenExpires || null,
                        a.resetToken || null,
                        a.resetTokenExpires || null,
                        a.createdAt ? new Date(a.createdAt) : new Date(),
                        a.updatedAt ? new Date(a.updatedAt) : new Date()
                    ]
                );
            }
            console.log(`Migrated ${admins.length} admins from JSON.`);
        }
    } else {
        console.log("admins table already has data, skip seed.");
    }

    const [bankCount] = await pool.query("SELECT COUNT(*) AS c FROM banks");
    if (bankCount[0].c === 0) {
        for (const b of readJson("banks.json")) {
            await pool.query(
                `INSERT INTO banks (id, name, code, address, created_at, updated_at)
                 VALUES (?,?,?,?,?,?)
                 ON DUPLICATE KEY UPDATE name=VALUES(name)`,
                [
                    b.id, b.name, b.code, b.address,
                    b.createdAt ? new Date(b.createdAt) : new Date(),
                    b.updatedAt ? new Date(b.updatedAt) : new Date()
                ]
            );
        }
        console.log("Migrated banks.");
    }

    const [branchCount] = await pool.query("SELECT COUNT(*) AS c FROM branches");
    if (branchCount[0].c === 0) {
        for (const b of readJson("branches.json")) {
            await pool.query(
                `INSERT INTO branches (id, name, address, phone, bank_id, created_at, updated_at)
                 VALUES (?,?,?,?,?,?,?)
                 ON DUPLICATE KEY UPDATE name=VALUES(name)`,
                [
                    b.id, b.name, b.address, b.phone || null, b.bankId || null,
                    b.createdAt ? new Date(b.createdAt) : new Date(),
                    b.updatedAt ? new Date(b.updatedAt) : new Date()
                ]
            );
        }
        console.log("Migrated branches.");
    }

    const [accCount] = await pool.query("SELECT COUNT(*) AS c FROM accounts");
    if (accCount[0].c === 0) {
        for (const a of readJson("accounts.json")) {
            await pool.query(
                `INSERT INTO accounts
                 (id, account_number, owner_name, balance, status, branch_id, bank_id, created_at, updated_at)
                 VALUES (?,?,?,?,?,?,?,?,?)
                 ON DUPLICATE KEY UPDATE account_number=VALUES(account_number)`,
                [
                    a.id, a.accountNumber, a.ownerName, a.balance || 0, a.status || "ACTIVE",
                    a.branchId || null, a.bankId || null,
                    a.createdAt ? new Date(a.createdAt) : new Date(),
                    a.updatedAt ? new Date(a.updatedAt) : new Date()
                ]
            );
        }
        console.log("Migrated accounts.");
    }

    const [orphanAccounts] = await pool.query("DELETE FROM accounts WHERE branch_id IS NULL");
    if (orphanAccounts.affectedRows) console.log(`Removed ${orphanAccounts.affectedRows} orphan accounts.`);

    const [txCount] = await pool.query("SELECT COUNT(*) AS c FROM transactions");
    if (txCount[0].c === 0) {
        for (const t of readJson("transactions.json")) {
            await pool.query(
                `INSERT INTO transactions
                 (id, type, amount, from_account_id, to_account_id, account_id, branch_id, bank_id, created_at, updated_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?)
                 ON DUPLICATE KEY UPDATE type=VALUES(type)`,
                [
                    t.id, t.type, t.amount,
                    t.fromAccountId || null, t.toAccountId || null,
                    t.accountId || null, t.branchId || null, t.bankId || null,
                    t.createdAt ? new Date(t.createdAt) : new Date(),
                    t.updatedAt ? new Date(t.updatedAt) : new Date()
                ]
            );
        }
        console.log("Migrated transactions.");
    }

    const [apCount] = await pool.query("SELECT COUNT(*) AS c FROM approvals");
    if (apCount[0].c === 0) {
        for (const a of readJson("approvals.json")) {
            await pool.query(
                `INSERT INTO approvals
                 (id, type, description, requested_by, requested_role, payload, status, note, history,
                  approved_by, approved_at, rejected_at, created_at)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                 ON DUPLICATE KEY UPDATE type=VALUES(type)`,
                [
                    a.id, a.type, a.description || null,
                    a.requestedBy || null, a.requestedRole || null,
                    JSON.stringify(a.payload || {}),
                    a.status || "PENDING",
                    a.note || null,
                    JSON.stringify(a.history || []),
                    a.approvedBy || null,
                    a.approvedAt ? new Date(a.approvedAt) : null,
                    a.rejectedAt ? new Date(a.rejectedAt) : null,
                    a.createdAt ? new Date(a.createdAt) : new Date()
                ]
            );
        }
        console.log("Migrated approvals.");
    }

    // Đồng bộ tài khoản quản lý cho các Bank/Branch đã có từ trước.
    const [banks] = await pool.query("SELECT id, name, code FROM banks");
    for (const b of banks) {
        const username = String(b.code).trim().toUpperCase();
        const [existing] = await pool.query("SELECT id FROM admins WHERE username=? LIMIT 1", [username]);
        if (!existing.length) {
            await pool.query(
                `INSERT INTO admins
                 (username,password,full_name,role,email,email_verified,bank_id)
                 VALUES (?,?,?,?,?,?,?)`,
                [username, await hashPassword("123456"), `Quản lý ${b.name}`, "BANK", `${username.toLowerCase()}@banking.local`, 1, b.id]
            );
        }
    }
    const [branches] = await pool.query("SELECT id, name, bank_id FROM branches");
    for (const b of branches) {
        const [bankRows] = await pool.query("SELECT code FROM banks WHERE id=? LIMIT 1", [b.bank_id]);
        const bankCode = bankRows[0]?.code || "BRANCH";
        const branchKey = String(b.phone || b.name || b.id).trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
        const username = `${String(bankCode).trim().toUpperCase()}_${branchKey}`;
        const [existing] = await pool.query("SELECT id FROM admins WHERE username=? LIMIT 1", [username]);
        if (!existing.length) {
            await pool.query(
                `INSERT INTO admins
                 (username,password,full_name,role,email,email_verified,bank_id,branch_id)
                 VALUES (?,?,?,?,?,?,?,?)`,
                [username, await hashPassword("123456"), `Quản lý ${b.name}`, "BRANCH", `${username.toLowerCase()}@banking.local`, 1, b.bank_id || null, b.id]
            );
        }
    }


    // Bổ sung integrity constraints cho database cũ nếu chúng chưa tồn tại.
    const integrityStatements = [
        `ALTER TABLE admins ADD CONSTRAINT fk_admins_bank FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE admins ADD CONSTRAINT fk_admins_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL ON UPDATE CASCADE`,
        `ALTER TABLE transactions ADD CONSTRAINT fk_transactions_from_account FOREIGN KEY (from_account_id) REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        `ALTER TABLE transactions ADD CONSTRAINT fk_transactions_to_account FOREIGN KEY (to_account_id) REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        `ALTER TABLE transactions ADD CONSTRAINT fk_transactions_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        `ALTER TABLE transactions ADD CONSTRAINT fk_transactions_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE RESTRICT ON UPDATE CASCADE`,
        `ALTER TABLE transactions ADD CONSTRAINT fk_transactions_bank FOREIGN KEY (bank_id) REFERENCES banks(id) ON DELETE RESTRICT ON UPDATE CASCADE`
    ];
    for (const sql of integrityStatements) {
        try {
            await pool.query(sql);
        } catch (err) {
            if (!/duplicate|already exists/i.test(err.message)) {
                console.warn("[Integrity]", err.message);
            }
        }
    }

    const [codeIndexes] = await pool.query(
        `SELECT COUNT(*) AS c FROM information_schema.statistics
         WHERE table_schema = ? AND table_name = 'banks' AND column_name = 'code' AND non_unique = 0`,
        [DB_NAME]
    );
    if (Number(codeIndexes[0].c) === 0) {
        try {
            await pool.query("ALTER TABLE banks ADD UNIQUE INDEX uq_banks_code (code)");
        } catch (err) {
            console.warn("[Integrity] Không thể tạo unique index banks.code:", err.message);
        }
    }

    const [nameIndexes] = await pool.query(
        `SELECT COUNT(*) AS c FROM information_schema.statistics
         WHERE table_schema = ? AND table_name = 'banks' AND column_name = 'name' AND non_unique = 0`,
        [DB_NAME]
    );
    if (Number(nameIndexes[0].c) === 0) {
        try {
            await pool.query("ALTER TABLE banks ADD UNIQUE INDEX uk_banks_name (name)");
        } catch (err) {
            console.warn("[Integrity] Không thể tạo unique index banks.name:", err.message);
        }
    }

    const [branchNameIndexes] = await pool.query(
        `SELECT COUNT(*) AS c FROM information_schema.statistics
         WHERE table_schema = ? AND table_name = 'branches' AND index_name = 'uk_branches_bank_name'`,
        [DB_NAME]
    );
    if (Number(branchNameIndexes[0].c) === 0) {
        try {
            await pool.query("ALTER TABLE branches ADD UNIQUE INDEX uk_branches_bank_name (bank_id, name)");
        } catch (err) {
            console.warn("[Integrity] Không thể tạo unique index branches(bank_id, name):", err.message);
        }
    }

    await pool.end();
    console.log("\nDone. MySQL sẵn sàng.");
    console.log("Chạy server: npm start");
}

main().catch(err => {
    console.error("initDb failed:", err.message);
    process.exit(1);
});
