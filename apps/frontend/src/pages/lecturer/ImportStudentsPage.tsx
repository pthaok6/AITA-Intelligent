import React, { useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../../api/client';

interface Preview {
  headers: Array<{ index: number; label: string }>;
  mapping: { email: number; fullName: number } | null;
  rows: Array<{
    row: number;
    email: string;
    fullName: string;
    accountStatus?: 'READY' | 'NOT_FOUND' | 'INACTIVE' | 'NOT_STUDENT';
  }>;
  errors: Array<{ row: number; message: string }>;
  totalRows: number;
  previewToken: string | null;
}

export const ImportStudentsPage: React.FC = () => {
  const { classId } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState({ email: 0, fullName: 0 });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [rowErrors, setRowErrors] = useState<Array<{ row: number; message: string }>>([]);

  const formData = () => {
    const data = new FormData();
    if (file) data.append('file', file);
    if (mapping.email && mapping.fullName) data.append('mapping', JSON.stringify(mapping));
    return data;
  };

  const showPreview = async () => {
    if (!file) return;
    setBusy(true);
    setMessage('');
    setRowErrors([]);
    const result = await apiRequest<Preview>('/classes/' + classId + '/students/import/preview', {
      method: 'POST',
      body: formData(),
    });
    setBusy(false);
    if (result.success && result.data) {
      setPreview(result.data);
      if (result.data.mapping) setMapping(result.data.mapping);
      setRowErrors(result.data.errors);
    } else {
      setPreview(null);
      setMessage(result.message || 'Không thể đọc file.');
    }
  };

  const commit = async () => {
    if (!preview?.previewToken) return;
    const data = formData();
    data.append('previewToken', preview.previewToken);
    setBusy(true);
    setMessage('');
    setRowErrors([]);
    const result = await apiRequest<{ added: number; skipped: number; missingAccounts: number }>(
      '/classes/' + classId + '/students/import',
      { method: 'POST', body: data }
    );
    setBusy(false);
    setPreview((current) => (current ? { ...current, previewToken: null } : null));
    if (result.success && result.data) {
      setMessage(
        `Import thành công: ${result.data.added} sinh viên được thêm vào lớp, ${result.data.skipped} sinh viên đã có sẵn, ${result.data.missingAccounts} email chưa có tài khoản đã được bỏ qua.`
      );
    } else {
      setMessage(result.message || 'Import không thành công; dữ liệu không được ghi một phần.');
      if (Array.isArray(result.details)) setRowErrors(result.details as any);
    }
  };

  const selectFile = (candidate: File | null) => {
    setPreview(null);
    setMapping({ email: 0, fullName: 0 });
    setMessage('');
    setRowErrors([]);
    if (candidate && (!candidate.name.toLowerCase().endsWith('.xlsx') || candidate.size >= 10 * 1024 * 1024)) {
      setFile(null);
      setMessage('Vui lòng chọn file .xlsx có dung lượng nhỏ hơn 10 MB.');
      return;
    }
    setFile(candidate);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      selectFile(e.dataTransfer.files[0]);
    }
  };

  const readyCount = preview?.rows.filter((r) => r.accountStatus === 'READY').length || 0;
  const notFoundCount = preview?.rows.filter((r) => r.accountStatus === 'NOT_FOUND').length || 0;
  const errorCount =
    preview?.rows.filter((r) => r.accountStatus === 'INACTIVE' || r.accountStatus === 'NOT_STUDENT').length || 0;

  return (
    <div className="container" style={{ maxWidth: '1050px', paddingBottom: '3rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <Link
          to="/lecturer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Quay lại lớp học
        </Link>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0 0 0.4rem', letterSpacing: '-0.02em' }}>
          Import danh sách sinh viên từ Excel
        </h2>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Tải file danh sách lớp (.xlsx) để ghi danh tự động tài khoản sinh viên vào lớp học.
        </p>
      </div>

      {/* Step Tracker */}
      <div className="step-tracker">
        <div className={`step-item ${file ? 'completed' : 'active'}`}>
          <span className="step-number">{file ? '✓' : '1'}</span>
          <span>Chọn tệp Excel</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        <div className={`step-item ${preview ? (preview.previewToken ? 'completed' : 'active') : file ? 'active' : ''}`}>
          <span className="step-number">{preview?.previewToken ? '✓' : '2'}</span>
          <span>Khớp cột dữ liệu</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        <div className={`step-item ${preview?.previewToken ? 'active' : ''}`}>
          <span className="step-number">3</span>
          <span>Xem trước & Xác nhận</span>
        </div>
      </div>

      {/* Notice Message */}
      {message && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.85rem 1.15rem',
            borderRadius: 'var(--radius-control)',
            background: message.startsWith('Import thành công')
              ? 'rgba(16, 185, 129, 0.12)'
              : 'rgba(239, 68, 68, 0.12)',
            border: message.startsWith('Import thành công')
              ? '1px solid rgba(16, 185, 129, 0.3)'
              : '1px solid rgba(239, 68, 68, 0.3)',
            color: message.startsWith('Import thành công') ? '#34d399' : '#fca5a5',
            marginBottom: '1.25rem',
            fontSize: '0.9rem',
          }}
        >
          {message.startsWith('Import thành công') ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          )}
          <span>{message}</span>
        </div>
      )}

      {/* Row Errors Alert */}
      {rowErrors.length > 0 && (
        <div
          role="alert"
          style={{
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-control)',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#fca5a5',
            marginBottom: '1.25rem',
          }}
        >
          <strong style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', color: '#f87171' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Phát hiện {rowErrors.length} lỗi trong file cần điều chỉnh:
          </strong>
          <ul style={{ paddingLeft: '1.5rem', margin: 0, fontSize: '0.85rem', maxHeight: '160px', overflowY: 'auto' }}>
            {rowErrors.slice(0, 50).map((err, idx) => (
              <li key={idx} style={{ marginBottom: '0.2rem' }}>
                Dòng {err.row}: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Card */}
      <div className="card">
        {/* Step 1: Upload File Area */}
        <input
          type="file"
          accept=".xlsx"
          ref={fileInputRef}
          style={{ display: 'none' }}
          disabled={busy}
          onChange={(event) => selectFile(event.target.files?.[0] || null)}
        />

        {!file ? (
          <div
            className={`dropzone-box ${isDragging ? 'dragover' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={{ display: 'inline-flex', padding: '0.85rem', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', marginBottom: '0.75rem' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.35rem' }}>
              Kéo thả file Excel (.xlsx) vào đây
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
              hoặc <span style={{ color: 'var(--primary)', fontWeight: 600 }}>bấm để duyệt file từ máy tính</span>
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Định dạng hỗ trợ: .xlsx</span>
              <span>•</span>
              <span>Tối đa: 5.000 sinh viên (10 MB)</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '1rem 1.25rem', background: 'var(--surface-inset)', borderRadius: 'var(--radius-control)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ padding: '0.6rem', borderRadius: '0.4rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <div>
                <strong style={{ fontSize: '1rem', display: 'block', color: 'var(--text-primary)' }}>{file.name}</strong>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {(file.size / 1024).toFixed(1)} KB · File Excel hợp lệ
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                Đổi file khác
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={showPreview}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {busy ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    Đọc dữ liệu & Xem trước
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Requirements info banner */}
        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(30, 41, 59, 0.4)', borderRadius: 'var(--radius-control)', border: '1px solid var(--border)', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Chỉ ghi danh tài khoản sinh viên đã kích hoạt trên hệ thống. Email chưa có tài khoản sẽ tự động được bỏ qua mà không làm gián đoạn import.</span>
        </div>

        {/* Step 2 & 3: Preview and Column Mapping Section */}
        {preview && (
          <div style={{ marginTop: '1.75rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
              Cấu hình cột dữ liệu
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              {(['email', 'fullName'] as const).map((field) => (
                <div key={field} style={{ background: 'var(--surface-inset)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-control)', border: '1px solid var(--border)' }}>
                  <label htmlFor={`map-${field}`} style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                    {field === 'email' ? 'Cột Email sinh viên *' : 'Cột Họ và tên sinh viên *'}
                  </label>
                  <select
                    id={`map-${field}`}
                    className="form-control"
                    value={mapping[field]}
                    disabled={busy}
                    onChange={(event) => {
                      setMapping((current) => ({ ...current, [field]: Number(event.target.value) }));
                      setPreview((current) => (current ? { ...current, previewToken: null } : null));
                    }}
                  >
                    <option value={0}>-- Chọn cột từ file Excel --</option>
                    {preview.headers.map((header) => (
                      <option key={header.index} value={header.index}>
                        Cột {header.index}: {header.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview Statistics Pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.75rem 1rem', background: 'var(--surface-inset)', borderRadius: 'var(--radius-control)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Tổng số dòng</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', marginTop: '0.2rem' }}>{preview.totalRows}</div>
              </div>
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-control)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <span style={{ fontSize: '0.75rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 600 }}>Sẵn sàng thêm</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#34d399', marginTop: '0.2rem' }}>{readyCount}</div>
              </div>
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 'var(--radius-control)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                <span style={{ fontSize: '0.75rem', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 600 }}>Chưa có tài khoản</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.2rem' }}>{notFoundCount}</div>
              </div>
              {errorCount > 0 && (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-control)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                  <span style={{ fontSize: '0.75rem', color: '#f87171', textTransform: 'uppercase', fontWeight: 600 }}>Tài khoản lỗi</span>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f87171', marginTop: '0.2rem' }}>{errorCount}</div>
                </div>
              )}
            </div>

            {/* Preview Table */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-control)', overflow: 'hidden', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.65rem 1rem', background: 'var(--surface-inset)', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Hiển thị mẫu {Math.min(preview.rows.length, 100)} / {preview.totalRows} sinh viên</span>
                <span>{!preview.previewToken && <strong style={{ color: '#fbbf24' }}>* Đã thay đổi cột, bấm Xem trước lại để tạo token</strong>}</span>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: '380px' }}>
                <table className="table" style={{ margin: 0 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#1e293b', zIndex: 1 }}>
                    <tr>
                      <th style={{ width: '70px' }}>Dòng</th>
                      <th>Email sinh viên</th>
                      <th>Họ và tên</th>
                      <th>Trạng thái tài khoản</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 100).map((row) => (
                      <tr key={row.row}>
                        <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>#{row.row}</td>
                        <td style={{ fontWeight: 600 }}>{row.email}</td>
                        <td>{row.fullName}</td>
                        <td>
                          {row.accountStatus === 'READY' ? (
                            <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                              Sẵn sàng import
                            </span>
                          ) : row.accountStatus === 'NOT_FOUND' ? (
                            <span className="badge badge-yellow">Chưa có tài khoản (bỏ qua)</span>
                          ) : row.accountStatus === 'INACTIVE' ? (
                            <span className="badge badge-red">Tài khoản bị khóa</span>
                          ) : row.accountStatus === 'NOT_STUDENT' ? (
                            <span className="badge badge-red">Không phải sinh viên</span>
                          ) : (
                            <span className="badge">Chưa kiểm tra</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Commit Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', alignItems: 'center' }}>
              {!preview.previewToken && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={showPreview}
                >
                  Xem trước lại với cấu hình mới
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !preview.previewToken || !!rowErrors.length}
                onClick={commit}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
              >
                {busy ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Đang import vào lớp...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Xác nhận import {readyCount} sinh viên
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
