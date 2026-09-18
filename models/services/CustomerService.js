const Customer = require("../entities/Customer");
const customerRepository = require("../repositories/CustomerRepository");
const accountRepository = require("../repositories/AccountRepository");
const transactionService = require("./TransactionService");
const accountService = require("./AccountService");
const { hashPassword, comparePassword, isHashedPassword } = require("../../utils/password");
const { generateToken, sendCustomerResetPasswordEmail } = require("../../utils/email");

const DEFAULT_PASSWORD = process.env.CUSTOMER_DEFAULT_PASSWORD || "Banking@123";
/** Token khách hàng hết hạn sau 15 giây (theo yêu cầu demo) */
const CUSTOMER_TOKEN_TTL_SECONDS = Number(process.env.CUSTOMER_JWT_EXPIRES_SECONDS || 15);

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function isCustomerVerified(c) {
    return Boolean(c) && !c.mustChangePassword && Boolean(c.otpHash);
}

function toSafeCustomer(c) {
    if (!c) return null;
    const mustChangePassword = Boolean(c.mustChangePassword);
    const hasOtp = Boolean(c.otpHash);
    return {
        id: c.id,
        accountId: c.accountId,
        username: c.username,
        fullName: c.fullName,
        email: c.email || null,
        hasOtp,
        mustChangePassword,
        /** Đã đổi MK + đặt OTP → tài khoản nội bộ (được giao dịch). Chưa → tài khoản ngoại (chỉ xem số dư). */
        isVerified: !mustChangePassword && hasOtp,
        status: c.status,
        role: "CUSTOMER",
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
    };
}

function assertVerified(customer) {
    if (!customer) throw new Error("Không tìm thấy khách hàng.");
    if (customer.mustChangePassword || !customer.otpHash) {
        const err = new Error(
            "Tài khoản chưa xác thực. Vui lòng đổi mật khẩu và đặt OTP trong phần Xác thực tài khoản để sử dụng giao dịch."
        );
        err.code = "NOT_VERIFIED";
        err.mustChangePassword = Boolean(customer.mustChangePassword);
        err.hasOtp = Boolean(customer.otpHash);
        err.isVerified = false;
        throw err;
    }
}

class CustomerService {
    getDefaultPassword() {
        return DEFAULT_PASSWORD;
    }

    getTokenTtlSeconds() {
        return CUSTOMER_TOKEN_TTL_SECONDS;
    }

    /**
     * Tạo login khách hàng khi staff tạo Account.
     * Username mặc định = số tài khoản.
     * Mật khẩu mặc định = Banking@123 (hoặc CUSTOMER_DEFAULT_PASSWORD).
     */
    async createForAccount(account, email = null) {
        if (!account?.id || !account.accountNumber) {
            throw new Error("Thiếu thông tin tài khoản để tạo khách hàng.");
        }
        const existing = await customerRepository.findByAccountId(account.id);
        if (existing) return toSafeCustomer(existing);

        const username = String(account.accountNumber).trim();
        const byUser = await customerRepository.findByUsername(username);
        if (byUser) {
            throw new Error(`Username ${username} đã tồn tại.`);
        }

        let normalizedEmail = null;
        if (email && isValidEmail(email)) {
            normalizedEmail = String(email).trim().toLowerCase();
            const byEmail = await customerRepository.findByEmail(normalizedEmail);
            if (byEmail) {
                throw new Error(`Email ${normalizedEmail} đã được sử dụng.`);
            }
        }

        const customer = new Customer(
            null,
            account.id,
            username,
            await hashPassword(DEFAULT_PASSWORD),
            account.ownerName || username,
            true,
            "ACTIVE",
            normalizedEmail,
            null
        );
        const created = await customerRepository.create(customer);
        const safe = toSafeCustomer(created);
        safe._defaultPassword = DEFAULT_PASSWORD;
        return safe;
    }

    async login(username, password) {
        if (!username || !password) {
            throw new Error("Vui lòng nhập tên đăng nhập và mật khẩu.");
        }
        const customer = await customerRepository.findByUsername(String(username).trim());
        if (!customer) {
            throw new Error("Sai tên đăng nhập hoặc mật khẩu.");
        }
        if (customer.status !== "ACTIVE") {
            throw new Error("Tài khoản khách hàng đã bị khóa.");
        }

        let valid = await comparePassword(password, customer.password);
        if (!valid && !isHashedPassword(customer.password) && customer.password === String(password)) {
            const upgraded = await hashPassword(password);
            await customerRepository.update(customer.id, { password: upgraded });
            valid = true;
        }
        if (!valid) {
            throw new Error("Sai tên đăng nhập hoặc mật khẩu.");
        }

        const account = await accountRepository.findById(customer.accountId);
        if (!account) {
            throw new Error("Không tìm thấy tài khoản ngân hàng liên kết.");
        }
        if (account.status !== "ACTIVE") {
            throw new Error("Tài khoản ngân hàng đang bị khóa hoặc không hoạt động.");
        }

        return {
            customer: toSafeCustomer(customer),
            account: {
                id: account.id,
                accountNumber: account.accountNumber,
                ownerName: account.ownerName,
                balance: account.balance,
                status: account.status,
                branchId: account.branchId,
                bankId: account.bankId
            }
        };
    }

    async getProfile(customerId) {
        const customer = await customerRepository.findById(customerId);
        if (!customer) throw new Error("Không tìm thấy khách hàng.");
        const account = await accountRepository.findById(customer.accountId);
        return {
            customer: toSafeCustomer(customer),
            account: account
                ? {
                      id: account.id,
                      accountNumber: account.accountNumber,
                      ownerName: account.ownerName,
                      balance: account.balance,
                      status: account.status,
                      branchId: account.branchId,
                      bankId: account.bankId
                  }
                : null
        };
    }

    async getBalance(customerId) {
        const customer = await customerRepository.findById(customerId);
        if (!customer) throw new Error("Không tìm thấy khách hàng.");
        const account = await accountRepository.findById(customer.accountId);
        if (!account) throw new Error("Không tìm thấy tài khoản.");
        return {
            accountId: account.id,
            accountNumber: account.accountNumber,
            ownerName: account.ownerName,
            balance: account.balance,
            status: account.status
        };
    }

    async deposit(customerId, amount) {
        const customer = await customerRepository.findById(customerId);
        assertVerified(customer);
        const amt = Number(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new Error("Số tiền nạp phải lớn hơn 0.");
        }
        const account = await accountService.deposit(customer.accountId, amt);
        return {
            accountId: account.id,
            accountNumber: account.accountNumber,
            balance: account.balance,
            message: `Nạp thành công ${amt.toLocaleString("vi-VN")} VND.`
        };
    }

    async withdraw(customerId, amount) {
        const customer = await customerRepository.findById(customerId);
        assertVerified(customer);
        const amt = Number(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new Error("Số tiền rút phải lớn hơn 0.");
        }
        const account = await accountService.withdraw(customer.accountId, amt);
        return {
            accountId: account.id,
            accountNumber: account.accountNumber,
            balance: account.balance,
            message: `Rút thành công ${amt.toLocaleString("vi-VN")} VND.`
        };
    }

    /**
     * Danh sách ngân hàng (cho form chuyển khoản khách hàng).
     */
    async listBanks() {
        const bankService = require("./BankService");
        const banks = await bankService.findAll();
        return (banks || []).map((b) => ({
            id: b.id,
            name: b.name,
            code: b.code,
            address: b.address || null
        }));
    }

    /**
     * Tra cứu tài khoản nhận theo STK + ngân hàng (hiển thị tên trước khi xác nhận).
     */
    async lookupRecipient(toAccountNumber, bankId) {
        const targetNumber = String(toAccountNumber || "").trim();
        if (!targetNumber) throw new Error("Vui lòng nhập số tài khoản nhận.");
        const toAccount = await accountRepository.findByAccountNumber(targetNumber);
        if (!toAccount) {
            throw new Error("Không tìm thấy tài khoản nhận. Kiểm tra lại số tài khoản.");
        }
        if (toAccount.status !== "ACTIVE") {
            throw new Error("Tài khoản nhận đang bị khóa hoặc không hoạt động.");
        }
        if (bankId != null && bankId !== "" && Number(toAccount.bankId) !== Number(bankId)) {
            throw new Error("Số tài khoản không thuộc ngân hàng đã chọn.");
        }
        let bankName = null;
        try {
            const bankService = require("./BankService");
            const bank = await bankService.findById(toAccount.bankId);
            bankName = bank?.name || null;
        } catch {
            /* ignore */
        }
        return {
            accountNumber: toAccount.accountNumber,
            ownerName: toAccount.ownerName,
            bankId: toAccount.bankId,
            bankName,
            branchId: toAccount.branchId
        };
    }

    /**
     * Chuyển khoản: chọn ngân hàng → STK → nội dung → xác nhận OTP.
     */
    async transfer(customerId, { toAccountNumber, amount, description, otp, bankId }) {
        const customer = await customerRepository.findById(customerId);
        assertVerified(customer);

        const otpStr = String(otp || "").trim();
        if (!/^\d{6}$/.test(otpStr)) {
            throw new Error("OTP phải gồm đúng 6 chữ số.");
        }
        const otpValid = await comparePassword(otpStr, customer.otpHash);
        if (!otpValid) {
            throw new Error("Mã OTP không đúng.");
        }

        const amt = Number(amount);
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new Error("Số tiền chuyển phải lớn hơn 0.");
        }
        const targetNumber = String(toAccountNumber || "").trim();
        if (!targetNumber) {
            throw new Error("Vui lòng nhập số tài khoản nhận.");
        }
        if (bankId == null || bankId === "") {
            throw new Error("Vui lòng chọn ngân hàng nhận.");
        }

        const fromAccount = await accountRepository.findById(customer.accountId);
        if (!fromAccount) throw new Error("Không tìm thấy tài khoản nguồn.");
        if (String(fromAccount.accountNumber) === targetNumber) {
            throw new Error("Không thể chuyển khoản tới chính tài khoản của bạn.");
        }

        const toAccount = await accountRepository.findByAccountNumber(targetNumber);
        if (!toAccount) {
            throw new Error("Không tìm thấy tài khoản nhận. Kiểm tra lại số tài khoản.");
        }
        if (toAccount.status !== "ACTIVE") {
            throw new Error("Tài khoản nhận đang bị khóa hoặc không hoạt động.");
        }
        if (Number(toAccount.bankId) !== Number(bankId)) {
            throw new Error("Số tài khoản không thuộc ngân hàng đã chọn.");
        }

        const sameBank = Number(fromAccount.bankId) === Number(toAccount.bankId);
        const sameBranch = Number(fromAccount.branchId) === Number(toAccount.branchId);
        let transferTypeLabel = "liên ngân hàng";
        if (sameBank && sameBranch) transferTypeLabel = "nội bộ (cùng chi nhánh)";
        else if (sameBank) transferTypeLabel = "liên chi nhánh";

        const desc =
            description ||
            `Chuyển ${transferTypeLabel} tới ${toAccount.accountNumber} (${toAccount.ownerName})`;

        const result = await accountService.transfer(
            fromAccount.id,
            toAccount.id,
            amt,
            desc
        );

        return {
            from: {
                accountNumber: result.from.accountNumber,
                balance: result.from.balance
            },
            to: {
                accountNumber: result.to.accountNumber,
                ownerName: result.to.ownerName,
                bankId: result.to.bankId
            },
            amount: amt,
            transferType: transferTypeLabel,
            message: `Chuyển thành công ${amt.toLocaleString("vi-VN")} VND tới ${result.to.accountNumber} (${transferTypeLabel}).`
        };
    }

    async getTransactions(customerId) {
        const customer = await customerRepository.findById(customerId);
        assertVerified(customer);
        return transactionService.findByAccountId(customer.accountId);
    }

    async changePassword(customerId, currentPassword, newPassword) {
        const customer = await customerRepository.findById(customerId);
        if (!customer) throw new Error("Không tìm thấy khách hàng.");

        if (!newPassword || String(newPassword).length < 6) {
            throw new Error("Mật khẩu mới phải có ít nhất 6 ký tự.");
        }

        let valid = await comparePassword(currentPassword, customer.password);
        if (!valid && !isHashedPassword(customer.password) && customer.password === String(currentPassword)) {
            valid = true;
        }
        if (!valid) {
            throw new Error("Mật khẩu hiện tại không đúng.");
        }

        if (String(newPassword) === String(currentPassword)) {
            throw new Error("Mật khẩu mới phải khác mật khẩu hiện tại.");
        }

        const hashed = await hashPassword(String(newPassword));
        await customerRepository.update(customerId, {
            password: hashed,
            mustChangePassword: false
        });
        return { message: "Đổi mật khẩu thành công." };
    }

    /**
     * Đặt / đổi OTP 6 số do user tự đặt (dùng khi chuyển khoản).
     */
    async setOtp(customerId, otp, currentPassword) {
        const customer = await customerRepository.findById(customerId);
        if (!customer) throw new Error("Không tìm thấy khách hàng.");

        if (!currentPassword) {
            throw new Error("Vui lòng nhập mật khẩu hiện tại để xác nhận.");
        }
        let valid = await comparePassword(currentPassword, customer.password);
        if (!valid && !isHashedPassword(customer.password) && customer.password === String(currentPassword)) {
            valid = true;
        }
        if (!valid) {
            throw new Error("Mật khẩu hiện tại không đúng.");
        }

        const otpStr = String(otp || "").trim();
        if (!/^\d{6}$/.test(otpStr)) {
            throw new Error("OTP phải gồm đúng 6 chữ số.");
        }

        const otpHash = await hashPassword(otpStr);
        await customerRepository.update(customerId, { otpHash });
        return { message: "Đặt mã OTP thành công. Mã này sẽ dùng khi chuyển khoản." };
    }

    /**
     * Cập nhật email (cần để quên mật khẩu gửi đúng mail user).
     */
    async updateEmail(customerId, email, currentPassword) {
        const customer = await customerRepository.findById(customerId);
        if (!customer) throw new Error("Không tìm thấy khách hàng.");

        if (!isValidEmail(email)) {
            throw new Error("Email không hợp lệ.");
        }
        const normalized = String(email).trim().toLowerCase();
        const existing = await customerRepository.findByEmail(normalized);
        if (existing && existing.id !== customerId) {
            throw new Error("Email này đã được sử dụng bởi tài khoản khác.");
        }

        if (currentPassword) {
            let valid = await comparePassword(currentPassword, customer.password);
            if (!valid && !isHashedPassword(customer.password) && customer.password === String(currentPassword)) {
                valid = true;
            }
            if (!valid) throw new Error("Mật khẩu hiện tại không đúng.");
        }

        await customerRepository.update(customerId, { email: normalized });
        return { message: "Cập nhật email thành công.", email: normalized };
    }

    /**
     * Quên mật khẩu – gửi link reset tới đúng email của user.
     */
    async forgotPassword({ username, email }) {
        let customer = null;
        if (email) {
            customer = await customerRepository.findByEmail(String(email).trim().toLowerCase());
        } else if (username) {
            customer = await customerRepository.findByUsername(String(username).trim());
        }

        const generic = {
            message: "Nếu tài khoản tồn tại và có email, hướng dẫn đặt lại mật khẩu đã được gửi."
        };

        if (!customer || !customer.email) return generic;

        const resetToken = generateToken();
        const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

        await customerRepository.update(customer.id, {
            resetToken,
            resetTokenExpires
        });
        const refreshed = await customerRepository.findById(customer.id);

        let emailResult;
        try {
            emailResult = await sendCustomerResetPasswordEmail(
                {
                    fullName: refreshed.fullName,
                    username: refreshed.username,
                    email: refreshed.email
                },
                resetToken
            );
        } catch (err) {
            console.error("[Email] Gửi mail reset customer thất bại:", err.message);
            emailResult = { mode: "error", link: null };
        }

        if (emailResult) {
            generic._devResetLink = emailResult.link || null;
            generic._emailPreview = emailResult.preview || null;
            generic._emailMode = emailResult.mode || null;
            generic._sentTo = refreshed.email;
        }
        return generic;
    }

    async resetPassword(token, newPassword) {
        if (!token) throw new Error("Thiếu token đặt lại mật khẩu.");
        if (!newPassword || String(newPassword).length < 6) {
            throw new Error("Mật khẩu mới phải có ít nhất 6 ký tự.");
        }

        const customer = await customerRepository.findByResetToken(token);
        if (!customer) throw new Error("Token đặt lại mật khẩu không hợp lệ.");

        if (customer.resetTokenExpires && new Date(customer.resetTokenExpires) < new Date()) {
            throw new Error("Token đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu lại.");
        }

        await customerRepository.update(customer.id, {
            password: await hashPassword(newPassword),
            mustChangePassword: false,
            resetToken: null,
            resetTokenExpires: null
        });

        return { message: "Đổi mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới." };
    }
}

module.exports = new CustomerService();
