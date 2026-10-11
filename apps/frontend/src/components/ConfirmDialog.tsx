import React, { useEffect, useRef } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open, title, description, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy', busy = false, onConfirm, onCancel,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const cancel = () => { if (!busy) onCancel(); };

  return <dialog
    ref={dialogRef}
    className="confirm-dialog"
    aria-labelledby="confirm-dialog-title"
    aria-describedby="confirm-dialog-description"
    onCancel={event => { event.preventDefault(); cancel(); }}
    onClick={event => { if (event.target === dialogRef.current) cancel(); }}
  >
    <section className="confirm-panel">
      <div className="confirm-icon" aria-hidden="true">!</div>
      <h2 id="confirm-dialog-title" className="confirm-title">{title}</h2>
      <p id="confirm-dialog-description" className="confirm-description">{description}</p>
      <div className="confirm-actions">
        <button type="button" className="btn btn-secondary" onClick={cancel} disabled={busy}>{cancelLabel}</button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy ? 'Đang xử lý…' : confirmLabel}</button>
      </div>
    </section>
  </dialog>;
};
