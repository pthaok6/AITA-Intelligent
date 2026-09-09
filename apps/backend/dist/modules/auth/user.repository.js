"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRepository = exports.UserRepository = void 0;
const prisma_1 = require("../../infrastructure/database/prisma");
class UserRepository {
    async findByEmail(email) {
        return prisma_1.prisma.user.findUnique({
            where: { email },
        });
    }
    async findById(id) {
        return prisma_1.prisma.user.findUnique({
            where: { id },
        });
    }
    async create(data) {
        return prisma_1.prisma.user.create({
            data,
        });
    }
}
exports.UserRepository = UserRepository;
exports.userRepository = new UserRepository();
