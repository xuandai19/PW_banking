/**
 * Email service – mặc định dùng Ethereal Email (miễn phí, test tự động).
 *
 * EMAIL_MODE:
 *   ethereal  (mặc định) – https://ethereal.email , tự tạo tài khoản SMTP test
 *   console   – chỉ in link ra terminal
 *   smtp      – Mailtrap / Gmail / Resend (cấu hình SMTP_*)
 *
 * Biến môi trường:
 *   FRONTEND_URL=http://localhost:5173
 *   EMAIL_FROM=Banking System <noreply@banking.local>
 *   EMAIL_MODE=ethereal|console|smtp
 */

const crypto = require("crypto");

let nodemailer = null;
try {
    nodemailer = require("nodemailer");
} catch {
    console.warn("[Email] nodemailer chưa cài. Chạy: cd backend && npm install nodemailer");
}

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const EMAIL_FROM = process.env.EMAIL_FROM || "Banking System <noreply@banking.local>";
// Mặc định ethereal khi có nodemailer, không thì console
const EMAIL_MODE = (
    process.env.EMAIL_MODE ||
    (nodemailer ? "ethereal" : "console")
).toLowerCase();

function generateToken() {
     // Tạo 32 bytes ngẫu nhiên → 64 ký tự hex
    return crypto.randomBytes(32).toString("hex");
}

let transporterPromise = null;
let etherealAccount = null;

async function getTransporter() {
    if (!nodemailer) {
        return null;
    }

    if (transporterPromise) {
        return transporterPromise;
    }

    transporterPromise = (async () => {
        if (EMAIL_MODE === "ethereal") {
            try {
                etherealAccount = await nodemailer.createTestAccount();
                console.log("\n========== ETHEREAL EMAIL (test) ==========");
                console.log("User :", etherealAccount.user);
                console.log("Pass :", etherealAccount.pass);
                console.log("Web  : https://ethereal.email/login");
                console.log("→ Đăng nhập web trên để xem hộp thư test");
                console.log("===========================================\n");

                return nodemailer.createTransport({
                    host: "smtp.ethereal.email",
                    port: 587,
                    secure: false,
                    auth: {
                        user: etherealAccount.user,
                        pass: etherealAccount.pass
                    }
                });
            } catch (err) {
                console.error("[Email] Không tạo được Ethereal account:", err.message);
                console.warn("[Email] Fallback → console mode");
                return null;
            }
        }

        if (EMAIL_MODE === "smtp") {
            const host = process.env.SMTP_HOST;
            const port = Number(process.env.SMTP_PORT || 587);
            const user = process.env.SMTP_USER;
            const pass = process.env.SMTP_PASS;
            const secure = String(process.env.SMTP_SECURE || "false") === "true";

            if (!host || !user || !pass) {
                throw new Error(
                    "SMTP chưa được cấu hình. Cần SMTP_HOST, SMTP_USER và SMTP_PASS để gửi email thật."
                );
            }

            return nodemailer.createTransport({
                host,
                port,
                secure,
                auth: { user, pass }
            });
        }

        // console mode
        return null;
    })();

    return transporterPromise;
}

async function sendMail({ to, subject, html, text }) {
    const transporter = await getTransporter();

    if (!transporter && EMAIL_MODE === "smtp") {
        throw new Error("Không thể khởi tạo SMTP transporter. Kiểm tra cấu hình SMTP.");
    }

    if (!transporter) {
        console.log("\n========== EMAIL (CONSOLE MODE) ==========");
        console.log("To:", to);
        console.log("Subject:", subject);
        console.log(text || html);
        console.log("==========================================\n");
        return { mode: "console", preview: null };
    }

    const info = await transporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject,
        text,
        html
    });

    let preview = null;
    if (nodemailer.getTestMessageUrl) {
        preview = nodemailer.getTestMessageUrl(info);
    }

    return {
        mode: EMAIL_MODE,
        preview,
        messageId: info.messageId,
        etherealUser: etherealAccount?.user || null
    };
}

async function sendVerificationEmail(user, token) {
    const link = `${FRONTEND_URL}/verify-email?token=${token}`;
    const subject = "Xác thực tài khoản Banking System";
    const text = [
        `Xin chào ${user.fullName || user.username},`,
        "",
        "Vui lòng xác thực email bằng cách mở liên kết sau:",
        link,
        "",
        "Liên kết có hiệu lực trong 24 giờ.",
        "Nếu bạn không yêu cầu, hãy bỏ qua email này."
    ].join("\n");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:12px">
        <h2 style="color:#1565c0;margin-top:0">Xác thực tài khoản</h2>
        <p>Xin chào <strong>${user.fullName || user.username}</strong>,</p>
        <p>Tài khoản <strong>${user.username}</strong> đã được tạo. Vui lòng xác thực email để đăng nhập.</p>
        <p style="text-align:center;margin:28px 0">
          <a href="${link}" style="background:#1565c0;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
            Xác thực email
          </a>
        </p>
        <p style="color:#666;font-size:13px">Hoặc copy link: <br/><a href="${link}">${link}</a></p>
        <p style="color:#999;font-size:12px">Link hết hạn sau 24 giờ.</p>
      </div>
    `;

    const result = await sendMail({ to: user.email, subject, html, text });
    return { ...result, link };
}

async function sendResetPasswordEmail(user, token) {
    const link = `${FRONTEND_URL}/reset-password?token=${token}`;
    const subject = "Đặt lại mật khẩu Banking System";
    const text = [
        `Xin chào ${user.fullName || user.username},`,
        "",
        "Bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu. Mở liên kết sau để đổi mật khẩu mới:",
        link,
        "",
        "Liên kết có hiệu lực trong 1 giờ.",
        "Nếu bạn không yêu cầu, hãy bỏ qua email này."
    ].join("\n");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:12px">
        <h2 style="color:#1565c0;margin-top:0">Đặt lại mật khẩu</h2>
        <p>Xin chào <strong>${user.fullName || user.username}</strong>,</p>
        <p>Nhấn nút bên dưới để tạo mật khẩu mới cho tài khoản <strong>${user.username}</strong>.</p>
        <p style="text-align:center;margin:28px 0">
          <a href="${link}" style="background:#1565c0;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
            Đặt lại mật khẩu
          </a>
        </p>
        <p style="color:#666;font-size:13px">Hoặc copy link: <br/><a href="${link}">${link}</a></p>
        <p style="color:#999;font-size:12px">Link hết hạn sau 1 giờ. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>
      </div>
    `;

    const result = await sendMail({ to: user.email, subject, html, text });
    return { ...result, link };
}

async function sendCustomerResetPasswordEmail(user, token) {
    const link = `${FRONTEND_URL}/customer/reset-password?token=${encodeURIComponent(token)}`;
    const subject = "Đặt lại mật khẩu Portal Khách hàng – Banking System";
    const text = [
        `Xin chào ${user.fullName || user.username},`,
        "",
        "Bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu portal khách hàng. Mở liên kết sau để đổi mật khẩu mới:",
        link,
        "",
        "Liên kết có hiệu lực trong 1 giờ.",
        "Nếu bạn không yêu cầu, hãy bỏ qua email này."
    ].join("\n");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:12px">
        <h2 style="color:#1565c0;margin-top:0">Đặt lại mật khẩu khách hàng</h2>
        <p>Xin chào <strong>${user.fullName || user.username}</strong>,</p>
        <p>Nhấn nút bên dưới để tạo mật khẩu mới cho tài khoản <strong>${user.username}</strong>.</p>
        <p style="text-align:center;margin:28px 0">
          <a href="${link}" style="background:#1565c0;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
            Đặt lại mật khẩu
          </a>
        </p>
        <p style="color:#666;font-size:13px">Hoặc copy link: <br/><a href="${link}">${link}</a></p>
        <p style="color:#999;font-size:12px">Link hết hạn sau 1 giờ. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.</p>
      </div>
    `;

    const result = await sendMail({ to: user.email, subject, html, text });
    return { ...result, link };
}

module.exports = {
    generateToken,
    sendVerificationEmail,
    sendResetPasswordEmail,
    sendCustomerResetPasswordEmail,
    initEmail,
    FRONTEND_URL,
    EMAIL_MODE
};
