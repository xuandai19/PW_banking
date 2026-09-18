const tokenUtils = require("../utils/jwt");
const customerRepository = require("../models/repositories/CustomerRepository");

/**
 * Lấy token từ Authorization Bearer hoặc cookie customer_token.
 */
function extractToken(req) {
    const header = req.headers.authorization || "";
    const [scheme, bearerToken] = header.split(" ");
    if (scheme === "Bearer" && bearerToken) {
        return bearerToken.trim();
    }
    // Cookie: customer_token=...
    const cookieHeader = req.headers.cookie || "";
    const match = cookieHeader.match(/(?:^|;\s*)customer_token=([^;]*)/);
    if (match) {
        try {
            return decodeURIComponent(match[1].trim());
        } catch {
            return match[1].trim();
        }
    }
    return null;
}

/**
 * Xác thực JWT của khách hàng (role = CUSTOMER).
 * Token có thời gian hết hạn; hết hạn → 401 (frontend tự logout).
 */
async function authenticateCustomer(req, res, next) {
    try {
        const token = extractToken(req);
        if (!token) {
            return res.status(401).json({ message: "Vui lòng đăng nhập." });
        }
        const payload = tokenUtils.decode(token);
        if (!payload?.id || payload.role !== "CUSTOMER") {
            return res.status(401).json({
                message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."
            });
        }
        const customer = await customerRepository.findById(Number(payload.id));
        if (!customer) {
            return res.status(401).json({
                message: "Phiên đăng nhập không hợp lệ hoặc tài khoản không còn tồn tại."
            });
        }
        if (customer.status !== "ACTIVE") {
            return res.status(403).json({ message: "Tài khoản khách hàng đã bị khóa." });
        }
        req.customer = customer;
        req.customerTokenPayload = payload;
        next();
    } catch {
        return res.status(401).json({ message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." });
    }
}

/**
 * Chặn thao tác giao dịch nếu chưa đổi mật khẩu mặc định.
 */
function requirePasswordChanged(req, res, next) {
    if (req.customer?.mustChangePassword) {
        return res.status(403).json({
            message: "Vui lòng đổi mật khẩu mặc định trước khi sử dụng chức năng này.",
            mustChangePassword: true,
            isVerified: false
        });
    }
    next();
}

/**
 * Tài khoản đã xác thực = đã đổi mật khẩu + đã đặt OTP.
 * Chưa xác thực → chỉ xem số dư (tài khoản ngoại).
 */
function requireVerified(req, res, next) {
    const c = req.customer;
    if (!c) {
        return res.status(401).json({ message: "Vui lòng đăng nhập." });
    }
    const mustChangePassword = Boolean(c.mustChangePassword);
    const hasOtp = Boolean(c.otpHash);
    if (mustChangePassword || !hasOtp) {
        return res.status(403).json({
            message:
                "Tài khoản chưa xác thực. Vui lòng đổi mật khẩu và đặt OTP trong phần Xác thực tài khoản.",
            mustChangePassword,
            hasOtp,
            isVerified: false
        });
    }
    next();
}

module.exports = {
    authenticateCustomer,
    requirePasswordChanged,
    requireVerified,
    extractToken
};
