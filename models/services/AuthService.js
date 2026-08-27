const Admin = require("../entities/Admin");
const adminRepository = require("../repositories/AdminRepository");
const authorizationService = require("./AuthorizationService");
const { hashPassword, comparePassword, isHashedPassword } = require("../../utils/password");
const {
    generateToken,
    sendVerificationEmail,
    sendResetPasswordEmail
} = require("../../utils/email");

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function toSafeUser(user) {
    if (!user) return null;
    const {
        password,
        verifyToken,
        verifyTokenExpires,
        resetToken,
        resetTokenExpires,
        ...safe
    } = user;
    return safe;
}

class AuthService {

    async seedDefaultUsers() {
        const defaults = [
            { username: "admin", password: "123456", fullName: "System Admin", role: Admin.ROLE_ADMIN, email: "admin@banking.local" },
            { username: "subadmin", password: "123456", fullName: "Sub Admin", role: Admin.ROLE_SUBADMIN, email: "subadmin@banking.local" },
            { username: "employee", password: "123456", fullName: "Transaction Staff", role: Admin.ROLE_EMPLOYEE, email: "employee@banking.local" }
        ];

        for (const d of defaults) {
            const existing = await adminRepository.findByUsername(d.username);
            if (!existing) {
                await adminRepository.create(
                    new Admin(null, d.username, await hashPassword(d.password), d.fullName, d.role, d.email, true)
                );
                console.log(`[Seed] Created user: ${d.username}`);
            } else if (!isHashedPassword(existing.password)) {
                await adminRepository.update(existing.id, { password: await hashPassword(existing.password) });
                console.log(`[Security] Upgraded password hash: ${d.username}`);
            }
        }
    }

    async createUser(data, creator) {
        if (!data?.username || !data?.password || !data?.fullName || !data?.role || !data?.email) {
            throw new Error("Thiếu thông tin người dùng (username, password, fullName, role, email).");
        }

        const username = String(data.username).trim();
        const password = String(data.password);
        const fullName = String(data.fullName).trim();
        const email = String(data.email).trim().toLowerCase();
        const role = String(data.role).toUpperCase();

        if (!isValidEmail(email)) {
            throw new Error("Email không hợp lệ.");
        }

        if (password.length < 4) {
            throw new Error("Mật khẩu phải có ít nhất 4 ký tự.");
        }

        const validRoles = [Admin.ROLE_SUBADMIN, Admin.ROLE_EMPLOYEE];
        if (!validRoles.includes(role)) {
            throw new Error("Vai trò không hợp lệ. Chỉ được tạo SUBADMIN hoặc EMPLOYEE.");
        }

        if (!authorizationService.canCreateRole(role, creator)) {
            if (authorizationService.isSubAdmin(creator)) {
                throw new Error("Subadmin chỉ được tạo tài khoản Employee.");
            }
            throw new Error("Bạn không có quyền tạo tài khoản với vai trò này.");
        }

        if (await adminRepository.findByUsername(username)) {
            throw new Error("Tên đăng nhập đã tồn tại.");
        }

        if (await adminRepository.findByEmail(email)) {
            throw new Error("Email đã được sử dụng bởi tài khoản khác.");
        }

        //Tạo token xác thực 
        const verifyToken = generateToken();
        const verifyTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const user = new Admin(null, username, await hashPassword(password), fullName, role, email, false);
        user.verifyToken = verifyToken;
        user.verifyTokenExpires = verifyTokenExpires;

        //Lưu vào database
        const created = await adminRepository.create(user);

        //Gửi email xác thực
        let emailResult;
        try {
            emailResult = await sendVerificationEmail(created, verifyToken);
        } catch (err) {
            console.error("[Email] Gửi mail xác thực thất bại:", err.message);
            emailResult = { mode: "error", error: err.message, link: null };
        }

        const safe = toSafeUser(created);
        if (emailResult && process.env.NODE_ENV !== "production") {
            safe._devVerifyLink = emailResult.link || null;
            safe._emailPreview = emailResult.preview || null;
            safe._emailMode = emailResult.mode || null;
        }
        return safe;
    }

    async login(usernameOrEmail, password) {
        if (!usernameOrEmail || !password) {
            throw new Error("Vui lòng nhập tên đăng nhập/email và mật khẩu.");
        }

        const identifier = String(usernameOrEmail).trim();
        // Cho phép đăng nhập bằng username hoặc email
        let admin = await adminRepository.findByUsername(identifier);
        if (!admin && identifier.includes("@")) {
            admin = await adminRepository.findByEmail(identifier);
        }
        // Fallback: thử email dù không có @ (trường hợp dữ liệu đặc biệt)
        if (!admin) {
            admin = await adminRepository.findByEmail(identifier);
        }

        if (!admin) {
            throw new Error("Sai tên đăng nhập/email hoặc mật khẩu.");
        }

        // Tự động nâng cấp password plaintext của dữ liệu cũ sang hash an toàn.
        let validPassword = await comparePassword(password, admin.password);
        if (!validPassword && !isHashedPassword(admin.password) && admin.password === String(password)) {
            const upgraded = await hashPassword(password);
            await adminRepository.update(admin.id, { password: upgraded });
            validPassword = true;
        }
        if (!validPassword) {
            throw new Error("Sai tên đăng nhập/email hoặc mật khẩu.");
        }

        if (admin.email && admin.emailVerified === false) {
            throw new Error("Tài khoản chưa xác thực email. Vui lòng kiểm tra hộp thư hoặc yêu cầu gửi lại email xác thực.");
        }

        return toSafeUser(await adminRepository.findById(admin.id));
    }

    logout() {
        // JWT là stateless; client xóa token để kết thúc phiên.
    }

    async getAllUsers() {
        const users = await adminRepository.findAll();
        return users.map(toSafeUser);
    }

    async getUserById(id) {
        return toSafeUser(await adminRepository.findById(Number(id)));
    }

    async updateUser(id, data, editor) {
        if (!editor || editor.role !== Admin.ROLE_ADMIN) {
            throw new Error("Chỉ Admin mới được cập nhật tài khoản người dùng.");
        }
        const user = await adminRepository.findById(Number(id));
        if (!user) throw new Error("Không tìm thấy tài khoản.");

        // Tài khoản ADMIN không được sửa (kể cả chính mình)
        if (user.role === Admin.ROLE_ADMIN) {
            throw new Error("Tài khoản Admin không được phép sửa.");
        }
        // Tài khoản BANK/BRANCH không sửa qua CRUD Users — quản lý theo Bank/Branch
        if (user.role === Admin.ROLE_BANK || user.role === Admin.ROLE_BRANCH) {
            throw new Error("Tài khoản Bank/Branch không được sửa tại đây. Chỉ Admin được xóa sau khi đã xóa Bank/Branch tương ứng.");
        }

        const username = data.username !== undefined ? String(data.username).trim() : user.username;
        const fullName = data.fullName !== undefined ? String(data.fullName).trim() : user.fullName;
        const email = data.email !== undefined ? String(data.email).trim().toLowerCase() : user.email;
        const role = data.role !== undefined ? String(data.role).toUpperCase() : user.role;

        if (!username || !fullName || !email || !isValidEmail(email)) throw new Error("Thông tin người dùng không hợp lệ.");
        if (![Admin.ROLE_SUBADMIN, Admin.ROLE_EMPLOYEE].includes(role)) {
            throw new Error("Chỉ được gán vai trò SUBADMIN hoặc EMPLOYEE. Tài khoản BANK/BRANCH do hệ thống tạo khi thêm Bank/Branch.");
        }

        const sameUsername = await adminRepository.findByUsername(username);
        if (sameUsername && sameUsername.id !== user.id) throw new Error("Tên đăng nhập đã tồn tại.");
        const sameEmail = await adminRepository.findByEmail(email);
        if (sameEmail && sameEmail.id !== user.id) throw new Error("Email đã được sử dụng bởi tài khoản khác.");

        const changedEmail = email !== user.email;
        const update = { username, fullName, email, role };
        if (data.password) {
            if (String(data.password).length < 4) throw new Error("Mật khẩu phải có ít nhất 4 ký tự.");
            update.password = await hashPassword(data.password);
        }
        if (changedEmail) {
            update.emailVerified = false;
            update.verifyToken = generateToken();
            update.verifyTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        }
        const updated = await adminRepository.update(user.id, update);
        const safe = toSafeUser(updated);
        if (changedEmail) {
            try {
                const emailResult = await sendVerificationEmail(updated, update.verifyToken);
                if (process.env.NODE_ENV !== "production") {
                    safe._devVerifyLink = emailResult?.link || null;
                    safe._emailPreview = emailResult?.preview || null;
                }
            } catch (err) {
                console.error("[Email] Gửi mail xác thực thất bại:", err.message);
            }
        }
        return safe;
    }

    async deleteUser(id, editor) {
        if (!editor || editor.role !== Admin.ROLE_ADMIN) {
            throw new Error("Chỉ Admin mới được xóa tài khoản người dùng.");
        }
        const user = await adminRepository.findById(Number(id));
        if (!user) throw new Error("Không tìm thấy tài khoản.");

        // Tài khoản ADMIN không được xóa
        if (user.role === Admin.ROLE_ADMIN) {
            throw new Error("Tài khoản Admin không được phép xóa.");
        }
        if (user.id === editor.id) throw new Error("Không thể tự xóa tài khoản đang đăng nhập.");

        // Tài khoản BANK/BRANCH: chỉ Admin xóa được, và chỉ sau khi đã xóa Bank/Branch
        if (user.role === Admin.ROLE_BANK) {
            if (user.bankId != null) {
                const bank = await require("./BankService").findById(user.bankId);
                if (bank) {
                    throw new Error("Chỉ được xóa tài khoản quản lý Bank sau khi Bank đã được xóa.");
                }
            }
        }
        if (user.role === Admin.ROLE_BRANCH) {
            if (user.branchId != null) {
                const branch = await require("./BranchService").findById(user.branchId);
                if (branch) {
                    throw new Error("Chỉ được xóa tài khoản quản lý Branch sau khi Branch đã được xóa.");
                }
            }
        }
        await adminRepository.delete(user.id);
        return { message: "Đã xóa tài khoản." };
    }

    async verifyEmail(token) {
        if (!token) throw new Error("Thiếu token xác thực.");

        const user = await adminRepository.findByVerifyToken(token);
        if (!user) throw new Error("Token xác thực không hợp lệ.");

        if (user.verifyTokenExpires && new Date(user.verifyTokenExpires) < new Date()) {
            throw new Error("Token xác thực đã hết hạn. Vui lòng liên hệ quản trị viên để xác thực lại tài khoản.");
        }

        await adminRepository.update(user.id, {
            emailVerified: true,
            verifyToken: null,
            verifyTokenExpires: null
        });

        return toSafeUser(await adminRepository.findById(user.id));
    }

    async forgotPassword({ username, email }) {
        let user = null;
        if (email) {
            user = await adminRepository.findByEmail(email);
        } else if (username) {
            user = await adminRepository.findByUsername(String(username).trim());
        }

        const generic = {
            message: "Nếu tài khoản tồn tại và có email, hướng dẫn đặt lại mật khẩu đã được gửi."
        };

        if (!user || !user.email) return generic;

        const resetToken = generateToken();
        const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

        await adminRepository.update(user.id, { resetToken, resetTokenExpires });
        const refreshed = await adminRepository.findById(user.id);

        let emailResult;
        try {
            emailResult = await sendResetPasswordEmail(refreshed, resetToken);
        } catch (err) {
            console.error("[Email] Gửi mail reset thất bại:", err.message);
            emailResult = { mode: "error", link: null };
        }

        if (emailResult && process.env.NODE_ENV !== "production") {
            generic._devResetLink = emailResult.link || null;
            generic._emailPreview = emailResult.preview || null;
            generic._emailMode = emailResult.mode || null;
        }
        return generic;
    }

    async resetPassword(token, newPassword) {
        if (!token) throw new Error("Thiếu token đặt lại mật khẩu.");
        if (!newPassword || String(newPassword).length < 4) {
            throw new Error("Mật khẩu mới phải có ít nhất 4 ký tự.");
        }

        const user = await adminRepository.findByResetToken(token);
        if (!user) throw new Error("Token đặt lại mật khẩu không hợp lệ.");

        if (user.resetTokenExpires && new Date(user.resetTokenExpires) < new Date()) {
            throw new Error("Token đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu lại.");
        }

        await adminRepository.update(user.id, {
            password: await hashPassword(newPassword),
            resetToken: null,
            resetTokenExpires: null
        });

        return { message: "Đổi mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới." };
    }
}

module.exports = new AuthService();
