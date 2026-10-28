const API_BASE = '/api';
export interface ApiResult<T = any> { success: boolean; data?: T; message?: string; details?: unknown }
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    refreshInFlight = fetch(API_BASE + '/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-AITA-Request': '1' },
      signal: controller.signal,
    }).then(async response => {
      clearTimeout(timeout);
      if (!response.ok) return false;
      const result = await response.json();
      if (result.data?.user) window.dispatchEvent(new CustomEvent('aita-session-refreshed', { detail: result.data }));
      return true;
    }).catch(() => false).finally(() => {
      clearTimeout(timeout);
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers(options.headers);
  headers.set('X-AITA-Request', '1');
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  const controller = new AbortController();
  const isAiReview = endpoint.startsWith('/ai/');
  const timeoutMs = isAiReview ? 120000 : options.body instanceof FormData ? 60000 : 15000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const request = () => fetch(API_BASE + endpoint, {
    ...options,
    headers,
    credentials: 'include',
    signal: options.signal || controller.signal,
  });

  try {
    let response = await request();
    clearTimeout(timeout);
    const authEntry = /^\/auth\/(login|register|google|refresh|logout)(\/|$)/.test(endpoint);
    if (response.status === 401 && !authEntry) {
      if (await refreshSession()) response = await request();
      if (response.status === 401) window.dispatchEvent(new Event('aita-session-expired'));
    }
    const result = await response.json();
    return response.ok ? result : { success: false, message: result.message || 'Yêu cầu thất bại.', details: result.details };
  } catch (error: any) {
    clearTimeout(timeout);
    return {
      success: false,
      message: error.name === 'AbortError'
        ? 'Hết thời gian chờ phản hồi từ máy chủ (cổng 5000).'
        : (error.message || 'Không thể kết nối máy chủ.'),
    };
  }
}
