import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { MarkdownPreview } from '../../components/MarkdownPreview';

type TestCase = { id?: string; inputData: string; expectedOutput: string; isHidden: boolean; scoreWeight: number; orderIndex: number };
type ExamForm = { title: string; descriptionMd: string; allowedLanguage: string; timeLimitMs: number; memoryLimitMb: number; startTime: string; endTime: string };
const localInput = (value: string) => { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

export const EditExamPage: React.FC = () => {
  const { classId, examId } = useParams<{ classId: string; examId: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState<ExamForm | null>(null);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [hasSubmissions, setHasSubmissions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingDeleteCase, setPendingDeleteCase] = useState<TestCase | null>(null);
  const [deletingCase, setDeletingCase] = useState(false);

  useEffect(() => {
    void apiRequest<any>(`/exams/${examId}`).then(result => {
      if (!result.success || !result.data) { setError(result.message || 'Không tải được đề thi.'); setLoading(false); return; }
      const exam = result.data;
      setHasSubmissions((exam._count?.submissions || 0) > 0);
      setForm({ title: exam.title, descriptionMd: exam.descriptionMd, allowedLanguage: exam.allowedLanguage, timeLimitMs: exam.timeLimitMs, memoryLimitMb: exam.memoryLimitMb, startTime: localInput(exam.startTime), endTime: localInput(exam.endTime) });
      setCases(exam.testCases.map((test: any) => ({ id: test.id, inputData: test.inputData, expectedOutput: test.expectedOutput, isHidden: test.isHidden, scoreWeight: test.scoreWeight, orderIndex: test.orderIndex })));
      setLoading(false);
    });
  }, [examId]);

  const updateCase = (index: number, field: keyof TestCase, value: string | number | boolean) => setCases(current => current.map((item, i) => i === index ? { ...item, [field]: value } : item));

  const removeCase = async () => {
    const item = pendingDeleteCase;
    if (!item) return;
    if (item.id) {
      setDeletingCase(true);
      const result = await apiRequest(`/exams/${examId}/testcases/${item.id}`, { method: 'DELETE' });
      setDeletingCase(false);
      if (!result.success) { setError(result.message || 'Không xóa được test case.'); setPendingDeleteCase(null); return; }
    }
    setCases(current => current.filter(testCase => testCase !== item && (!item.id || testCase.id !== item.id)));
    setPendingDeleteCase(null);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!form || !examId) return;
    setSaving(true); setError('');
    const examResult = await apiRequest(`/exams/${examId}`, { method: 'PATCH', body: JSON.stringify({ ...form, timeLimitMs: Number(form.timeLimitMs), memoryLimitMb: Number(form.memoryLimitMb), startTime: new Date(form.startTime).toISOString(), endTime: new Date(form.endTime).toISOString() }) });
    if (!examResult.success) { setError(examResult.message || 'Không cập nhật được đề thi.'); setSaving(false); return; }
    if (!hasSubmissions) {
      for (const item of cases) {
      const { id, ...payload } = item;
      const result = await apiRequest(id ? `/exams/${examId}/testcases/${id}` : `/exams/${examId}/testcases`, { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      if (!result.success) { setError(result.message || 'Đề đã lưu nhưng có test case chưa cập nhật.'); setSaving(false); return; }
    }
    }
    setSaving(false); navigate(`/lecturer/classes/${classId}/exams`);
  };

  if (loading) return <div className="container"><p>Đang tải đề thi…</p></div>;
  return <div className="container" style={{ maxWidth: 900 }}>
    <div style={{ marginBottom: '1.25rem' }}><Link to={`/lecturer/classes/${classId}/exams`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> Quay lại danh sách đề</Link></div>
    <div className="card"><h2>Sửa đề thi và bộ test</h2>
      {error && <p role="alert" style={{ color: '#f87171' }}>{error}</p>}
      {form && <form onSubmit={save}>
        <div className="form-group"><label>Tiêu đề</label><input className="form-control" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
        <div className="form-group"><label htmlFor="exam-description">Mô tả đề bài (Markdown)</label><div className="markdown-editor-preview">
          <div><span className="markdown-panel-title">Nội dung Markdown</span><textarea id="exam-description" className="form-control markdown-editor" rows={12} required value={form.descriptionMd} onChange={e => setForm({ ...form, descriptionMd: e.target.value })} /></div>
          <section aria-label="Xem trước đề bài"><span className="markdown-panel-title">Xem trước</span><MarkdownPreview content={form.descriptionMd} /></section>
        </div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
          <div className="form-group"><label>Ngôn ngữ</label><select className="form-control" value={form.allowedLanguage} onChange={e => setForm({ ...form, allowedLanguage: e.target.value })}><option value="PYTHON">Python</option><option value="CSHARP">C#</option><option value="JAVA">Java</option></select></div>
          <div className="form-group"><label>Thời gian chạy tối đa (ms)</label><input className="form-control" type="number" value={form.timeLimitMs} onChange={e => setForm({ ...form, timeLimitMs: Number(e.target.value) })} /></div>
          <div className="form-group"><label>Bộ nhớ tối đa (MiB)</label><input className="form-control" type="number" value={form.memoryLimitMb} onChange={e => setForm({ ...form, memoryLimitMb: Number(e.target.value) })} /></div>
          <div className="form-group"><label>Bắt đầu</label><input className="form-control" type="datetime-local" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} /></div>
          <div className="form-group"><label>Kết thúc</label><input className="form-control" type="datetime-local" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1rem 0' }}><h3>Test case</h3><button type="button" className="btn btn-secondary" disabled={hasSubmissions} onClick={() => setCases([...cases, { inputData: '', expectedOutput: '', isHidden: false, scoreWeight: 1, orderIndex: Math.max(0, ...cases.map(item => item.orderIndex)) + 1 }])}>+ Thêm test case</button></div>
        {hasSubmissions && <p role="note" style={{ color: '#fbbf24', marginBottom: '1rem' }}>Đề đã có bài nộp: có thể sửa cấu hình đề, nhưng bộ test bị khóa để bảo toàn kết quả chấm hiện có.</p>}
        {cases.map((item, index) => <div className="card" key={item.id || `new-${index}`} style={{ marginBottom: '0.75rem' }}>
          <div className="form-group"><label>Dữ liệu đầu vào</label><textarea className="form-control" disabled={hasSubmissions} value={item.inputData} onChange={e => updateCase(index, 'inputData', e.target.value)} /></div>
          <div className="form-group"><label>Kết quả mong đợi</label><textarea className="form-control" disabled={hasSubmissions} value={item.expectedOutput} onChange={e => updateCase(index, 'expectedOutput', e.target.value)} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><label><input type="checkbox" disabled={hasSubmissions} checked={item.isHidden} onChange={e => updateCase(index, 'isHidden', e.target.checked)} /> Test ẩn</label><label>Trọng số <input type="number" min="0.1" step="0.1" disabled={hasSubmissions} value={item.scoreWeight} onChange={e => updateCase(index, 'scoreWeight', Number(e.target.value))} /></label><button type="button" className="btn btn-ghost-danger btn-sm" disabled={hasSubmissions} onClick={() => setPendingDeleteCase(item)}>Xóa test</button></div>
        </div>)}
        {cases.length === 0 && <p>Cần thêm ít nhất một test case trước khi lưu.</p>}
        <button className="btn btn-primary" disabled={saving || cases.length === 0}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
      </form>}
    </div>
    <ConfirmDialog open={!!pendingDeleteCase} title="Xóa test case?" description="Test case này sẽ bị xóa khỏi đề. Đề phải còn ít nhất một test case, và chỉ có thể chỉnh sửa bộ test trước khi nhận bài nộp." confirmLabel="Xóa test case" busy={deletingCase} onConfirm={removeCase} onCancel={() => setPendingDeleteCase(null)} />
  </div>;
};
