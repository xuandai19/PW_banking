const BaseEntity = require("./BaseEntity");

class Customer extends BaseEntity {
    constructor(
        id,
        accountId,
        username,
        password,
        fullName,
        mustChangePassword = true,
        status = "ACTIVE",
        email = null,
        otpHash = null
    ) {
        super(id);
        this.accountId = accountId;
        this.username = username;
        this.password = password;
        this.fullName = fullName;
        this.email = email || null;
        this.otpHash = otpHash || null;
        this.mustChangePassword = Boolean(mustChangePassword);
        this.status = status;
        this.role = "CUSTOMER";
        this.resetToken = null;
        this.resetTokenExpires = null;
    }
}

module.exports = Customer;
