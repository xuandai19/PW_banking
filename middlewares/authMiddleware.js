const tokenUtils = require("../utils/jwt");
const adminRepository = require("../models/repositories/AdminRepository");

//Xác thực người dùng
async function authenticate(req, res, next) {
    try {
        //Lấy header Authorization từ request.
        const header = req.headers.authorization || "";
        //Tách token ra khỏi chuỗi Bearer <token>.
        const [scheme, token] = header.split(" ");
        if (scheme !== "Bearer" || !token) return res.status(401).json({ message: "Vui lòng đăng nhập." });
        //Giải mã token bằng tokenUtils.decode
        const payload = tokenUtils.decode(token);
        const user = payload?.id ? await adminRepository.findById(Number(payload.id)) : null;
        if (!user) return res.status(401).json({ message: "Phiên đăng nhập không hợp lệ hoặc tài khoản không còn tồn tại." });
        if (payload.role && payload.role !== user.role) return res.status(401).json({ message: "Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại." });
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Phiên đăng nhập không hợp lệ." });
    }
}

//Kiểm tra quyền
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: "Bạn không có quyền thực hiện chức năng này." });
        next();
    };
}

// Lọc theo phạm vi quyền
function scopeFilters(req) {
    const role = req.user?.role;
    if (role === "BANK") return { bankId: Number(req.user.bankId) };
    if (role === "BRANCH") return { branchId: Number(req.user.branchId), bankId: Number(req.user.bankId) };
    return {};
}

//Kiểm tra quyền truy cập ngân hàng
function canAccessBank(req, bankId) {
    if (req.user?.role === "ADMIN" || req.user?.role === "SUBADMIN" || req.user?.role === "EMPLOYEE") return true;
    if (req.user?.role === "BANK") return Number(req.user.bankId) === Number(bankId);
    return false;
}

//Kiểm tra quyền truy cập chi nhánh
function canAccessBranch(req, branch) {
    if (["ADMIN","SUBADMIN","EMPLOYEE"].includes(req.user?.role)) return true;
    if (req.user?.role === "BANK") return Number(req.user.bankId) === Number(branch?.bankId);
    if (req.user?.role === "BRANCH") return Number(req.user.branchId) === Number(branch?.id);
    return false;
}

module.exports = { authenticate, requireRole, scopeFilters, canAccessBank, canAccessBranch };
