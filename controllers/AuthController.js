const authService = require("../models/services/AuthService");
const tokenUtils = require("../utils/jwt");
const authorizationService = require("../models/services/AuthorizationService");

class AuthController {

    async login(req, res) {
        try {
            // Hỗ trợ cả username và email (field có thể là username hoặc email)
            const { username, email, password } = req.body;
            const identifier = username || email;
            const user = await authService.login(identifier, password);

            // Log thông tin đăng nhập (username + email) ra console server
            console.log(
                `[Auth] Login success | id=${user.id} | username=${user.username} | email=${user.email || "(none)"} | role=${user.role}`
            );

            const token = tokenUtils.encode({
                id: user.id,
                username: user.username,
                role: user.role
            });

            res.status(200).json({ token, user });
        } catch (error) {
            res.status(401).json({ message: error.message });
        }
    }

    me(req, res) {
        const {
            password,
            verifyToken,
            verifyTokenExpires,
            resetToken,
            resetTokenExpires,
            ...safeUser
        } = req.user;
        res.json(safeUser);
    }

    logout(req, res) {
        authService.logout();
        res.json({ message: "Đã đăng xuất." });
    }

    async getUsers(req, res) {
        try {
            if (!authorizationService.canCreateUser(req.user)) {
                return res.status(403).json({ message: "Bạn không có quyền xem danh sách tài khoản." });
            }
            res.json(await authService.getAllUsers());
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async createUser(req, res) {
        try {
            if (!authorizationService.canCreateUser(req.user)) {
                return res.status(403).json({ message: "Bạn không có quyền tạo tài khoản." });
            }
            const user = await authService.createUser(req.body, req.user);
            res.status(201).json(user);
        } catch (error) {
            const status = error.message.includes("quyền") || error.message.includes("Subadmin")
                ? 403
                : 400;
            res.status(status).json({ message: error.message });
        }
    }

    async updateUser(req, res) {
        try {
            const user = await authService.updateUser(Number(req.params.id), req.body || {}, req.user);
            res.json(user);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async deleteUser(req, res) {
        try {
            const result = await authService.deleteUser(Number(req.params.id), req.user);
            res.json(result);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async verifyEmail(req, res) {
        try {
            const token = req.body?.token || req.query?.token;
            const user = await authService.verifyEmail(token);
            res.json({ message: "Xác thực email thành công. Bạn có thể đăng nhập.", user });
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async forgotPassword(req, res) {
        try {
            const result = await authService.forgotPassword(req.body || {});
            res.json(result);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async resetPassword(req, res) {
        try {
            const { token, newPassword, password } = req.body || {};
            const result = await authService.resetPassword(token, newPassword || password);
            res.json(result);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
}

module.exports = new AuthController();
