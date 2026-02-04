import "./styles.css";
import { api } from "./api.js";

const el = (sel) => document.querySelector(sel);

const state = {
  me: null,
  rooms: [],
  selectedRoomId: "",
  availability: null,

  selectedSlot: null, // { startAt, endAt }
  lastReservedStartAt: null,

  reservations: [],
  reservationsLoading: false,

  roomsError: "",
  roomsLoading: false,
  availabilityLoading: false,

  ui: {
    showBusy: true,
    showPast: false,
    authMode: "login",    // "login" | "register"
    resTab: "today",      // "today" | "upcoming" | "past"
    pastFilter: "all",    // "all" | "missed" | "completed"
    expandRes: {},        // map {[id]: true }
  },

  cancelTargetId: null,
};

// ------------------ Helpers UI ------------------
function roomImage(name) {
  const n = String(name || "").trim().toLowerCase();
  if (n === "sala a") return "/rooms/room-a.jpg";
  if (n === "sala b") return "/rooms/room-b.jpg";
  return "/rooms/placeholder.jpg";
}

function fmtHM(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDateShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" });
}

function selectedRoom() {
  return state.rooms.find((r) => r.id === state.selectedRoomId) ?? null;
}

function canReserve() {
  return !!(state.me?.user?.id);
}

function setMessage(kind, text) {
  const box = el("#msgBox");
  if (!box) return;
  box.className = `notice ${kind === "ok" ? "ok" : kind === "err" ? "err" : ""}`;
  box.textContent = text;
}

// ------------------ Modal ------------------
function openModal() {
  el("#modalOverlay")?.classList.add("open");
  el("body")?.classList.add("noScroll");
}

function closeModal() {
  el("#modalOverlay")?.classList.remove("open");
  el("body")?.classList.remove("noScroll");

  state.selectedSlot = null;
  state.cancelTargetId = null;

  // restaurar botón modal a modo reserva
  const btn = el("#btnConfirmReserve");
  if (btn) {
    btn.textContent = "Confirmar reserva";
    btn.classList.remove("btnDanger");
    btn.classList.add("btnPrimary");
  }
}

function openCancelModal(reservationId) {
  state.cancelTargetId = reservationId;

  el("#modalTitle").textContent = "Confirmar cancelación";
  el("#modalBody").innerHTML = `
    <div class="notice err">
      <strong>Esta acción es definitiva.</strong><br/>
      Al cancelar, la reserva queda anulada y el horario podría no estar disponible después.
    </div>

    <div class="notice" style="margin-top:10px;">
      ¿Desea continuar?
    </div>
  `;

  const btn = el("#btnConfirmReserve");
  btn.textContent = "Sí, cancelar";
  btn.classList.add("btnDanger");
  btn.classList.remove("btnPrimary");

  openModal();
}

// ------------------ API loads ------------------
async function loadMe({ silentNoSession = false } = {}) {
  try {
    const data = await api.me();
    state.me = data;
    setMessage("ok", "Sesión iniciada correctamente.");
  } catch (e) {
    state.me = null;
    if (!silentNoSession) {
      setMessage("err", "Usted no ha iniciado sesión.");
    } else {
      // mensaje neutro al inicio (o no pongas nada)
      setMessage("ok", "Listo.");
    }
  } finally {
    render();
  }
}

async function loadRooms() {
  state.roomsLoading = true;
  state.roomsError = "";
  render();

  try {
    const data = await api.rooms();
    const rooms =
      Array.isArray(data) ? data :
        Array.isArray(data?.rooms) ? data.rooms :
          Array.isArray(data?.items) ? data.items :
            Array.isArray(data?.data) ? data.data :
              [];

    state.rooms = rooms;
    setMessage("ok", `Salas listas (${rooms.length}).`);
  } catch (e) {
    state.rooms = [];
    state.roomsError = `No se pudieron cargar las salas (${e.status ?? "?"}).`;
    console.error("[rooms] error:", e);
    setMessage("err", state.roomsError);
  } finally {
    state.roomsLoading = false;
    render();
  }
}

async function loadAvailability({ silent = false } = {}) {
  const date = el("#dateInput")?.value ?? "";

  if (!canReserve()) {
    if (!silent) setMessage("err", "Inicie sesión para ver horarios.");
    return;
  }
  if (!state.selectedRoomId) {
    if (!silent) setMessage("err", "Por favor, seleccione una sala.");
    return;
  }
  if (!date) {
    if (!silent) setMessage("err", "Por favor, seleccione una fecha.");
    return;
  }

  state.availabilityLoading = true;
  render();

  try {
    const av = await api.availability(state.selectedRoomId, date);
    state.availability = av;
    if (!silent) setMessage("ok", "Horarios cargados.");
  } catch (e) {
    state.availability = null;
    if (e?.code === "TIMEOUT") {
      if (!silent) setMessage("err", "El servicio tardó demasiado. Intente nuevamente.");
    } else {
      if (!silent) setMessage("err", `No se pudieron cargar los horarios (${e.status ?? "?"}).`);
    }
  } finally {
    state.availabilityLoading = false;
    render();
  }
}

async function loadMyReservations({ silent = false } = {}) {
  if (!canReserve()) {
    state.reservations = [];
    render();
    return;
  }

  state.reservationsLoading = true;
  render();

  try {
    const data = await api.myReservations();
    const items =
      Array.isArray(data) ? data :
        Array.isArray(data?.reservations) ? data.reservations :
          Array.isArray(data?.items) ? data.items :
            Array.isArray(data?.data) ? data.data :
              [];

    state.reservations = items;
    if (!silent) setMessage("ok", `Reservas actualizadas (${items.length}).`);
  } catch (e) {
    state.reservations = [];
    if (!silent) setMessage("err", "No se pudieron cargar sus reservas. Intente de nuevo.");
  } finally {
    state.reservationsLoading = false;
    render();
  }
}

// ------------------ Auth actions ------------------
async function onLogin() {
  const email = el("#email")?.value.trim();
  const password = el("#password")?.value;

  if (!email || !password) {
    setMessage("err", "Por favor, ingrese su correo y contraseña.");
    return;
  }

  try {
    setMessage("ok", "Iniciando sesión…");
    await api.login(email, password);
  } catch (e) {
    if (e.status === 401) setMessage("err", "No se pudo iniciar sesión. Verifique su correo y contraseña.");
    else setMessage("err", `No se pudo iniciar sesión (${e.status ?? "?"}).`);
    return;
  }

  await loadMe();

  // si ya hay sesión, carga datos
  if (canReserve()) {
    await loadRooms();
    await loadMyReservations({ silent: true });
    setMessage("ok", "Sesión iniciada correctamente.");
  }
}

async function onRegister() {
  const fullName = el("#regFullName")?.value.trim();
  const email = el("#regEmail")?.value.trim();
  const password = el("#regPassword")?.value;

  if (!fullName || !email || !password) {
    setMessage("err", "Complete nombre, correo y contraseña para registrarse.");
    return;
  }

  try {
    setMessage("ok", "Creando cuenta…");
    await api.register({ email, password, fullName });

    setMessage("ok", "Cuenta creada. Iniciando sesión…");
    await api.login(email, password);

    await loadMe();

    if (canReserve()) {
      await loadRooms();
      await loadMyReservations({ silent: true });
    }

    setMessage("ok", "Registro exitoso. Sesión iniciada correctamente.");
  } catch (e) {
    if (e.status === 409) setMessage("err", "Ese correo ya está registrado.");
    else if (e.status === 400) setMessage("err", "Datos inválidos. Revise e intente de nuevo.");
    else setMessage("err", `No se pudo registrar (${e.status ?? "?"}).`);
  }
}

async function onLogout() {
  try {
    await api.logout();
    setMessage("ok", "Sesión cerrada.");
  } catch (e) {
    setMessage("err", "No se pudo cerrar la sesión. Intente de nuevo.");
  } finally {
    state.me = null;

    state.rooms = [];
    state.roomsError = "";
    state.roomsLoading = false;

    state.selectedRoomId = "";
    state.availability = null;
    state.availabilityLoading = false;

    state.selectedSlot = null;
    state.lastReservedStartAt = null;

    state.reservations = [];
    state.reservationsLoading = false;

    state.ui.authMode = "login";

    render();
  }
}

// ------------------ Reservation actions ------------------
async function cancelReservation(id) {
  if (!canReserve()) {
    setMessage("err", "Usted debe iniciar sesión para cancelar.");
    return;
  }

  try {
    setMessage("ok", "Cancelando…");
    await api.cancelReservation(id);

    setMessage("ok", "Reserva cancelada.");
    await loadMyReservations({ silent: true });

    if (state.selectedRoomId && el("#dateInput")?.value) {
      await loadAvailability({ silent: true });
    }
  } catch (e) {
    console.error("[cancel] error:", e);

    if (e.status === 401) {
      setMessage("err", "Su sesión expiró. Inicie sesión nuevamente.");
    } else if (e.status === 404) {
      setMessage("err", "La reserva ya no existe.");
    } else if (e.status === 409) {
      // tu backend manda “Muy tarde…”
      setMessage("err", e.message || "Muy tarde para cancelar esta reserva.");
    } else {
      setMessage("err", `No se pudo cancelar la reserva (${e.status ?? "?"}).`);
    }
  }
}

async function doCheckIn(id) {
  if (!canReserve()) return setMessage("err", "Usted debe iniciar sesión para registrar entrada.");

  const ok = confirm("¿Desea registrar Check-In para esta reserva?");
  if (!ok) return;

  try {
    setMessage("ok", "Registrando Check-In…");
    await api.checkIn(id);
    setMessage("ok", "Check-In registrado.");
    await loadMyReservations({ silent: true });
    if (state.selectedRoomId && el("#dateInput")?.value) await loadAvailability({ silent: true });
  } catch (e) {
    console.error("[checkin] error:", e);
    if (e.status === 401) setMessage("err", "Su sesión expiró. Inicie sesión nuevamente.");
    else setMessage("err", `No se pudo registrar Check-In (${e.status ?? "?"}).`);
  }
}

async function doCheckOut(id) {
  if (!canReserve()) return setMessage("err", "Usted debe iniciar sesión para registrar salida.");

  const ok = confirm("¿Desea registrar Check-Out para esta reserva?");
  if (!ok) return;

  try {
    setMessage("ok", "Registrando Check-Out…");
    await api.checkOut(id);
    setMessage("ok", "Check-Out registrado.");
    await loadMyReservations({ silent: true });
    if (state.selectedRoomId && el("#dateInput")?.value) await loadAvailability({ silent: true });
  } catch (e) {
    console.error("[checkout] error:", e);
    if (e.status === 401) setMessage("err", "Su sesión expiró. Inicie sesión nuevamente.");
    else setMessage("err", `No se pudo registrar Check-Out (${e.status ?? "?"}).`);
  }
}

// ------------------ Reserve modal flow ------------------
function pickSlot(slot) {
  if (!slot.available) return;
  if (!canReserve()) return setMessage("err", "Necesitas iniciar sesión para reservar.");

  state.selectedSlot = { startAt: slot.startAt, endAt: slot.endAt };
  renderReserveModal();
  openModal();
}

function renderReserveModal() {
  const room = selectedRoom();
  const s = state.selectedSlot;
  if (!room || !s) {
    el("#modalBody").innerHTML = `<div class="notice">No hay datos para reservar.</div>`;
    return;
  }

  const date = el("#dateInput").value;
  el("#modalTitle").textContent = "Confirmar reserva";

  el("#modalBody").innerHTML = `
    <div class="modalKVs">
      <div class="kvRow">
        <span class="k">Sala</span>
        <span class="v"><strong>${room.name}</strong></span>
      </div>
      <div class="kvRow">
        <span class="k">Fecha</span>
        <span class="v">${date}</span>
      </div>
      <div class="kvRow">
        <span class="k">Horario</span>
        <span class="v"><strong>${fmtHM(s.startAt)} - ${fmtHM(s.endAt)}</strong></span>
      </div>
      <div class="kvRow">
        <span class="k">Usuario</span>
        <span class="v">${state.me?.user?.email ?? "-"}</span>
      </div>
    </div>

    <div class="notice" style="margin-top:12px;">
      Al confirmar, se registrará su reserva. Podrá verla en <strong>Mis reservas</strong>.
    </div>
  `;
}

async function confirmReserve() {
  const roomId = state.selectedRoomId;
  const slot = state.selectedSlot;

  if (!roomId || !slot) return setMessage("err", "No hay slot seleccionado.");
  if (!canReserve()) return setMessage("err", "Necesitas iniciar sesión para reservar.");

  const btn = el("#btnConfirmReserve");
  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Reservando…";
    }

    await api.reserve({ roomId, startAt: slot.startAt, endAt: slot.endAt });

    setMessage("ok", "Reserva creada.");
    closeModal();

    await loadAvailability({ silent: true });
    await loadMyReservations({ silent: true });

    state.lastReservedStartAt = slot.startAt;
  } catch (e) {
    if (e.status === 401) setMessage("err", "Tu sesión expiró. Vuelve a iniciar sesión.");
    else if (e.status === 409) setMessage("err", e.message || "Ese horario ya fue reservado. Elige otro.");
    else setMessage("err", "No se pudo completar la reserva. Intenta de nuevo.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = state.cancelTargetId ? "Sí, cancelar" : "Confirmar reserva";
    }
  }
}

async function onModalConfirm() {
  // si estamos cancelando
  if (state.cancelTargetId) {
    const id = state.cancelTargetId;
    await cancelReservation(id);
    closeModal();
    return;
  }
  // si estamos reservando
  await confirmReserve();
}

// ------------------ Reservations rendering ------------------
function getCheckTimes(r) {
  const checkInAt = r.checkInAt || r.checkedInAt || r.check_in_at || r.checkinAt || null;
  const checkOutAt = r.checkOutAt || r.checkedOutAt || r.check_out_at || r.checkoutAt || null;
  return { checkInAt, checkOutAt };
}

function reservationOutcomeText(r) {
  const status = (r.status ?? "CONFIRMED").toString().toUpperCase();
  const { checkInAt, checkOutAt } = getCheckTimes(r);

  const now = new Date();
  const start = new Date(r.startAt);
  const end = new Date(r.endAt);

  // 1) Finalizada: backend lo marca FINISHED o hay check-out
  if (status === "FINISHED" || (checkInAt && checkOutAt) || checkOutAt) {
    return { label: "Finalizada", reason: "" };
  }

  // 2) Cancelada
  if (status === "CANCELLED") {
    return { label: "Cancelada", reason: "" };
  }

  // 3) Si ya terminó y no finalizó => Perdida/Incompleta
  if (now > end) {
    if (!checkInAt) {
      return {
        label: "Perdida",
        reason: "Se perdió porque no se registró Check-In dentro del horario.",
      };
    }
    if (!checkOutAt) {
      return {
        label: "Incompleta",
        reason: "Se registró Check-In, pero no se registró Check-Out antes de finalizar.",
      };
    }
  }

  // 4) En curso
  if (status === "IN_PROGRESS") return { label: "En curso", reason: "" };

  // 5) Activa
  return { label: "Activa", reason: "" };
}


function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function sortByStartAsc(a, b) { return new Date(a.startAt) - new Date(b.startAt); }
function sortByStartDesc(a, b) { return new Date(b.startAt) - new Date(a.startAt); }

function badgeForOutcome(outcome) {
  if (outcome.label === "Finalizada") return `<span class="badge ok">Finalizada</span>`;
  if (outcome.label === "En curso") return `<span class="badge ok">En curso</span>`;
  if (outcome.label === "Activa") return `<span class="badge ok">Activa</span>`;
  if (outcome.label === "Cancelada") return `<span class="badge off">Cancelada</span>`;
  if (outcome.label === "Perdida") return `<span class="badge off">Perdida</span>`;
  if (outcome.label === "Incompleta") return `<span class="badge off">Incompleta</span>`;
  return `<span class="badge">—</span>`;
}

function reservationCard(r) {
  const id = r.id;
  const status = (r.status ?? "CONFIRMED").toString().toUpperCase();
  const start = new Date(r.startAt);
  const end = new Date(r.endAt);

  const roomName =
    r.room?.name ||
    r.roomName ||
    state.rooms.find((x) => x.id === r.roomId)?.name ||
    "Sala";

  const outcome = reservationOutcomeText(r);
  const badge = badgeForOutcome(outcome);

  const { checkInAt, checkOutAt } = getCheckTimes(r);

  // Botones por estado (fuente de verdad: backend)
  const canCancel = status === "CONFIRMED" && outcome.label === "Activa";
  const canCheckIn = status === "CONFIRMED" && outcome.label === "Activa";
  const canCheckOut = status === "IN_PROGRESS" && outcome.label === "En curso";

  const timeStr = `${fmtDateShort(r.startAt)} • ${fmtHM(r.startAt)} - ${fmtHM(r.endAt)}`;

  const expanded = !!state.ui.expandedRes?.[id];

  return `
    <div class="resRow">
      <div class="resLeft">
        <div class="resTop" style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <strong>${roomName}</strong>
            ${badge}
          </div>

          <button class="btn" data-res-toggle="${id}" style="min-width:120px;">
            ${expanded ? "Ocultar" : "Detalles"}
          </button>
        </div>

        <div class="small muted">${timeStr}</div>

        ${outcome.reason ? `<div class="small" style="margin-top:6px;"><strong>Motivo:</strong> ${outcome.reason}</div>` : ``}

        <div class="resDetails" style="margin-top:10px; ${expanded ? "" : "display:none;"}">
          <div class="notice" style="margin:0;">
            <div class="small"><strong>ID:</strong> ${id}</div>
            <div class="small"><strong>Status (backend):</strong> ${status}</div>
            <div class="small"><strong>Check-In:</strong> ${checkInAt ? new Date(checkInAt).toLocaleString() : "—"}</div>
            <div class="small"><strong>Check-Out:</strong> ${checkOutAt ? new Date(checkOutAt).toLocaleString() : "—"}</div>
          </div>
        </div>
      </div>

      <div class="resRight">
        ${canCheckIn ? `<button class="btn btnPrimary" data-checkin-res="${id}">Check-In</button>` : ``}
        ${canCheckOut ? `<button class="btn btnPrimary" data-checkout-res="${id}">Check-Out</button>` : ``}

        ${canCancel
      ? `<button class="btn btnDanger" data-cancel-res="${id}">Cancelar</button>`
      : `<button class="btn" disabled>No disponible</button>`
    }
      </div>
    </div>
  `;
}

function reservationsSection(title, items, emptyText) {
  if (!items.length) {
    return `
      <div class="notice" style="margin-top:10px;">
        <strong>${title}</strong><br/>
        <span class="small">${emptyText}</span>
      </div>
    `;
  }

  return `
    <div style="margin-top:12px;">
      <div class="sectionTitle" style="margin-bottom:8px;">
        <h3>${title}</h3>
        <span class="badge">${items.length}</span>
      </div>
      <div class="resList">
        ${items.map(reservationCard).join("")}
      </div>
    </div>
  `;
}

function getPastBucket(outcome) {
  if (outcome.label === "Finalizada") return "finished";
  if (outcome.label === "Cancelada") return "cancelled";
  if (outcome.label === "Perdida" || outcome.label === "Incompleta") return "lost";
  return "all";
}

function renderReservations() {
  const me = state.me?.user ?? null;

  if (!me) {
    return `<div class="notice">Inicie sesión para ver <strong>Mis reservas</strong>.</div>`;
  }

  if (state.reservationsLoading) {
    return `<div class="notice">Cargando sus reservas…</div>`;
  }

  const items = (state.reservations ?? []).slice().sort(sortByStartAsc);
  if (!items.length) {
    return `<div class="notice">Aún no tiene reservas. Seleccione una sala y elija un horario disponible.</div>`;
  }

  const now = new Date();
  const today0 = startOfLocalDay(now);
  const todayEnd = endOfLocalDay(now);

  const today = [];
  const upcoming = [];
  const past = [];

  for (const r of items) {
    const start = new Date(r.startAt);
    const end = new Date(r.endAt);
    const outcome = reservationOutcomeText(r);

    // Regla: si ya terminó o el outcome ya es “estado final” => Past
    const isEnded = now > end;
    const isFinal =
      outcome.label === "Finalizada" ||
      outcome.label === "Cancelada" ||
      outcome.label === "Perdida" ||
      outcome.label === "Incompleta";

    if (isEnded || isFinal) {
      past.push(r);
      continue;
    }

    // Si aún no termina:
    const touchesToday = (start <= todayEnd && end >= today0);
    if (touchesToday) today.push(r);
    else if (start > todayEnd) upcoming.push(r);
    else past.push(r);
  }

  today.sort(sortByStartAsc);
  upcoming.sort(sortByStartAsc);
  past.sort(sortByStartDesc);

  // Tabs
  const tab = state.ui.resTab ?? "today";
  const pastFilter = state.ui.pastFilter ?? "all";

  const tabBtn = (key, label, count) => `
    <button class="btn ${tab === key ? "btnPrimary" : ""}" data-res-tab="${key}">
      ${label} <span class="badge" style="margin-left:8px;">${count}</span>
    </button>
  `;

  let visible = [];
  let header = "";

  if (tab === "today") {
    visible = today;
    header = today.length ? "" : `<div class="notice" style="margin-top:10px;">No tiene reservas para hoy.</div>`;
  } else if (tab === "upcoming") {
    visible = upcoming;
    header = upcoming.length ? "" : `<div class="notice" style="margin-top:10px;">No tiene reservas próximas.</div>`;
  } else {
    // past
    const filtered = past.filter((r) => {
      if (pastFilter === "all") return true;
      const bucket = getPastBucket(reservationOutcomeText(r));
      return bucket === pastFilter;
    });

    visible = filtered;

    const filterBtns = `
      <div class="row" style="gap:10px; flex-wrap:wrap; margin-top:10px;">
        <button class="btn ${pastFilter === "all" ? "btnPrimary" : ""}" data-past-filter="all">Todas</button>
        <button class="btn ${pastFilter === "finished" ? "btnPrimary" : ""}" data-past-filter="finished">Finalizadas</button>
        <button class="btn ${pastFilter === "lost" ? "btnPrimary" : ""}" data-past-filter="lost">Perdidas</button>
        <button class="btn ${pastFilter === "cancelled" ? "btnPrimary" : ""}" data-past-filter="cancelled">Canceladas</button>
      </div>
    `;

    header =
      filterBtns +
      (filtered.length ? "" : `<div class="notice" style="margin-top:10px;">No hay reservas pasadas con ese filtro.</div>`);
  }

  return `
    <div class="row" style="gap:10px; flex-wrap:wrap;">
      ${tabBtn("today", "Hoy", today.length)}
      ${tabBtn("upcoming", "Próximas", upcoming.length)}
      ${tabBtn("past", "Pasadas", past.length)}
    </div>

    ${header}

    <div class="resList" style="margin-top:12px;">
      ${visible.map(reservationCard).join("")}
    </div>
  `;
}


// ------------------ Availability rendering helpers ------------------
function ymdLocal(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isTodaySelected() {
  const input = el("#dateInput");
  if (!input) return false;
  const selected = input.value;
  return selected && selected === ymdLocal(new Date());
}

// ------------------ MAIN RENDER ------------------
function render() {
  if (!state.ui) state.ui = { showBusy: true, showPast: false, authMode: "login" };
  if (typeof state.availabilityLoading !== "boolean") state.availabilityLoading = false;

  const me = state.me?.user ?? null;
  const logged = !!me;

  // Pills
  el("#pillStatus").innerHTML = logged ? `<strong>Conectado</strong>` : `<strong>Invitado</strong>`;
  el("#pillUser").innerHTML = logged ? `<strong>${me.email}</strong>` : `<strong>Inicie sesión</strong>`;
  el("#pillRole").innerHTML = logged
    ? `<strong>${me.role === "ADMIN" ? "Administrador" : "Usuario"}</strong>`
    : `<strong>—</strong>`;

  // Me box
  el("#meBox").innerHTML = logged
    ? `
      <div class="notice ok">
        <strong>Tu cuenta</strong><br/>
        <span class="small">Sesión activa como:</span><br/>
        <span><strong>${me.email}</strong></span><br/>
        <span class="small">Rol: ${me.role === "ADMIN" ? "Administrador" : "Usuario"}</span>
      </div>
    `
    : `
      <div class="notice">
        <strong>Bienvenido</strong><br/>
        <span class="small">Inicie sesión para reservar una sala y consultar sus reservas.</span>
      </div>
    `;

  // ====== VIEW SWITCH (CLAVE) ======
  const authView = el("#authView");
  const appView = el("#appView");
  const roomsView = el("#roomsView");
  const registerSection = el("#registerSection");

  if (authView) authView.style.display = logged ? "none" : "block";
  if (appView) appView.style.display = logged ? "block" : "none";
  if (roomsView) roomsView.style.display = logged ? "block" : "none";

  // auth mode: login/register
  if (!logged) {
    if (registerSection) registerSection.style.display = state.ui.authMode === "register" ? "block" : "none";

    const btnGoRegister = el("#btnGoRegister");
    const btnGoLogin = el("#btnGoLogin");

    if (btnGoRegister) btnGoRegister.style.display = state.ui.authMode === "login" ? "inline-flex" : "none";
    if (btnGoLogin) btnGoLogin.style.display = state.ui.authMode === "register" ? "inline-flex" : "none";

    // IMPORTANTE: cortar para NO renderizar APP
    return;
  }

  // ---- APP VIEW render (solo si logged) ----
  // Mis reservas
  const rb = el("#reservationsBox");
  if (rb) rb.innerHTML = renderReservations();

  // Rooms
  const roomsHtml = state.rooms
    .map((r) => {
      const img = roomImage(r.name);
      const badgeClass = r.isActive ? "ok" : "off";
      const badgeText = r.isActive ? "Activa" : "Inactiva";
      const isSelected = r.id === state.selectedRoomId;

      return `
        <div class="roomCard ${isSelected ? "selected" : ""}">
          <div class="roomImg">
            <img src="${img}" alt="${r.name}" onerror="this.src='/rooms/placeholder.jpg'"/>
          </div>
          <div class="roomMeta">
            <div class="roomTitle">
              <h3>${r.name}</h3>
              <span class="badge ${badgeClass}">${badgeText}</span>
            </div>

            <div class="roomDetails">
              <span class="kv">Capacidad: <strong>${r.capacity}</strong></span>
              <span class="kv">Slot: <strong>${r.slotMinutes ?? 60} min</strong></span>
            </div>

            <hr class="sep"/>

            <div class="row">
              <button class="btn btnPrimary" data-select-room="${r.id}">
                ${isSelected ? "Seleccionada" : "Ver disponibilidad"}
              </button>
              <span class="small">ID: ${r.id.slice(0, 8)}…</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  const roomsHeader = state.roomsLoading
    ? `<div class="notice">Cargando salas…</div>`
    : state.roomsError
      ? `<div class="notice err">${state.roomsError}</div>`
      : "";

  el("#roomsGrid").innerHTML = roomsHeader + (roomsHtml || `<div class="notice">No hay salas disponibles.</div>`);

  // Availability
  const av = state.availability;
  const todaySelected = isTodaySelected();

  if (!state.selectedRoomId) {
    el("#availabilityBox").innerHTML = `
      <div class="notice">
        Seleccione una sala para ver sus horarios disponibles.
      </div>
    `;
  } else if (state.availabilityLoading && !av) {
    el("#availabilityBox").innerHTML = `
      <div class="notice">Cargando horarios…</div>
      <div class="slotsGrid" style="margin-top:10px;">
        ${Array.from({ length: 8 }).map(() => `
          <div class="slot busy" style="opacity:.55; pointer-events:none;">
            <div class="slotTime">—:— - —:—</div>
            <div class="slotBadge"><span class="badge">Cargando</span></div>
          </div>
        `).join("")}
      </div>
    `;
  } else if (!av) {
    el("#availabilityBox").innerHTML = `
      <div class="notice">
        Elija una fecha y pulse <strong>Ver horarios</strong>.
      </div>
    `;
  } else if (av.closed) {
    el("#availabilityBox").innerHTML = `
      <div class="notice err">
        <strong>No disponible</strong><br/>
        Esta sala no está abierta en la fecha seleccionada.
      </div>
    `;
  } else {
    const room = selectedRoom();
    let slots = av.slots ?? [];
    const now = new Date();

    // ocultar pasados si hoy y showPast false
    if (todaySelected && !state.ui.showPast) {
      slots = slots.filter((s) => new Date(s.startAt) > now);
    }

    // ocultar ocupados si showBusy false
    if (!state.ui.showBusy) {
      slots = slots.filter((s) => s.available);
    }

    const totalShown = slots.length;
    const freeCount = slots.filter((s) => s.available).length;

    const controls = `
      <div class="row" style="justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
        <div class="small muted">
          ${av.timezone} • Slot ${av.slotMinutes} min • Libres: <strong>${freeCount}</strong>
          ${todaySelected && !state.ui.showPast ? `<span class="small muted">• Horarios pasados ocultos</span>` : ``}
        </div>

        <div class="row" style="gap:10px; flex-wrap:wrap;">
          <label class="small" style="display:flex; align-items:center; gap:6px; cursor:pointer;">
            <input type="checkbox" id="toggleBusy" ${state.ui.showBusy ? "checked" : ""}/>
            Mostrar ocupados
          </label>

          <label class="small" style="display:flex; align-items:center; gap:6px; cursor:pointer;">
            <input type="checkbox" id="togglePast" ${state.ui.showPast ? "checked" : ""}/>
            Mostrar pasados
          </label>

          <button class="btn" id="btnNextFree" ${freeCount ? "" : "disabled"}>
            Siguiente libre
          </button>
        </div>
      </div>
    `;

    const slotsGrid = slots.map((s) => {
      const wasJustReserved = state.lastReservedStartAt === s.startAt;

      const start = new Date(s.startAt);
      const isPast = todaySelected && start <= now;
      const pastIsVisible = todaySelected && state.ui.showPast && isPast;

      let clsBase = "slot";
      let disabled = "";
      let badgeText = "";
      let badgeClass = "";
      let availableForPick = false;

      if (pastIsVisible) {
        clsBase += " busy";
        disabled = "disabled";
        badgeText = "No disponible";
        badgeClass = "off";
        availableForPick = false;
      } else if (!s.available) {
        clsBase += " busy";
        disabled = "disabled";
        badgeText = "Ocupada";
        badgeClass = "off";
        availableForPick = false;
      } else {
        clsBase += " free";
        badgeText = "Libre";
        badgeClass = "ok";
        availableForPick = true;
      }

      const cls = wasJustReserved ? `${clsBase} justReserved` : clsBase;

      return `
        <button class="${cls}" ${disabled}
          data-slot-start="${s.startAt}"
          data-slot-end="${s.endAt}"
          data-slot-available="${availableForPick ? "1" : "0"}"
          title="${badgeText}">
          <div class="slotTime">${fmtHM(s.startAt)} - ${fmtHM(s.endAt)}</div>
          <div class="slotBadge"><span class="badge ${badgeClass}">${badgeText}</span></div>
        </button>
      `;
    }).join("");

    el("#availabilityBox").innerHTML = `
      <div class="avHeader">
        <div>
          <div class="avTitle">
            <strong>Horarios • ${room?.name ?? "Sala"}</strong>
            <span class="small">• ${av.date} • ${av.openAt}–${av.closeAt}</span>
          </div>
        </div>
        <div class="avActions">
          <span class="badge ${canReserve() ? "ok" : "off"}">
            ${canReserve() ? "Puede reservar" : "Inicie sesión para reservar"}
          </span>
        </div>
      </div>

      ${controls}

      <div class="slotsGrid" style="margin-top:10px;">
        ${totalShown ? slotsGrid : `<div class="notice">No hay horarios para mostrar con los filtros actuales.</div>`}
      </div>

      <div class="small muted" style="margin-top:10px;">
        Seleccione un horario <strong>Libre</strong> para continuar.
      </div>
    `;

    // binds toggles
    const tBusy = el("#toggleBusy");
    if (tBusy) {
      tBusy.addEventListener("change", () => {
        state.ui.showBusy = tBusy.checked;
        render();
      });
    }

    const tPast = el("#togglePast");
    if (tPast) {
      tPast.addEventListener("change", () => {
        state.ui.showPast = tPast.checked;
        render();
      });
    }

    const btnNext = el("#btnNextFree");
    if (btnNext) {
      btnNext.addEventListener("click", () => {
        const firstFree = document.querySelector('.slotsGrid [data-slot-available="1"]');
        if (firstFree) firstFree.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  }

  // room buttons bind
  document.querySelectorAll("[data-select-room]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-select-room");
      state.selectedRoomId = id;
      state.availability = null;
      render();
      await loadAvailability({ silent: false });
      el("#availabilityBox")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

//! ------------------ Boot ------------------
function boot() {
  // default date = hoy local (solo se usa cuando logged)
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const dateInput = el("#dateInput");
  if (dateInput) dateInput.value = `${yyyy}-${mm}-${dd}`;

  // auth buttons
  el("#btnLogin")?.addEventListener("click", onLogin);
  el("#btnLogout")?.addEventListener("click", onLogout);
  el("#btnRegister")?.addEventListener("click", onRegister);

  // switch auth modes
  el("#btnGoRegister")?.addEventListener("click", () => {
    state.ui.authMode = "register";
    render();
  });
  el("#btnGoLogin")?.addEventListener("click", () => {
    state.ui.authMode = "login";
    render();
  });

  // reload (solo si sesión)
  el("#btnReload")?.addEventListener("click", async () => {
    await loadMe();
    if (canReserve()) {
      await loadRooms();
      await loadMyReservations({ silent: true });
    }
  });

  // reload reservations
  el("#btnReloadReservations")?.addEventListener("click", async () => {
    if (!canReserve()) return setMessage("err", "Inicia sesión para ver tus reservas.");
    await loadMyReservations();
  });

  // availability click
  el("#btnAvailability")?.addEventListener("click", () => loadAvailability());

  // slots pick
  el("#availabilityBox")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-slot-start]");
    if (!btn) return;
    const available = btn.getAttribute("data-slot-available") === "1";
    if (!available) return;
    pickSlot({
      available,
      startAt: btn.getAttribute("data-slot-start"),
      endAt: btn.getAttribute("data-slot-end"),
    });
  });

  // reservations actions
  el("#reservationsBox")?.addEventListener("click", (e) => {
    const cancelBtn = e.target.closest("[data-cancel-res]");
    const resBox = el("#reservationsBox");
    if (resBox) {
      resBox.addEventListener("click", (e) => {

        // Tabs
        const tabBtn = e.target.closest("[data-res-tab]");
        if (tabBtn) {
          state.ui.resTab = tabBtn.getAttribute("data-res-tab");
          render();
          return;
        }

        // Filtros Pasadas
        const pf = e.target.closest("[data-past-filter]");
        if (pf) {
          state.ui.pastFilter = pf.getAttribute("data-past-filter");
          render();
          return;
        }

        // Accordion toggle
        const tog = e.target.closest("[data-res-toggle]");
        if (tog) {
          const id = tog.getAttribute("data-res-toggle");
          if (!state.ui.expandedRes) state.ui.expandedRes = {};
          state.ui.expandedRes[id] = !state.ui.expandedRes[id];
          render();
          return;
        }

        // Cancelar (tu modal)
        const cancelBtn = e.target.closest("[data-cancel-res]");
        if (cancelBtn) {
          const id = cancelBtn.getAttribute("data-cancel-res");
          openCancelModal(id);
          return;
        }

        // Check-in/out
        const inBtn = e.target.closest("[data-checkin-res]");
        if (inBtn) {
          const id = inBtn.getAttribute("data-checkin-res");
          doCheckIn(id);
          return;
        }

        const outBtn = e.target.closest("[data-checkout-res]");
        if (outBtn) {
          const id = outBtn.getAttribute("data-checkout-res");
          doCheckOut(id);
          return;
        }
      });
    }
  });

  // modal events
  el("#modalClose")?.addEventListener("click", closeModal);
  el("#modalOverlay")?.addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });
  el("#btnCancelReserve")?.addEventListener("click", closeModal);
  el("#btnConfirmReserve")?.addEventListener("click", onModalConfirm);

  // Initial
  loadMe({ silentNoSession: true }).then(() => {
    if (canReserve()) {
      loadRooms();
      loadMyReservations({ silent: true });
    }
  });

  render();
}
// ------------------ HTML ------------------
document.querySelector("#app").innerHTML = `
  <div class="container">
    <div class="topbar">
      <div class="brand">
        <div class="logo"></div>
        <div>
          <h1>Acceso y Reservas</h1>
          <p>Inicie sesión para reservar horarios disponibles</p>
        </div>
      </div>
      <div class="pills">
        <div class="pill" id="pillStatus"></div>
        <div class="pill" id="pillUser"></div>
        <div class="pill" id="pillRole"></div>
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="cardHeader">
          <div>
            <h2>Sesión</h2>
            <p>Login / Register y App (solo al iniciar sesión)</p>
          </div>

          <div class="row" style="min-width: 240px;">
            <button class="btn" id="btnReload">Actualizar</button>
            <button class="btn btnDanger" id="btnLogout">Cerrar sesión</button>
          </div>
        </div>

        <div class="cardBody">
          <div style="margin-top:12px;" id="msgBox" class="notice">Listo.</div>
          <div style="margin-top:12px;" id="meBox"></div>

          <!-- AUTH VIEW -->
          <div id="authView" style="margin-top:12px;">
            <!-- Login -->
            <div id="authLogin" style="margin-top:6px;">
              <div style="display:flex; flex-direction:column; gap:10px;">
                <div>
                  <label class="small">Email</label>
                  <input class="input" id="email" placeholder="correo@dominio.com" />
                </div>
                <div>
                  <label class="small">Password</label>
                  <input class="input" id="password" type="password" placeholder="Su contraseña" />
                </div>
              </div>

              <div class="row" style="margin-top:12px; justify-content:flex-end; gap:10px; flex-wrap:wrap;">
                <button class="btn btnPrimary" id="btnLogin" style="min-width:160px;">Iniciar sesión</button>
                <button class="btn" id="btnGoRegister" style="min-width:160px;">Registrarse</button>
              </div>
            </div>

            <!-- Registro -->
            <div id="registerSection" style="margin-top:14px;">
              <div class="sectionTitle" style="margin-top:6px;">
                <h3>Crear cuenta</h3>
                <span class="small muted">Registro rápido</span>
              </div>

              <div style="display:flex; flex-direction:column; gap:10px;">
                <div>
                  <label class="small">Nombre completo</label>
                  <input class="input" id="regFullName" placeholder="Tu nombre" />
                </div>

                <div>
                  <label class="small">Email</label>
                  <input class="input" id="regEmail" placeholder="correo@dominio.com" />
                </div>

                <div>
                  <label class="small">Password</label>
                  <input class="input" id="regPassword" type="password" placeholder="Crea una contraseña" />
                </div>
              </div>

              <div class="row" style="margin-top:12px; justify-content:flex-end; gap:10px; flex-wrap:wrap;">
                <button class="btn btnPrimary" id="btnRegister" style="min-width:180px;">Registrarme</button>
                <button class="btn" id="btnGoLogin" style="min-width:160px;">Volver</button>
              </div>
            </div>
          </div>

          <!-- APP VIEW (solo logged) -->
          <div id="appView" style="margin-top:12px;">
            <hr class="sep"/>

            <!-- Availability -->
            <div class="row">
              <div>
                <label class="small">Fecha</label>
                <input class="input" id="dateInput" type="date"/>
              </div>
              <div style="flex:0 0 auto; min-width: 220px;">
                <label class="small">&nbsp;</label>
                <button class="btn" id="btnAvailability" style="width:100%;">Ver horarios</button>
              </div>
            </div>

            <div style="margin-top:12px;" id="availabilityBox"></div>

            <hr class="sep"/>

            <!-- Mis reservas -->
            <div class="sectionTitle">
              <h3>Mis reservas</h3>
              <button class="btn" id="btnReloadReservations">Actualizar</button>
            </div>
            <div style="margin-top:12px;" id="reservationsBox"></div>
          </div>
        </div>
      </div>

      <!-- ROOMS VIEW (solo logged) -->
      <div class="card" id="roomsView">
        <div class="cardHeader">
          <div>
            <h2>Salas</h2>
            <p>Seleccione una sala para ver los horarios disponibles.</p>
          </div>
        </div>
        <div class="cardBody">
          <div class="rooms" id="roomsGrid"></div>
        </div>
      </div>
    </div>

    <div class="footer">
      <div class="small muted">© Room Booking • Gestión simple de salas y reservas.</div>
      <div class="small muted">Soporte: <span class="muted">contacto@tusitio.com</span></div>
    </div>
  </div>

  <!-- Modal -->
  <div class="modalOverlay" id="modalOverlay" aria-hidden="true">
    <div class="modal">
      <div class="modalHeader">
        <div class="modalTitle" id="modalTitle">Confirmar</div>
        <button class="iconBtn" id="modalClose" title="Cerrar">✕</button>
      </div>
      <div class="modalBody" id="modalBody"></div>
      <div class="modalFooter">
        <button class="btn" id="btnCancelReserve">Cancelar</button>
        <button class="btn btnPrimary" id="btnConfirmReserve">Confirmar reserva</button>
      </div>
    </div>
  </div>
`;


boot();
