// Talks to the FairView API. Every call returns the JSON body, or throws an Error
// whose message is the API's own explanation (the API always answers { error }).
const BASE = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'fairview.token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // private browsing: the login lasts until the tab closes
  }
}

let onUnauthorized = () => {};
export function whenLoggedOut(fn) {
  onUnauthorized = fn;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const token = getToken();
  const init = { method, headers: { ...headers } };
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    if (raw) {
      init.body = body;
    } else {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
  }
  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, init);
  } catch {
    throw new ApiError('Cannot reach the FairView server. Check your connection and try again.', 0);
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token && !path.startsWith('/auth/login')) onUnauthorized();
    throw new ApiError(data?.error || `Request failed (${res.status}).`, res.status);
  }
  return data;
}
