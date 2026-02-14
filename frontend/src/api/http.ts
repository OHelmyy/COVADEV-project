// frontend/src/api/http.ts
function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()!.split(";").shift();
  return undefined;
}

function csrf() {
  return getCookie("csrftoken");
}

async function request<T>(url: string, options: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `HTTP ${res.status}`);
  }
  return text ? JSON.parse(text) : (null as any);
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
      "X-CSRFToken": csrf() || "",
    },
    body,
  });
}

export function apiUpload<T>(url: string, form: FormData) {
  return request<T>(url, {
    method: "POST",
    headers: {
      "X-CSRFToken": csrf() || "",
    },
    body: form,
  });
}


export function apiPatch<T>(url: string, data: Record<string, any>) {
  const body = new URLSearchParams();
  Object.entries(data).forEach(([k, v]) => body.append(k, String(v ?? "")));

  return request<T>(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-CSRFToken": csrf() || "",
    },
    body,
  });
}

export function apiDelete<T>(url: string) {
  return request<T>(url, {
    method: "DELETE",
    headers: {
      "X-CSRFToken": csrf() || "",
    },
  });
}