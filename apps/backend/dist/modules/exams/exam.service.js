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
        if (!['PYTHON', 'CSHARP', 'JAVA'].includes(data.allowedLanguage))
            throw new Error('Chỉ hỗ trợ PYTHON, CSHARP và JAVA.');
        const time = data.timeLimitMs ?? 2000, memory = data.memoryLimitMb ?? 512;
        if (!Number.isInteger(time) || time < 1 || time > 10000 || !Number.isInteger(memory) || memory < 64 || memory > 512)
            throw new Error('Thời gian 1..10000 ms; RAM 64..512 MiB.');
        if (!Number.isFinite(Date.parse(data.startTime)) || !Number.isFinite(Date.parse(data.endTime)) || Date.parse(data.endTime) <= Date.parse(data.startTime))
            throw new Error('Thời gian bắt đầu/kết thúc không hợp lệ.');
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
