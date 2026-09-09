"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_repository_1 = require("./user.repository");
const enums_1 = require("../../domain/enums");
const JWT_SECRET = process.env.JWT_SECRET || 'aita-super-secret-key-swp391-2026';
class AuthService {
    userRepo;
    constructor(userRepo = user_repository_1.userRepository) {
        this.userRepo = userRepo;
    }
    async register(email, password, fullName, role) {
        const existing = await this.userRepo.findByEmail(email);
        if (existing) {
            throw new Error('Email đã tồn tại trong hệ thống');
        }
        const validRoles = [enums_1.UserRole.ADMIN, enums_1.UserRole.LECTURER, enums_1.UserRole.STUDENT];
        const userRole = validRoles.includes(role) ? role : enums_1.UserRole.STUDENT;
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const user = await this.userRepo.create({
            email,
            passwordHash,
            fullName,
            role: userRole,
        });
        const token = this.generateToken(user.id, user.email, user.role);
        return {
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
            },
            token,
        };
    }
    async login(email, password) {
        const user = await this.userRepo.findByEmail(email);
        if (!user || !user.passwordHash) {
            throw new Error('Email hoặc mật khẩu không chính xác');
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            throw new Error('Email hoặc mật khẩu không chính xác');
        }
        const token = this.generateToken(user.id, user.email, user.role);
        return {
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                role: user.role,
            },
            token,
        };
    }
    generateToken(userId, email, role) {
        return jsonwebtoken_1.default.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '7d' });
    }
}
exports.AuthService = AuthService;
exports.authService = new AuthService();
