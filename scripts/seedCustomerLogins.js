/**
 * Tạo login khách hàng cho các Account chưa có.
 * Chạy: node scripts/seedCustomerLogins.js
 */
require("../config/env");
const { testConnection, ensureSchema } = require("../config/db");
const accountRepository = require("../models/repositories/AccountRepository");
const customerService = require("../models/services/CustomerService");

async function main() {
    await testConnection();
    await ensureSchema();
    const accounts = await accountRepository.findAll();
    let created = 0;
    let skipped = 0;
    for (const acc of accounts) {
        try {
            const result = await customerService.createForAccount(acc);
            if (result._defaultPassword) {
                console.log(
                    `✓ STK ${acc.accountNumber} → username=${result.username} | pass=${result._defaultPassword}`
                );
                created++;
            } else {
                skipped++;
            }
        } catch (err) {
            console.warn(`✗ STK ${acc.accountNumber}:`, err.message);
        }
    }
    console.log(`Done. Created: ${created}, already existed: ${skipped}`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
