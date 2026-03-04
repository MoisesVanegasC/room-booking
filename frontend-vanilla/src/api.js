const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

async function apiFetch(path, { method = "GET", body, headers, timeoutMs = 15000 } = {}) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    let res;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            method,
            credentials: "include",
            signal: controller.signal,
            headers: {
                "Content-Type": "application/json",
                ...(headers ?? {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch (err) {
        clearTimeout(t);
        // AbortError = timeout
        if (err?.name === "AbortError") {
            const e = new Error(`Timeout (${timeoutMs}ms) llamando ${path}`);
            e.code = "TIMEOUT";
            e.status = 0;
            throw e;
        }
        throw err;
    }

    clearTimeout(t);

    const contentType = res.headers.get("content-type") || "";
    let data = null;

    // 204 No Content o body vacío: no parsear JSON
    if (res.status === 204) {
        data = null;
    } else if (contentType.includes("application/json")) {
        try {
            data = await res.json();
        } catch {
            data = null;
        }
    } else {
        data = await res.text();
    }

    if (!res.ok) {
        const msg =
            (data && data.error && data.error.message) ||
            (typeof data === "string" ? data : "Error");
        const code = (data && data.error && data.error.code) || `${res.status}`;
        const err = new Error(msg);
        err.code = code;
        err.status = res.status;
        err.data = data;
        throw err;
    }

    return data;
}

export const api = {
    login: (email, password) => apiFetch("/auth/login", { method: "POST", body: { email, password } }),
    logout: () => apiFetch("/auth/logout", { method: "POST" }),
    register: (payload) => apiFetch("/auth/register", { method: "POST", body: payload }),
    me: () => apiFetch("/auth/me"),
    rooms: () => apiFetch("/rooms"),
    availability: (roomId, date) => apiFetch(`/rooms/${roomId}/availability?date=${encodeURIComponent(date)}`),

    // Reserva con timeout
    reserve: ({ roomId, startAt, endAt }) =>
        apiFetch("/reservations", { method: "POST", body: { roomId, startAt, endAt }, timeoutMs: 15000 }),

    myReservations: () => apiFetch("/reservations/me"),
    cancelReservation: (id) => apiFetch(`/reservations/${id}`, { method: "DELETE" }),

    // Check-in / Check-out
    checkIn: (id) => apiFetch(`/reservations/${id}/check-in`, { method: "PATCH" }),
    checkOut: (id) => apiFetch(`/reservations/${id}/check-out`, { method: "PATCH" }),

    adminReservations() {
        return apiFetch(`/admin/reservations`);
    },
};
