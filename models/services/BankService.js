const Bank = require("../entities/Bank");
const bankRepository = require("../repositories/BankRepository");
const branchService = require("./BranchService");
const adminRepository = require("../repositories/AdminRepository");
const Admin = require("../entities/Admin");
const { hashPassword } = require("../../utils/password");

class BankService {
    async create(...args) {
        let name, code, address;
        if (typeof args[0] === "number") {
            name = args[1]; code = args[2]; address = args[3];
        } else {
            name = args[0]; code = args[1]; address = args[2];
        }
        if (!name || !code || !address) throw new Error("Thiếu thông tin ngân hàng.");
        const existingBanks = await bankRepository.findAll();
        if (existingBanks.some(b => String(b.code).toLowerCase() === String(code).trim().toLowerCase())) {
            throw new Error("Mã ngân hàng đã tồn tại.");
        }

        const bank = await bankRepository.create(new Bank(null, name, code, address));

        // Tự động tạo tài khoản quản lý Bank:
        // username = mã bank (passcode), email = username@banking.local, password = mã bank (chữ thường) hoặc 123456
        const username = String(code).trim().toUpperCase();
        const email = `${username.toLowerCase()}@banking.local`;
        const password = username.length >= 4 ? username.toLowerCase() : "123456";
        let manager = await adminRepository.findByUsername(username);
        if (!manager) {
            manager = await adminRepository.create(
                new Admin(null, username, await hashPassword(password), `Quản lý ${name}`, Admin.ROLE_BANK, email, true, bank.id, null)
            );
        } else if (!manager.bankId) {
            await adminRepository.update(manager.id, { bankId: bank.id, role: Admin.ROLE_BANK, emailVerified: true });
        }
        bank.managementAccount = { username, password, email, role: Admin.ROLE_BANK };
        return bank;
    }

    async findAll() { return bankRepository.findAll(); }
    async findById(id) { return bankRepository.findById(id); }
    async search(keyword) { return bankRepository.search(keyword); }

    async update(id, data) {
        const bank = await bankRepository.findById(id);
        if (!bank) throw new Error("Không tìm thấy Bank.");
        if (data.name !== undefined) bank.name = data.name;
        if (data.code !== undefined) bank.code = data.code;
        if (data.address !== undefined) bank.address = data.address;
        return bankRepository.update(bank);
    }

    async delete(id) {
        const bank = await this.findById(id);
        if (!bank) throw new Error("Không tìm thấy ngân hàng.");
        const branches = await branchService.findByBankId(id);
        if (branches.length > 0) {
            const error = new Error("Ngân hàng đang có chi nhánh. Vui lòng xóa tất cả chi nhánh trước khi xóa ngân hàng.");
            error.code = "BANK_HAS_BRANCHES";
            error.branches = branches;
            throw error;
        }
        const systemUser = (await adminRepository.findAll()).find(u => u.role === Admin.ROLE_BANK && u.bankId === Number(id));
        if (systemUser) await adminRepository.delete(systemUser.id);
        await bankRepository.delete(id);
            }
}
module.exports = new BankService();
