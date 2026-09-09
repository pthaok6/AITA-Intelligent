"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.examService = exports.ExamService = void 0;
const exam_repository_1 = require("./exam.repository");
class ExamService {
    examRepo;
    constructor(examRepo = exam_repository_1.examRepository) {
        this.examRepo = examRepo;
    }
    async createExam(data) {
        return this.examRepo.create({
            ...data,
            startTime: new Date(data.startTime),
            endTime: new Date(data.endTime),
        });
    }
    async getExamById(id, isLecturer = false) {
        const exam = await this.examRepo.findById(id, isLecturer);
        if (!exam)
            throw new Error('Không tìm thấy bài thi');
        return exam;
    }
    async getExamsByClass(classId) {
        return this.examRepo.findByClassId(classId);
    }
    async addTestCase(examId, data) {
        return this.examRepo.addTestCase(examId, data);
    }
}
exports.ExamService = ExamService;
exports.examService = new ExamService();
