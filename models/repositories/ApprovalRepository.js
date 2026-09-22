const { query } = require("../../config/db");

function parseJson(value, fallback) {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "object") return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function mapRow(row) {
    if (!row) return null;
    return {
        id: row.id,
        type: row.type,
        description: row.description,
        requestedBy: row.requested_by,
        requestedRole: row.requested_role,
        payload: parseJson(row.payload, {}),
        status: row.status,
        note: row.note,
        history: parseJson(row.history, []),
        approvedBy: row.approved_by,
        approvedAt: row.approved_at,
        rejectedAt: row.rejected_at,
        reason: row.reason || null,
        rejectedBy: row.rejected_by || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

class ApprovalRepository {

    async create(request) {
        const result = await query(
            `INSERT INTO approvals
             (type, description, requested_by, requested_role, payload, status, note, history,
              approved_by, approved_at, rejected_at, reason, rejected_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                request.type,
                request.description || null,
                request.requestedBy || null,
                request.requestedRole || null,
                JSON.stringify(request.payload || {}),
                request.status || "PENDING",
                request.note || null,
                JSON.stringify(request.history || []),
                request.approvedBy || null,
                request.approvedAt || null,
                request.rejectedAt || null,
                request.reason || null,
                request.rejectedBy || null
            ]
        );
        return this.findById(result.insertId);
    }

    async findAll() {
        const rows = await query("SELECT * FROM approvals ORDER BY id DESC");
        return rows.map(mapRow);
    }

    async findById(id) {
        const rows = await query("SELECT * FROM approvals WHERE id = ? LIMIT 1", [id]);
        return mapRow(rows[0]);
    }

    async getNextId() {
        const rows = await query("SELECT IFNULL(MAX(id), 0) + 1 AS nextId FROM approvals");
        return rows[0].nextId;
    }

    async update(request) {
        await query(
            `UPDATE approvals SET
               type = ?, description = ?, requested_by = ?, requested_role = ?,
               payload = ?, status = ?, note = ?, history = ?,
               approved_by = ?, approved_at = ?, rejected_at = ?, reason = ?, rejected_by = ?
             WHERE id = ?`,
            [
                request.type,
                request.description || null,
                request.requestedBy || null,
                request.requestedRole || null,
                JSON.stringify(request.payload || {}),
                request.status,
                request.note || null,
                JSON.stringify(request.history || []),
                request.approvedBy || null,
                request.approvedAt || null,
                request.rejectedAt || null,
                request.reason || null,
                request.rejectedBy || null,
                request.id
            ]
        );
        return this.findById(request.id);
    }

    async delete(id) {
        await query("DELETE FROM approvals WHERE id = ?", [id]);
    }
}

module.exports = new ApprovalRepository();
