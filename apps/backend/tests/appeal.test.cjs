const { test } = require('node:test');
const assert = require('node:assert/strict');
const { appealService } = require('../dist/modules/appeals/appeal.service');

test('AppealService: rejects appeal with missing submissionId', async () => {
  await assert.rejects(
    appealService.createAppeal('student-1', {
      submissionId: '',
      reason: 'Lý do khiếu nại chi tiết kiểm tra testcase',
    }),
    { status: 400, message: 'Thiếu mã bài nộp (submissionId).' }
  );
});

test('AppealService: rejects appeal with short or empty reason', async () => {
  await assert.rejects(
    appealService.createAppeal('student-1', {
      submissionId: 'sub-1',
      reason: '123',
    }),
    { status: 400, message: 'Lý do khiếu nại phải có ít nhất 5 ký tự.' }
  );
});

test('AppealService: rejects invalid status resolution', async () => {
  await assert.rejects(
    appealService.resolveAppeal('appeal-1', 'lecturer-1', 'LECTURER', {
      status: 'INVALID_STATUS',
    }),
    { status: 400, message: 'Trạng thái xử lý không hợp lệ.' }
  );
});
