export const USER_TOKEN_KEY = 'pema_user_token';
export const ADMIN_TOKEN_KEY = 'pema_admin_token';

export function getUserToken(): string | null {
  return typeof window !== 'undefined' ? window.localStorage.getItem(USER_TOKEN_KEY) : null;
}

export function setUserToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(USER_TOKEN_KEY, token);
  else window.localStorage.removeItem(USER_TOKEN_KEY);
}

export function getAdminToken(): string | null {
  return typeof window !== 'undefined' ? window.localStorage.getItem(ADMIN_TOKEN_KEY) : null;
}

export function setAdminToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  else window.localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const userToken = getUserToken();
  const adminToken = getAdminToken();
  if (userToken) headers.set('x-pema-token', userToken);
  if (adminToken) headers.set('x-pema-admin-token', adminToken);

  const response = await fetch(url, {
    ...options,
    cache: 'no-store',
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.error || `Request failed (${response.status})`) as Error & {
      fieldErrors?: Record<string, string>;
      status?: number;
    };
    err.fieldErrors = data?.fieldErrors;
    err.status = response.status;
    throw err;
  }
  return data as T;
}

export interface FileUploadPayload {
  fileName: string;
  dataUrl: string;
}

export function fileToPayload(file: File): Promise<FileUploadPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read selected file.'));
        return;
      }
      resolve({ fileName: file.name, dataUrl: reader.result });
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}
