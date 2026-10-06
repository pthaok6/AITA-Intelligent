const API_BASE = '/api';
export interface ApiResult<T = any> { success: boolean; data?: T; message?: string; details?: unknown }
let refreshInFlight: Promise<boolean> | null = null;
async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(API_BASE + '/auth/refresh', {
      method: 'POST', credentials: 'include', headers: { 'X-AITA-Request': '1' },
    }).then(async response => {
      if (!response.ok) return false;
      const result = await response.json();
      if (result.data?.user) window.dispatchEvent(new CustomEvent('aita-session-refreshed', { detail: result.data }));
      return true;
    }).catch(() => false).finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}
export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers(options.headers);
  headers.set('X-AITA-Request', '1');
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const request = () => fetch(API_BASE + endpoint, { ...options, headers, credentials: 'include' });
  try {
    let response = await request();
    const authEntry = /^\/auth\/(login|register|google|refresh|logout)(\/|$)/.test(endpoint);
    if (response.status === 401 && !authEntry) {
      if (await refreshSession()) response = await request();
      if (response.status === 401) window.dispatchEvent(new Event('aita-session-expired'));
    }
    const result = await response.json();
    return response.ok ? result : { success: false, message: result.message || 'Yêu cầu thất bại.', details: result.details };
  } catch (error: any) { return { success: false, message: error.message || 'Không thể kết nối máy chủ.' }; }
}
