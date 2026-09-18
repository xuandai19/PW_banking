const customerService = require("../models/services/CustomerService");
const tokenUtils = require("../utils/jwt");

const CUSTOMER_TOKEN_TTL = customerService.getTokenTtlSeconds();

function setAuthCookie(res, token) {
    const maxAgeMs = CUSTOMER_TOKEN_TTL * 1000;
    const isProd = process.env.NODE_ENV === "production";
    const parts = [
        `customer_token=${encodeURIComponent(token)}`,
        "Path=/",
        `Max-Age=${CUSTOMER_TOKEN_TTL}`,
        "SameSite=Lax",
        "HttpOnly"
    ];
    if (isProd) parts.push("Secure");
    res.setHeader("Set-Cookie", parts.join("; "));
    return {
        expiresAt: Date.now() + maxAgeMs,
        expiresIn: CUSTOMER_TOKEN_TTL
    };
}

function clearAuthCookie(res) {
    res.setHeader(
        "Set-Cookie",
        "customer_token=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly"
    );
}

function sendServiceError(res, error) {
    const status = error.code === "NOT_VERIFIED" ? 403 : 400;
    const body = { message: error.message };
    if (error.code === "NOT_VERIFIED") {
        body.isVerified = false;
        body.mustChangePassword = error.mustChangePassword;
        body.hasOtp = error.hasOtp;
    }
    res.status(status).json(body);
}

class CustomerController {
    async login(req, res) {
        try {
            const { username, password } = req.body;
            const result = await customerService.login(username, password);

            const token = tokenUtils.encode(
                {
                    id: result.customer.id,
                    username: result.customer.username,
                    role: "CUSTOMER",
                    accountId: result.customer.accountId
                },
                CUSTOMER_TOKEN_TTL
            );

            const cookieMeta = setAuthCookie(res, token);

            console.log(
                `[Customer] Login success | id=${result.customer.id} | username=${result.customer.username} | account=${result.account.accountNumber} | tokenTTL=${CUSTOMER_TOKEN_TTL}s | verified=${result.customer.isVerified}`
            );

            res.status(200).json({
                token,
                expiresIn: cookieMeta.expiresIn,
                expiresAt: cookieMeta.expiresAt,
                user: result.customer,
                account: result.account,
                mustChangePassword: result.customer.mustChangePassword,
                isVerified: result.customer.isVerified
            });
        } catch (error) {
            res.status(401).json({ message: error.message });
        }
    }

    async logout(req, res) {
        clearAuthCookie(res);
        res.json({ message: "Đã đăng xuất." });
    }

    async me(req, res) {
        try {
            const profile = await customerService.getProfile(req.customer.id);
            res.json(profile);
        } catch (error) {
            res.status(404).json({ message: error.message });
        }
    }

    async balance(req, res) {
        try {
            const data = await customerService.getBalance(req.customer.id);
            res.json(data);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async listBanks(req, res) {
        try {
            const banks = await customerService.listBanks();
            res.json(banks);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async lookupRecipient(req, res) {
        try {
            const { accountNumber, bankId } = req.query;
            const data = await customerService.lookupRecipient(accountNumber, bankId);
            res.json(data);
        } catch (error) {
            sendServiceError(res, error);
        }
    }

    async deposit(req, res) {
        try {
            const { amount } = req.body;
            const data = await customerService.deposit(req.customer.id, amount);
            res.json(data);
        } catch (error) {
            sendServiceError(res, error);
        }
    }

    async withdraw(req, res) {
        try {
            const { amount } = req.body;
            const data = await customerService.withdraw(req.customer.id, amount);
            res.json(data);
        } catch (error) {
            sendServiceError(res, error);
        }
    }

    async transfer(req, res) {
        try {
            const { toAccountNumber, amount, description, otp, bankId } = req.body;
            const data = await customerService.transfer(req.customer.id, {
                toAccountNumber,
                amount,
                description,
                otp,
                bankId
            });
            res.json(data);
        } catch (error) {
            sendServiceError(res, error);
        }
    }

    async transactions(req, res) {
        try {
            const list = await customerService.getTransactions(req.customer.id);
            res.json(list);
        } catch (error) {
            sendServiceError(res, error);
        }
    }

    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const data = await customerService.changePassword(
                req.customer.id,
                currentPassword,
                newPassword
            );
            res.json(data);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async setOtp(req, res) {
        try {
            const { otp, currentPassword } = req.body;
            const data = await customerService.setOtp(
                req.customer.id,
                otp,
                currentPassword
            );
            res.json(data);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async updateEmail(req, res) {
        try {
            const { email, currentPassword } = req.body;
            const data = await customerService.updateEmail(
                req.customer.id,
                email,
                currentPassword
            );
            res.json(data);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async forgotPassword(req, res) {
        try {
            const result = await customerService.forgotPassword(req.body || {});
            res.json(result);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }

    async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;
            const data = await customerService.resetPassword(token, newPassword);
            res.json(data);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
}

module.exports = new CustomerController();
