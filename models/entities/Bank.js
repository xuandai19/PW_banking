const BaseEntity = require("./BaseEntity");

class Bank extends BaseEntity {

    constructor(id, name, code, address) {
        super(id);

        this.name = name;
        this.code = code;
        this.address = address;

        this.branches = [];
    }

    addBranch(branch) {
        this.branches.push(branch);
        this.updateTime();
    }

    removeBranch(branchId) {
        this.branches = this.branches.filter(
            branch => branch.id !== branchId
        );

        this.updateTime();
    }

    findBranch(branchId) {
        return this.branches.find(
            branch => branch.id === branchId
        );
    }
}

module.exports = Bank;