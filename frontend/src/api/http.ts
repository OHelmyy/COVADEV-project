import { getCookie } from "../lib/csrf";

function looksLikeHtml(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html");
}

async function request<T>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();

  if (!res.ok) {
    const snippet = looksLikeHtml(text)
      ? "HTML response (likely login/404/CSRF)"
      : text.slice(0, 200);

    throw new Error(`HTTP ${res.status}: ${snippet}`);
  }

  if (!text) return null as T;

  if (looksLikeHtml(text)) {
    throw new Error("Expected JSON but got HTML (check endpoint URL / login / permissions).");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON response: ${text.slice(0, 200)}`);
  }
}

export function apiGet<T>(url: string) {
  return request<T>(url, { method: "GET" });
}

export function apiPost<T>(url: string, data: Record<string, any>) {
  const body = new URLSearchParams();
  Object.entries(data).forEach(([k, v]) => body.append(k, String(v ?? "")));

  return request<T>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body,
  });
}

export function apiPatch<T>(url: string, data: Record<string, any>) {
  const body = new URLSearchParams();
  Object.entries(data).forEach(([k, v]) => body.append(k, String(v ?? "")));

  return request<T>(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body,
  });
}

export function apiDelete<T>(url: string) {
  return request<T>(url, {
    method: "DELETE",
    headers: {
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
  });
}

export function apiUpload<T>(url: string, form: FormData) {
  return request<T>(url, {
    method: "POST",
    headers: {
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: form,
  });
}

/* New JSON helpers for new feature-based APIs */

export function apiPostJson<T>(url: string, data: unknown) {
  return request<T>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(data),
  });
}

export function apiPatchJson<T>(url: string, data: unknown) {
  return request<T>(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCookie("csrftoken") || "",
    },
    body: JSON.stringify(data),
  });
}