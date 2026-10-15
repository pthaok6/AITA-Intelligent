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
        return this.classRepo.create({ classCode: classCode.trim(), name: name.trim(), lecturerId, semester: semester.trim() });
    }
    async updateClass(classId, data) {
        if (!data.classCode.trim() || !data.name.trim() || !data.semester.trim())
            throw new Error('Mã lớp, tên lớp và học kỳ không được để trống.');
        return this.classRepo.update(classId, { classCode: data.classCode.trim(), name: data.name.trim(), semester: data.semester.trim() });
    }
    async deleteClass(classId) { return this.classRepo.deleteIfEmpty(classId); }
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
    async reactivateStudent(classId, studentId) {
        if (!(await this.classRepo.isStudent(studentId)))
            throw new Error('Chỉ có thể ghi danh tài khoản sinh viên đang hoạt động.');
        return this.classRepo.enrollStudent(classId, studentId);
    }
    async enrollByCode(classCode, studentId) {
        const cls = await this.classRepo.findByCode(classCode.trim());
        if (!cls)
            throw new Error('Không tìm thấy lớp theo mã đã nhập.');
        await this.classRepo.enrollStudent(cls.id, studentId);
        return cls;
    }
    async dropStudent(classId, studentId) { return this.classRepo.dropStudent(classId, studentId); }
    async removeStudentFromClass(classId, studentId) {
        const result = await this.classRepo.removeStudentFromClass(classId, studentId);
        if (result.count === 0)
            throw new Error('Sinh viên không còn trong lớp này.');
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
