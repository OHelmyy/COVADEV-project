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
    credentials: "include", // ✅ keep session cookie
    headers: {
      Accept: "application/json", // ✅ ask for JSON
      ...(options.headers || {}),
    },
  });

  const text = await res.text();

  // ✅ If backend returned HTML, don't JSON.parse it
  const looksLikeHtml = text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html");

  if (!res.ok) {
    // show short snippet only
    const snippet = looksLikeHtml ? "HTML response (likely login/404/CSRF)" : text.slice(0, 200);
    throw new Error(`HTTP ${res.status}: ${snippet}`);
  }

  if (!text) return null as any;

  if (looksLikeHtml) {
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
