import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { PrismaClient, Prisma, User } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma';
import { allowedDomains, jwtSecret } from '../../config';
import { HttpError } from '../../shared/http';

export const ACCESS_SECONDS = 15 * 60;
export const REFRESH_SECONDS = 7 * 24 * 60 * 60;
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
const googleClient = new OAuth2Client();
export const publicUser = (user: User) => ({ id: user.id, email: user.email, fullName: user.fullName, role: user.role });

export function institutionalEmail(value: unknown): string {
  if (typeof value !== 'string') throw new HttpError(400, 'Email không hợp lệ.');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Email không hợp lệ.');
  if (!allowedDomains().includes(email.split('@')[1])) throw new HttpError(403, 'Email này chưa thuộc danh sách miền được cho phép.');
  return email;
}

export function validateGoogleIdentity(payload: TokenPayload | undefined, nonce: string) {
  if (!payload?.sub || payload.email_verified !== true || !payload.email) throw new HttpError(401, 'Tài khoản Google chưa được xác minh.');
  const email = institutionalEmail(payload.email);
  // Google is authoritative for verified Gmail accounts without a Workspace hd claim.
  if (email.split('@')[1] !== 'gmail.com' && (!payload.hd || !allowedDomains().includes(payload.hd.toLowerCase()))) {
    throw new HttpError(403, 'Tài khoản ngoài Gmail phải thuộc tổ chức Google được cho phép.');
  }
  if (!nonce || (payload as TokenPayload & { nonce?: string }).nonce !== nonce) throw new HttpError(401, 'Phiên đăng nhập Google không hợp lệ. Vui lòng thử lại.');
  return { email, subject: payload.sub, name: payload.name || payload.email, picture: payload.picture };
}

export async function authorizeGoogleLink(passwordHash: string | null, password: unknown) {
  // Do not auto-link a password account on email alone: require proof of both identities.
  if (passwordHash && (typeof password !== 'string' || Buffer.byteLength(password) > 72 || !(await bcrypt.compare(password, passwordHash)))) {
    throw new HttpError(409, 'Email đã có tài khoản mật khẩu. Điền mật khẩu hiện tại rồi thử đăng nhập Google lại.');
  }
}

export class AuthService {
  constructor(private db: PrismaClient = prisma) {}
  async register(emailInput: unknown, password: unknown, fullName: unknown, role?: unknown) {
    const email = institutionalEmail(emailInput);
    if (role && role !== 'STUDENT') throw new HttpError(403, 'Tài khoản tự đăng ký chỉ có vai trò sinh viên.');
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) throw new HttpError(400, 'Mật khẩu cần từ 8 ký tự và không quá 72 byte.');
    if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 100) throw new HttpError(400, 'Họ tên cần từ 1 đến 100 ký tự.');
    const user = await this.db.user.create({ data: { email, fullName: fullName.trim(), passwordHash: await bcrypt.hash(password, 12), role: 'STUDENT' } });
    return this.createSession(user);
  }
  async login(emailInput: unknown, password: unknown) {
    const email = institutionalEmail(emailInput);
    if (typeof password !== 'string' || Buffer.byteLength(password) > 72) throw new HttpError(401, 'Email hoặc mật khẩu không chính xác.');
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Email hoặc mật khẩu không chính xác.');
    return this.createSession(user);
  }
  async googleLogin(credential: unknown, nonce: string, password?: unknown) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new HttpError(503, 'Đăng nhập Google chưa được bật.');
    if (typeof credential !== 'string' || credential.length > 10000) throw new HttpError(400, 'Thiếu thông tin đăng nhập Google.');
    let payload: TokenPayload | undefined;
    try { payload = (await googleClient.verifyIdToken({ idToken: credential, audience: clientId })).getPayload(); }
    catch { throw new HttpError(401, 'Thông tin đăng nhập Google không hợp lệ hoặc đã hết hạn.'); }
    const identity = validateGoogleIdentity(payload, nonce);
    // Link only verified Gmail/Workspace identities. Conditional update prevents a concurrent relink.
    const user = await this.db.$transaction(async tx => {
      const known = await tx.user.findUnique({ where: { googleSubject: identity.subject } });
      if (known) return known;
      const existing = await tx.user.findUnique({ where: { email: identity.email } });
      if (existing) {
        if (!existing.isActive) throw new HttpError(403, 'Tài khoản đã bị vô hiệu hóa.');
        await authorizeGoogleLink(existing.passwordHash, password);
        const linked = await tx.user.updateMany({
          where: { id: existing.id, OR: [{ googleSubject: null }, { googleSubject: identity.subject }] },
          data: { googleSubject: identity.subject, avatarUrl: identity.picture },
        });
        if (linked.count !== 1) throw new HttpError(409, 'Email đã liên kết với tài khoản Google khác.');
        return tx.user.findUniqueOrThrow({ where: { id: existing.id } });
      }
      return tx.user.create({ data: { email: identity.email, fullName: identity.name, avatarUrl: identity.picture, googleSubject: identity.subject, role: 'STUDENT' } });
    });
    if (!user.isActive) throw new HttpError(403, 'Tài khoản đã bị vô hiệu hóa.');
    return this.createSession(user);
  }
  private accessToken(user: User, sessionId: string) {
    return jwt.sign({ userId: user.id, email: user.email, role: user.role, sid: sessionId }, jwtSecret(), {
      expiresIn: ACCESS_SECONDS, algorithm: 'HS256', issuer: 'aita', audience: 'aita-web',
    });
  }
  private async createSession(user: User) {
    jwtSecret();
    const refreshToken = randomBytes(48).toString('base64url');
    const session = await this.db.authSession.create({ data: { userId: user.id, refreshTokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + REFRESH_SECONDS * 1000) } });
    return { user: publicUser(user), token: this.accessToken(user, session.id), refreshToken, expiresAt: session.expiresAt };
  }
  async refresh(refreshToken: unknown) {
    if (typeof refreshToken !== 'string' || refreshToken.length > 200) throw new HttpError(401, 'Phiên đăng nhập đã hết hạn.');
    const tokenHash = hashToken(refreshToken);
    const replacement = randomBytes(48).toString('base64url');
    return this.db.$transaction(async tx => {
      const session = await tx.authSession.findUnique({ where: { refreshTokenHash: tokenHash }, include: { user: true } });
      if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) throw new HttpError(401, 'Phiên đăng nhập đã hết hạn.');
      const rotated = await tx.authSession.updateMany({ where: { id: session.id, refreshTokenHash: tokenHash, revokedAt: null, expiresAt: { gt: new Date() } }, data: { refreshTokenHash: hashToken(replacement) } });
      if (rotated.count !== 1) throw new HttpError(401, 'Refresh token đã được sử dụng.');
      return { user: publicUser(session.user), token: this.accessToken(session.user, session.id), refreshToken: replacement, expiresAt: session.expiresAt };
    });
  }
  async authenticate(token: string) {
    let decoded: JwtPayload;
    try {
      const value = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'], issuer: 'aita', audience: 'aita-web' });
      if (typeof value === 'string' || typeof value.sid !== 'string' || typeof value.userId !== 'string') throw new Error();
      decoded = value;
    } catch { throw new HttpError(401, 'Token không hợp lệ hoặc đã hết hạn.'); }
    const session = await this.db.authSession.findUnique({ where: { id: decoded.sid }, include: { user: true } });
    if (!session || session.userId !== decoded.userId || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive || session.user.role !== decoded.role) throw new HttpError(401, 'Phiên đăng nhập không còn hiệu lực.');
    return { userId: session.user.id, email: session.user.email, role: session.user.role, sessionId: session.id };
  }
  async logout(refreshToken?: string, accessToken?: string) {
    const selectors: Prisma.AuthSessionWhereInput[] = refreshToken ? [{ refreshTokenHash: hashToken(refreshToken) }] : [];
    if (accessToken) {
      try {
        const payload = jwt.verify(accessToken, jwtSecret(), { algorithms: ['HS256'], issuer: 'aita', audience: 'aita-web', ignoreExpiration: true }) as JwtPayload;
        if (typeof payload.sid === 'string') selectors.push({ id: payload.sid });
      } catch { /* Invalid access token cannot select a session to revoke. */ }
    }
    if (selectors.length) await this.db.authSession.updateMany({ where: { OR: selectors, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
export const authService = new AuthService();
