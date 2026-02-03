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
  },

};

function roomImage(name) {
  const n = String(name || "").trim().toLowerCase();

  if (n === "sala a") return "/rooms/room-a.jpg";
  if (n === "sala b") return "/rooms/room-b.jpg";

  return "/rooms/placeholder.jpg";
}

function fmtRole(role) {
  if (!role) return "—";
  return role === "ADMIN" ? "Administrador" : "Usuario";
}

function fmtHM(iso) {
  // iso puede venir con timezone Z; lo mostramos en hora local del navegador
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function selectedRoom() {
  return state.rooms.find((r) => r.id === state.selectedRoomId) ?? null;
}

function openModal() {
  el("#modalOverlay").classList.add("open");
  el("body").classList.add("noScroll");
}

function closeModal() {
  el("#modalOverlay").classList.remove("open");
  el("body").classList.remove("noScroll");
  state.selectedSlot = null;
}

function setMessage(kind, text) {
  const box = el("#msgBox");
  box.className = `notice ${kind === "ok" ? "ok" : kind === "err" ? "err" : ""}`;
  box.textContent = text;
}

//! Cargar usuario actual
async function loadMe() {
  try {
    const data = await api.me();
    state.me = data;
    setMessage("ok", "Sesión iniciada correctamente.");
  } catch (e) {
    state.me = null;
    setMessage("err", "Usted no ha iniciado sesión.");
  } finally {
    render();
  }
}

//! Cargar lista de salas
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


//! Cargar disponibilidad de la sala seleccionada
async function loadAvailability({ silent = false } = {}) {
  const date = el("#dateInput")?.value ?? "";

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

//! Cargar mis reservas
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
    console.log("[myReservations] raw:", data);

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
  console.log("[myReservations] sample:", state.reservations?.[0]);
}


//! Iniciar sesión
async function onLogin() {
  const email = el("#email").value.trim();
  const password = el("#password").value;

  if (!email || !password) {
    setMessage("err", "Por favor, ingrese su correo y contraseña.");
    return;
  }

  // 1) Login (solo aquí aplica “credenciales”)
  try {
    setMessage("ok", "Iniciando sesión…");
    await api.login(email, password);
  } catch (e) {
    // Aquí sí: credenciales / login
    if (e.status === 401) {
      setMessage("err", "No se pudo iniciar sesión. Verifique su correo y contraseña.");
    } else {
      setMessage("err", `No se pudo iniciar sesión (${e.status ?? "?"}).`);
    }
    return;
  }

  // 2) Cargar sesión (si esto falla, NO son credenciales; es cookie/CORS)
  try {
    await loadMe();
  } catch {
    // loadMe ya pone mensaje, pero por si acaso:
    setMessage("err", "No se pudo confirmar la sesión. Intente nuevamente.");
    return;
  }

  // 3) Cargar datos de la app
  try {
    await loadRooms();
    await loadMyReservations({ silent: true });
    setMessage("ok", "Sesión iniciada correctamente.");
  } catch (e) {
    console.error("[post-login] error:", e);
    setMessage("err", "Sesión iniciada, pero no se pudieron cargar todos los datos. Intente actualizar.");
  }
}

//! Registrar usuario
async function onRegister() {
  const email = el("#regEmail").value.trim();
  const password = el("#regPassword").value;
  const fullName = el("#regFullName").value.trim();

  if (!email || !password || !fullName) {
    setMessage("err", "Complete nombre, correo y contraseña para registrarse.");
    return;
  }

  try {
    setMessage("ok", "Creando cuenta…");
    await api.register({ email, password, fullName });

    setMessage("ok", "Cuenta creada. Iniciando sesión…");
    await api.login(email, password);
    await loadMe();
    await loadRooms();
    await loadMyReservations({ silent: true });

    setMessage("ok", "Registro exitoso. Sesión iniciada correctamente.");
  } catch (e) {
    // Ajusta según códigos reales del backend
    if (e.status === 409) setMessage("err", "Ese correo ya está registrado.");
    else if (e.status === 400) setMessage("err", "Datos inválidos. Revise e intente de nuevo.");
    else setMessage("err", `No se pudo registrar (${e.status ?? "?"}).`);
  }
}


//! Cerrar sesión
async function onLogout() {
  try {
    await api.logout();
    setMessage("ok", "Sesión cerrada.");
  } catch (e) {
    setMessage("err", "No se pudo cerrar la sesión. Intente de nuevo.");
  } finally {
    state.me = null;
    state.availability = null;
    state.selectedSlot = null;
    state.reservations = [];
    state.reservationsLoading = false;

    render();
  }
}

//! Cancelar reserva
async function cancelReservation(id) {
  if (!canReserve()) {
    setMessage("err", "Usted debe iniciar sesión para cancelar.");
    return;
  }

  const ok = confirm("¿Desea cancelar esta reserva?");
  if (!ok) return;

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
      setMessage("err", "No se pudo cancelar en este momento. Intente de nuevo.");
    } else {
      setMessage("err", `No se pudo cancelar la reserva (${e.status ?? "?"}).`);
    }
  }
}

//! Check-In
async function doCheckIn(id) {
  if (!canReserve()) {
    setMessage("err", "Usted debe iniciar sesión para registrar entrada.");
    return;
  }

  const ok = confirm("¿Desea registrar Check-In para esta reserva?");
  if (!ok) return;

  try {
    setMessage("ok", "Registrando Check-In…");
    await api.checkIn(id);
    setMessage("ok", "Check-In registrado.");
    await loadMyReservations({ silent: true });
    if (state.selectedRoomId && el("#dateInput")?.value) {
      await loadAvailability({ silent: true });
    }
  } catch (e) {
    console.error("[checkin] error:", e);
    if (e.status === 401) setMessage("err", "Su sesión expiró. Inicie sesión nuevamente.");
    else setMessage("err", `No se pudo registrar Check-In (${e.status ?? "?"}).`);
  }
}

//! Check-Out
async function doCheckOut(id) {
  if (!canReserve()) {
    setMessage("err", "Usted debe iniciar sesión para registrar salida.");
    return;
  }

  const ok = confirm("¿Desea registrar Check-Out para esta reserva?");
  if (!ok) return;

  try {
    setMessage("ok", "Registrando Check-Out…");
    await api.checkOut(id);
    setMessage("ok", "Check-Out registrado.");
    await loadMyReservations({ silent: true });
    if (state.selectedRoomId && el("#dateInput")?.value) {
      await loadAvailability({ silent: true });
    }
  } catch (e) {
    console.error("[checkout] error:", e);
    if (e.status === 401) setMessage("err", "Su sesión expiró. Inicie sesión nuevamente.");
    else setMessage("err", `No se pudo registrar Check-Out (${e.status ?? "?"}).`);
  }
}

function canReserve() {
  return !!(state.me?.user?.id);
}

function pickSlot(slot) {
  // slot = {startAt, endAt, available}
  if (!slot.available) return;

  if (!canReserve()) {
    setMessage("err", "Necesitas iniciar sesión para reservar.");
    return;
  }

  state.selectedSlot = { startAt: slot.startAt, endAt: slot.endAt };
  renderModal();
  openModal();
}

function renderModal() {
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

  // 1) Si backend ya marca FINISHED o hay check-in + check-out => Realizada
  if (status === "FINISHED" || status === "FINISHED" || (checkInAt && checkOutAt)) {
    return { label: "Realizada", reason: "" };
  }


  // 2) Si está cancelada, no inventamos razones
  if (status === "CANCELLED") {
    return { label: "Cancelada", reason: "" };
  }

  // 3) Si ya pasó el fin de la reserva y no se completó, damos razon
  if (now > end) {
    // caso: nunca hizo check-in
    if (!checkInAt) {
      return {
        label: "Perdida",
        reason: "Se perdió porque no se registró Check-In dentro del horario de la reserva.",
      };
    }
    // caso: hizo check-in pero no check-out
    if (!checkOutAt) {
      return {
        label: "Incompleta",
        reason: "Se registró Check-In, pero no se registró Check-Out antes de que terminara el horario.",
      };
    }
  }

  // 4) Si aún no termina, dejamos estados normales
  if (status === "IN_PROGRESS") return { label: "En curso", reason: "" };
  return { label: "Activa", reason: "" };
}

function startOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function sortByStartAsc(a, b) {
  return new Date(a.startAt) - new Date(b.startAt);
}
function sortByStartDesc(a, b) {
  return new Date(b.startAt) - new Date(a.startAt);
}

function reservationCard(r) {
  const status = (r.status ?? "CONFIRMED").toString().toUpperCase();
  const start = new Date(r.startAt);
  const end = new Date(r.endAt);

  const roomName =
    r.room?.name ||
    r.roomName ||
    state.rooms.find((x) => x.id === r.roomId)?.name ||
    "Sala";

  const outcome = reservationOutcomeText(r);

  const badge =
    outcome.label === "Realizada"
      ? `<span class="badge ok">Realizada</span>`
      : outcome.label === "Perdida"
        ? `<span class="badge off">Perdida</span>`
        : outcome.label === "Incompleta"
          ? `<span class="badge off">Incompleta</span>`
          : outcome.label === "Cancelada"
            ? `<span class="badge off">Cancelada</span>`
            : outcome.label === "En curso"
              ? `<span class="badge ok">En curso</span>`
              : `<span class="badge ok">Activa</span>`;

  // Botones status/outcome
  const canCancel = status === "CONFIRMED" && outcome.label === "Activa";
  const canCheckIn = status === "CONFIRMED" && outcome.label === "Activa";
  const canCheckOut = status === "IN_PROGRESS" && outcome.label === "En curso";

  const dateStr = start.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" });
  const timeStr = `${dateStr} • ${fmtHM(r.startAt)} - ${fmtHM(r.endAt)}`;

  return `
    <div class="resRow">
      <div class="resLeft">
        <div class="resTop">
          <strong>${roomName}</strong>
          ${badge}
        </div>
        <div class="small muted">${timeStr}</div>

        ${outcome.reason ? `<div class="small" style="margin-top:6px;"><strong>Motivo:</strong> ${outcome.reason}</div>` : ``}

        <div class="small muted">id: ${(r.id ?? "").slice(0, 8)}…</div>
      </div>

      <div class="resRight">
        ${canCheckIn ? `<button class="btn btnPrimary" data-checkin-res="${r.id}">Check-In</button>` : ``}
        ${canCheckOut ? `<button class="btn btnPrimary" data-checkout-res="${r.id}">Check-Out</button>` : ``}
        ${canCancel ? `<button class="btn btnDanger" data-cancel-res="${r.id}">Cancelar</button>` : `<button class="btn" disabled>No disponible</button>`}
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

function renderReservations() {
  const me = state.me?.user ?? null;

  if (!me) {
    return `
      <div class="notice">
        Inicie sesión para ver <strong>Mis reservas</strong>.
      </div>
    `;
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

    const isEnded = now > end;

    // Regla 1: si ya terminó (aunque sea hoy) => Pasadas
    if (isEnded) {
      past.push(r);
      continue;
    }

    // Regla 2: finalizada/cancelada/perdida/incompleta => Pasadas (aunque no haya terminado, por si backend lo marca)
    if (
      outcome.label === "Finalizada" ||
      outcome.label === "Cancelada" ||
      outcome.label === "Perdida" ||
      outcome.label === "Incompleta"
    ) {
      past.push(r);
      continue;
    }

    // Si todavía no termina:
    const touchesToday = (start <= todayEnd && end >= today0);
    if (touchesToday) today.push(r);
    else if (start > todayEnd) upcoming.push(r);
    else past.push(r);
  }



  // UX: Hoy y Próximas ascendente; Pasadas descendente (más recientes arriba)
  today.sort(sortByStartAsc);
  upcoming.sort(sortByStartAsc);
  past.sort(sortByStartDesc);

  return `
    ${reservationsSection("Hoy", today, "Usted no tiene reservas para hoy.")}
    ${reservationsSection("Próximas", upcoming, "Usted no tiene reservas próximas.")}
    ${reservationsSection("Pasadas", past, "Usted no tiene reservas pasadas.")}
  `;
}

async function confirmReserve() {
  const roomId = state.selectedRoomId;
  const slot = state.selectedSlot;

  if (!roomId || !slot) {
    setMessage("err", "No hay slot seleccionado.");
    return;
  }
  if (!canReserve()) {
    setMessage("err", "Necesitas iniciar sesión para reservar.");
    return;
  }

  try {
    const btn = el("#btnConfirmReserve");
    btn.disabled = true;
    btn.textContent = "Reservando…";

    console.log("[reserve] sending:", { roomId, startAt: slot.startAt, endAt: slot.endAt });

    const resp = await api.reserve({
      roomId,
      startAt: slot.startAt,
      endAt: slot.endAt,
    });
    console.log("[reserve] response:", resp);
    setMessage("ok", "Reserva creada.");
    closeModal();
    await loadAvailability({ silent: true });
    await loadMyReservations({ silent: true });
    state.lastReservedStartAt = slot.startAt;
  } catch (e) {
    if (e.status === 401) {
      setMessage("err", "Tu sesión expiró. Vuelve a iniciar sesión.");
    } else if (e.status === 409) {
      setMessage("err", "Ese horario ya fue reservado. Elige otro.");
    } else {
      setMessage("err", "No se pudo completar la reserva. Intenta de nuevo.");
    }

  } finally {
    const btn = el("#btnConfirmReserve");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Confirmar reserva";
    }
  }
}

function ymdLocal(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isTodaySelected() {
  const input = el("#dateInput");
  if (!input) return false;          // si todavía no existe en DOM
  const selected = input.value;
  return selected && selected === ymdLocal(new Date());
}

function render() {
  if (!state.ui) state.ui = { showBusy: true, showPast: false };
  if (typeof state.availabilityLoading !== "boolean") state.availabilityLoading = false;
  const me = state.me?.user ?? null;

  // Pills del topbar
  el("#pillStatus").innerHTML = me
    ? `<strong>Conectado</strong>`
    : `<strong>Invitado</strong>`;

  el("#pillUser").innerHTML = me
    ? `<strong>${me.email}</strong>`
    : `<strong>Inicie sesión</strong>`;

  el("#pillRole").innerHTML = me
    ? `<strong>${me.role === "ADMIN" ? "Administrador" : "Usuario"}</strong>`
    : `<strong>—</strong>`;


  // Panel /auth/me
  el("#meBox").innerHTML = me
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
      <span class="small">Inicie sesión para reservar una sala y consultar tus reservas.</span>
    </div>
  `;
  // Mis reservas
  const rb = el("#reservationsBox");
  if (rb) rb.innerHTML = renderReservations();

  // Lista rooms
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
  const roomsGrid = el("#roomsGrid");
  const roomsHeader = state.roomsLoading
    ? `<div class="notice">Cargando salas…</div>`
    : state.roomsError
      ? `<div class="notice err">${state.roomsError}</div>`
      : "";

  el("#roomsGrid").innerHTML = roomsHeader + (roomsHtml || `<div class="notice">No hay salas disponibles.</div>`);


  //! Availability
  // Availability
  const av = state.availability;
  const todaySelected = isTodaySelected();

  // defaults UX: si es hoy, por defecto ocultamos pasados
  if (todaySelected && state.ui.showPast === false) {
    // ok, default
  }

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

    // 1) Ocultar pasados si la fecha es hoy y showPast = false
    if (todaySelected && !state.ui.showPast) {
      slots = slots.filter((s) => {
        const start = new Date(s.startAt);
        return start > now;
      });
    }

    // 2) Mostrar/ocultar ocupados
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

      // 1) pasados visibles => siempre "No disponible"
      if (pastIsVisible) {
        clsBase += " busy";
        disabled = "disabled";
        badgeText = "No disponible";
        badgeClass = "off";
        availableForPick = false;
      }
      // 2) ocupado
      else if (!s.available) {
        clsBase += " busy";
        disabled = "disabled";
        badgeText = "Ocupada";
        badgeClass = "off";
        availableForPick = false;
      }
      // 3) libre
      else {
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
      <div class="slotTime">
        ${fmtHM(s.startAt)} - ${fmtHM(s.endAt)}
      </div>
      <div class="slotBadge">
        <span class="badge ${badgeClass}">${badgeText}</span>
      </div>
    </button>
  `;
    }).join("");


    el("#availabilityBox").innerHTML = `
      <div class="avHeader" >
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
      </div >
    </div >

      ${controls}

    <div class="slotsGrid" style="margin-top:10px;">
      ${totalShown ? slotsGrid : `<div class="notice">No hay horarios para mostrar con los filtros actuales.</div>`}
    </div>

    <div class="small muted" style="margin-top:10px;">
      Seleccione un horario <strong>Libre</strong> para continuar.
    </div>
    `;

    // Bind toggles + next free (una sola vez por render del availability)
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


  // Bind room buttons
  document.querySelectorAll("[data-select-room]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-select-room");
      state.selectedRoomId = id;
      state.availability = null; // limpia vista anterior para evitar confusión
      render();
      await loadAvailability({ silent: false });
      el("#availabilityBox")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function humanError(e, fallback = "Ocurrió un error. Intente de nuevo.") {
  const status = e?.status;

  // Mensajes “producto” por status
  if (status === 0 && e?.code === "TIMEOUT") return "El servidor tardó demasiado en responder. Intente nuevamente.";
  if (status === 400) return "La solicitud no es válida. Revise los datos e intente de nuevo.";
  if (status === 401) return "Su sesión expiró. Inicie sesión nuevamente.";
  if (status === 403) return "Usted no tiene permisos para realizar esta acción.";
  if (status === 404) return "No se encontró el recurso solicitado.";
  if (status === 409) return "Ese horario ya no está disponible. Por favor, elija otro.";
  if (status === 422) return "No se pudo completar la acción por reglas del sistema. Revise e intente de nuevo.";
  if (status >= 500) return "El servicio no está disponible en este momento. Intente más tarde.";
  // Mensajes específicos del backend
  if (e?.message && typeof e.message === "string" && e.message.trim()) return e.message;

  return fallback;
}

function boot() {
  // set default date = hoy local
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  el("#dateInput").value = `${yyyy}-${mm}-${dd}`;

  el("#btnLogin").addEventListener("click", onLogin);
  el("#btnLogout").addEventListener("click", onLogout);

  const btnReg = el("#btnRegister");
  if (btnReg) btnReg.addEventListener("click", onRegister);


  el("#btnReload").addEventListener("click", async () => {
    await loadMe();
    await loadRooms();
    await loadMyReservations({ silent: true });
  });

  const btn = el("#btnReloadReservations");
  if (btn) {
    btn.addEventListener("click", async () => {
      if (!canReserve()) return setMessage("err", "Inicia sesión para ver tus reservas.");
      await loadMyReservations();
    });
  }
  const avBox = el("#availabilityBox");
  if (avBox) {
    avBox.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-slot-start]");
      if (!btn) return;

      const available = btn.getAttribute("data-slot-available") === "1";
      if (!available) return;

      const startAt = btn.getAttribute("data-slot-start");
      const endAt = btn.getAttribute("data-slot-end");
      pickSlot({ available, startAt, endAt });
    });
  }

  //* Cancelar reserva
  const resBox = el("#reservationsBox");
  if (resBox) {
    resBox.addEventListener("click", (e) => {
      const cancelBtn = e.target.closest("[data-cancel-res]");
      if (cancelBtn) {
        const id = cancelBtn.getAttribute("data-cancel-res");
        cancelReservation(id);
        return;
      }

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

  loadMe().finally(() => {
    loadRooms();
    loadMyReservations({ silent: true });
  });

  el("#btnAvailability").addEventListener("click", loadAvailability);

  // Modal events
  el("#modalClose").addEventListener("click", closeModal);
  el("#modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });
  el("#btnCancelReserve").addEventListener("click", closeModal);
  el("#btnConfirmReserve").addEventListener("click", confirmReserve);

  render();
}

document.querySelector("#app").innerHTML = `
  <div class="container" >
    <div class="topbar">
      <div class="brand">
        <div class="logo"></div>
        <!-- Top -->
        <div>
          <h1>Acceso y Reservas</h1>
          <p>Inicie Sesion para reservar horarios disponibles</p>
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
      <!-- Left Card -->
        <div class="cardHeader">
          <div>
            <h2>Sesión</h2>
            <p>Login, /auth/me, Availability y Reservas</p>
          </div>

          <div class="row" style="min-width: 240px;">
            <button class="btn" id="btnReload">Actualizar</button>
            <button class="btn btnDanger" id="btnLogout">Cerrar sesión</button>
          </div>
        </div>

        <div class="cardBody">
          <!-- Login -->
          <div class="row">
            <div>
              <label class="small">Email</label>
              <input class="input" id="email" placeholder="correo@dominio.com" />
            </div>
            <div>
              <label class="small">Password</label>
              <input class="input" id="password" type="password" placeholder="Su Contraseña" />
            </div>
            <div style="flex:0 0 auto; min-width: 160px;">
              <label class="small">&nbsp;</label>
              <button class="btn btnPrimary" id="btnLogin" style="width:100%;">Iniciar sesión</button>
            </div>
          </div>

          <div style="margin-top:12px;" id="msgBox" class="notice">Listo.</div>
          <div style="margin-top:12px;" id="meBox"></div>

          <hr class="sep"/>

          <!-- Registro -->
          <div class="sectionTitle" style="margin-top:6px;">
            <h3>Crear cuenta</h3>
            <span class="small muted">Registro rápido</span>
          </div>

          <div class="row">
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
            <div style="flex:0 0 auto; min-width: 180px;">
              <label class="small">&nbsp;</label>
              <button class="btn btnPrimary" id="btnRegister" style="width:100%;">Registrarme</button>
            </div>
          </div>

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

      <div class="card">
        <div class="cardHeader">
        <!-- Right Card -->
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
      <div class="small muted">
        © Room Booking • Gestión simple de salas y reservas.
      </div>
      <div class="small muted">
        Soporte: <span class="muted">contacto@tusitio.com</span>
      </div>
    </div>

  </div >

  <!--Modal Reserva-->
      <div class="modalOverlay" id="modalOverlay" aria-hidden="true">
        <div class="modal">
          <div class="modalHeader">
            <div class="modalTitle" id="modalTitle">Confirmar reserva</div>
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
