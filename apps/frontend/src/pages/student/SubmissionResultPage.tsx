import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { MarkdownPreview } from '../../components/MarkdownPreview';

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'SUBMITTED':
      return <span className="badge badge-yellow">Chờ tiếp nhận</span>;
    case 'IN_REVIEW':
      return <span className="badge badge-blue">Đang xem xét</span>;
    case 'ACCEPTED':
      return <span className="badge badge-green">Đã chấp nhận</span>;
    case 'REJECTED':
      return <span className="badge badge-red">Đã từ chối</span>;
    default:
      return <span className="badge">{status}</span>;
  }
};

export const SubmissionResultPage: React.FC = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const [submission, setSubmission] = useState<any>(null);
  const [error, setError] = useState('');

  // AI Review States
  const [triggeringAiReview, setTriggeringAiReview] = useState(false);
  const [explainingError, setExplainingError] = useState(false);
  const [manualExplanation, setManualExplanation] = useState<any>(null);

  // Appeals States
  const [appeals, setAppeals] = useState<any[]>([]);
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [appealTitle, setAppealTitle] = useState('');
  const [appealReason, setAppealReason] = useState('');
  const [appealExpectedScore, setAppealExpectedScore] = useState<string>('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [appealError, setAppealError] = useState('');
  const [appealSuccess, setAppealSuccess] = useState('');

  const loadSubmission = async () => {
    const res = await apiRequest('/submissions/' + id);
    if (res.success && res.data) {
      setSubmission(res.data);
    } else {
      setError(res.message || 'Không tải được kết quả.');
    }
  };

  const fetchAppeals = async () => {
    if (!id) return;
    const res = await apiRequest(`/appeals/submission/${id}`);
    if (res.success && res.data) {
      setAppeals(res.data);
    }
  };

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      const res = await apiRequest('/submissions/' + id);
      if (!active) return;
      if (!res.success) {
        setError(res.message || 'Không tải được kết quả.');
        return;
      }
      setSubmission(res.data);
      if (
        ['QUEUED', 'RUNNING'].includes(res.data.status) ||
        (['PENDING', 'RUNNING'].includes(res.data.astStatus) &&
          ['COMPLETED', 'COMPILE_ERROR'].includes(res.data.status))
      ) {
        timer = setTimeout(poll, 1500);
      } else if (!res.data.scoreReleased && res.data.status !== 'COMPILE_ERROR') {
        timer = setTimeout(poll, 30000);
      }
    }

    void poll();
    if (user?.role === 'STUDENT') {
      void fetchAppeals();
    }
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, user]);

  // Trigger on-demand AI Semantic Review
  const handleTriggerAiReview = async () => {
    setTriggeringAiReview(true);
    try {
      const res = await apiRequest(`/ai/review-submission/${id}`, { method: 'POST' });
      if (res.success) {
        await loadSubmission();
      } else {
        alert(res.message || 'Không thể thực hiện AI Review.');
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi gọi AI Review.');
    } finally {
      setTriggeringAiReview(false);
    }
  };

  // Trigger on-demand compilation error explainer
  const handleExplainError = async () => {
    if (!submission?.compileMessage) return;
    setExplainingError(true);
    try {
      const res = await apiRequest('/ai/explain-error', {
        method: 'POST',
        body: JSON.stringify({
          language: submission.exam?.allowedLanguage || 'PYTHON',
          compileMessage: submission.compileMessage,
        }),
      });
      if (res.success && res.data) {
        setManualExplanation(res.data);
      } else {
        alert(res.message || 'Không thể giải nghĩa lỗi biên dịch.');
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi gọi AI Explainer.');
    } finally {
      setExplainingError(false);
    }
  };

  const handleOpenAppealModal = () => {
    const roundNumber = appeals.length + 1;
    if (roundNumber === 1) {
      setAppealTitle(`Phúc khảo Lần 1 (Gửi Giảng viên) - ${submission?.exam?.title || ''}`);
    } else {
      setAppealTitle(`Phúc khảo Lần 2 (Gửi Khảo thí) - ${submission?.exam?.title || ''}`);
    }
    setAppealReason('');
    setAppealExpectedScore('');
    setAppealError('');
    setAppealSuccess('');
    setShowAppealModal(true);
  };

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealReason.trim()) {
      setAppealError('Vui lòng nhập lý do khiếu nại cụ thể.');
      return;
    }
    const roundNumber = appeals.length + 1;
    setSubmittingAppeal(true);
    setAppealError('');

    const res = await apiRequest('/appeals', {
      method: 'POST',
      body: JSON.stringify({
        submissionId: id,
        title: appealTitle.trim(),
        reason: appealReason.trim(),
        expectedScore: appealExpectedScore ? Number(appealExpectedScore) : undefined,
      }),
    });

    setSubmittingAppeal(false);
    if (res.success) {
      setAppealSuccess(
        roundNumber === 1
          ? 'Đã gửi đơn khiếu nại Lần 1 thành công! Giảng viên phụ trách sẽ xem xét và phản hồi.'
          : 'Đã gửi đơn khiếu nại Lần 2 thành công! Ban Khảo thí (Admin) sẽ thẩm định độc lập và đưa ra kết quả cuối cùng.'
      );
      setShowAppealModal(false);
      void fetchAppeals();
    } else {
      setAppealError(res.message || 'Không thể gửi đơn khiếu nại.');
    }
  };

  if (error)
    return (
      <div className="container">
        <p role="alert">{error}</p>
      </div>
    );
  if (!submission) return <div className="container">Đang tải kết quả…</div>;

  const waiting = ['QUEUED', 'RUNNING'].includes(submission.status);
  const isStudent = user?.role === 'STUDENT';
  const hasActiveAppeal = appeals.some(a => ['SUBMITTED', 'IN_REVIEW'].includes(a.status));

  const latestAiReview = submission.aiReviews?.[0];

  // Parse error explanation from AIReview or manual request
  let errorExplanation = manualExplanation;
  if (!errorExplanation && latestAiReview?.errorExplanation) {
    try {
      errorExplanation = JSON.parse(latestAiReview.errorExplanation);
    } catch {
      errorExplanation = { summary: latestAiReview.errorExplanation };
    }
  }

  const cleanScore = latestAiReview?.cleanCodeScore;
  const scoreBadgeClass =
    cleanScore >= 8.5
      ? 'badge-green'
      : cleanScore >= 7.0
      ? 'badge-blue'
      : cleanScore >= 5.0
      ? 'badge-yellow'
      : 'badge-red';

  return (
    <div className="container page-submission-result" style={{ maxWidth: 1000 }}>
      <div className="submission-result-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div className="submission-result-links" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link to={isStudent ? '/student' : '/lecturer'}>← Quay lại Dashboard</Link>
          {isStudent && (
            <Link to="/student/appeals" className="btn btn-secondary btn-sm">
               Xem tất cả khiếu nại của tôi &rarr;
            </Link>
          )}
        </div>
        {!waiting && (
          <button
            type="button"
            className="btn btn-secondary btn-sm ai-review-button"
            disabled={triggeringAiReview}
            onClick={handleTriggerAiReview}
          >
            {triggeringAiReview
              ? '⏳ Đang phân tích mã nguồn...'
              : latestAiReview
              ? '🔄 Yêu cầu AI Review lại mã nguồn'
              : '✨ Yêu cầu AI Review mã nguồn'}
          </button>
        )}
      </div>

      {appealSuccess && (
        <div className="card" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#34d399', marginBottom: '1rem', padding: '0.75rem 1rem' }}>
          {appealSuccess}
        </div>
      )}

      {/* CARD 1: SUBMISSION OVERVIEW */}
      <div className="card" style={{ marginTop: '0.5rem' }}>
        <div className="submission-overview-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>{submission.exam.title}</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Lần nộp #{submission.attemptNumber || 1} • Ngôn ngữ: <strong>{submission.exam.allowedLanguage}</strong> · Nộp lúc: {formatDate(submission.submittedAt)}
            </p>
          </div>
          <div className="submission-result-status" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span
              className={
                'badge ' +
                (submission.status === 'COMPLETED'
                  ? 'badge-green'
                  : submission.status === 'COMPILE_ERROR'
                  ? 'badge-red'
                  : 'badge-yellow')
              }
              style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}
            >
              {submission.status}
            </span>
            {submission.scoreReleased && (
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399' }}>
                {submission.totalScore} pts
              </span>
            )}
          </div>
        </div>

        {!submission.scoreReleased && submission.status !== 'COMPILE_ERROR' && (
          <p style={{ marginTop: '1rem', color: '#cbd5e1', background: '#1e293b', padding: '0.75rem', borderRadius: '0.5rem' }}>
            ℹ️ Đã ghi nhận bài nộp mới nhất của bạn. Điểm số và kết quả chi tiết các test case sẽ được công bố sau khi đề thi kết thúc ({formatDate(submission.exam.endTime)}).
          </p>
        )}

        {waiting && (
          <p style={{ marginTop: '0.75rem', color: '#fbbf24' }}>
            ⏳ Sandbox Worker đang chấm bài nộp trong container Docker cô lập. Kết quả sẽ tự động hiển thị trong giây lát...
          </p>
        )}

        <div style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
          <strong>File nộp:</strong> {submission.originalFilename || 'Mã nguồn nộp'} · Entrypoint: <code>{submission.entrypoint || 'Mặc định'}</code>
          <div style={{ marginTop: '0.25rem', color: '#94a3b8' }}>
            Mã băm SHA-256: <code className="submission-hash" style={{ fontSize: '0.8rem' }}>{submission.fileHashSha256}</code>
          </div>
          {submission.artifactType === 'ZIP' && (
            <div style={{ marginTop: '0.5rem' }}>
              <a href={'/api/submissions/' + id + '/archive'} className="btn btn-secondary btn-sm">
                 Tải ZIP bài nộp
              </a>
            </div>
          )}

          {/* {submission.commitSha && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '0.5rem', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <strong>🔍 Đối chiếu mã nguồn với GitHub:</strong>{' '}
                  Commit: <code style={{ color: '#38bdf8' }}>{submission.commitSha.slice(0, 7)}</code>
                </div>
                {submission.repoMatchStatus === 'VERIFIED' ? (
                  <span className="badge badge-green">🟢 Khớp 100% Repository</span>
                ) : submission.repoMatchStatus === 'PARTIAL' ? (
                  <span className="badge badge-yellow">🟡 Khớp {submission.repoMatchPercent}% Repository</span>
                ) : submission.repoMatchStatus === 'MISMATCH' ? (
                  <span className="badge badge-red">🔴 Bất nhất mã nguồn (0% khớp)</span>
                ) : (
                  <span className="badge">⚪ Chưa đối chiếu</span>
                )}
              </div>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                {submission.repoMatchStatus === 'VERIFIED'
                  ? `Toàn vẹn mã nguồn: 100% file trong ZIP trùng khớp từng byte với commit ${submission.commitSha.slice(0, 7)} trên GitHub.`
                  : submission.repoMatchStatus === 'PARTIAL'
                  ? `Mã nguồn trong file ZIP có ${submission.repoMatchPercent}% trùng khớp với commit GitHub. Một số file có sự chỉnh sửa trước khi nén.`
                  : submission.repoMatchStatus === 'MISMATCH'
                  ? `⚠️ Cảnh báo bất nhất: Không tìm thấy file mã nguồn tương ứng trong commit ${submission.commitSha.slice(0, 7)} trên GitHub.`
                  : 'Dữ liệu đối chiếu cây thư mục không khả dụng hoặc repository ở chế độ riêng tư.'}
              </p>
              {Array.isArray(submission.repoMatchDetails) && submission.repoMatchDetails.length > 0 && (
                <div style={{ marginTop: '0.5rem', maxHeight: '120px', overflowY: 'auto', fontSize: '0.8rem', background: '#020617', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                  {submission.repoMatchDetails.map((f: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                      <code>{f.path}</code>
                      <span style={{ color: f.status === 'MATCHED' ? '#34d399' : f.status === 'MODIFIED' ? '#fbbf24' : '#f87171' }}>
                        {f.status === 'MATCHED' ? '✓ Khớp 100%' : f.status === 'MODIFIED' ? '✎ Đã sửa đổi' : '✗ Không có trên repo'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )} */}
        </div>
      </div>

      {/* CARD 2: AI COMPILATION ERROR EXPLAINER */}
      {(submission.status === 'COMPILE_ERROR' || submission.compileMessage) && (
        <div className="error-explainer-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="badge badge-red" style={{ fontWeight: 700 }}>LỖI BIÊN DỊCH</span>
              <h3 style={{ margin: 0, color: '#fca5a5', fontSize: '1.15rem' }}>
                💡 AI Trợ Lý: Giải Nghĩa Lỗi Biên Dịch & Hướng Dẫn Sửa Lỗi
              </h3>
            </div>
            {!errorExplanation && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ background: '#dc2626', border: 'none' }}
                disabled={explainingError}
                onClick={handleExplainError}
              >
                {explainingError ? ' Đang phân tích...' : ' Nhờ AI Giải Nghĩa Lỗi'}
              </button>
            )}
          </div>

          {errorExplanation ? (
            <div style={{ marginTop: '1rem', color: '#f1f5f9' }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.35)', padding: '1rem', borderRadius: '0.5rem', borderLeft: '4px solid #ef4444', marginBottom: '1rem' }}>
                <strong style={{ fontSize: '1.05rem', color: '#f87171' }}>📌 Tóm tắt vấn đề:</strong>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.95rem' }}>{errorExplanation.summary}</p>
                {errorExplanation.rootCause && (
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#cbd5e1' }}>
                    <strong>Nguyên nhân cốt lõi:</strong> {errorExplanation.rootCause}
                  </p>
                )}
                {errorExplanation.errorLocation?.line && (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#fca5a5' }}>
                    📍 Vị trí phát hiện: Dòng <strong>{errorExplanation.errorLocation.line}</strong>
                  </p>
                )}
              </div>

              {Array.isArray(errorExplanation.fixSteps) && errorExplanation.fixSteps.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong style={{ color: '#38bdf8' }}>🛠️ Các bước khắc phục từng bước:</strong>
                  <ul style={{ paddingLeft: '1.25rem', marginTop: '0.4rem', fontSize: '0.9rem' }}>
                    {errorExplanation.fixSteps.map((step: string, idx: number) => (
                      <li key={idx} style={{ marginBottom: '0.25rem' }}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}

              {errorExplanation.fixedCodeExample && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong style={{ color: '#34d399' }}>✅ Đoạn code sửa mẫu gợi ý:</strong>
                  <pre style={{ background: '#090d16', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #334155', color: '#a7f3d0', whiteSpace: 'pre-wrap', marginTop: '0.4rem', fontSize: '0.85rem' }}>
                    {errorExplanation.fixedCodeExample}
                  </pre>
                </div>
              )}

              {errorExplanation.tips && (
                <p style={{ fontSize: '0.85rem', color: '#fde047', margin: 0 }}>
                  💡 <strong>Lời khuyên sư phạm:</strong> {errorExplanation.tips}
                </p>
              )}
            </div>
          ) : (
            <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#fca5a5' }}>
              Mã nguồn gặp sự cố khi biên dịch. Bấm nút "Nhờ AI Giải Nghĩa Lỗi" ở trên để AI phân tích và đưa ra hướng dẫn sửa lỗi dễ hiểu.
            </p>
          )}

          {/* Raw compiler output expandable */}
          <details style={{ marginTop: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#94a3b8' }}>
              Xem toàn bộ thông báo gốc của Compiler (Log)
            </summary>
            <pre style={{ background: '#090d16', padding: '0.75rem', borderRadius: '0.5rem', whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              {submission.compileMessage}
            </pre>
          </details>
        </div>
      )}

      {/* CARD 3: SEMANTIC CODE REVIEW & CLEAN CODE SCORING */}
      {latestAiReview && (
        <div className="clean-code-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(59, 130, 246, 0.25)', paddingBottom: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, color: '#93c5fd' }}>
                Đánh Giá Chất Lượng Clean Code & Kiến Trúc SOLID
                </h3>
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                Mô hình: <code>{latestAiReview.modelName}</code> · Round: #{latestAiReview.reviewRound} · Đánh giá tự động
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="clean-score-circle">
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>
                  {cleanScore}
                </span>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>/ 10 ĐIỂM</span>
              </div>
              <div>
                <span className={`badge ${scoreBadgeClass}`} style={{ fontSize: '0.85rem', padding: '0.3rem 0.65rem' }}>
                  {cleanScore >= 8.5 ? 'XUẤT SẮC' : cleanScore >= 7.0 ? 'ĐẠT CHUẨN' : cleanScore >= 5.0 ? 'TRUNG BÌNH' : 'CẦN CẢI THIỆN'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            <h4 style={{ color: '#60a5fa', marginBottom: '0.5rem' }}>📐 Phân tích Nguyên lý SOLID & Cấu trúc hàm</h4>
            <div className="markdown-preview" style={{ background: '#090d16', minHeight: 'auto', marginBottom: '1.25rem' }}>
              <MarkdownPreview content={latestAiReview.solidAnalysis} />
            </div>

            <h4 style={{ color: '#34d399', marginBottom: '0.5rem' }}>💡 Gợi ý Cải tiến & Mã nguồn Refactor mẫu</h4>
            <div className="markdown-preview" style={{ background: '#090d16', minHeight: 'auto' }}>
              <MarkdownPreview content={latestAiReview.suggestions} />
            </div>
          </div>
        </div>
      )}

      {/* When no AI Review yet and submission finished */}
      {!latestAiReview && !waiting && submission.status !== 'FAILED' && (
        <div className="card" style={{ marginTop: '1rem', background: 'rgba(30, 41, 59, 0.4)', border: '1px dashed #475569', textAlign: 'center', padding: '1.5rem' }}>
          <h4 style={{ color: '#93c5fd', margin: '0 0 0.5rem' }}>✨ Đánh giá Clean Code & Nguyên lý SOLID</h4>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0 0 1rem' }}>
            Bài nộp này chưa có kết quả đánh giá Clean Code tự động hoặc đang trong hàng đợi xử lý.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={triggeringAiReview}
            onClick={handleTriggerAiReview}
          >
            {triggeringAiReview ? '⏳ Đang phân tích mã nguồn...' : '✨ Yêu cầu AI Review ngay'}
          </button>
        </div>
      )}

      {/* CARD 4: TEST CASES TABLE */}
      {submission.scoreReleased && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3>Kết quả kiểm thử Test Cases</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Test</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
                <th>RAM</th>
                <th>Điểm</th>
              </tr>
            </thead>
            <tbody>
              {submission.testResults?.map((result: any) => (
                <tr key={result.id}>
                  <td>
                    #{result.testCase.orderIndex}
                    {result.testCase.isHidden ? ' (ẩn)' : ''}
                  </td>
                  <td>
                    <span className={'badge ' + (result.status === 'ACCEPTED' ? 'badge-green' : 'badge-red')}>
                      {result.status}
                    </span>
                    {(result.actualOutput !== null || result.stderr) && (
                      <details style={{ marginTop: '0.25rem' }}>
                        <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: '#94a3b8' }}>
                          StdOut / StdErr (exit {result.exitCode ?? '—'})
                        </summary>
                        <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', fontSize: '0.75rem' }}>
                          {result.actualOutput}
                        </pre>
                        {result.stderr && (
                          <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', color: '#f87171', fontSize: '0.75rem' }}>
                            {result.stderr}
                          </pre>
                        )}
                      </details>
                    )}
                  </td>
                  <td>{result.executionTimeMs} ms</td>
                  <td>{(result.memoryUsedKb / 1024).toFixed(1)} MiB</td>
                  <td style={{ fontWeight: 600 }}>{result.scoreEarned}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!waiting && !submission.testResults?.length && (
            <p style={{ marginTop: '0.5rem', color: '#94a3b8' }}>
              Không có kết quả test case. Xem thông báo compiler bên trên.
            </p>
          )}
        </div>
      )}

      {/* CARD 5: GRADE APPEAL SECTION FOR STUDENT (2-TIER WORKFLOW) */}
      {submission.scoreReleased && isStudent && (
        <div className="card" style={{ marginTop: '1rem', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Phúc khảo & Khiếu nại điểm số (Quy trình 2 Cấp)</h3>
                <span className="badge badge-blue" style={{ fontSize: '0.75rem' }}>
                  {appeals.length}/2 lượt khiếu nại
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>
                Hệ thống hỗ trợ 2 lần phúc khảo độc lập: <strong>Lần 1</strong> gửi Giảng viên phụ trách lớp; <strong>Lần 2</strong> gửi Ban Khảo thí (Admin) để so sánh đối chiếu minh bạch và công bằng.
              </p>
            </div>
            <div>
              {appeals.length === 0 && (
                <button onClick={handleOpenAppealModal} className="btn btn-primary btn-sm">
                  Gửi khiếu nại Lần 1 (Giảng viên)
                </button>
              )}
              {appeals.length === 1 && !['ACCEPTED', 'REJECTED'].includes(appeals[0].status) && (
                <span className="badge badge-yellow">Đang chờ Giảng viên xử lý Lần 1</span>
              )}
              {appeals.length === 1 && ['ACCEPTED', 'REJECTED'].includes(appeals[0].status) && (
                <button onClick={handleOpenAppealModal} className="btn btn-warning btn-sm" style={{ background: '#f59e0b', color: '#000', fontWeight: 600 }}>
                  Gửi khiếu nại Lần 2 (Khảo thí)
                </button>
              )}
              {appeals.length >= 2 && !['ACCEPTED', 'REJECTED'].includes(appeals[1]?.status) && (
                <span className="badge badge-yellow">Đang chờ Ban Khảo thí xử lý Lần 2</span>
              )}
              {appeals.length >= 2 && ['ACCEPTED', 'REJECTED'].includes(appeals[1]?.status) && (
                <span className="badge badge-green">Đã hoàn thành 2 lần phúc khảo (Giảng viên & Khảo thí)</span>
              )}
            </div>
          </div>

          {/* Banner notification for Round 2 opportunity */}
          {appeals.length === 1 && ['ACCEPTED', 'REJECTED'].includes(appeals[0].status) && (
            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#fde68a' }}>
              <strong>Thông báo lượt 2:</strong> Bạn đã hoàn tất phúc khảo Lần 1 với Giảng viên. Nếu nhận thấy điểm số vẫn chưa thỏa đáng hoặc cần thẩm định độc lập, bạn có quyền gửi khiếu nại <strong>Lần 2 lên Ban Khảo thí (Admin)</strong> để so sánh kết quả giữa 2 người (Tối đa 2 lần/bài nộp).
            </div>
          )}

          {/* TRANSPARENT 3-TIER SCORE COMPARISON */}
          {appeals.length > 0 && (
            <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem', margin: 0, color: '#e2e8f0' }}>Bảng đối chiếu minh bạch điểm số các cấp:</h4>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                  Điểm chốt hiện tại: <strong style={{ color: '#38bdf8', fontSize: '1rem' }}>{submission.totalScore} điểm</strong>
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                {/* Tier 1: Điểm AI Ban Đầu */}
                <div style={{ background: '#090d16', padding: '0.85rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>1. Điểm AI Chấm (Gốc)</span>
                    <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>Hệ thống AI</span>
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#f1f5f9', marginBottom: '0.25rem' }}>
                    {appeals[0]?.originalScore ?? appeals[0]?.previousScore ?? submission.totalScore} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: '#94a3b8' }}>điểm</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                    Chấm tự động qua Testcase Runner & AI Evaluation.
                  </p>
                </div>

                {/* Tier 2: Phúc khảo Lần 1 (Giảng viên) */}
                {appeals[0] && (
                  <div style={{ background: '#090d16', padding: '0.85rem 1rem', borderRadius: '0.5rem', border: appeals[0].status === 'ACCEPTED' ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>2. Phúc khảo L1 (Giảng viên)</span>
                      {getStatusBadge(appeals[0].status)}
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: appeals[0].newScore !== null ? '#34d399' : '#f1f5f9', marginBottom: '0.25rem' }}>
                      {appeals[0].newScore !== null ? `${appeals[0].newScore}` : appeals[0].status === 'REJECTED' ? `${appeals[0].previousScore}` : '—'} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: '#94a3b8' }}>{appeals[0].newScore !== null ? 'điểm (đã sửa)' : appeals[0].status === 'REJECTED' ? 'điểm (giữ nguyên)' : 'chưa có điểm'}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      <strong>Người giải quyết: </strong>
                      <span style={{ color: '#cbd5e1' }}>{appeals[0].resolvedBy?.fullName || 'Giảng viên phụ trách'}</span>
                    </div>
                    {appeals[0].decisionReason && (
                      <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.35rem', fontSize: '0.8rem' }}>
                        <span style={{ color: '#94a3b8' }}>Nhận xét: </span>
                        <span style={{ color: '#e2e8f0' }}>{appeals[0].decisionReason}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Tier 3: Phúc khảo Lần 2 (Khảo thí / Admin) */}
                <div style={{ background: '#090d16', padding: '0.85rem 1rem', borderRadius: '0.5rem', border: appeals[1]?.status === 'ACCEPTED' ? '1px solid rgba(52, 211, 153, 0.4)' : '1px solid var(--border)', opacity: appeals[1] ? 1 : 0.7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>3. Phúc khảo L2 (Khảo thí)</span>
                    {appeals[1] ? getStatusBadge(appeals[1].status) : <span className="badge" style={{ opacity: 0.6 }}>Chưa tạo đơn</span>}
                  </div>
                  {appeals[1] ? (
                    <>
                      <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: appeals[1].newScore !== null ? '#38bdf8' : '#f1f5f9', marginBottom: '0.25rem' }}>
                        {appeals[1].newScore !== null ? `${appeals[1].newScore}` : appeals[1].status === 'REJECTED' ? `${appeals[1].previousScore}` : '—'} <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: '#94a3b8' }}>{appeals[1].newScore !== null ? 'điểm (đã sửa)' : appeals[1].status === 'REJECTED' ? 'điểm (giữ nguyên)' : 'chờ xử lý'}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        <strong>Cán bộ Khảo thí: </strong>
                        <span style={{ color: '#cbd5e1' }}>{appeals[1].resolvedBy?.fullName || 'Ban Khảo thí (Admin)'}</span>
                      </div>
                      {appeals[1].decisionReason && (
                        <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.35rem', fontSize: '0.8rem' }}>
                          <span style={{ color: '#94a3b8' }}>Kết luận Khảo thí: </span>
                          <span style={{ color: '#e2e8f0' }}>{appeals[1].decisionReason}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ paddingTop: '0.5rem', fontSize: '0.825rem', color: '#64748b' }}>
                      {appeals.length === 1 && ['ACCEPTED', 'REJECTED'].includes(appeals[0].status)
                        ? 'Có thể tạo đơn gửi lên Khảo thí nếu chưa hài lòng với kết quả của Giảng viên.'
                        : 'Sẽ mở khi hoàn tất phúc khảo Lần 1 với Giảng viên.'}
                    </div>
                  )}
                </div>
              </div>

              {/* Detailed Appeal History */}
              <div style={{ marginTop: '1.25rem' }}>
                <h5 style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Chi tiết các đơn khiếu nại đã gửi:</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {appeals.map((app) => (
                    <div key={app.id} style={{ background: '#090d16', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                      <div className="appeal-history-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className={`badge ${app.round === 2 || app.targetRole === 'ADMIN' ? 'badge-yellow' : 'badge-blue'}`} style={{ fontSize: '0.75rem' }}>
                            {app.round === 2 || app.targetRole === 'ADMIN' ? 'Cấp 2: Khảo thí' : 'Cấp 1: Giảng viên'}
                          </span>
                          <strong style={{ fontSize: '0.95rem' }}>{app.title}</strong>
                        </div>
                        {getStatusBadge(app.status)}
                      </div>
                      <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.4rem', marginBottom: '0.25rem' }}>
                        Lý do khiếu nại: <span style={{ color: '#cbd5e1' }}>{app.reason}</span>
                      </p>
                      {app.expectedScore !== null && (
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                          Điểm kỳ vọng: <span style={{ color: '#f59e0b', fontWeight: 600 }}>{app.expectedScore} điểm</span>
                        </p>
                      )}
                      {app.decisionReason && (
                        <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.35rem', fontSize: '0.85rem' }}>
                          <strong style={{ color: app.status === 'ACCEPTED' ? '#34d399' : '#f87171' }}>
                            Phản hồi từ {app.targetRole === 'ADMIN' || app.round === 2 ? 'Ban Khảo thí' : 'Giảng viên'}:{' '}
                          </strong>
                          <span style={{ color: '#f1f5f9' }}>{app.decisionReason}</span>
                          {app.newScore !== null && <span style={{ color: '#34d399', fontWeight: 'bold' }}> (Điểm cập nhật: {app.newScore})</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Appeal Creation Modal */}
      {showAppealModal && (
        <div className="form-modal-overlay">
          <div className="card form-modal-panel" style={{ width: 'min(38rem, 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span className={`badge ${appeals.length === 0 ? 'badge-blue' : 'badge-yellow'}`}>
                {appeals.length === 0 ? 'Phúc khảo Lần 1: Giảng viên' : 'Phúc khảo Lần 2: Khảo thí (Admin)'}
              </span>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
                {appeals.length === 0 ? 'Tạo Đơn Khiếu Nại Điểm Lần 1' : 'Tạo Đơn Khiếu Nại Điểm Lần 2 (Khảo thí)'}
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
              {appeals.length === 0
                ? 'Đơn khiếu nại Lần 1 sẽ được gửi trực tiếp vào Hộp thư giải quyết của Giảng viên phụ trách lớp học.'
                : 'Đơn khiếu nại Lần 2 sẽ được chuyển thẳng tới Ban Khảo thí (Admin) để thẩm định độc lập lần cuối cùng (Tối đa 2 lần).'}
            </p>
            {appealError && <p role="alert" style={{ color: '#f87171', marginBottom: '1rem' }}>{appealError}</p>}
            <form onSubmit={handleSubmitAppeal}>
              <div className="form-group">
                <label>Tiêu đề khiếu nại</label>
                <input
                  className="form-control"
                  value={appealTitle}
                  onChange={(e) => setAppealTitle(e.target.value)}
                  required
                />
              </div>

              <div className="appeal-score-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>{appeals.length === 0 ? 'Điểm AI chấm ban đầu' : 'Điểm sau phúc khảo Lần 1'}</label>
                  <input
                    className="form-control"
                    value={`${submission.totalScore} điểm`}
                    disabled
                    style={{ opacity: 0.7 }}
                  />
                </div>
                <div className="form-group">
                  <label>Điểm kỳ vọng (nếu có)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    className="form-control"
                    placeholder="VD: 8.5"
                    value={appealExpectedScore}
                    onChange={(e) => setAppealExpectedScore(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Lý do và bằng chứng khiếu nại cụ thể *</label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder={
                    appeals.length === 0
                      ? 'Mô tả chi tiết: Test case nào bạn nghi ngờ bị chấm sai? Lý do tại sao code chạy đúng nhưng bị trừ điểm?...'
                      : 'Nêu rõ lý do bạn chưa đồng ý với kết quả giải quyết của Giảng viên ở lần 1, các bằng chứng kỹ thuật bổ sung để Ban Khảo thí xem xét...'
                  }
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  required
                />
              </div>

              <div className="appeal-form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAppealModal(false)}
                  disabled={submittingAppeal}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingAppeal}
                >
                  {submittingAppeal ? 'Đang gửi...' : appeals.length === 0 ? 'Xác nhận gửi Giảng viên (Lần 1)' : 'Xác nhận gửi Khảo thí (Lần 2)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CARD 6: AST & WINNOWING PLAGIARISM */}
      {submission.scoreReleased && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3>AST & Winnowing Fingerprinting</h3>
          <p>
            Trạng thái phân tích: <strong>{submission.astStatus}</strong> · {submission._count?.fingerprints || 0} vân tay số (fingerprints)
          </p>
          {submission.astVersion && (
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Cấu hình: {submission.astVersion} · k = {submission.astK} · w = {submission.astW}
            </p>
          )}
          {submission.astMessage && <pre style={{ whiteSpace: 'pre-wrap' }}>{submission.astMessage}</pre>}
        </div>
      )}
    </div>
  );
};
