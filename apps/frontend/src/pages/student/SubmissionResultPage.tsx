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

export const SubmissionResultPage: React.FC = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const [submission, setSubmission] = useState<any>(null);
  const [error, setError] = useState('');
  const [triggeringAiReview, setTriggeringAiReview] = useState(false);
  const [explainingError, setExplainingError] = useState(false);
  const [manualExplanation, setManualExplanation] = useState<any>(null);

  const loadSubmission = async () => {
    const res = await apiRequest('/submissions/' + id);
    if (res.success && res.data) {
      setSubmission(res.data);
    } else {
      setError(res.message || 'Không tải được kết quả.');
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
      if (!res.data.scoreReleased && res.data.status !== 'COMPILE_ERROR') {
        timer = setTimeout(poll, 30000);
      } else if (
        ['QUEUED', 'RUNNING'].includes(res.data.status) ||
        (['PENDING', 'RUNNING'].includes(res.data.astStatus) &&
          ['COMPLETED', 'COMPILE_ERROR'].includes(res.data.status))
      ) {
        timer = setTimeout(poll, 1500);
      }
    }

    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id]);

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

  if (error)
    return (
      <div className="container">
        <p role="alert">{error}</p>
      </div>
    );
  if (!submission) return <div className="container">Đang tải kết quả…</div>;

  const waiting = ['QUEUED', 'RUNNING'].includes(submission.status);
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
    <div className="container" style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to={user?.role === 'STUDENT' ? '/student' : '/lecturer'}>← Quay lại Dashboard</Link>
        {submission.scoreReleased && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ borderColor: '#6366f1', color: '#c7d2fe' }}
            disabled={triggeringAiReview}
            onClick={handleTriggerAiReview}
          >
            {triggeringAiReview ? '⏳ Đang phân tích mã nguồn...' : '✨ Yêu cầu AI Review lại mã nguồn'}
          </button>
        )}
      </div>

      {/* CARD 1: SUBMISSION OVERVIEW */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>{submission.exam.title}</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Ngôn ngữ: <strong>{submission.exam.allowedLanguage}</strong> · Nộp lúc: {formatDate(submission.submittedAt)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
            Mã băm SHA-256: <code style={{ fontSize: '0.8rem' }}>{submission.fileHashSha256}</code>
          </div>
          {submission.artifactType === 'ZIP' && (
            <div style={{ marginTop: '0.5rem' }}>
              <a href={'/api/submissions/' + id + '/archive'} className="btn btn-secondary btn-sm">
                ⬇️ Tải ZIP bài nộp
              </a>
            </div>
          )}
        </div>
      </div>

      {/* CARD 2: AI COMPILATION ERROR EXPLAINER (UC-GenAI: Giải nghĩa lỗi biên dịch) */}
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
                {explainingError ? '⏳ Đang phân tích...' : '🤖 Nhờ AI Giải Nghĩa Lỗi'}
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

      {/* CARD 3: SEMANTIC CODE REVIEW & CLEAN CODE SCORING (UC-GenAI: Semantic Code Review) */}
      {(submission.scoreReleased || user?.role !== 'STUDENT') && latestAiReview && (
        <div className="clean-code-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(59, 130, 246, 0.25)', paddingBottom: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="ai-badge">SEMANTIC CODE REVIEW</span>
                <h3 style={{ margin: 0, color: '#93c5fd' }}>
                  🤖 Đánh Giá Chất Lượng Clean Code & Kiến Trúc SOLID
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

      {/* CARD 5: AST & WINNOWING PLAGIARISM */}
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
