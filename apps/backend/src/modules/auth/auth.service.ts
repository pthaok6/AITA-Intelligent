import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userRepository, UserRepository } from './user.repository';
import { UserRole } from '../../domain/enums';

const JWT_SECRET = process.env.JWT_SECRET || 'aita-super-secret-key-swp391-2026';

export class AuthService {
  constructor(private userRepo: UserRepository = userRepository) {}

  async register(email: string, password: string, fullName: string, role: string) {
    const existing = await this.userRepo.findByEmail(email);
    if (existing) {
      throw new Error('Email đã tồn tại trong hệ thống');
    }

    const validRoles = [UserRole.ADMIN, UserRole.LECTURER, UserRole.STUDENT];
    const userRole = validRoles.includes(role as UserRole) ? role : UserRole.STUDENT;

    const passwordHash = await bcrypt.hash(password, 10);
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

  async login(email: string, password: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new Error('Email hoặc mật khẩu không chính xác');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
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

  private generateToken(userId: string, email: string, role: string): string {
    return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: '7d' });
  }
}

export const authService = new AuthService();
