const Branch = require("../entities/Branch");
const branchRepository = require("../repositories/BranchRepository");
const adminRepository = require("../repositories/AdminRepository");
const Admin = require("../entities/Admin");
const { hashPassword } = require("../../utils/password");

function slugify(str) {
    return String(str || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 24) || "BR";
}

class BranchService {
    async create(...args) {
        let name, address, phone, bankId = null;
        if (typeof args[0] === "number") {
            name = args[1]; address = args[2]; phone = args[3]; bankId = args[4] ?? null;
        } else if (typeof args[0] === "object" && args[0] !== null) {
            ({ name, address, phone, bankId = null } = args[0]);
        } else {
            name = args[0]; address = args[1]; phone = args[2]; bankId = args[3] ?? null;
        }
        if (!name || !address) throw new Error("Thiếu thông tin chi nhánh.");
        if (bankId !== null) {
            const bankRepository = require("../repositories/BankRepository");
            if (!(await bankRepository.findById(Number(bankId)))) throw new Error("Không tìm thấy ngân hàng.");
        }
        // Không cho phép trùng tên chi nhánh trong cùng một ngân hàng
        if (bankId != null) {
            const siblings = await branchRepository.findByBankId(Number(bankId));
            const nameNorm = String(name).trim().toLowerCase();
            if (siblings.some(b => String(b.name).trim().toLowerCase() === nameNorm)) {
                throw new Error("Tên chi nhánh đã tồn tại trong ngân hàng này. Không được tạo chi nhánh trùng tên.");
            }
        }
        const branch = await branchRepository.create(
            Object.assign(new Branch(null, String(name).trim(), String(address).trim(), phone ? String(phone).trim() : null), { bankId: bankId ? Number(bankId) : null })
        );

        // Tài khoản quản lý Branch:
        // username / email theo username (mã) của Bank + mã chi nhánh
        // ví dụ bank code=VCB, branch name=Quan1 → username=VCB_QUAN1, email=vcb_quan1@banking.local
        // mật khẩu mặc định = mã bank (passcode) hoặc 123456
        const bankRepository = require("../repositories/BankRepository");
        const bank = branch.bankId ? await bankRepository.findById(branch.bankId) : null;
        const bankUsername = String(bank?.code || "BRANCH").trim().toUpperCase();
        const branchSlug = slugify(name) || `BR${branch.id}`;
        let username = `${bankUsername}_${branchSlug}`;
        // Tránh trùng username
        if (await adminRepository.findByUsername(username)) {
            username = `${bankUsername}_BR${branch.id}`;
        }
        const email = `${username.toLowerCase()}@banking.local`;
        const password = bankUsername.length >= 4 ? bankUsername.toLowerCase() : "123456";

        // Xóa tài khoản BRANCH cũ trùng email (nếu từng tạo sai tên)
        const existingByEmail = await adminRepository.findByEmail(email);
        if (existingByEmail && existingByEmail.role === Admin.ROLE_BRANCH && !existingByEmail.branchId) {
            await adminRepository.delete(existingByEmail.id);
        }

        await adminRepository.create(
            new Admin(
                null,
                username,
                await hashPassword(password),
                `Quản lý ${name}`,
                Admin.ROLE_BRANCH,
                email,
                true,
                branch.bankId,
                branch.id
            )
        );
        branch.managementAccount = { username, password, email, role: Admin.ROLE_BRANCH };
        return branch;
    }

    async findAll() { return branchRepository.findAll(); }
    async findById(id) { return branchRepository.findById(id); }
    async findByBankId(bankId) { return branchRepository.findByBankId(bankId); }
    async findByBankIdPaged(bankId, limit = 10, offset = 0) {
        return branchRepository.findByBankIdPaged(bankId, limit, offset);
    }
    async search(keyword) { return branchRepository.search(keyword); }

    async update(id, data) {
        const branch = await branchRepository.findById(id);
        if (!branch) throw new Error("Không tìm thấy chi nhánh.");
        const targetBankId = data.bankId !== undefined
            ? (data.bankId === null ? null : Number(data.bankId))
            : branch.bankId;
        if (data.name !== undefined) {
            const nameNorm = String(data.name).trim().toLowerCase();
            if (targetBankId != null) {
                const siblings = await branchRepository.findByBankId(Number(targetBankId));
                if (siblings.some(b => b.id !== Number(id) && String(b.name).trim().toLowerCase() === nameNorm)) {
                    throw new Error("Tên chi nhánh đã tồn tại trong ngân hàng này. Không được cập nhật trùng tên.");
                }
            }
            branch.name = String(data.name).trim();
        }
        if (data.address !== undefined) branch.address = String(data.address).trim();
        if (data.phone !== undefined) branch.phone = data.phone ? String(data.phone).trim() : null;
        if (data.bankId !== undefined) {
            const bankRepository = require("../repositories/BankRepository");
            if (data.bankId !== null && !(await bankRepository.findById(Number(data.bankId)))) {
                throw new Error("Không tìm thấy ngân hàng.");
            }
            branch.bankId = data.bankId === null ? null : Number(data.bankId);
        }
        return branchRepository.update(branch);
    }

    async delete(id) {
        const branch = await this.findById(id);
        if (!branch) throw new Error("Không tìm thấy chi nhánh.");
        const accountService = require("./AccountService");
        const accounts = await accountService.findByBranchId(id);
        if (accounts.length > 0) {
            const error = new Error("Chi nhánh đang có tài khoản. Vui lòng xóa tất cả tài khoản thuộc chi nhánh trước.");
            error.code = "BRANCH_HAS_ACCOUNTS";
            error.accounts = accounts;
            throw error;
        }
        // Xóa luôn tài khoản quản lý BRANCH gắn với chi nhánh này
        const users = (await adminRepository.findAll()).filter(
            (u) => u.role === Admin.ROLE_BRANCH && u.branchId === Number(id)
        );
        for (const user of users) await adminRepository.delete(user.id);
        await branchRepository.delete(id);
    }
}

module.exports = new BranchService();
