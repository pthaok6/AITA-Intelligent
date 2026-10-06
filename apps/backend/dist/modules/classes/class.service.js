"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classService = exports.ClassService = void 0;
const class_repository_1 = require("./class.repository");
const http_1 = require("../../shared/http");
class ClassService {
    classRepo;
    constructor(classRepo = class_repository_1.classRepository) {
        this.classRepo = classRepo;
    }
    async createClass(classCode, name, lecturerId, semester) {
        return this.classRepo.create({ classCode, name, lecturerId, semester });
    }
    async getAllClasses() {
        return this.classRepo.findAll();
    }
    async getClassDetails(classId, actor) {
        const cls = await this.classRepo.findById(classId);
        if (!cls)
            throw new Error('Không tìm thấy lớp học');
        if (actor && actor.role !== 'ADMIN' && cls.lecturerId !== actor.userId && !cls.enrollments.some(e => e.studentId === actor.userId && e.status === 'ACTIVE'))
            throw new http_1.HttpError(403, 'Bạn không có quyền xem lớp này.');
        return cls;
    }
    async enrollStudent(classId, studentId) {
        return this.classRepo.enrollStudent(classId, studentId);
    }
    async getMyClasses(userId, role) {
        if (role === 'STUDENT') {
            return this.classRepo.findStudentClasses(userId);
        }
        return this.classRepo.findAll(role === 'LECTURER' ? userId : undefined);
    }
}
exports.ClassService = ClassService;
exports.classService = new ClassService();
