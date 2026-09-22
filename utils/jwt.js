const crypto = require("crypto");

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN_SECONDS = Number(process.env.JWT_EXPIRES_IN_SECONDS || 7200);

if (!SECRET || SECRET.length < 32) {
    throw new Error("JWT_SECRET phải được cấu hình và có ít nhất 32 ký tự.");
}

function base64url(value) {
    return Buffer.from(value).toString("base64url");
}

//tạo chữ ký
function sign(input) {
    return crypto.createHmac("sha256", SECRET).update(input).digest("base64url");
}

//tạo JWT – expiresInSeconds tùy chọn (mặc định JWT_EXPIRES_IN_SECONDS)
function encode(payload = {}, expiresInSeconds) {
    const now = Math.floor(Date.now() / 1000);
    const ttl = Number.isFinite(Number(expiresInSeconds))
        ? Number(expiresInSeconds)
        : EXPIRES_IN_SECONDS;
    const header = { alg: "HS256", typ: "JWT" };
    const body = { ...payload, iat: now, exp: now + ttl };
    const encodedHeader = base64url(JSON.stringify(header));
    const encodedBody = base64url(JSON.stringify(body));
    const unsigned = `${encodedHeader}.${encodedBody}`;
    return `${unsigned}.${sign(unsigned)}`;
}

//xác thực JWT
function decode(token) {
    try {
        // 1. Kiểm tra định dạng
        if (typeof token !== "string") return null;
        const parts = token.split(".");
        if (parts.length !== 3) return null;

        // 2. Xác thực chữ ký
        const [encodedHeader, encodedBody, signature] = parts;
        const unsigned = `${encodedHeader}.${encodedBody}`;
        const expected = sign(unsigned);
        
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

        const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
        if (header.alg !== "HS256" || header.typ !== "JWT") return null;

        const payload = JSON.parse(Buffer.from(encodedBody, "base64url").toString("utf8"));
        if (!payload.exp || Number(payload.exp) <= Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch {
        return null;
    }
}

module.exports = { encode, decode, EXPIRES_IN_SECONDS };