import { examRepository, ExamRepository } from './exam.repository';

export class ExamService {
  constructor(private examRepo: ExamRepository = examRepository) {}

  async createExam(data: {
    classId: string;
    title: string;
    descriptionMd: string;
    allowedLanguage: string;
    timeLimitMs?: number;
    memoryLimitMb?: number;
    startTime: string;
    endTime: string;
    testCases?: Array<{ inputData: string; expectedOutput: string; isHidden?: boolean; scoreWeight?: number; orderIndex: number }>;
  }) {
    return this.examRepo.create({
      ...data,
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

  async addTestCase(examId: string, data: { inputData: string; expectedOutput: string; isHidden?: boolean; scoreWeight?: number; orderIndex: number }) {
    return this.examRepo.addTestCase(examId, data);
  }
}

export const examService = new ExamService();
