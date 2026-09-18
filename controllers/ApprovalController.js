const approvalService = require("../models/services/ApprovalService");

class ApprovalController {

    async getPending(req, res) {
        try {
            res.json(await approvalService.getPending());
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getNotes(req, res) {
        try {
            res.json(await approvalService.getNotes());
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async getAll(req, res) {
        try {
            res.json(await approvalService.getAll());
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

    async approve(req, res) {
        try {
            const result = await approvalService.approve(Number(req.params.id), req.user);
            res.json(result);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async reject(req, res) {
        try {
            const reason = req.body?.reason || "Từ chối";
            const result = await approvalService.reject(Number(req.params.id), reason, req.user);
            res.json(result);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
}


// getAll / getPending / approve / reject already match routes

module.exports = new ApprovalController();
