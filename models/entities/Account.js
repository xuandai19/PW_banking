const BaseEntity = require("./BaseEntity");

class Account extends BaseEntity {

    constructor(
        id,
        accountNumber,
        ownerName,
        balance = 0,
        status = "ACTIVE",
        branchId = null,
        bankId = null
    ) {

        super(id);

        this.accountNumber = accountNumber;
        this.ownerName = ownerName;
        this.balance = balance;
        this.status = status;
        this.branchId = branchId;
        this.bankId = bankId;

        this.transactions = [];
    }

    addTransaction(type, amount, description) {
        const transaction = {
            id: Date.now() + Math.random(),
            type,
            amount,
            description,
            createdAt: new Date()
        };

        this.transactions.push(transaction);
        this.updateTime();

        return transaction;
    }

    deposit(amount) {

        if (amount <= 0) {
            throw new Error("Số tiền phải lớn hơn 0.");
        }

        this.balance += amount;
        this.addTransaction("DEPOSIT", amount, "Nạp tiền vào tài khoản");
        this.updateTime();
    }

    withdraw(amount) {

        if (amount <= 0) {
            throw new Error("Số tiền phải lớn hơn 0.");
        }

        if (this.balance < amount) {
            throw new Error("Số dư không đủ.");
        }

        this.balance -= amount;
        this.addTransaction("WITHDRAW", amount, "Rút tiền khỏi tài khoản");
        this.updateTime();
    }

    transfer(targetAccount, amount) {

        if (amount <= 0) {
            throw new Error("Số tiền phải lớn hơn 0.");
        }

        if (this.balance < amount) {
            throw new Error("Số dư không đủ.");
        }

        this.balance -= amount;
        targetAccount.balance += amount;

        this.addTransaction("TRANSFER_OUT", amount, `Chuyển khoản tới ${targetAccount.accountNumber}`);
        targetAccount.addTransaction("TRANSFER_IN", amount, `Nhận chuyển khoản từ ${this.accountNumber}`);
        this.updateTime();
        targetAccount.updateTime();
    }

}

module.exports = Account;