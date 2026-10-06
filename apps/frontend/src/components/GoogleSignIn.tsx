import React, { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

declare global {
  interface Window {
    google?: { accounts: { id: {
      initialize: (options: { client_id: string; nonce: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (element: HTMLElement, options: { theme: string; size: string; text: string }) => void;
    } } };
  }
}
let googleScript: Promise<void> | undefined;
function loadGoogle() {
  if (window.google) return Promise.resolve();
  if (!googleScript) googleScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { googleScript = undefined; script.remove(); reject(new Error('Không thể tải đăng nhập Google.')); };
    document.head.appendChild(script);
  });
  return googleScript;
}
export const GoogleSignIn: React.FC<{ password?: string }> = ({ password }) => {
  const container = useRef<HTMLDivElement>(null);
  const passwordRef = useRef(password);
  passwordRef.current = password;
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    void (async () => {
      const config = await apiRequest<{ clientId: string | null; nonce: string | null }>('/auth/google/config');
      if (!active) return;
      if (!config.success || !config.data?.clientId || !config.data.nonce) {
        setMessage(config.message || 'Đăng nhập Google chưa được bật.'); return;
      }
      try {
        await loadGoogle();
        if (!active || !container.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: config.data.clientId, nonce: config.data.nonce,
          callback: async response => {
            if (!active) return;
            setBusy(true); setMessage('');
            const result = await apiRequest('/auth/google', { method: 'POST', body: JSON.stringify({ credential: response.credential, password: passwordRef.current || undefined }) });
            if (!active) return;
            setBusy(false);
            if (result.success && result.data) {
              login(result.data.token, result.data.user);
              navigate(result.data.user.role === 'STUDENT' ? '/student' : '/lecturer');
            } else { setMessage(result.message || 'Đăng nhập Google thất bại.'); setRetry(value => value + 1); }
          },
        });
        container.current.replaceChildren();
        window.google.accounts.id.renderButton(container.current, { theme: 'outline', size: 'large', text: 'signin_with' });
      } catch (error: any) { if (active) setMessage(error.message); }
    })();
    return () => { active = false; };
  }, [retry, login, navigate]);
  return <div style={{ marginTop: '1rem' }}>
    <div ref={container} style={{ display: busy ? 'none' : 'flex', justifyContent: 'center' }} />
    {busy && <p>Đang xác thực Google...</p>}
    {message && <p role="status" style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{message}</p>}
  </div>;
};
