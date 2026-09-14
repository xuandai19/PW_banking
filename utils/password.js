const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

async function hashPassword(password) {
    const value = String(password ?? "");
    if (!value) throw new Error("Mật khẩu không được để trống.");
    const salt = crypto.randomBytes(16).toString("hex");
    const derived = await scrypt(value, salt, KEY_LENGTH, {
        N: COST,
        r: BLOCK_SIZE,
        p: PARALLELIZATION,
        maxmem: 32 * 1024 * 1024
    });
    return `scrypt$${COST}$${BLOCK_SIZE}$${PARALLELIZATION}$${salt}$${derived.toString("hex")}`;
}

async function comparePassword(password, stored) {
    if (typeof stored !== "string" || !stored.startsWith("scrypt$")) return false;
    const [scheme, n, r, p, salt, hash] = stored.split("$");
    if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
    try {
        const derived = await scrypt(String(password ?? ""), salt, Buffer.from(hash, "hex").length, {
            N: Number(n), r: Number(r), p: Number(p), maxmem: 32 * 1024 * 1024
        });
        const expected = Buffer.from(hash, "hex");
        return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
    } catch {
        return false;
    }
}

function isHashedPassword(value) {
    return typeof value === "string" && value.startsWith("scrypt$");
}

module.exports = { hashPassword, comparePassword, isHashedPassword };
