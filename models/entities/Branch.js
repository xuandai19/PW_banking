const BaseEntity = require("./BaseEntity");

class Branch extends BaseEntity {

    constructor(id, name, address, phone) {
        super(id);

        this.name = name;
        this.address = address;
        this.phone = phone;

        this.accounts = [];
    }

    addAccount(account) {
        this.accounts.push(account);
        this.updateTime();
    }

    removeAccount(accountId) {
        this.accounts = this.accounts.filter(
            account => account.id !== accountId
        );

        this.updateTime();
    }

    findAccount(accountId) {
        return this.accounts.find(
            account => account.id === accountId
        );
    }
}

module.exports = Branch;