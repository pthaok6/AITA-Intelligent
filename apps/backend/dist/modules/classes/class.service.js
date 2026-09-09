"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classService = exports.ClassService = void 0;
const class_repository_1 = require("./class.repository");
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
    async getClassDetails(classId) {
        const cls = await this.classRepo.findById(classId);
        if (!cls)
            throw new Error('Không tìm thấy lớp học');
        return cls;
    }
    async enrollStudent(classId, studentId) {
        return this.classRepo.enrollStudent(classId, studentId);
    }
    async getMyClasses(userId, role) {
        if (role === 'STUDENT') {
            return this.classRepo.findStudentClasses(userId);
        }
        return this.classRepo.findAll();
    }
}
exports.ClassService = ClassService;
exports.classService = new ClassService();
