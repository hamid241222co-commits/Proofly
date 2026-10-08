import { createClient } from './supabase/client';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = new Headers(options.headers);
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }
  
  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });
  } catch (error) {
    throw new Error('Network error. Backend might be unavailable.');
  }
  
  if (!response.ok) {
    let errorMessage = `API Error: ${response.statusText}`;
    try {
      const data = await response.json();
      errorMessage = data.detail || data.error || errorMessage;
    } catch (e) {
      if (response.status === 401) errorMessage = 'Unauthorized: Please log in again.';
      else if (response.status === 403) errorMessage = 'Forbidden: You do not have permission.';
      else if (response.status === 422) errorMessage = 'Validation Error: Invalid input data.';
      else if (response.status >= 500) errorMessage = 'Internal Server Error.';
    }
    throw new ApiError(errorMessage, response.status);
  }
  
  return response.json();
}
