const BaseEntity = require("./BaseEntity");

class Admin extends BaseEntity {
    static ROLE_ADMIN = "ADMIN";
    static ROLE_SUBADMIN = "SUBADMIN";
    static ROLE_EMPLOYEE = "EMPLOYEE";
    static ROLE_BANK = "BANK";
    static ROLE_BRANCH = "BRANCH";

    constructor(
        id,
        username,
        password,
        fullName,
        role,
        email = "",
        emailVerified = false,
        bankId = null,
        branchId = null
    ) {
        super(id);
        this.username = username;
        this.password = password;
        this.fullName = fullName;
        this.role = role;
        this.email = email || "";
        this.emailVerified = Boolean(emailVerified);
        this.bankId = bankId;
        this.branchId = branchId;
        this.verifyToken = null;
        this.verifyTokenExpires = null;
        this.resetToken = null;
        this.resetTokenExpires = null;
    }
}
module.exports = Admin;
