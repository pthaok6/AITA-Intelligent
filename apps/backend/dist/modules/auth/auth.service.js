"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = exports.publicUser = exports.hashToken = exports.REFRESH_SECONDS = exports.ACCESS_SECONDS = void 0;
exports.institutionalEmail = institutionalEmail;
exports.validateGoogleIdentity = validateGoogleIdentity;
exports.authorizeGoogleLink = authorizeGoogleLink;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const node_crypto_1 = require("node:crypto");
const google_auth_library_1 = require("google-auth-library");
const prisma_1 = require("../../infrastructure/database/prisma");
const config_1 = require("../../config");
const http_1 = require("../../shared/http");
exports.ACCESS_SECONDS = 15 * 60;
exports.REFRESH_SECONDS = 7 * 24 * 60 * 60;
const hashToken = (value) => (0, node_crypto_1.createHash)('sha256').update(value).digest('hex');
exports.hashToken = hashToken;
const googleClient = new google_auth_library_1.OAuth2Client();
const publicUser = (user) => ({ id: user.id, email: user.email, fullName: user.fullName, role: user.role });
exports.publicUser = publicUser;
function institutionalEmail(value) {
    if (typeof value !== 'string')
        throw new http_1.HttpError(400, 'Email không hợp lệ.');
    const email = value.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new http_1.HttpError(400, 'Email không hợp lệ.');
    if (!(0, config_1.allowedDomains)().includes(email.split('@')[1]))
        throw new http_1.HttpError(403, 'Email này chưa thuộc danh sách miền được cho phép.');
    return email;
}
function validateGoogleIdentity(payload, nonce) {
    if (!payload?.sub || payload.email_verified !== true || !payload.email)
        throw new http_1.HttpError(401, 'Tài khoản Google chưa được xác minh.');
    const email = institutionalEmail(payload.email);
    // Google is authoritative for verified Gmail accounts without a Workspace hd claim.
    if (email.split('@')[1] !== 'gmail.com' && (!payload.hd || !(0, config_1.allowedDomains)().includes(payload.hd.toLowerCase()))) {
        throw new http_1.HttpError(403, 'Tài khoản ngoài Gmail phải thuộc tổ chức Google được cho phép.');
    }
    if (!nonce || payload.nonce !== nonce)
        throw new http_1.HttpError(401, 'Phiên đăng nhập Google không hợp lệ. Vui lòng thử lại.');
    return { email, subject: payload.sub, name: payload.name || payload.email, picture: payload.picture };
}
async function authorizeGoogleLink(passwordHash, password) {
    // Do not auto-link a password account on email alone: require proof of both identities.
    if (passwordHash && (typeof password !== 'string' || Buffer.byteLength(password) > 72 || !(await bcryptjs_1.default.compare(password, passwordHash)))) {
        throw new http_1.HttpError(409, 'Email đã có tài khoản mật khẩu. Điền mật khẩu hiện tại rồi thử đăng nhập Google lại.');
    }
}
class AuthService {
    db;
    constructor(db = prisma_1.prisma) {
        this.db = db;
    }
    async register(emailInput, password, fullName, role) {
        const email = institutionalEmail(emailInput);
        if (role && role !== 'STUDENT')
            throw new http_1.HttpError(403, 'Tài khoản tự đăng ký chỉ có vai trò sinh viên.');
        if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72)
            throw new http_1.HttpError(400, 'Mật khẩu cần từ 8 ký tự và không quá 72 byte.');
        if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 100)
            throw new http_1.HttpError(400, 'Họ tên cần từ 1 đến 100 ký tự.');
        const user = await this.db.user.create({ data: { email, fullName: fullName.trim(), passwordHash: await bcryptjs_1.default.hash(password, 12), role: 'STUDENT' } });
        return this.createSession(user);
    }
    async login(emailInput, password) {
        const email = institutionalEmail(emailInput);
        if (typeof password !== 'string' || Buffer.byteLength(password) > 72)
            throw new http_1.HttpError(401, 'Email hoặc mật khẩu không chính xác.');
        const user = await this.db.user.findUnique({ where: { email } });
        if (!user?.passwordHash || !user.isActive || !(await bcryptjs_1.default.compare(password, user.passwordHash)))
            throw new http_1.HttpError(401, 'Email hoặc mật khẩu không chính xác.');
        return this.createSession(user);
    }
    async googleLogin(credential, nonce, password) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId)
            throw new http_1.HttpError(503, 'Đăng nhập Google chưa được bật.');
        if (typeof credential !== 'string' || credential.length > 10000)
            throw new http_1.HttpError(400, 'Thiếu thông tin đăng nhập Google.');
        let payload;
        try {
            payload = (await googleClient.verifyIdToken({ idToken: credential, audience: clientId })).getPayload();
        }
        catch {
            throw new http_1.HttpError(401, 'Thông tin đăng nhập Google không hợp lệ hoặc đã hết hạn.');
        }
        const identity = validateGoogleIdentity(payload, nonce);
        // Link only verified Gmail/Workspace identities. Conditional update prevents a concurrent relink.
        const user = await this.db.$transaction(async (tx) => {
            const known = await tx.user.findUnique({ where: { googleSubject: identity.subject } });
            if (known)
                return known;
            const existing = await tx.user.findUnique({ where: { email: identity.email } });
            if (existing) {
                if (!existing.isActive)
                    throw new http_1.HttpError(403, 'Tài khoản đã bị vô hiệu hóa.');
                await authorizeGoogleLink(existing.passwordHash, password);
                const linked = await tx.user.updateMany({
                    where: { id: existing.id, OR: [{ googleSubject: null }, { googleSubject: identity.subject }] },
                    data: { googleSubject: identity.subject, avatarUrl: identity.picture },
                });
                if (linked.count !== 1)
                    throw new http_1.HttpError(409, 'Email đã liên kết với tài khoản Google khác.');
                return tx.user.findUniqueOrThrow({ where: { id: existing.id } });
            }
            return tx.user.create({ data: { email: identity.email, fullName: identity.name, avatarUrl: identity.picture, googleSubject: identity.subject, role: 'STUDENT' } });
        });
        if (!user.isActive)
            throw new http_1.HttpError(403, 'Tài khoản đã bị vô hiệu hóa.');
        return this.createSession(user);
    }
    accessToken(user, sessionId) {
        return jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role, sid: sessionId }, (0, config_1.jwtSecret)(), {
            expiresIn: exports.ACCESS_SECONDS, algorithm: 'HS256', issuer: 'aita', audience: 'aita-web',
        });
    }
    async createSession(user) {
        (0, config_1.jwtSecret)();
        const refreshToken = (0, node_crypto_1.randomBytes)(48).toString('base64url');
        const session = await this.db.authSession.create({ data: { userId: user.id, refreshTokenHash: (0, exports.hashToken)(refreshToken), expiresAt: new Date(Date.now() + exports.REFRESH_SECONDS * 1000) } });
        return { user: (0, exports.publicUser)(user), token: this.accessToken(user, session.id), refreshToken, expiresAt: session.expiresAt };
    }
    async refresh(refreshToken) {
        if (typeof refreshToken !== 'string' || refreshToken.length > 200)
            throw new http_1.HttpError(401, 'Phiên đăng nhập đã hết hạn.');
        const tokenHash = (0, exports.hashToken)(refreshToken);
        const replacement = (0, node_crypto_1.randomBytes)(48).toString('base64url');
        return this.db.$transaction(async (tx) => {
            const session = await tx.authSession.findUnique({ where: { refreshTokenHash: tokenHash }, include: { user: true } });
            if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive)
                throw new http_1.HttpError(401, 'Phiên đăng nhập đã hết hạn.');
            const rotated = await tx.authSession.updateMany({ where: { id: session.id, refreshTokenHash: tokenHash, revokedAt: null, expiresAt: { gt: new Date() } }, data: { refreshTokenHash: (0, exports.hashToken)(replacement) } });
            if (rotated.count !== 1)
                throw new http_1.HttpError(401, 'Refresh token đã được sử dụng.');
            return { user: (0, exports.publicUser)(session.user), token: this.accessToken(session.user, session.id), refreshToken: replacement, expiresAt: session.expiresAt };
        });
    }
    async authenticate(token) {
        let decoded;
        try {
            const value = jsonwebtoken_1.default.verify(token, (0, config_1.jwtSecret)(), { algorithms: ['HS256'], issuer: 'aita', audience: 'aita-web' });
            if (typeof value === 'string' || typeof value.sid !== 'string' || typeof value.userId !== 'string')
                throw new Error();
            decoded = value;
        }
        catch {
            throw new http_1.HttpError(401, 'Token không hợp lệ hoặc đã hết hạn.');
        }
        const session = await this.db.authSession.findUnique({ where: { id: decoded.sid }, include: { user: true } });
        if (!session || session.userId !== decoded.userId || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive || session.user.role !== decoded.role)
            throw new http_1.HttpError(401, 'Phiên đăng nhập không còn hiệu lực.');
        return { userId: session.user.id, email: session.user.email, role: session.user.role, sessionId: session.id };
    }
    async logout(refreshToken, accessToken) {
        const selectors = refreshToken ? [{ refreshTokenHash: (0, exports.hashToken)(refreshToken) }] : [];
        if (accessToken) {
            try {
                const payload = jsonwebtoken_1.default.verify(accessToken, (0, config_1.jwtSecret)(), { algorithms: ['HS256'], issuer: 'aita', audience: 'aita-web', ignoreExpiration: true });
                if (typeof payload.sid === 'string')
                    selectors.push({ id: payload.sid });
            }
            catch { /* Invalid access token cannot select a session to revoke. */ }
        }
        if (selectors.length)
            await this.db.authSession.updateMany({ where: { OR: selectors, revokedAt: null }, data: { revokedAt: new Date() } });
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
