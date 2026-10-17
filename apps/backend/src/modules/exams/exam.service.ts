import { examRepository, ExamRepository } from './exam.repository';

export class ExamService {
  constructor(private examRepo: ExamRepository = examRepository) {}

  async createExam(data: {
    classId: string;
    title: string;
    descriptionMd: string;
    allowedLanguage: string;
    examType?: string;
    timeLimitMs?: number;
    memoryLimitMb?: number;
    startTime: string;
    endTime: string;
    maxTeamSize?: number;
    lowerBound?: number;
    upperBound?: number;
    testCases?: Array<{ inputData: string; expectedOutput: string; isHidden?: boolean; scoreWeight?: number; orderIndex: number }>;
  }) {
    if (!['PYTHON', 'CSHARP', 'JAVA'].includes(data.allowedLanguage)) throw new Error('Chỉ hỗ trợ PYTHON, CSHARP và JAVA.');
    const examType = data.examType === 'GROUP' ? 'GROUP' : 'INDIVIDUAL';
    const time = data.timeLimitMs ?? 2000, memory = data.memoryLimitMb ?? 512;
    if (!Number.isInteger(time) || time < 1 || time > 10000 || !Number.isInteger(memory) || memory < 64 || memory > 512) throw new Error('Thời gian 1..10000 ms; RAM 64..512 MiB.');
    if (!Number.isFinite(Date.parse(data.startTime)) || !Number.isFinite(Date.parse(data.endTime)) || Date.parse(data.endTime) <= Date.parse(data.startTime)) throw new Error('Thời gian bắt đầu/kết thúc không hợp lệ.');
    if (data.maxTeamSize !== undefined && (!Number.isInteger(data.maxTeamSize) || data.maxTeamSize < 2 || data.maxTeamSize > 50)) {
      throw new Error('Số thành viên tối đa phải từ 2 đến 50.');
    }
    return this.examRepo.create({
      ...data,
      examType,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
    });
  }

  async getExamById(id: string, isLecturer: boolean = false) {
    const exam = await this.examRepo.findById(id, isLecturer);
    if (!exam) throw new Error('Không tìm thấy bài thi');
    return exam;
  }

  async getExamsByClass(classId: string) {
    return this.examRepo.findByClassId(classId);
  }

  async updateExam(id: string, data: { title: string; descriptionMd: string; allowedLanguage: string; timeLimitMs: number; memoryLimitMb: number; startTime: string; endTime: string; maxTeamSize?: number; lowerBound?: number; upperBound?: number }) {
    if (!data.title.trim() || !data.descriptionMd.trim()) throw new Error('Tiêu đề và mô tả không được để trống.');
    if (!['PYTHON', 'CSHARP', 'JAVA'].includes(data.allowedLanguage)) throw new Error('Chỉ hỗ trợ PYTHON, CSHARP và JAVA.');
    if (!Number.isInteger(data.timeLimitMs) || data.timeLimitMs < 1 || data.timeLimitMs > 10000 || !Number.isInteger(data.memoryLimitMb) || data.memoryLimitMb < 64 || data.memoryLimitMb > 512) throw new Error('Thời gian 1..10000 ms; RAM 64..512 MiB.');
    if (!Number.isFinite(Date.parse(data.startTime)) || !Number.isFinite(Date.parse(data.endTime)) || Date.parse(data.endTime) <= Date.parse(data.startTime)) throw new Error('Thời gian bắt đầu/kết thúc không hợp lệ.');
    if (data.maxTeamSize !== undefined && (!Number.isInteger(data.maxTeamSize) || data.maxTeamSize < 2 || data.maxTeamSize > 50)) {
      throw new Error('Số thành viên tối đa phải từ 2 đến 50.');
    }
    return this.examRepo.update(id, { ...data, startTime: new Date(data.startTime), endTime: new Date(data.endTime) });
  }

  async deleteExam(id: string) { return this.examRepo.deleteIfNoSubmissions(id); }

  async addTestCase(examId: string, data: { inputData: string; expectedOutput: string; isHidden?: boolean; scoreWeight?: number; orderIndex: number }) {
    if (await this.examRepo.hasSubmissions(examId)) throw new Error('Không thể sửa bộ test sau khi đã có bài nộp.');
    if (typeof data.inputData !== 'string' || typeof data.expectedOutput !== 'string' || (data.isHidden !== undefined && typeof data.isHidden !== 'boolean') || !Number.isFinite(data.scoreWeight ?? 1) || (data.scoreWeight ?? 1) <= 0 || !Number.isInteger(data.orderIndex) || data.orderIndex < 1) throw new Error('Thông tin test case không hợp lệ.');
    return this.examRepo.addTestCase(examId, data);
  }

  async updateTestCase(examId: string, testCaseId: string, data: { inputData: string; expectedOutput: string; isHidden: boolean; scoreWeight: number; orderIndex: number }) {
    if (await this.examRepo.hasSubmissions(examId)) throw new Error('Không thể sửa bộ test sau khi đã có bài nộp.');
    if (typeof data.inputData !== 'string' || typeof data.expectedOutput !== 'string' || typeof data.isHidden !== 'boolean' || !Number.isFinite(data.scoreWeight) || data.scoreWeight <= 0 || !Number.isInteger(data.orderIndex) || data.orderIndex < 1) throw new Error('Thông tin test case không hợp lệ.');
    return this.examRepo.updateTestCase(examId, testCaseId, data);
  }

  async deleteTestCase(examId: string, testCaseId: string) {
    if (await this.examRepo.hasSubmissions(examId)) throw new Error('Không thể sửa bộ test sau khi đã có bài nộp.');
    return this.examRepo.deleteTestCase(examId, testCaseId);
  }
}

export const examService = new ExamService();
