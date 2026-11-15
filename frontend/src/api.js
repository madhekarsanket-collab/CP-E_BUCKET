// Base URL of the Flask API. Empty = same origin (Vite proxy in dev, Flask serving the build in prod,
// or a Vercel rewrite). The session lives in an httpOnly cookie the page cannot read.
const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

/** JSON request helper. Failures become ApiError with a message that is safe to show. */
export async function api(path, { method = 'GET', body } = {}) {
  // The X-Requested-With header is the anti-forgery proof the server requires on every write.
  const headers = { Accept: 'application/json', 'X-Requested-With': 'ebucket-web' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) onUnauthorized();
    throw new ApiError(data?.error || 'Something went wrong. Please try again.', response.status);
  }
  return data;
}

export const errorMessage = (error) =>
  error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
