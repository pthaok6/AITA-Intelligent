import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

export const SubmissionResultPage: React.FC = () => {
  const { user } = useAuth();
  const { id } = useParams(); const [submission, setSubmission] = useState<any>(null), [error, setError] = useState('');
  useEffect(() => {
    let active = true; let timer: ReturnType<typeof setTimeout>;
    async function load() {
      const res = await apiRequest('/submissions/' + id);
      if (!active) return;
      if (!res.success) { setError(res.message || 'Không tải được kết quả.'); return; }
      setSubmission(res.data);
      if (['QUEUED', 'RUNNING'].includes(res.data.status) || ['PENDING', 'RUNNING'].includes(res.data.astStatus) && ['COMPLETED', 'COMPILE_ERROR'].includes(res.data.status)) timer = setTimeout(load, 1500);
    }
    void load(); return () => { active = false; clearTimeout(timer); };
  }, [id]);
  if (error) return <div className="container"><p role="alert">{error}</p></div>;
  if (!submission) return <div className="container">Đang tải kết quả…</div>;
  const waiting = ['QUEUED', 'RUNNING'].includes(submission.status);
  return <div className="container" style={{ maxWidth: 1000 }}>
    <Link to={user?.role === 'STUDENT' ? '/student' : '/lecturer'}>← Dashboard</Link>
    <div className="card" style={{ marginTop: '1rem' }}>
      <h2>{submission.exam.title}</h2>
      <span className={'badge ' + (submission.status === 'COMPLETED' ? 'badge-green' : 'badge-yellow')}>{submission.status}</span>
      <p><strong>{submission.totalScore} điểm</strong> · {submission.exam.allowedLanguage} · {new Date(submission.submittedAt).toLocaleString('vi-VN')}</p>
      {waiting && <p>Worker đang xử lý bài nộp. Kết quả sẽ tự cập nhật.</p>}
      {submission.compileMessage && <details open={submission.status !== 'COMPLETED'}><summary>Thông báo compiler / worker</summary><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{submission.compileMessage}</pre></details>}
      <h3>Bài nộp</h3><p>{submission.originalFilename || 'Bài nộp cũ'} · {submission.entrypoint}</p>
      <p style={{ overflowWrap: 'anywhere' }}>SHA-256: <code>{submission.fileHashSha256}</code></p>
      {submission.artifactType === 'ZIP' && <a href={'/api/submissions/' + id + '/archive'} className="btn btn-secondary">Tải ZIP đã nộp</a>}
      <ul>{submission.sourceFiles?.map((file: any) => <li key={file.path}>{file.path} ({file.size} bytes)</li>)}</ul>
    </div>
    <div className="card" style={{ marginTop: '1rem' }}>
      <h3>Kết quả test case</h3>
      <table className="table"><thead><tr><th>Test</th><th>Trạng thái</th><th>Thời gian</th><th>RAM đo được</th><th>Điểm</th></tr></thead>
        <tbody>{submission.testResults?.map((result: any) => <tr key={result.id}>
          <td>#{result.testCase.orderIndex}{result.testCase.isHidden ? ' (ẩn)' : ''}</td>
          <td><span className={'badge ' + (result.status === 'ACCEPTED' ? 'badge-green' : 'badge-red')}>{result.status}</span>
            {(result.actualOutput !== null || result.stderr) && <details><summary>StdOut / StdErr · exit {result.exitCode ?? '—'}</summary>
              <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 250, overflow: 'auto' }}>{result.actualOutput}</pre>
              {result.stderr && <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 250, overflow: 'auto', color: '#f87171' }}>{result.stderr}</pre>}
              {result.outputTruncated && <p>Output đã vượt giới hạn.</p>}
            </details>}</td>
          <td>{result.executionTimeMs} ms</td><td>{(result.memoryUsedKb / 1024).toFixed(1)} MiB</td><td>{result.scoreEarned}</td>
        </tr>)}</tbody></table>
      {!waiting && !submission.testResults?.length && <p>Không có kết quả test case. Xem thông báo compiler / worker ở trên.</p>}
    </div>
    <div className="card" style={{ marginTop: '1rem' }}>
      <h3>AST & Winnowing</h3><p>Trạng thái: {submission.astStatus} · {submission._count?.fingerprints || 0} fingerprint</p>
      {submission.astVersion && <p>{submission.astVersion} · k = {submission.astK} · w = {submission.astW}</p>}
      {submission.astMessage && <pre style={{ whiteSpace: 'pre-wrap' }}>{submission.astMessage}</pre>}
      <p>Giảng viên có thể xem tỷ lệ tương đồng giữa các bài nộp trong trang kết quả của lớp.</p>
    </div>
  </div>;
};
