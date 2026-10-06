import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiRequest } from '../../api/client';

interface Preview {
  headers: Array<{ index: number; label: string }>;
  mapping: { email: number; fullName: number } | null;
  rows: Array<{ row: number; email: string; fullName: string }>;
  errors: Array<{ row: number; message: string }>;
  totalRows: number;
  previewToken: string | null;
}
export const ImportStudentsPage: React.FC = () => {
  const { classId } = useParams();
  const [file, setFile] = useState<File | null>(null);
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
    setBusy(true); setMessage(''); setRowErrors([]);
    const result = await apiRequest<Preview>('/classes/' + classId + '/students/import/preview', { method: 'POST', body: formData() });
    setBusy(false);
    if (result.success && result.data) {
      setPreview(result.data);
      if (result.data.mapping) setMapping(result.data.mapping);
      setRowErrors(result.data.errors);
    } else { setPreview(null); setMessage(result.message || 'Không thể đọc file.'); }
  };
  const commit = async () => {
    if (!preview?.previewToken) return;
    const data = formData(); data.append('previewToken', preview.previewToken);
    setBusy(true); setMessage(''); setRowErrors([]);
    const result = await apiRequest<{ added: number; skipped: number; createdUsers: number }>('/classes/' + classId + '/students/import', { method: 'POST', body: data });
    setBusy(false);
    // Always require another preview after an attempted commit.
    setPreview(current => current ? { ...current, previewToken: null } : null);
    if (result.success && result.data) setMessage('Import thành công: ' + result.data.added + ' sinh viên được thêm, ' + result.data.skipped + ' đã có trong lớp, ' + result.data.createdUsers + ' tài khoản mới.');
    else {
      setMessage(result.message || 'Import không thành công; dữ liệu không được ghi một phần.');
      if (Array.isArray(result.details)) setRowErrors(result.details as any);
    }
  };
  const selectFile = (candidate: File | null) => {
    setPreview(null); setMapping({ email: 0, fullName: 0 }); setMessage(''); setRowErrors([]);
    if (candidate && (!candidate.name.toLowerCase().endsWith('.xlsx') || candidate.size >= 10 * 1024 * 1024)) {
      setFile(null); setMessage('Chọn file .xlsx nhỏ hơn 10 MB.'); return;
    }
    setFile(candidate);
  };
  return <div className="container" style={{ maxWidth: '1000px' }}>
    <Link to="/lecturer">← Quay lại lớp học</Link>
    <div className="card" style={{ marginTop: '1rem' }}>
      <h2>Import sinh viên từ Excel</h2>
      <p>Sheet đầu tiên cần có dòng tiêu đề và các cột Email, Họ tên. Tối đa 5.000 sinh viên, file nhỏ hơn 10 MB.</p>
      <p>Tài khoản mới đăng nhập bằng Google với email đã import, gồm Gmail cá nhân. Sinh viên đã có tài khoản được giữ nguyên thông tin.</p>
      <input type="file" accept=".xlsx" disabled={busy} onChange={event => selectFile(event.target.files?.[0] || null)} />
      <button className="btn btn-secondary" disabled={!file || busy} onClick={showPreview} style={{ marginLeft: '1rem' }}>{busy ? 'Đang xử lý...' : 'Xem trước'}</button>
      {preview && <div style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {(['email', 'fullName'] as const).map(field => <label key={field} style={{ flex: 1 }}>
            {field === 'email' ? 'Cột Email' : 'Cột Họ tên'}
            <select className="form-control" value={mapping[field]} disabled={busy} onChange={event => {
              setMapping(current => ({ ...current, [field]: Number(event.target.value) }));
              setPreview(current => current ? { ...current, previewToken: null } : null);
            }}>
              <option value={0}>Chọn cột</option>
              {preview.headers.map(header => <option key={header.index} value={header.index}>{header.label} (cột {header.index})</option>)}
            </select>
          </label>)}
        </div>
        <p>{preview.totalRows} dòng; hiển thị tối đa 100 dòng mẫu. Khi đổi cột, nhấn Xem trước lại.</p>
        <div style={{ overflowX: 'auto', maxHeight: '360px' }}>
          <table style={{ width: '100%', textAlign: 'left' }}>
            <thead><tr><th>Dòng</th><th>Email</th><th>Họ tên</th></tr></thead>
            <tbody>{preview.rows.slice(0, 100).map(row => <tr key={row.row}><td>{row.row}</td><td>{row.email}</td><td>{row.fullName}</td></tr>)}</tbody>
          </table>
        </div>
        <button className="btn btn-primary" disabled={busy || !preview.previewToken || !!rowErrors.length} onClick={commit} style={{ marginTop: '1rem' }}>Xác nhận import</button>
      </div>}
      {message && <p role="status" style={{ marginTop: '1rem' }}>{message}</p>}
      {rowErrors.length > 0 && <div role="alert"><p>Vui lòng sửa các lỗi trước khi import:</p><ul>{rowErrors.slice(0, 100).map((error, index) => <li key={index}>Dòng {error.row}: {error.message}</li>)}</ul></div>}
    </div>
  </div>;
};
