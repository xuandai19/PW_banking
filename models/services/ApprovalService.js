const approvalRepository = require("../repositories/ApprovalRepository");

class ApprovalService {

    async queue(request) {
        return approvalRepository.create({
            ...request,
            status: "PENDING",
            approvedAt: null,
            rejectedAt: null,
            note: request.description || request.type || "Yêu cầu mới",
            history: []
        });
    }

    async getPending() {
        const all = await approvalRepository.findAll();
        return all.filter(r => r.status === "PENDING");
    }

    async getNotes() {
        const all = await approvalRepository.findAll();
        return all
            .filter(r => r.status !== "PENDING")
            .sort((a, b) => {
                const timeA = new Date(a.approvedAt || a.rejectedAt || a.createdAt).getTime();
                const timeB = new Date(b.approvedAt || b.rejectedAt || b.createdAt).getTime();
                return timeB - timeA;
            });
    }

    async getAll() {
        return approvalRepository.findAll();
    }

    buildNote(request, status, reason = null, approver = null) {
        const actionText = status === "APPROVED" ? "Đã duyệt" : "Đã từ chối";
        const actor = approver?.username ? ` bởi ${approver.username}` : "";
        const suffix = reason ? ` - ${reason}` : "";
        return `${actionText}${actor}: ${request.description || request.type} (${request.requestedBy || "Hệ thống"})${suffix}`;
    }

    async approve(id, approver = null) {
        const request = await approvalRepository.findById(id);
        if (!request) throw new Error("Không tìm thấy yêu cầu.");
        if (request.status !== "PENDING") throw new Error("Yêu cầu này đã được xử lý.");

        await this.applyRequest(request);

        request.status = "APPROVED";
        request.approvedAt = new Date();
        request.approvedBy = approver?.username || null;
        request.note = this.buildNote(request, "APPROVED", null, approver);
        request.history = request.history || [];
        request.history.push({
            status: "APPROVED",
            note: request.note,
            updatedAt: new Date()
        });

        return approvalRepository.update(request);
    }

    async applyRequest(request) {
        const accountService = require("./AccountService");
        const branchService = require("./BranchService");
        const payload = request.payload || {};

        switch (request.type) {
            case "CREATE_BRANCH":
                return branchService.create({
                    name: payload.name,
                    address: payload.address,
                    phone: payload.phone,
                    bankId: payload.bankId == null ? null : Number(payload.bankId)
                });
            case "CREATE_ACCOUNT":
                return accountService.create({
                    accountNumber: payload.accountNumber,
                    ownerName: payload.ownerName,
                    balance: Number(payload.balance || 0),
                    branchId: Number(payload.branchId),
                    status: payload.status || "ACTIVE",
                    email: payload.email
                });
            case "UPDATE_ACCOUNT":
                return accountService.update(Number(payload.id), payload.data || {});
            case "DELETE_ACCOUNT":
                return accountService.delete(Number(payload.id));
            case "DEPOSIT":
                return accountService.deposit(Number(payload.accountId), Number(payload.amount), payload.description);
            case "WITHDRAW":
                return accountService.withdraw(Number(payload.accountId), Number(payload.amount), payload.description);
            case "TRANSFER":
                return accountService.transfer(
                    Number(payload.fromAccountId),
                    Number(payload.toAccountId),
                    Number(payload.amount),
                    payload.description
                );
            default:
                throw new Error("Loại yêu cầu không hợp lệ.");
        }
    }

    async reject(id, reason = "Từ chối", approver = null) {
        const request = await approvalRepository.findById(id);
        if (!request) throw new Error("Không tìm thấy yêu cầu.");
        if (request.status !== "PENDING") throw new Error("Yêu cầu này đã được xử lý.");

        request.status = "REJECTED";
        reason = String(reason || "").trim();
        if (!reason) throw new Error("Vui lòng nhập lý do từ chối.");
        request.reason = reason;
        request.rejectedAt = new Date();
        request.rejectedBy = approver?.username || null;
        request.note = this.buildNote(request, "REJECTED", reason, approver);
        request.history = request.history || [];
        request.history.push({
            status: "REJECTED",
            note: request.note,
            updatedAt: new Date()
        });

        return approvalRepository.update(request);
    }
}

module.exports = new ApprovalService();
