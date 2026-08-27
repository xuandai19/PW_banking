const BaseEntity = require("./BaseEntity");

class Transaction extends BaseEntity {

    constructor(
        id,
        type,
        amount,
        fromAccountId,
        toAccountId,
        accountId,
        branchId,
        bankId,
        description = null
    ) {
        super(id);

        this.type = type;
        this.amount = amount;

        this.fromAccountId = fromAccountId;
        this.toAccountId = toAccountId;

        this.accountId = accountId;
        this.branchId = branchId;
        this.bankId = bankId;
        this.description = description || null;
    }
}

module.exports = Transaction;
