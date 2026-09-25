const firebaseConfig = {
  apiKey: 'AIzaSyA7y8e-8jnSpvxG-fyWhn8wdSI-XvmhecY',
  authDomain: 'mfit-698b4.firebaseapp.com',
  projectId: 'mfit-698b4',
  storageBucket: 'mfit-698b4.firebasestorage.app',
  messagingSenderId: '302079450710',
  appId: '1:302079450710:web:7fbd3176f4930b21f825f7',
  measurementId: 'G-WWHLR5SXPH'
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const secondaryApp = firebase.initializeApp(firebaseConfig, 'mfit-user-creator');
const secondaryAuth = secondaryApp.auth();
const today = new Date();

/* ==========================================================
   NUEVA ARQUITECTURA DE DATOS: COLEECCIONES INDEPENDIENTES
   Ya NO se guarda todo en un único documento (mfit/state).
   Cada entidad vive en su propia colección para que las
   acciones de un usuario nunca puedan sobrescribir el resto.
   ========================================================== */
const usersCol = db.collection('users');
const activitiesCol = db.collection('activities');
const reservationsCol = db.collection('reservations');
const purchasesCol = db.collection('purchases');
const purchaseHistoryCol = db.collection('purchase_history');
const premiumPostsCol = db.collection('premium_posts');
const consultasCol = db.collection('consultas');
const siteContentRef = db.collection('site_content').doc('content');
const runtimeRef = db.collection('site_content').doc('runtime');
// Referencia SOLO LECTURA al antiguo documento, para la migración única.
const legacyStateRef = db.collection('mfit').doc('state');

/* ==========================================================
   SISTEMA DE NOTIFICACIONES TOAST (sustituye a alert())
   ========================================================== */
const TOAST_ICONS = { success: '✓', error: '✕', warning: '!', info: 'i' };
const TOAST_TITLES = { success: 'Éxito', error: 'Error', warning: 'Atención', info: 'Información' };

function showToast(message, type = 'info', options = {}) {
  const container = document.getElementById('toast-container');
  if (!container) {
    // Fallback si el contenedor no existe todavía
    console.log(`[${type}] ${message}`);
    return;
  }
  const variant = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
  const duration = options.duration ?? (variant === 'error' ? 6000 : 4200);

  const toast = document.createElement('div');
  toast.className = `toast toast-${variant}${options.className ? ` ${options.className}` : ''}`;
  toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');
  toast.innerHTML = `
    <span class="toast-icon">${options.icon || TOAST_ICONS[variant]}</span>
    <div class="toast-body">
      <span class="toast-title">${options.title || TOAST_TITLES[variant]}</span>
      <span class="toast-message"></span>
    </div>
    <button type="button" class="toast-close" aria-label="Cerrar notificación">×</button>
    <span class="toast-progress" style="animation-duration:${duration}ms"></span>
  `;
  // Insertamos el mensaje como texto para evitar inyección de HTML
  toast.querySelector('.toast-message').textContent = message;
  container.appendChild(toast);

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 400);
  };

  toast.querySelector('.toast-close').addEventListener('click', remove);
  const timer = setTimeout(remove, duration);
  toast.addEventListener('mouseenter', () => clearTimeout(timer));
  toast.addEventListener('mouseleave', () => setTimeout(remove, 1200));
  return toast;
}

// Atajos semánticos
const toastSuccess = (msg, opts) => showToast(msg, 'success', opts);
const toastError = (msg, opts) => showToast(msg, 'error', opts);
const toastWarning = (msg, opts) => showToast(msg, 'warning', opts);
const toastInfo = (msg, opts) => showToast(msg, 'info', opts);

/* ==========================================================
   DIÁLOGO DE CONFIRMACIÓN PERSONALIZADO (sustituye a confirm())
   ========================================================== */
function showConfirm(message, options = {}) {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirm-overlay');
    if (!overlay) {
      resolve(window.confirm(message));
      return;
    }
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    const iconEl = document.getElementById('confirm-icon');
    const acceptBtn = document.getElementById('confirm-accept');
    const cancelBtn = document.getElementById('confirm-cancel');

    titleEl.textContent = options.title || 'Confirmar acción';
    msgEl.textContent = message;
    iconEl.textContent = options.icon || '⚠️';
    acceptBtn.textContent = options.confirmText || 'Aceptar';
    cancelBtn.textContent = options.cancelText || 'Cancelar';
    acceptBtn.className = `btn ${options.danger ? 'btn-primary' : 'btn-primary'}`;

    overlay.classList.remove('hidden');

    const cleanup = () => {
      overlay.classList.add('hidden');
      acceptBtn.removeEventListener('click', onAccept);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlay);
      document.removeEventListener('keydown', onKey);
    };
    const onAccept = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    const onOverlay = event => { if (event.target === overlay) onCancel(); };
    const onKey = event => { if (event.key === 'Escape') onCancel(); };

    acceptBtn.addEventListener('click', onAccept);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlay);
    document.addEventListener('keydown', onKey);
  });
}


const mfitData = {
  info: {
    name: 'MIFIT',
    description: 'Centro de entrenamiento funcional avanzado y readaptación física en Murcia.',
    address: 'Calle Mayor nº 166 Bajo, El Raal, Murcia',
    phone: '613132515',
    whatsapp: '34613132515',
    landingTitle: 'Tu mejor versión empieza hoy.',
    landingSubtitle: 'Entrenamiento funcional, readaptación y acompañamiento real en un espacio diseñado para avanzar.',
    email: 'contacto@mfit.es',
    heroImage: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80'
  },
  services: [
    { id: 1, name: 'Entrenamiento Funcional', desc: 'Clases en grupos reducidos.', image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=400&q=80', active: true },
    { id: 2, name: 'Entrenamiento Personal', desc: 'Plan individual a medida.', image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=400&q=80', active: true },
    { id: 3, name: 'Readaptación', desc: 'Recuperación funcional especializada.', image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=400&q=80', active: true }
  ],
  team: [
    { id: 1, name: 'Carlos Pérez', role: 'Head Coach', spec: 'Fuerza y acondicionamiento', bio: 'Especialista en rendimiento', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80', active: true },
    { id: 2, name: 'Laura Gómez', role: 'Fisioterapeuta', spec: 'Readaptación y movilidad', bio: 'Movilidad y prevención', image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=300&q=80', active: true }
  ],
  gallery: [
    { id: 1, url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80', caption: 'Sala principal', active: true },
    { id: 2, url: 'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=800&q=80', caption: 'Zona de fuerza', active: true },
    { id: 3, url: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80', caption: 'Movilidad', active: true },
    { id: 4, url: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=800&q=80', caption: 'Readaptación', active: true }
  ],
  news: [
    { id: 1, title: 'Horario ampliado', date: '15 Oct 2026', desc: 'Nuevas sesiones matinales', image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80', active: true },
    { id: 2, title: 'Taller de movilidad', date: '28 Oct 2026', desc: 'Taller gratuito para socios activos.', image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80', active: true }
  ],
  premium: [
    { id: 1, type: 'Anuncio', title: '¡Bienvenido a la Zona Premium!', content: 'Desde aquí podrás acceder a recursos, rutinas y anuncios exclusivos reservados solo para clientes Premium de MIFIT.', date: '2026-10-01' }
  ],
  consultas: [
    { id: 1, nombre: 'María López', email: 'maria@test.com', mensaje: '¿Hay plazas para entrenamiento personal?', fecha: '2026-10-24 10:30', estado: 'nueva' }
  ]
};

const defaultUsers = [
  { id: 1, name: 'Juan López', email: 'juan@mfit.com', password: 'juan123', role: 'cliente' },
  { id: 2, name: 'Admin MFIT', email: 'admin@mfit.com', password: 'admin123', role: 'admin' }
];

const defaultServices = [
  { id: 1, name: 'Bono Mensual', type: 'Bono', billingType: 'time', durationDays: 30, sessions: 0, price: 59, description: 'Acceso ilimitado a clases grupales.', active: true },
  { id: 2, name: 'Pack Fuerza', type: 'Pack', billingType: 'sessions', sessions: 10, durationDays: 0, price: 89, description: 'Incluye clases y evaluación inicial.', active: true },
  { id: 3, name: 'Clase Privada', type: 'Servicio', price: 35, description: 'Sesión individual con coach.', active: true },
  { id: 4, name: 'Readaptación', type: 'Servicio', price: 70, description: 'Sesión de recuperación funcional.', active: true }
];

function buildState() {
  return {
    currentYear: today.getFullYear(),
    currentMonth: today.getMonth(),
    selectedDate: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    currentUserId: null,
    deletedUserIds: [],
    content: JSON.parse(JSON.stringify(mfitData)),
    users: defaultUsers,
    services: defaultServices,
    purchases: [
      { id: 1, userId: 1, serviceId: 1, serviceName: 'Bono Mensual', amount: 59, date: '2026-09-01', status: 'aprobado', billingType: 'time', sessions: 0, durationDays: 30, activatedAt: '2026-09-01', expiresAt: '2026-10-01' }
    ],
    activities: buildInitialActivities(),
    reservations: [],
    reservationHistory: [],
    purchaseHistory: [],
    revision: 0,
    loadedFromCloud: false,
    loadFailed: false
  };
}

function buildInitialActivities() {
  const base = new Date();
  const year = base.getFullYear();
  const makeActivity = (offsetDays, title, coach, time, duration, capacity) => {
    const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays);
    return {
      id: Date.now() + Math.random(),
      title,
      coach,
      time,
      duration,
      capacity,
      booked: Math.min(capacity - 2, 5),
      date: new Date(date).toISOString(),
      description: 'Actividad de entrenamiento funcional',
      reservations: []
    };
  };

  return [
    makeActivity(0, 'Funcional HIIT', 'Carlos', '07:30', 45, 12),
    makeActivity(1, 'Mobility Flow', 'Laura', '18:30', 40, 15),
    makeActivity(3, 'Strength Circuit', 'Marcos', '09:00', 50, 10),
    makeActivity(5, 'Power Core', 'Carlos', '19:00', 45, 12),
    makeActivity(7, 'Cardio Blast', 'Ana', '08:00', 35, 10),
    makeActivity(9, 'Yoga Recovery', 'Laura', '20:00', 30, 14),
    makeActivity(12, 'Low Impact', 'Marcos', '10:00', 40, 8),
    makeActivity(15, 'Performance', 'Carlos', '18:00', 60, 12),
    makeActivity(18, 'Pilates', 'Laura', '17:00', 45, 12),
    makeActivity(20, 'Boxeo', 'Carlos', '19:30', 50, 10),
    makeActivity(25, 'HIIT', 'Ana', '08:30', 35, 15),
    makeActivity(28, 'Mobility', 'Laura', '18:00', 35, 12),
    makeActivity(35, 'Strength', 'Marcos', '09:30', 50, 10),
    makeActivity(42, 'Funcional', 'Carlos', '19:00', 45, 10),
    makeActivity(48, 'Yoga', 'Laura', '18:30', 30, 14),
    makeActivity(60, 'Cross Training', 'Ana', '07:00', 55, 12),
    makeActivity(70, 'Resistencia', 'Marcos', '18:15', 40, 12),
    makeActivity(85, 'Power', 'Carlos', '20:00', 45, 10)
  ];
}

let state = buildState();
let userRole = 'cliente';
Object.assign(mfitData, state.content);

/* ==========================================================
   PERSISTENCIA POR COLECCIONES (sustituye a saveState)
   Cada operación escribe SOLO su propia colección: un usuario
   ya no puede sobrescribir anuncios premium ni datos ajenos.
   ========================================================== */

function snapshotData(docSnap) {
  if (!docSnap || !docSnap.exists) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

function snapshotList(querySnap) {
  if (!querySnap || !querySnap.docs) return [];
  return querySnap.docs.map(snapshotData);
}

function userScopedCollection(col) {
  const user = auth.currentUser;
  return isAdmin() || !user ? col.get() : col.where('userId', '==', user.uid).get();
}

async function dbWrite(op, errorMsg = 'No se pudo guardar en la nube.') {
  if (state.loadFailed) {
    toastWarning('La app no pudo cargar los datos de la nube. Refresca la página antes de guardar.', { title: 'Sin conexión' });
    return 'error';
  }
  try {
    await op();
    return 'ok';
  } catch (error) {
    console.error(error);
    toastError(`${errorMsg} Revisa tu conexión o los permisos de Firestore.`);
    return 'error';
  }
}

// ---------- premium_posts (solo admin) ----------
function addPremiumPost(post) {
  return dbWrite(() => premiumPostsCol.add({ ...post, createdAt: firebase.firestore.FieldValue.serverTimestamp() }).then(ref => { post.id = ref.id; }), 'No se pudo publicar el contenido Premium.');
}

function updatePremiumPost(id, data) {
  return dbWrite(() => premiumPostsCol.doc(String(id)).update(data), 'No se pudo actualizar la publicación Premium.');
}
function removePremiumPost(id) {
  return dbWrite(() => premiumPostsCol.doc(String(id)).delete(), 'No se pudo eliminar la publicación Premium.');
}

// ---------- users ----------
function updateUserDocument(id, data) {
  return dbWrite(() => usersCol.doc(String(id)).set(data, { merge: true }), 'No se pudo actualizar el cliente.');
}
function deleteUserDocument(id) {
  return dbWrite(() => usersCol.doc(String(id)).delete(), 'No se pudo eliminar el cliente de Firebase.');
}

// ---------- activities (solo admin) ----------
function createActivityDocument(activity) {
  return dbWrite(() => activitiesCol.doc(String(activity.id)).set(activity), 'No se pudo crear la actividad.');
}
function updateActivityDocument(id, data) {
  return dbWrite(() => activitiesCol.doc(String(id)).set(data, { merge: true }), 'No se pudo actualizar la actividad.');
}
function deleteActivityDocument(id) {
  return dbWrite(() => activitiesCol.doc(String(id)).delete(), 'No se pudo eliminar la actividad.');
}

// ---------- reservations (solo el usuario propietario) ----------
function createReservationDocument(reservation) {
  const user = auth.currentUser;
  if (!user) return Promise.resolve('error');
  return dbWrite(() => reservationsCol.add({ ...reservation, userId: user.uid, status: 'active', createdAt: firebase.firestore.FieldValue.serverTimestamp() }).then(ref => { reservation.id = ref.id; }), 'No se pudo registrar la reserva.');
}
function updateReservationDocument(id, data) {
  return dbWrite(() => reservationsCol.doc(String(id)).update(data), 'No se pudo actualizar la reserva.');
}
function deleteReservationDocument(id) {
  return dbWrite(() => reservationsCol.doc(String(id)).delete(), 'No se pudo cancelar la reserva en la nube.');
}
const createReservation = createReservationDocument;

// ---------- purchases (el usuario crea las suyas; admin las gestiona) ----------
function createPurchaseDocument(purchase) {
  const user = auth.currentUser;
  if (!user) return Promise.resolve('error');
  return dbWrite(() => purchasesCol.add({ ...purchase, userId: user.uid, status: 'pendiente', createdAt: firebase.firestore.FieldValue.serverTimestamp() }).then(ref => { purchase.id = ref.id; }), 'No se pudo registrar la compra.');
}
function updatePurchaseDocument(id, data) {
  return dbWrite(() => purchasesCol.doc(String(id)).update(data), 'No se pudo actualizar la compra.');
}
function deletePurchaseDocument(id) {
  return dbWrite(() => purchasesCol.doc(String(id)).delete(), 'No se pudo cancelar la solicitud en la nube.');
}
const registerPurchase = createPurchaseDocument;

// ---------- purchase_history (solo admin) ----------
function addPurchaseHistoryDocument(entry) {
  return dbWrite(() => purchaseHistoryCol.doc(String(entry.id)).set(entry, { merge: true }), 'No se pudo guardar el histórico.');
}
function deletePurchaseHistoryDocument(id) {
  return dbWrite(() => purchaseHistoryCol.doc(String(id)).delete(), 'No se pudo eliminar la transacción del histórico.');
}

// ---------- consultas (creación pública; gestión de admin) ----------
function createConsultaDocument(consulta) {
  return dbWrite(() => consultasCol.doc(String(consulta.id)).set(consulta, { merge: true }), 'No se pudo enviar el mensaje.');
}
function updateConsultaDocument(id, data) {
  return dbWrite(() => consultasCol.doc(String(id)).set(data, { merge: true }), 'No se pudo actualizar el mensaje.');
}
function deleteConsultaDocument(id) {
  return dbWrite(() => consultasCol.doc(String(id)).delete(), 'No se pudo eliminar el mensaje.');
}

// ---------- contenido del sitio (info, servicios, equipo, galería, novedades, bonos) ----------
function saveSiteContent() {
  return dbWrite(() => siteContentRef.set({
    info: mfitData.info || {},
    services: mfitData.services || [],
    team: mfitData.team || [],
    gallery: mfitData.gallery || [],
    news: mfitData.news || [],
    bonos: state.services || []
  }, { merge: true }), 'No se pudo guardar el contenido de la web.');
}

// ---------- runtime (listas de cuentas eliminadas / bloqueadas) ----------
function saveRuntime() {
  return dbWrite(() => runtimeRef.set({
    deletedUserIds: state.deletedUserIds || [],
    deletedUserEmails: state.deletedUserEmails || []
  }, { merge: true }), 'No se pudo guardar la configuración de acceso.');
}

/* ==========================================================
   CARGA DE DATOS DESDE LAS COLECCIONES
   ========================================================== */

function normalizeService(service) {
  return {
    ...service,
    billingType: service.billingType || 'sessions',
    sessions: Number(service.sessions || (service.billingType === 'time' ? 0 : 8)),
    durationDays: Number(service.durationDays || (service.billingType === 'time' ? 30 : 0))
  };
}

function normalizePurchases(purchases) {
  return (purchases || []).map(purchase => {
    const service = state.services.find(item => String(item.id) === String(purchase.serviceId));
    const billingType = purchase.billingType || service?.billingType || 'sessions';
    const sessions = purchase.sessions || service?.sessions || 8;
    const durationDays = purchase.durationDays || service?.durationDays || 0;
    const normalizedPurchase = { ...purchase, billingType, sessions, durationDays, remainingSessions: purchase.remainingSessions ?? (purchase.status === 'aprobado' && billingType === 'sessions' ? sessions : 0) };
    if (billingType === 'time' && !normalizedPurchase.expiresAt) {
      const start = new Date(purchase.activatedAt || purchase.approvedAt || purchase.date);
      if (purchase.status === 'aprobado' && !isNaN(start.getTime()) && (purchase.durationDays || service?.durationDays)) {
        const expiry = new Date(start);
        expiry.setDate(expiry.getDate() + Number(purchase.durationDays || service?.durationDays || 30));
        normalizedPurchase.expiresAt = expiry.toISOString();
      }
    }
    return normalizedPurchase;
  });
}

function normalizeDate(value) {
  return value && typeof value.toDate === 'function' ? value.toDate().toISOString() : value;
}

/* Reconstruye activity.booked y activity.reservations a partir de la
   colección /reservations (fuente única de verdad para la ocupación). */
function rebuildActivityOccupancy() {
  (state.activities || []).forEach(activity => {
    activity.reservations = (state.reservations || [])
      .filter(item => String(item.activityId) === String(activity.id))
      .map(item => ({ userId: item.userId, date: item.reservedAt || item.date }));
    activity.booked = activity.reservations.length;
  });
}

function applyContentToMemory(content) {
  if (!content) return;
  if (content.info) mfitData.info = content.info;
  if (content.services) mfitData.services = content.services;
  if (content.team) mfitData.team = content.team;
  if (content.gallery) mfitData.gallery = content.gallery;
  if (content.news) mfitData.news = content.news;
  if (content.bonos) state.services = (content.bonos || []).map(normalizeService);
}

/* Migración única: vuelca el antiguo documento mfit/state a las colecciones.
   Las escrituras son "mejor esfuerzo" (no rompen la carga si aún no hay sesión
   de admin); el contenido siempre se aplica en memoria al momento. */
async function migrateLegacyState(legacy) {
  if (!legacy) return;
  const content = legacy.content || {};
  const safe = (promise) => promise.catch(err => console.warn('[migración] Pieza no escrita aún (se reintentará con admin):', err && err.message));

  await Promise.all([
    safe(siteContentRef.set({
      info: content.info || {},
      services: content.services || [],
      team: content.team || [],
      gallery: content.gallery || [],
      news: content.news || [],
      bonos: legacy.services || []
    })),
    safe(runtimeRef.set({
      deletedUserIds: legacy.deletedUserIds || [],
      deletedUserEmails: legacy.deletedUserEmails || [],
      migratedAt: firebase.firestore.FieldValue.serverTimestamp()
    })),
    ...(content.premium || []).map(post => safe(premiumPostsCol.doc(String(post.id)).set(post))),
    ...(content.consultas || []).map(c => safe(consultasCol.doc(String(c.id)).set(c))),
    ...(legacy.users || []).map(u => safe(usersCol.doc(String(u.id)).set(u))),
    ...(legacy.activities || []).map(a => safe(activitiesCol.doc(String(a.id)).set(a))),
    ...(legacy.reservations || []).map(r => safe(reservationsCol.doc(String(r.id)).set(r))),
    ...(legacy.purchases || []).map(p => safe(purchasesCol.doc(String(p.id)).set(p))),
    ...(legacy.purchaseHistory || []).map(h => safe(purchaseHistoryCol.doc(String(h.id)).set(h)))
  ]);

  // Reflejar la migración en memoria (las lecturas de colecciones venían vacías).
  state.deletedUserIds = legacy.deletedUserIds || [];
  state.deletedUserEmails = legacy.deletedUserEmails || [];
  state.users = legacy.users || state.users;
  state.activities = (legacy.activities || []).map(a => ({ ...a, date: normalizeDate(a.date) }));
  state.reservations = legacy.reservations || [];
  state.purchases = normalizePurchases(legacy.purchases || []);
  state.purchaseHistory = legacy.purchaseHistory || [];
  state.services = (legacy.services || defaultServices).map(normalizeService);
  mfitData.premium = content.premium || [];
  mfitData.consultas = content.consultas || [];
  applyContentToMemory(content);
  state.needsMigration = true;
}

/* Cuando entra un administrador se completa la migración y se elimina el
   antiguo documento mfit/state (ya no es necesario). */
async function ensureMigration() {
  if (!isAdmin()) return;
  try {
    const [legacySnap, contentSnap] = await Promise.all([
      legacyStateRef.get().catch(() => null),
      siteContentRef.get().catch(() => null)
    ]);
    if (legacySnap && legacySnap.exists && (!contentSnap || !contentSnap.exists)) {
      await migrateLegacyState(legacySnap.data());
      await legacyStateRef.delete().catch(() => {});
      state.needsMigration = false;
      console.info('[migración] Completada y documento antiguo eliminado.');
    } else if (!legacySnap || !legacySnap.exists) {
      state.needsMigration = false;
    }
  } catch (error) {
    console.warn('[migración] No se pudo completar ahora:', error);
  }
}

/* Primer arranque (sin datos previos): siembra las colecciones por defecto. */
async function bootstrapCollections() {
  await siteContentRef.set({
    info: mfitData.info || {},
    services: mfitData.services || [],
    team: mfitData.team || [],
    gallery: mfitData.gallery || [],
    news: mfitData.news || [],
    bonos: state.services || []
  });
  await Promise.all(state.activities.map(activity => activitiesCol.doc(String(activity.id)).set(activity)));
  await saveRuntime();
  console.info('[bootstrap] Colecciones inicializadas con los datos por defecto.');
}

/* Lectura inicial de todas las colecciones (se ejecuta al abrir la app). */
async function loadCloudState() {
  state.loadedFromCloud = false;
  state.loadFailed = false;
  try {
    const [
      usersSnap, activitiesSnap, premiumSnap, reservationsSnap, purchasesSnap,
      historySnap, consultasSnap, contentSnap, runtimeDoc, legacySnap
    ] = await Promise.all([
      userScopedCollection(usersCol).catch(() => null),
      activitiesCol.get().catch(() => null),
      premiumPostsCol.get().catch(() => null),
      userScopedCollection(reservationsCol).catch(() => null),
      userScopedCollection(purchasesCol).catch(() => null),
      purchaseHistoryCol.get().catch(() => null),
      consultasCol.get().catch(() => null),
      siteContentRef.get().catch(() => null),
      runtimeRef.get().catch(() => null),
      legacyStateRef.get().catch(() => null)
    ]);

    state.users = snapshotList(usersSnap);
    state.activities = snapshotList(activitiesSnap).map(a => ({ ...a, date: normalizeDate(a.date) }));
    mfitData.premium = snapshotList(premiumSnap);
    state.reservations = snapshotList(reservationsSnap);
    mfitData.consultas = snapshotList(consultasSnap).sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));

    if (contentSnap && contentSnap.exists) applyContentToMemory(contentSnap.data() || {});
    state.purchases = normalizePurchases(snapshotList(purchasesSnap));
    state.purchaseHistory = snapshotList(historySnap);

    if (runtimeDoc && runtimeDoc.exists) {
      const runtime = runtimeDoc.data() || {};
      state.deletedUserIds = runtime.deletedUserIds || [];
      state.deletedUserEmails = runtime.deletedUserEmails || [];
    }

    // Migración única desde el antiguo mfit/state.
    const legacyNeeded = legacySnap && legacySnap.exists && (!contentSnap || !contentSnap.exists);
    if (legacyNeeded) {
      await migrateLegacyState(legacySnap.data());
    } else if (!legacySnap?.exists && (!contentSnap || !contentSnap.exists) && !premiumSnap?.size && !state.activities.length) {
      // Proyecto completamente nuevo: sembrar las colecciones (mejor esfuerzo).
      await bootstrapCollections().catch(() => null);
    }

    rebuildActivityOccupancy();
    state.loadedFromCloud = true;
  } catch (error) {
    state.loadedFromCloud = false;
    state.loadFailed = true;
    console.error('No se pudo cargar Firebase:', error);
    toastError('No se pudieron cargar los datos desde la nube. Comprueba tu conexión y refresca la página.', { title: 'Sin conexión a la nube', duration: 8000 });
  }
}

/* Refresco en mitad de sesión: relee las colecciones y conserva la sesión actual. */
async function refreshFromCloud() {
  const localUserId = state.currentUserId;
  try {
    const [
      usersSnap, activitiesSnap, premiumSnap, reservationsSnap, purchasesSnap,
      historySnap, consultasSnap, contentSnap, runtimeDoc
    ] = await Promise.all([
      userScopedCollection(usersCol).catch(() => null),
      activitiesCol.get().catch(() => null),
      premiumPostsCol.get().catch(() => null),
      userScopedCollection(reservationsCol).catch(() => null),
      userScopedCollection(purchasesCol).catch(() => null),
      purchaseHistoryCol.get().catch(() => null),
      consultasCol.get().catch(() => null),
      siteContentRef.get().catch(() => null),
      runtimeRef.get().catch(() => null)
    ]);

    if (usersSnap) state.users = snapshotList(usersSnap);
    if (activitiesSnap) state.activities = snapshotList(activitiesSnap).map(a => ({ ...a, date: normalizeDate(a.date) }));
    if (premiumSnap) mfitData.premium = snapshotList(premiumSnap);
    if (reservationsSnap) state.reservations = snapshotList(reservationsSnap);
    if (contentSnap && contentSnap.exists) applyContentToMemory(contentSnap.data() || {});
    if (purchasesSnap) state.purchases = normalizePurchases(snapshotList(purchasesSnap));
    if (historySnap) state.purchaseHistory = snapshotList(historySnap);
    if (consultasSnap) mfitData.consultas = snapshotList(consultasSnap).sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
    if (runtimeDoc && runtimeDoc.exists) {
      const runtime = runtimeDoc.data() || {};
      state.deletedUserIds = runtime.deletedUserIds || [];
      state.deletedUserEmails = runtime.deletedUserEmails || [];
    }

    rebuildActivityOccupancy();
    state.currentUserId = localUserId;
    state.loadedFromCloud = true;
    return true;
  } catch (error) {
    console.error('No se pudo refrescar desde la nube:', error);
    state.currentUserId = localUserId;
    return false;
  }
}

// Manejador del registro de usuarios
async function handleRegisterSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;

  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Actualizar el perfil en Firebase Auth
    await user.updateProfile({ displayName: name });

    // Guardar los datos iniciales en Firestore (con rol de 'cliente')
    await db.collection('users').doc(user.uid).set({
      name: name,
      email: email,
      role: 'cliente',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      profile: {},
      profileHistory: []
    });

    // Cerrar el modal
    document.getElementById('register-modal').classList.add('hidden');
    document.getElementById('register-form').reset();
    toastSuccess('¡Registro exitoso! Bienvenido a MIFIT.');

  } catch (error) {
    console.error(error);
    toastError('Error al registrar: ' + (error.code === 'auth/email-already-in-use' ? 'El email ya está en uso.' : error.message));
  }
}





function getCurrentUser() {
  return state.users.find(user => user.id === state.currentUserId) || null;
}

/* ==========================================================
   CLIENTE PREMIUM
   Un cliente es Premium si la marca isPremium está activa.
   Los administradores siempre tienen acceso a la Zona Premium.
   ========================================================== */
function isUserPremium(user) {
  if (!user) return false;
  return user.role === 'admin' || !!user.isPremium;
}

function premiumBadgeHtml() {
  return `<span class="premium-badge"><span class="premium-badge-star">★</span> Premium</span>`;
}

/* ¿Puede este usuario ver esta publicación Premium? */
function canSeePremiumPost(item, user) {
  if (!item) return false;
  if (!item.audience || item.audience === 'all') return true;
  if (user && user.role === 'admin') return true;
  return !!user && String(item.audience) === String(user.id);
}

/* ==========================================================
    TABLÓN PREMIUM (vista exclusiva oscura)
    ========================================================== */
function renderPremiumBoard() {
  const board = document.getElementById('premium-board');
  if (!board) return;
  const user = getCurrentUser();
  const premium = isUserPremium(user);
  board.classList.toggle('is-admin-board', !!user && user.role === 'admin');

  if (!user) {
    board.innerHTML = `
      <div class="premium-gate">
        <span class="premium-gate-star" aria-hidden="true">★</span>
        <h2>Acceso exclusivo</h2>
        <p>Inicia sesión con tu cuenta Premium de MIFIT para ver el tablón exclusivo.</p>
        <button type="button" class="premium-btn-glow" id="premium-gate-login">Iniciar sesión</button>
      </div>`;
    document.getElementById('premium-gate-login')?.addEventListener('click', openLoginModal);
    return;
  }

  if (!premium) {
    board.innerHTML = `
      <div class="premium-gate premium-gate-locked">
        <span class="premium-gate-star" aria-hidden="true">★</span>
        <h2>Todavía no eres Premium</h2>
        <p>El tablón Premium está reservado a clientes Premium: rutinas exclusivas, anuncios anticipados y recursos VIP.</p>
        <ul class="premium-perks">
          <li>Contenido y planes exclusivos</li>
          <li>Anuncios antes que nadie</li>
          <li>Recursos y seguimiento VIP</li>
        </ul>
        <small class="premium-gate-note">¿Quieres ser Premium? Consulta en recepción o escríbenos por WhatsApp y activaremos tu cuenta.</small>
      </div>`;
    return;
  }

  const posts = (mfitData.premium || [])
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .filter(item => canSeePremiumPost(item, user));

  if (!posts.length) {
    board.innerHTML = '<div class="premium-empty-board">Aún no hay contenido Premium publicado. Vuelve pronto <span aria-hidden="true">★</span></div>';
    return;
  }

  board.innerHTML = posts.map(item => {
    const specific = item.audience && item.audience !== 'all'
      ? state.users.find(u => String(u.id) === String(item.audience))
      : null;
    return `
      <article class="premium-card" data-premium-id="${item.id}">
        <div class="premium-card-head">
          <span class="premium-card-type">${item.type || 'Publicación'}</span>
          <small class="premium-card-date">${item.date ? new Date(item.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</small>
        </div>
        <h3 class="premium-card-title">${item.title}</h3>
        ${item.imageUrl ? `<img class="premium-card-image" src="${item.imageUrl}" alt="${item.title}" loading="lazy">` : ''}
        <p class="premium-card-body">${item.content}</p>
        ${specific ? `<div class="premium-card-recipient">★ Publicación privada para <strong>${specific.name}</strong></div>` : ''}
      </article>`;
  }).join('');
}

function openPremiumView() {
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active-view'));
  document.getElementById('view-premium')?.classList.add('active-view');
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  renderPremiumBoard();
}

function closePremiumView() {
  document.querySelectorAll('.view').forEach(view => view.classList.remove('active-view'));
  const homeNav = document.querySelector('[data-view="view-home"]');
  document.getElementById('view-home')?.classList.add('active-view');
  if (homeNav) homeNav.classList.add('active');
}

/* ==========================================================
   GESTIÓN DE CLIENTES: BAJA TEMPORAL vs. ELIMINAR DEFINITIVO
   ----------------------------------------------------------
   - Baja: status 'inactive' + isBaja true. Conserva toda la ficha.
   - Alta: vuelve a status 'active'. Pensado para cuando regresa.
   - Eliminar: borra el registro por completo (Firestore + estado).
   ========================================================== */
function isUserBaja(user) {
  return !!user && (user.isBaja === true || user.status === 'inactive');
}

function userStatusPillHtml(user) {
  return isUserBaja(user)
    ? '<span class="status-pill is-baja">De baja</span>'
    : '<span class="status-pill is-active">Activo</span>';
}

function userBajaSinceText(user) {
  if (!isUserBaja(user) || !user.bajaDate) return '';
  const date = new Date(user.bajaDate);
  return isNaN(date.getTime()) ? '' : `De baja desde el ${date.toLocaleDateString('es-ES')}`;
}

function userStatusActionsHtml(user) {
  const baja = isUserBaja(user);
  const bajaButton = user.role === 'cliente'
    ? (baja
      ? `<button type="button" class="btn btn-alta btn-sm" data-toggle-baja="${user.id}" title="Reactivar a este cliente">Dar de alta</button>`
      : `<button type="button" class="btn btn-baja btn-sm" data-toggle-baja="${user.id}" title="Pausar al cliente sin borrar sus datos">Dar de baja</button>`)
    : '';
  const deleteButton = `<button type="button" class="btn btn-danger btn-sm" data-delete-user="${user.id}" title="Borrar al cliente definitivamente">Eliminar cliente</button>`;
  return bajaButton + deleteButton;
}

async function toggleUserBaja(userId) {
  if (!isAdmin()) return;
  const user = state.users.find(item => String(item.id) === String(userId));
  if (!user) return;
  if (String(user.id) === String(state.currentUserId)) {
    toastWarning('No puedes dar de baja la cuenta con la que estás conectado.');
    return;
  }

  const goingToBaja = !isUserBaja(user);
  if (goingToBaja) {
    const confirmed = await showConfirm(
      `¿Dar de baja a ${user.name}? No podrá iniciar sesión ni reservar mientras esté de baja. Conservará todos sus datos y podrás darle de alta cuando vuelva.`,
      { title: 'Dar de baja', icon: '⏸️', confirmText: 'Dar de baja' }
    );
    if (!confirmed) return;
  }

  user.isBaja = goingToBaja;
  user.status = goingToBaja ? 'inactive' : 'active';
  user.bajaDate = goingToBaja ? new Date().toISOString() : null;
  user.altaDate = goingToBaja ? (user.altaDate || null) : new Date().toISOString();

  let accountSynced = true;
  try {
    await db.collection('users').doc(String(user.id)).set({
      isBaja: user.isBaja,
      status: user.status,
      bajaDate: user.bajaDate,
      altaDate: user.altaDate,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    accountSynced = false;
    console.error('No se pudo sincronizar el estado de baja:', error);
  }
  renderAdminPanels();
  toastSuccess(
    goingToBaja ? `${user.name} está de baja: no podrá iniciar sesión. Sus datos se han conservado.` : `${user.name} vuelve a estar de alta y ya puede entrar.`,
    { title: goingToBaja ? 'Cliente de baja' : 'Cliente de alta' }
  );
  if (!accountSynced) {
    toastWarning('No se pudo actualizar la cuenta del cliente en Firestore, así que el bloqueo de acceso puede no aplicarse. Revisa las reglas de seguridad.', { title: 'Sincronización incompleta' });
  }
}

async function deleteUserPermanently(userId) {
  if (!isAdmin()) return;
  const id = String(userId);
  const user = state.users.find(item => String(item.id) === id);
  if (!user) return;
  if (id === String(state.currentUserId)) {
    toastWarning('No puedes eliminar la cuenta con la que estás conectado.');
    return;
  }

  const confirmed = await showConfirm(
    `¿Eliminar definitivamente a ${user.name}? Se borrarán su ficha, medidas, bonos y reservas de la base de datos y no se podrá recuperar. Si solo deja de venir un tiempo, usa "Dar de baja".`,
    { title: 'Eliminar cliente', icon: '🗑️', confirmText: 'Eliminar definitivamente' }
  );
  if (!confirmed) return;

  // 1) Registro del cliente en Firestore (colección users)
  let firestoreDeleted = true;
  try {
    await db.collection('users').doc(id).delete();
  } catch (error) {
    firestoreDeleted = false;
    console.error('No se pudo borrar el documento del cliente en Firestore:', error);
  }

  // 2) Todo lo que cuelga del cliente (borrado en su colección propia)
  const userReservations = state.reservations.filter(item => String(item.userId) === id);
  const userPurchases = state.purchases.filter(item => String(item.userId) === id);
  const userReservationHistory = state.reservationHistory.filter(item => String(item.userId) === id);
  const userPurchaseHistory = state.purchaseHistory.filter(item => String(item.userId) === id);

  state.users = state.users.filter(item => String(item.id) !== id);
  state.purchases = state.purchases.filter(item => String(item.userId) !== id);
  state.purchaseHistory = state.purchaseHistory.filter(item => String(item.userId) !== id);
  state.reservations = state.reservations.filter(item => String(item.userId) !== id);
  state.reservationHistory = state.reservationHistory.filter(item => String(item.userId) !== id);

  // 3) Lista de cuentas bloqueadas (la cuenta de Authentication sigue existiendo, pero ya no puede entrar)
  state.deletedUserIds = state.deletedUserIds || [];
  state.deletedUserEmails = state.deletedUserEmails || [];
  if (typeof user.id === 'string') state.deletedUserIds.push(user.id);
  if (user.email) state.deletedUserEmails.push(user.email.toLowerCase());

  // 4) Borrado aislado en Firestore (solo documentos del cliente)
  await Promise.all([
    deleteUserDocument(id),
    ...userReservations.map(r => deleteReservationDocument(String(r.id))),
    ...userPurchases.map(p => deletePurchaseDocument(String(p.id))),
    ...userReservationHistory.map(r => deleteReservationDocument(String(r.id))),
    ...userPurchaseHistory.map(h => deletePurchaseHistoryDocument(String(h.id)))
  ]);
  await saveRuntime();
  renderAll();
  if (firestoreDeleted) {
    toastSuccess(`${user.name} se ha eliminado por completo de MIFIT.`, { title: 'Cliente eliminado' });
  } else {
    toastWarning(`${user.name} se ha quitado de la app, pero no se pudo borrar su documento en Firestore. Revisa las reglas de seguridad.`, { title: 'Borrado parcial' });
  }
}

async function toggleUserPremium(userId) {
  if (!isAdmin()) return;
  const user = state.users.find(item => String(item.id) === String(userId));
  if (!user) return;
  user.isPremium = !user.isPremium;
  try {
    await db.collection('users').doc(String(user.id)).set({ isPremium: user.isPremium, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('No se pudo sincronizar el estado Premium:', error);
  }
  renderAdminPanels();
  renderAdminContent();
  renderProfile();
  populatePremiumClientSelect();
  renderPremiumBoard();
  toastSuccess(user.isPremium ? `${user.name} ahora es cliente Premium ★` : `${user.name} ya no es Premium.`, { title: 'Cliente Premium' });
}

function formatPrice(value) {
  return `${Number(value).toFixed(2)}€`;
}

function toDateOnly(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/* Deriva la fecha de caducidad de un bono( soporta bonos antiguos sin expiresAt) */
function getPurchaseExpiration(purchase) {
  if (purchase.expiresAt) return new Date(purchase.expiresAt);
  const start = purchase.activatedAt || purchase.approvedAt || purchase.date;
  if (purchase.billingType === 'time' && start && purchase.durationDays) {
    const expiry = new Date(start);
    expiry.setDate(expiry.getDate() + Number(purchase.durationDays));
    return expiry;
  }
  return null;
}

function isSameDate(a, b) {
  return dateKey(a) === dateKey(b);
}
function getPurchaseStatus(purchase) {
  if (purchase.status !== 'aprobado') return purchase.status;

  // Bono por sesiones
  if (purchase.billingType === 'sessions') {
    if (Number(purchase.remainingSessions) <= 0) return 'Agotado';
  }

  // Bono por tiempo
  const expiresAt = getPurchaseExpiration(purchase);
  if (expiresAt && expiresAt < new Date()) {
    return 'Caducado'; // Si la fecha actual superó la de expiración, el bono caduca.
  }

  if (expiresAt && (expiresAt - new Date()) <= 7 * 86400000) return 'Próximo a caducar';

  return 'Activo';
}

function purchaseStatusClass(status) {
  return status.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replaceAll(' ', '-');
}

function getPurchaseAvailability(purchase) {
  if (purchase.billingType === 'sessions') return (purchase.remainingSessions ?? purchase.sessions ?? 0) + ' sesiones restantes';
  const expiresAt = getPurchaseExpiration(purchase);
  if (!expiresAt) return 'Bono por tiempo';
  const days = Math.max(0, Math.ceil((expiresAt - new Date()) / 86400000));
  return days + ' días restantes';
}

/* ==========================================================
   OCUPACIÓN DE SALA / AFORO POR CLASE
   ========================================================== */
function getOccupancyInfo(activity) {
  const capacity = Number(activity.capacity) || 0;
  const booked = Number(activity.booked) || 0;
  const percent = capacity ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
  let level = 'low';
  let label = 'Plazas libres';
  if (percent >= 100) { level = 'high'; label = 'Completa'; }
  else if (percent >= 80) { level = 'high'; label = 'Casi llena'; }
  else if (percent >= 50) { level = 'medium'; label = 'Ocupación media'; }
  return { percent, level, label, free: Math.max(0, capacity - booked) };
}

/* ==========================================================
   ARCHIVADO AUTOMÁTICO DE BONOS CADUCADOS
   Mueve a "Histórico" los bonos por tiempo cuya fecha de validez ya pasó.
   ========================================================== */
async function archiveExpiredPurchases() {
  if (!isAdmin()) return;
  const now = new Date();
  const expired = state.purchases.filter(purchase => {
    if (purchase.status !== 'aprobado') return false;
    if (purchase.billingType !== 'time') return false;
    const expiresAt = getPurchaseExpiration(purchase);
    return expiresAt && expiresAt < now;
  });
  if (!expired.length) return;

  expired.forEach(purchase => {
    state.purchaseHistory.push({
      ...purchase,
      event: 'expired',
      archivedAt: now.toISOString(),
      archivedBy: getCurrentUser()?.id || null
    });
  });
  state.purchases = state.purchases.filter(purchase => !expired.includes(purchase));

  // Persistencia aislada: histórico en su colección y baja de /purchases
  await Promise.all(expired.map(purchase => addPurchaseHistoryDocument({
    ...purchase,
    event: 'expired',
    archivedAt: now.toISOString(),
    archivedBy: getCurrentUser()?.id || null
  })));
  await Promise.all(expired.map(purchase => deletePurchaseDocument(String(purchase.id))));

  renderAdminPanels();
  renderProfile();
  toastInfo(`${expired.length} bono${expired.length === 1 ? '' : 's'} caducado${expired.length === 1 ? '' : 's'} movido${expired.length === 1 ? '' : 's'} al histórico.`, { title: 'Bonos caducados' });
}

/* ==========================================================
   RECORDATORIOS VISUALES EN EL CALENDARIO
   ========================================================== */
function renderCalendarReminders() {
  const container = document.getElementById('calendar-reminders');
  if (!container) return;
  const user = getCurrentUser();
  const reminders = [];

  if (user && user.role !== 'admin') {
    // Bonos próximos a caducar o agotados
    state.purchases.filter(item => item.userId === user.id).forEach(purchase => {
      const status = getPurchaseStatus(purchase);
      if (status === 'Próximo a caducar') {
        reminders.push({ type: 'warning', icon: '⏳', title: 'Tu bono caduca pronto ', text: `${purchase.serviceName}: ${getPurchaseAvailability(purchase)}.` });
      } else if (status === 'Agotado') {
        reminders.push({ type: 'warning', icon: '🎫', title: 'Bono agotado ', text: `${purchase.serviceName} no tiene sesiones disponibles.` });
      }
    });

    // Próxima reserva
    const upcoming = state.reservations
      .filter(item => item.userId === user.id)
      .map(item => ({ ...item, activity: state.activities.find(a => String(a.id) === String(item.activityId)) }))
      .filter(item => item.activity && new Date(item.activity.date) >= new Date())
      .sort((a, b) => new Date(a.activity.date) - new Date(b.activity.date))[0];
    if (upcoming) {
      const date = new Date(upcoming.activity.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
      reminders.push({ type: 'info', icon: '📅', title: 'Tu próxima clase ', text: `${upcoming.activity.title} · ${date} a las ${upcoming.activity.time}.` });
    }
  }

  if (isAdmin()) {
    const todayKey = dateKey(new Date());
    const todayActivities = state.activities.filter(a => dateKey(a.date) === todayKey);
    const totalBooked = todayActivities.reduce((sum, a) => sum + (Number(a.booked) || 0), 0);
    if (todayActivities.length) {
      reminders.push({ type: 'info', icon: '🏋️', title: 'Clases de hoy', text: `${todayActivities.length} clase${todayActivities.length === 1 ? '' : 's'} programada${todayActivities.length === 1 ? '' : 's'} · ${totalBooked} reserva${totalBooked === 1 ? '' : 's'} en total.` });
    }
    const pending = state.purchases.filter(item => item.status === 'pendiente').length;
    if (pending) {
      reminders.push({ type: 'warning', icon: '🧾', title: 'Compras pendientes', text: `Tienes ${pending} solicitud${pending === 1 ? '' : 'es'} de bono por aprobar.` });
    }
  }

  container.innerHTML = reminders.map(item => `
    <div class="reminder-banner reminder-${item.type}">
      <span class="reminder-icon">${item.icon}</span>
      <div><strong>${item.title}</strong><small>${item.text}</small></div>
    </div>
  `).join('');
}

function getUserMetrics(user) {
  const reservations = state.reservations.filter(item => item.userId === user.id);
  const completed = reservations.filter(item => item.attendedAt);
  const uniqueDates = [...new Set(completed.map(item => dateKey(item.activityDate || item.date)))].sort().reverse();
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (const key of uniqueDates) {
    if (key === dateKey(cursor)) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
    else if (streak === 0) { cursor.setDate(cursor.getDate() - 1); if (key === dateKey(cursor)) { streak += 1; cursor.setDate(cursor.getDate() - 1); } else break; }
    else break;
  }
  return { total: reservations.length, completed: completed.length, streak };
}

function renderEvolutionChart(history) {
  const points = history.filter(item => Number.isFinite(Number(item.weight))).slice().reverse();
  if (!points.length) return '<div class="empty-state">Aún no hay peso registrado para dibujar la evolución.</div>';
  const weights = points.map(item => Number(item.weight));
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const coordinates = weights.map((weight, index) => `${24 + (index * 252) / Math.max(1, weights.length - 1)},${112 - ((weight - min) * 78) / range}`);
  const change = weights[weights.length - 1] - weights[0];
  const trend = change > 0 ? '↑' : change < 0 ? '↓' : '→';
  const trendClass = change > 0 ? 'trend-up' : change < 0 ? 'trend-down' : 'trend-flat';
  const linePoints = coordinates.join(' ');
  const markers = coordinates.map(point => { const [x, y] = point.split(','); return `<circle cx="${x}" cy="${y}" r="4"/>`; }).join('');
  return `<div class="evolution-chart"><div class="chart-heading"><span>Evolución del peso</span><strong class="${trendClass}">${trend} ${Math.abs(change).toFixed(1)} kg</strong></div><svg viewBox="0 0 300 140" role="img" aria-label="Gráfica de evolución del peso"><path class="chart-gridline" d="M24 34H276M24 73H276M24 112H276"/><polyline points="${linePoints}"/>${markers}</svg><div class="chart-labels"><span>Inicio: ${weights[0]} kg</span><span>Actual: ${weights.at(-1)} kg</span></div><small class="chart-note">${points.length} registro${points.length === 1 ? '' : 's'} corporal${points.length === 1 ? '' : 'es'}</small></div>`;
}

function getActivityForDate(date) {
  const key = dateKey(date);
  return state.activities.filter(activity => dateKey(activity.date) === key);
}

function getSpanishHolidayName(date) {
  const year = date.getFullYear();
  const holidayRules = [
    { month: 0, day: 1, name: 'Año Nuevo' },
    { month: 0, day: 6, name: 'Reyes Magos' },
    { month: 2, day: 19, name: 'San José' },
    { month: 3, day: 1, name: 'Jueves Santo' },
    { month: 3, day: 2, name: 'Viernes Santo' },
    { month: 4, day: 1, name: 'Fiesta del Trabajo' },
    { month: 6, day: 15, name: 'Asunción' },
    { month: 8, day: 12, name: 'Fiesta Nacional' },
    { month: 10, day: 1, name: 'Todos los Santos' },
    { month: 10, day: 6, name: 'Constitución' },
    { month: 11, day: 8, name: 'Inmaculada' },
    { month: 11, day: 25, name: 'Navidad' }
  ];

  const easter = getEasterDate(year);
  const holidayNames = new Map();

  holidayRules.forEach(item => {
    const d = new Date(year, item.month, item.day);
    holidayNames.set(dateKey(d), item.name);
  });

  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  holidayNames.set(dateKey(goodFriday), 'Viernes Santo');

  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  holidayNames.set(dateKey(easterMonday), 'Lunes de Pascua');

  return holidayNames.get(dateKey(date)) || null;
}

function getEasterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

function renderYearOptions() {
  const yearSelect = document.getElementById('year-select');
  if (!yearSelect) return;
  const years = Array.from({ length: 6 }, (_, index) => today.getFullYear() - 2 + index);
  yearSelect.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join('');
  yearSelect.value = String(state.currentYear);
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  const title = document.getElementById('calendar-title');
  if (!grid || !title) return;

  const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(state.currentYear, state.currentMonth, 1));
  title.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  const firstDay = new Date(state.currentYear, state.currentMonth, 1);
  const weekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
  const prevMonthDays = new Date(state.currentYear, state.currentMonth, 0).getDate();

  grid.innerHTML = '';

  for (let i = 0; i < 42; i++) {
    const dayNumber = i - weekday + 1;
    const date = new Date(state.currentYear, state.currentMonth, dayNumber);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'calendar-day';

    if (date.getMonth() !== state.currentMonth) {
      button.classList.add('other-month');
    }
    if (isSameDate(date, state.selectedDate)) {
      button.classList.add('selected');
    }
    if (isSameDate(date, new Date())) {
      button.classList.add('today');
    }

    const holiday = getSpanishHolidayName(date);
    if (holiday) {
      button.classList.add('holiday');
    }

    const activityList = getActivityForDate(date);
    const inner = [];

    inner.push(`<span class="calendar-day-number">${date.getDate()}</span>`);
    if (holiday) inner.push(`<span class="day-holiday-tag" title="${holiday}">${holiday}</span>`);
    if (activityList.length) inner.push(`<span class="day-activity-count">${activityList.length} act.</span>`);

    button.innerHTML = inner.join('');
    button.addEventListener('click', () => {
      state.selectedDate = date;
      renderCalendar();
      renderSelectedDay();
    });
    grid.appendChild(button);
  }
}

function renderSelectedDay() {
  const title = document.getElementById('selected-day-title');
  const container = document.getElementById('selected-day-activities');
  if (!title || !container) return;

  const date = new Date(state.selectedDate);

  // --- AQUÍ ESTÁ EL CAMBIO ---
  const formattedDate = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const holiday = getSpanishHolidayName(date);

  if (holiday) {
    title.innerHTML = `Actividades del ${formattedDate} <span style="display:block; font-size:0.9rem; color:#b45309; margin-top:4px;">🎉 ${holiday}</span>`;
  } else {
    title.textContent = 'Actividades del ' + formattedDate;
  }
  // ---------------------------

  const activities = getActivityForDate(date);
  if (!activities.length) {
    container.innerHTML = '<div class="empty-state">No hay actividades programadas para este día.</div>';
    return;
  }

  container.innerHTML = activities.map(activity => {
    const isUserBooked = !!(getCurrentUser() && activity.reservations.some(item => item.userId === getCurrentUser().id));
    const isFull = activity.booked >= activity.capacity;
    const disabled = !getCurrentUser() || isUserBooked || isFull;
    const label = !getCurrentUser() ? 'Inicia sesión para reservar' : isUserBooked ? 'Reservado' : isFull ? 'Clase Completa' : 'Reservar';
    const occupancy = getOccupancyInfo(activity);

    return `
      <article class="activity-card">
        <div class="activity-card-header">
          <div>
            <h4>${activity.title}</h4>
          </div>
          <button type="button" class="btn btn-sm ${isUserBooked ? 'btn-secondary' : 'btn-primary'}" data-activity-id="${activity.id}" ${disabled ? 'disabled' : ''}>${label}</button>
        </div>
        <div class="activity-meta">
          <div>👤 ${activity.coach}</div>
          <div>🕒 ${activity.time}</div>
          <div>⏱ ${activity.duration} min</div>
          <div>📍 ${activity.description}</div>
        </div>
        <div class="occupancy-bar ${occupancy.level === 'medium' ? 'is-medium' : occupancy.level === 'high' ? 'is-high' : ''}">
          <span style="width:${occupancy.percent}%"></span>
        </div>
        <div class="occupancy-legend">
          <span>🏋️ <strong>${activity.booked}/${activity.capacity}</strong> plazas ocupadas</span>
          <span class="occupancy-pill ${occupancy.level}">${occupancy.label}</span>
        </div>
      </article>
    `;
  }).join('');

  container.querySelectorAll('[data-activity-id]').forEach(button => {
    button.addEventListener('click', () => reserveActivity(String(button.dataset.activityId)));
  });
}

async function reserveActivity(activityId) {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    openLoginModal();
    return;
  }
  if (isUserBaja(currentUser) && currentUser.role !== 'admin') {
    toastWarning('Tu cuenta está de baja y no puede reservar clases.', { title: 'Cuenta de baja' });
    return;
  }

  const activity = state.activities.find(item => String(item.id) === String(activityId));
  if (!activity) return;

  const alreadyBooked = activity.reservations.some(item => String(item.userId) === String(currentUser.id));
  if (alreadyBooked) {
    toastWarning('Ya tienes esta actividad reservada.');
    return;
  }

  if (activity.booked >= activity.capacity) {
    toastWarning('La clase está completa. No quedan plazas disponibles.');
    return;
  }

  // --- LÓGICA DE BONOS: buscamos un bono válido ---
  const validPurchases = state.purchases.filter(item => {
    if (String(item.userId) !== String(currentUser.id)) return false;
    if (getPurchaseStatus(item) !== 'Activo') return false;

    const serviceOrigin = state.services.find(s => String(s.id) === String(item.serviceId));
    if (serviceOrigin && serviceOrigin.linkedActivity && serviceOrigin.linkedActivity !== activity.title) {
      return false;
    }
    return true;
  });

  const activeTimeBonus = validPurchases.find(item => item.billingType === 'time');
  const activeSessionBonus = validPurchases.find(item => item.billingType === 'sessions' && Number(item.remainingSessions) > 0);
  const activeBonus = activeTimeBonus || activeSessionBonus;

  const isSingleClass = !activeBonus;

  activity.booked += 1;
  activity.reservations.push({ userId: currentUser.id, date: new Date().toISOString() });

  const reservation = {
    id: Date.now(),
    title: activity.title,
    date: activity.date,
    userId: currentUser.id,
    activityId: activity.id,
    status: 'active',
    activityDate: activity.date,
    purchaseId: activeBonus?.id || null,
    sessionCharged: false, // Se marcará en true cuando el admin confirme asistencia y se descuente la sesión
    singleClass: isSingleClass,
    paymentStatus: isSingleClass ? 'pendiente' : 'cubierto',
    reservedAt: new Date().toISOString()
  };

  state.reservations.push(reservation);
  state.reservationHistory.push({ ...reservation, event: 'reserved' });

  // Solo se toca la colección /reservations del propio usuario.
  await createReservationDocument(reservation);
  renderCalendar();
  renderSelectedDay();
  renderProfile();

  if (isSingleClass) {
    toastInfo(`Reserva de clase suelta confirmada para "${activity.title}". Queda pendiente de pago.`, { title: 'Clase suelta' });
  } else {
    toastSuccess(`¡Plaza reservada para "${activity.title}"!`);
  }
}

async function cancelReservation(reservationId) {
  const user = getCurrentUser();
  const reservation = state.reservations.find(item => String(item.id) === String(reservationId) && String(item.userId) === String(user?.id));
  if (!reservation) return;
  const confirmed = await showConfirm('¿Quieres cancelar esta reserva?', { title: 'Cancelar reserva', icon: '🗓️', confirmText: 'Sí, cancelar' });
  if (!confirmed) return;
  const activity = state.activities.find(item => String(item.id) === String(reservation.activityId));
  if (activity) {
    activity.booked = Math.max(0, activity.booked - 1);
    activity.reservations = activity.reservations.filter(item => String(item.userId) !== String(user.id));
  }
  const reservationPurchase = state.purchases.find(item => String(item.id) === String(reservation.purchaseId));
  if (reservation.sessionCharged && reservationPurchase?.billingType === 'sessions') {
    reservationPurchase.remainingSessions = (Number(reservationPurchase.remainingSessions) || 0) + 1;
  }
  state.reservations = state.reservations.filter(item => String(item.id) !== String(reservation.id));
  state.reservationHistory.push({ ...reservation, event: 'cancelled', cancelledAt: new Date().toISOString() });
  // Escritura aislada: se devuelve la sesión al bono (si procede) y se borra la reserva.
  if (reservation.sessionCharged && reservationPurchase?.billingType === 'sessions') {
    await updatePurchaseDocument(String(reservationPurchase.id), { remainingSessions: reservationPurchase.remainingSessions });
  }
  await deleteReservationDocument(String(reservation.id));
  renderCalendar();
  renderSelectedDay();
  renderProfile();
  toastInfo('Reserva cancelada.');
}

async function toggleAttendance(activityId, userId, attended) {
  if (!isAdmin()) return;
  const openActivities = [...document.querySelectorAll('.attendance-group[open]')].map(item => item.dataset.activityId);
  const activity = state.activities.find(item => String(item.id) === String(activityId));
  const reservation = state.reservations.find(item => String(item.activityId) === String(activityId) && String(item.userId) === String(userId));
  if (!activity || !reservation) return;

  if (attended && !reservation.attendedAt) {
    let bonus = reservation.purchaseId ? state.purchases.find(item => String(item.id) === String(reservation.purchaseId)) : null;
    const getRemaining = (p) => Number(p?.remainingSessions ?? p?.sessions ?? 0);

    if (!bonus || bonus.billingType !== 'sessions' || getRemaining(bonus) <= 0) {
      bonus = state.purchases.find(item =>
        String(item.userId) === String(userId) &&
        item.billingType === 'sessions' &&
        getPurchaseStatus(item) === 'Activo' &&
        getRemaining(item) > 0
      );
    }

    if (bonus && bonus.billingType === 'sessions' && getRemaining(bonus) > 0) {
      if (!reservation.sessionCharged) {
        const current = getRemaining(bonus);
        bonus.remainingSessions = Math.max(0, current - 1);
        reservation.purchaseId = bonus.id;
        reservation.sessionCharged = true;
      }
    } else {
      toastWarning('Aviso: El usuario no cuenta con un bono de sesiones activo con saldo disponible.');
    }

    reservation.attendedAt = new Date().toISOString();
    state.reservationHistory.push({ ...reservation, event: 'attendance_confirmed' });
  }
  else if (!attended && reservation.attendedAt) {
    const bonus = state.purchases.find(item => String(item.id) === String(reservation.purchaseId));
    if (reservation.sessionCharged && bonus?.billingType === 'sessions') {
      const current = Number(bonus.remainingSessions ?? bonus.sessions ?? 0);
      bonus.remainingSessions = current + 1;
    }
    delete reservation.attendedAt;
    reservation.sessionCharged = false;
    state.reservationHistory.push({ ...reservation, event: 'attendance_removed' });
  }

  // Persistencia aislada: se actualiza la reserva y, si procede, el bono usado.
  await updateReservationDocument(String(reservation.id), {
    attendedAt: reservation.attendedAt || null,
    sessionCharged: !!reservation.sessionCharged,
    purchaseId: reservation.purchaseId || null
  });
  const bonusAfter = reservation.purchaseId
    ? state.purchases.find(item => String(item.id) === String(reservation.purchaseId))
    : null;
  if (bonusAfter && typeof bonusAfter.remainingSessions === 'number') {
    await updatePurchaseDocument(String(bonusAfter.id), { remainingSessions: bonusAfter.remainingSessions });
  }
  renderAttendancePanel();
  document.querySelectorAll('.attendance-group').forEach(group => {
    if (openActivities.includes(group.dataset.activityId) || group.dataset.activityId === String(activityId)) {
      group.open = true;
    }
  });
  renderProfile();
  toastSuccess('Asistencia y saldo de bono actualizados correctamente.');
}

function renderAttendancePanel() {
  const container = document.getElementById('admin-attendance');
  if (!container) return;
  if (!isAdmin()) {
    container.innerHTML = '<div class="empty-state">Sin acceso.</div>';
    return;
  }
  const activities = state.activities.filter(item => item.reservations?.length);
  container.innerHTML = activities.length ? activities.map(activity => `<details class="attendance-group" data-activity-id="${activity.id}"><summary><strong>${activity.title}</strong><small>${new Date(activity.date).toLocaleDateString('es-ES')} · ${activity.time} · ${activity.booked}/${activity.capacity} plazas</small></summary><div class="attendance-list">${activity.reservations.map(item => { const reservation = state.reservations.find(entry => String(entry.activityId) === String(activity.id) && String(entry.userId) === String(item.userId)); const user = state.users.find(entry => String(entry.id) === String(item.userId)); if (!reservation || !user) return ''; return `<label class="attendance-row"><span><strong>${user.name}</strong> - <small>${user.email}</small></span><span><input type="checkbox" data-attendance-activity="${activity.id}" data-attendance-user="${user.id}" ${reservation.attendedAt ? 'checked' : ''} /> Asistió</span></label>`; }).join('')}</div></details>`).join('') : '<div class="empty-state">Todavía no hay reservas para confirmar.</div>';
  container.querySelectorAll('[data-attendance-activity]').forEach(input => input.addEventListener('change', () => toggleAttendance(input.dataset.attendanceActivity, input.dataset.attendanceUser, input.checked)));
}

async function cancelPurchase(purchaseId) {
  const user = getCurrentUser();
  const purchase = state.purchases.find(item => String(item.id) === String(purchaseId) && item.userId === user?.id);
  if (!purchase) return;
  const confirmed = await showConfirm('¿Quieres cancelar esta solicitud?', { title: 'Cancelar solicitud', icon: '🧾', confirmText: 'Sí, cancelar' });
  if (!confirmed) return;
  state.purchases = state.purchases.filter(item => item.id !== purchase.id);
  await deletePurchaseDocument(String(purchase.id));
  renderProfile();
  renderAdminPanels();
  toastInfo('Solicitud cancelada.');
}

function calculateProfileRecommendation(profile) {
  if (!profile?.age || !profile.height || !profile.weight) return null;
  const heightMeters = Number(profile.height) / 100;
  const bmi = Number(profile.weight) / (heightMeters * heightMeters);
  const baseCalories = (10 * Number(profile.weight)) + (6.25 * Number(profile.height)) - (5 * Number(profile.age)) + (profile.sex === 'hombre' ? 5 : -161);
  const maintenance = Math.round(baseCalories * Number(profile.activity || 1.2));
  const adjustment = profile.goal === 'bajar peso' ? -300 : profile.goal === 'aumentar musculo' ? 250 : 0;
  return { bmi: bmi.toFixed(1), calories: Math.max(1200, maintenance + adjustment) };
}

function renderProfileTracking(user) {
  const profile = user.profile || {};
  const form = document.getElementById('profile-goals-form');
  if (form) form.style.display = user.role === 'admin' ? 'none' : 'flex';
  if (user.role === 'admin') return;
  ['age', 'sex', 'height', 'weight', 'goal', 'activity', 'waist', 'hip', 'chest', 'arm', 'thigh', 'notes'].forEach(key => {
    const input = document.getElementById(`profile-${key}`);
    if (input && profile[key] !== undefined) input.value = profile[key];
  });
  const recommendation = document.getElementById('profile-recommendation');
  const values = calculateProfileRecommendation(profile);
  if (recommendation) recommendation.innerHTML = values ? `<strong>Tu orientación:</strong> IMC ${values.bmi} · aproximadamente ${values.calories} kcal/día para ${profile.goal}.<small>Estimación orientativa, no sustituye la valoración de un profesional.</small>` : '<span>Completa tus datos para ver tu orientación.</span>';
}

async function handleProfileGoalsSubmit(event) {
  event.preventDefault();
  const user = getCurrentUser();
  if (!user) return;
  user.profile = {
    age: Number(document.getElementById('profile-age').value),
    sex: document.getElementById('profile-sex').value,
    height: Number(document.getElementById('profile-height').value),
    weight: Number(document.getElementById('profile-weight').value),
    goal: document.getElementById('profile-goal').value,
    activity: Number(document.getElementById('profile-activity').value),
    waist: Number(document.getElementById('profile-waist').value) || null,
    hip: Number(document.getElementById('profile-hip').value) || null,
    chest: Number(document.getElementById('profile-chest').value) || null,
    arm: Number(document.getElementById('profile-arm').value) || null,
    thigh: Number(document.getElementById('profile-thigh').value) || null,
    notes: document.getElementById('profile-notes').value.trim()
  };
  user.profileHistory = user.profileHistory || [];
  user.profileHistory.unshift({ ...user.profile, recordedAt: new Date().toISOString() });
  await db.collection('users').doc(user.id).set({ profile: user.profile, profileHistory: user.profileHistory }, { merge: true });
  renderProfileTracking(user);
  renderAdminPanels();
  toastSuccess('Datos de seguimiento guardados.');
}

function openLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.classList.add('hidden');
}

function setCurrentUser(user) {
  state.currentUserId = user ? user.id : null;
  userRole = user ? user.role : 'cliente';
  renderHeader();
  renderProfile();
  renderAdminPanels();
  renderCenterConfig();
  renderCalendar();
  renderSelectedDay();
}

async function syncAuthenticatedUser(firebaseUser) {
  if (!firebaseUser) {
    state.currentUserId = null;
    userRole = 'cliente';
    renderAll();
    return;
  }

  // 1. Obtención segura del listado de administradores (si no existe 'adminEmails', busca en 'state' o usa un array vacío)
  const adminList = (typeof adminEmails !== 'undefined' ? adminEmails : state.adminEmails) || [];
  const userEmail = (firebaseUser.email || '').toLowerCase();

  // Comprobar si la cuenta ha sido deshabilitada/eliminada
  if ((state.deletedUserIds || []).includes(firebaseUser.uid) || (state.deletedUserEmails || []).includes(userEmail)) {
    await auth.signOut();
    toastError('Esta cuenta ya no tiene acceso a MIFIT.');
    return;
  }

  const profileSnapshot = await db.collection('users').doc(firebaseUser.uid).get().catch(() => null);
  const profile = profileSnapshot && profileSnapshot.exists ? profileSnapshot.data() : {};

  // Búsqueda segura en el estado local
  const existing = state.users.find(item => item.id === firebaseUser.uid || (item.email && item.email.toLowerCase() === userEmail));

  // Asignación de rol sin que 'adminEmails' provoque un fallo
  const role = profile.role || (adminList.includes(userEmail) ? 'admin' : existing?.role || 'cliente');

  // Cliente de baja: no puede entrar hasta que el administrador lo dé de alta
  const accountInBaja = typeof profile.isBaja === 'boolean' ? profile.isBaja : isUserBaja(existing);
  if (accountInBaja && role !== 'admin') {
    await auth.signOut();
    toastWarning('Tu cuenta está de baja. Contacta con MIFIT para volver a darte de alta.', { title: 'Acceso no disponible' });
    return;
  }

  if (existing) {
    existing.id = firebaseUser.uid;
    existing.name = profile.name || firebaseUser.displayName || existing.name;
    existing.role = role;
    existing.profile = profile.profile || existing.profile || {};
    existing.profileHistory = profile.profileHistory || existing.profileHistory || [];
    // Preservar el estado Premium: Firestore manda si existe; si no, se mantiene el valor local
    existing.isPremium = typeof profile.isPremium === 'boolean' ? profile.isPremium : (existing.isPremium === true);
    // Estado de baja temporal: Firestore manda si existe; si no, se mantiene el valor local
    existing.isBaja = typeof profile.isBaja === 'boolean' ? profile.isBaja : isUserBaja(existing);
    existing.status = existing.isBaja ? 'inactive' : 'active';
    state.currentUserId = firebaseUser.uid;
  } else {
    state.users.push({
      id: firebaseUser.uid,
      name: profile.name || firebaseUser.displayName || userEmail.split('@')[0] || 'Usuario',
      email: firebaseUser.email,
      role,
      profile: profile.profile || {},
      profileHistory: profile.profileHistory || [],
      isPremium: profile.isPremium === true,
      isBaja: profile.isBaja === true,
      status: profile.isBaja === true ? 'inactive' : 'active'
    });
    state.currentUserId = firebaseUser.uid;
  }

  userRole = getCurrentUser()?.role || role || 'cliente';

  // Guardar en Firestore usando encadenamiento opcional para evitar fallos si getCurrentUser() devuelve null
  await db.collection('users').doc(firebaseUser.uid).set({
    name: getCurrentUser()?.name || profile.name || firebaseUser.displayName || 'Usuario',
    email: firebaseUser.email,
    role,
    isPremium: getCurrentUser()?.isPremium === true,
    isBaja: isUserBaja(getCurrentUser()),
    status: isUserBaja(getCurrentUser()) ? 'inactive' : 'active',
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // Con sesión iniciada se refrescan las colecciones (el admin necesita
  // listas completas y actuales de usuarios, compras y reservas).
  if (role === 'admin') await ensureMigration();
  await refreshFromCloud();
  renderAll();

  if (role === 'admin') {
    const centerNav = document.querySelector('[data-view="view-centro"]');
    const adminTab = document.querySelector('[data-tab="admin"]');
    if (centerNav) centerNav.click();
    if (adminTab) adminTab.click();
  }
}

function renderHeader() {
  const user = getCurrentUser();
  const badge = document.getElementById('user-role-badge');
  const loginBtn = document.getElementById('login-toggle-btn');
  const registerBtn = document.getElementById('register-toggle-btn'); // 1. Capturamos el botón de registro
  const adminTabs = document.querySelectorAll('.admin-only-tab'); // Selecciona tanto Admin como Clientes
  const contactTab = document.querySelector('[data-tab="contacto"]');
  const contactForm = document.getElementById('contact-form');
  const profileNav = document.getElementById('profile-nav-item');

  document.querySelectorAll('[data-admin-only]').forEach(item => {
    const visible = isAdmin();
    item.classList.toggle('is-admin-visible', visible);
    item.removeAttribute('style');
  });
  if (contactTab) contactTab.style.display = isAdmin() ? 'none' : 'inline-block';
  if (contactForm) contactForm.style.display = isAdmin() ? 'none' : 'block';

  // Oculta o muestra tanto Admin como Clientes según el rol
  adminTabs.forEach(tab => {
    tab.style.display = isAdmin() ? 'inline-block' : 'none';
  });

  if (profileNav) {
    profileNav.style.display = user && user.role !== 'admin' ? 'flex' : 'none';
    if ((!user || isAdmin()) && profileNav.classList.contains('active')) {
      document.querySelector('[data-view="view-home"]')?.click();
    }
  }

// Si no hay usuario (Invitado)
  if (!user) {
    if (badge) badge.textContent = 'Invitado';
    if (loginBtn) loginBtn.textContent = 'Iniciar sesión';
    if (registerBtn) registerBtn.style.display = 'inline-block'; // 2. Mostramos el botón
    return;
  }

  // Si hay usuario logueado
  if (badge) badge.textContent = user.name + (user.role === 'admin' ? ' · Admin' : '');
  if (loginBtn) loginBtn.textContent = 'Cerrar sesión';
  if (registerBtn) registerBtn.style.display = 'none'; // 3. Ocultamos el botón
}
async function handleLoginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();
  try {
    await auth.signInWithEmailAndPassword(email, password);
    closeLoginModal();
    document.getElementById('login-form').reset();
  } catch (error) {
    toastError('Credenciales incorrectas. Revisa tu email y contraseña.');
  }
}

// Constantes con los SVG de ojo abierto y ojo tachado
const EYE_OPEN_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
`;

const EYE_CLOSED_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  </svg>
`;

// Función genérica para alternar visibilidad e icono SVG
function togglePasswordVisibility(inputId, toggleId) {
  const passwordInput = document.getElementById(inputId);
  const toggleBtn = document.getElementById(toggleId);
  if (!passwordInput || !toggleBtn) return;

  const isHidden = passwordInput.type === 'password';

  // Cambia el tipo de input
  passwordInput.type = isHidden ? 'text' : 'password';

  // Cambia el SVG interno
  toggleBtn.innerHTML = isHidden ? EYE_CLOSED_SVG : EYE_OPEN_SVG;

  // Actualiza accesibilidad y tooltip
  const label = isHidden ? 'Ocultar contraseña' : 'Mostrar contraseña';
  toggleBtn.setAttribute('aria-label', label);
  toggleBtn.title = label;
}

async function handlePasswordReset() {
  const emailInput = document.getElementById('login-email');
  const email = emailInput ? emailInput.value.trim() : '';

  if (!email) {
    toastWarning('Escribe tu email en el campo de inicio de sesión para recibir el enlace de recuperación.');
    if (emailInput) emailInput.focus();
    return;
  }

  try {
    await auth.sendPasswordResetEmail(email);
    toastSuccess('Te hemos enviado un enlace para restablecer la contraseña.');
  } catch (error) {
    // Esto te mostrará el código exacto de Firebase en la consola (F12)
    console.error('Error en Password Reset:', error.code, error.message);

    switch (error.code) {
      case 'auth/user-not-found':
        toastError('No existe ninguna cuenta registrada con este email en Authentication.');
        break;
      case 'auth/invalid-email':
        toastError('El correo electrónico introducido no es válido.');
        break;
      case 'auth/too-many-requests':
        toastError('Demasiados intentos. Inténtalo de nuevo más tarde.');
        break;
      default:
        toastError('No se pudo enviar el correo (' + error.code + '). Comprueba la consola.');
    }
  }
}

async function handleLogout() {
  await auth.signOut();
  closeLoginModal();
}

function renderCenterConfig() {
  const centerName = document.getElementById('center-name');
  const description = document.getElementById('center-description');
  const address = document.getElementById('center-address');
  const hero = document.getElementById('center-hero-img');
  const callBtn = document.getElementById('btn-call');
  const whatsappLink = document.getElementById('btn-whatsapp');
  const directions = document.getElementById('btn-directions');
  const map = document.getElementById('center-map');
  const headerLogo = document.getElementById('header-logo');

  if (centerName) centerName.textContent = mfitData.info.name;
  if (description) description.textContent = mfitData.info.description;
  if (address) address.textContent = mfitData.info.address;
  if (hero) hero.src = mfitData.info.heroImage;
  if (headerLogo) headerLogo.src = 'MIFIT.jpg';
  if (callBtn) callBtn.href = `tel:${mfitData.info.phone}`;
  if (whatsappLink) whatsappLink.href = `https://wa.me/${mfitData.info.whatsapp}`;
  if (directions) directions.href = `https://maps.google.com/?q=${encodeURIComponent(mfitData.info.address)}`;
  if (map) map.src = `https://www.google.com/maps?q=${encodeURIComponent(mfitData.info.address)}&output=embed`;

  const servicesContainer = document.getElementById('services-container');
  if (servicesContainer) {
    servicesContainer.innerHTML = mfitData.services.filter(item => item.active).map(item => `
      <article class="catalog-card">
        <img src="${item.image}" alt="${item.name}" style="height:150px; object-fit:cover; border-radius:12px;" />
        <div>
          <h3>${item.name}</h3>
          <p>${item.desc}</p>
        </div>
      </article>
    `).join('');
  }

  const teamContainer = document.getElementById('team-container');
  if (teamContainer) {
    teamContainer.innerHTML = mfitData.team.filter(item => item.active).map(item => `
    <article class="catalog-card">
      <img src="${item.image}" alt="${item.name}" style="height:150px; object-fit:cover; border-radius:12px;" />
      <div>
        <span class="label-badge">${item.role}</span>
        <h3>${item.name}</h3>
        <p><strong>Especialidad:</strong> ${item.spec}</p>
        <p>${item.bio}</p>
      </div>
    </article>
  `).join('');
  }

  const galleryContainer = document.getElementById('gallery-container');
  if (galleryContainer) {
    galleryContainer.innerHTML = mfitData.gallery.filter(item => item.active).map(item => `
    <div class="gallery-item" data-image="${item.url}" data-caption="${item.caption}">
      <img src="${item.url}" alt="${item.caption}" />
      <div class="gallery-caption">${item.caption}</div>
    </div>
  `).join('');
    galleryContainer.querySelectorAll('.gallery-item').forEach(item => {
      item.addEventListener('click', () => {
        const modal = document.getElementById('gallery-modal');
        const img = document.getElementById('modal-img');
        const caption = document.getElementById('modal-caption');
        img.src = item.dataset.image;
        caption.textContent = item.dataset.caption;
        modal.classList.remove('hidden');
      });
    });
  }

  const newsContainer = document.getElementById('news-container');
  if (newsContainer) {
    const activeNews = mfitData.news.filter(item => item.active);
    newsContainer.innerHTML = activeNews.length ? `
      <div class="news-board-grid">
        ${activeNews.map(item => `
          <article class="announcement-card">
            <div class="announcement-meta">
              <span class="announcement-tag">Novedad</span>
              <span class="announcement-date">${item.date || ''}</span>
            </div>
            <h3 class="announcement-title">${item.title}</h3>
            <p class="announcement-desc">${item.desc}</p>
          </article>
        `).join('')}
      </div>
    ` : '<div class="empty-state">No hay avisos en el tablón en este momento.</div>';
  }
}

function newsSeenStorageKey(userId) {
  return `mfit-seen-news-${userId}`;
}

function getUnreadNews(user) {
  const activeNews = (mfitData.news || []).filter(item => item.active !== false);
  if (!user || !activeNews.length) return [];
  let seen = [];
  try {
    seen = JSON.parse(localStorage.getItem(newsSeenStorageKey(user.id)) || '[]');
  } catch (error) {
    seen = [];
  }
  const seenIds = new Set((seen || []).map(String));
  return activeNews.filter(item => !seenIds.has(String(item.id)));
}

function markNewsAsSeen(user) {
  if (!user) return;
  const ids = (mfitData.news || []).filter(item => item.active !== false).map(item => String(item.id));
  localStorage.setItem(newsSeenStorageKey(user.id), JSON.stringify(ids));
}

function openNewsBoard() {
  document.querySelector('[data-view="view-centro"]')?.click();
  document.querySelector('[data-tab="novedades"]')?.click();
}

function notifyUnreadNews() {
  const user = getCurrentUser();
  if (!user || user.role === 'admin') return;
  const unread = getUnreadNews(user);
  if (!unread.length) return;
  const latest = unread[unread.length - 1];
  const message = unread.length === 1
    ? `Hay un anuncio nuevo: «${latest.title}». Tócalo para abrirlo.`
    : `Tienes ${unread.length} anuncios nuevos. El más reciente: «${latest.title}».`;
  const toast = showToast(message, 'info', {
    title: 'Tablón de anuncios',
    duration: 7200,
    className: 'toast-news',
    icon: '!'
  });
  if (toast) {
    toast.addEventListener('click', event => {
      if (event.target.closest('.toast-close')) return;
      openNewsBoard();
    });
  }
  markNewsAsSeen(user);
}

function renderHome() {
  const homeData = mfitData.info.home || {};
  const homeTitle = document.querySelector('.landing-copy h1');
  const homeSubtitle = document.querySelector('.landing-copy p');
  const cta1 = document.querySelector('.landing-actions button[data-go-view="view-calendario"]');
  const cta2 = document.querySelector('.landing-actions button[data-go-view="view-centro"]');
  const proof = document.querySelector('.landing-proof');

  if (homeTitle) homeTitle.textContent = homeData.title || 'Tu mejor versión empieza hoy.';
  if (homeSubtitle) homeSubtitle.textContent = homeData.subtitle || 'Entrenamiento funcional, readaptación y acompañamiento real en un espacio diseñado para avanzar.';
  if (cta1) cta1.textContent = homeData.cta1 || 'Ver calendario';
  if (cta2) cta2.textContent = homeData.cta2 || 'Conocer MIFIT';
  if (proof) proof.textContent = homeData.proof || '+500 clientes activos en nuestra comunidad';

  const valueCards = document.querySelectorAll('.value-card');
  if (valueCards.length >= 3) {
    const card1 = valueCards[0];
    const card2 = valueCards[1];
    const card3 = valueCards[2];

    if (card1) {
      card1.querySelector('h3').textContent = homeData.value1Title || 'Entrenamiento Funcional';
      card1.querySelector('p').textContent = homeData.value1Desc || 'Rutinas adaptadas a tu nivel con supervisión constante.';
    }
    if (card2) {
      card2.querySelector('h3').textContent = homeData.value2Title || 'Readaptación Física';
      card2.querySelector('p').textContent = homeData.value2Desc || 'Recuperación guiada por profesionales especializados.';
    }
    if (card3) {
      card3.querySelector('h3').textContent = homeData.value3Title || 'Comunidad Activa';
      card3.querySelector('p').textContent = homeData.value3Desc || 'Entrena en un ambiente motivador y seguro.';
    }
  }

  const ctaSection = document.querySelector('.landing-cta');
  if (ctaSection) {
    const ctaTitle = ctaSection.querySelector('h2');
    const ctaButton = ctaSection.querySelector('button');
    if (ctaTitle) ctaTitle.textContent = homeData.ctaTitle || '¿Listo para empezar tu transformación?';
    if (ctaButton) ctaButton.textContent = homeData.ctaButton || 'Únete ahora';
  }
}

function renderProfile() {
  const user = getCurrentUser();
  const container = document.getElementById('profile-content');
  const profileForm = document.getElementById('profile-goals-form');
  if (!container) return;

  if (!user) {
    if (profileForm) profileForm.style.display = 'none';
    container.innerHTML = '<div class="empty-state">Debes iniciar sesión para ver tu perfil y comprar servicios.</div>';
    return;
  }
  if (user.role === 'admin') {
    if (profileForm) profileForm.style.display = 'none';
    container.innerHTML = '<div class="empty-state">El administrador no tiene un perfil de entrenamiento. Accede al panel Admin para consultar a los clientes.</div>';
    return;
  }
  if (profileForm) profileForm.style.display = 'flex';

  const userReservations = state.reservations
    .filter(item => String(item.userId) === String(user.id))
    .map(item => {
      const activity = state.activities.find(a => String(a.id) === String(item.activityId));
      return activity ? { ...item, date: activity.date, title: activity.title, time: activity.time } : item;
    });

  const purchases = state.purchases.filter(item => String(item.userId) === String(user.id));
  const metrics = getUserMetrics(user);
  const premium = isUserPremium(user);
  const premiumPosts = (mfitData.premium || [])
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .filter(item => canSeePremiumPost(item, user));
  renderProfileTracking(user);

  const premiumPostsHtml = premium ? (
    premiumPosts.length ? premiumPosts.map((item, index) => `
      <article class="premium-post ${index === 0 ? 'premium-post-featured' : ''}">
        <div class="premium-post-head">
          <span class="premium-post-type">${item.type || 'Publicación'}</span>
          <small>${item.date ? new Date(item.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</small>
        </div>
        <h4>${item.title}</h4>
        ${item.imageUrl ? `<img class="premium-post-image" src="${item.imageUrl}" alt="${item.title}" loading="lazy">` : ''}
        <p>${item.content}</p>
      </article>
    `).join('') : '<div class="empty-state">Aún no hay contenido Premium publicado. Vuelve pronto ★</div>'
  ) : `
    <div class="premium-upgrade-banner">
      <div class="premium-upgrade-glow" aria-hidden="true"></div>
      <span class="premium-upgrade-crown">★</span>
      <h4>Desbloquea tu Zona Premium</h4>
      <p>Accede a rutinas exclusivas, anuncios anticipados y recursos reservados solo para clientes Premium de MIFIT.</p>
      <ul class="premium-perks">
        <li>Contenido y planes exclusivos</li>
        <li>Anuncios antes que nadie</li>
        <li>Recursos y seguimiento VIP</li>
      </ul>
      <small class="premium-upgrade-note">¿Quieres ser Premium? Consulta en recepción o escríbenos por WhatsApp y activaremos tu cuenta.</small>
    </div>
  `;

  container.classList.toggle('profile-night-mode', false);
  renderPremiumBoard();

  const premiumBody = document.getElementById('premium-zone-body');
  if (premiumBody) {
    premiumBody.innerHTML = premiumPostsHtml;
  }

  container.innerHTML = `
    <div class="profile-tab-panel" data-profile-panel="perfil">

    <div class="profile-card${premium ? ' premium-profile-card' : ''}">
      <div class="profile-header">
        <div class="avatar">${user.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</div>
        <div class="profile-identity">
          <h3>${user.name}${premium ? premiumBadgeHtml() : ''}</h3>
          <p>${user.role === 'admin' ? 'Administrador' : 'Cliente'} · ${user.email}</p>
        </div>
      </div>
      <div class="stats-grid">
        <div class="stat-box"><span>Clases reservadas</span><strong>${metrics.total}</strong></div>
        <div class="stat-box"><span>Asistencia acumulada</span><strong>${metrics.completed}</strong></div>
        <div class="stat-box"><span>Racha actual</span><strong>${metrics.streak} días</strong></div>
        <div class="stat-box"><span>Objetivo</span><strong>${user.profile?.goal || 'Sin definir'}</strong></div>
      </div>
      <div class="progress-block">
        <div class="progress-bar"><span style="width:${Math.min(100, metrics.completed ? Math.max(8, metrics.streak * 12) : 0)}%"></span></div>
      </div>
      ${renderEvolutionChart((user.profileHistory || []).length ? user.profileHistory : [user.profile || {}])}
    </div>

    <div class="profile-card">
      <h3>Servicios disponibles</h3>
      <div class="catalog-grid">
        ${state.services.map(service => `
          <article class="catalog-card">
            <div>
              <span class="label-badge">${service.type}</span>
              <h3>${service.name}</h3>
              <p>${service.description}</p>
            </div>
            <div class="price">${formatPrice(service.price)}</div>
            <div class="card-actions">
              <button type="button" class="btn btn-primary btn-sm" data-buy-service="${service.id}">Solicitar compra</button>
            </div>
          </article>
        `).join('')}
      </div>
    </div>

    <div class="profile-card">
      <h3>Compras</h3>
      <div class="admin-list">
        ${purchases.length ? purchases.map(item => `
          <div class="purchase-item">
            <strong>${item.serviceName}</strong>
            <small>${new Date(item.date).toLocaleDateString('es-ES')} · ${getPurchaseAvailability(item)}</small>
            <span class="alert-badge ${purchaseStatusClass(getPurchaseStatus(item))}" >${getPurchaseStatus(item)}</span>
            ${item.status === 'pendiente' ? '<button type="button" class="btn btn-secondary btn-sm" data-cancel-purchase="' + item.id + '">Cancelar solicitud</button>' : ''}
          </div>
        `).join('') : '<div class="empty-state">Todavía no has solicitado compras.</div>'}
      </div>
    </div>

    <div class="profile-card">
      <h3>Reservas</h3>
      <div class="admin-list">
        ${userReservations.length ? userReservations.map(item => `
          <details class="reservation-accordion">
            <summary class="reservation-summary">
              <div class="reservation-summary-main">
                <strong>${item.title}</strong>
                <small>${new Date(item.date).toLocaleDateString('es-ES')} · ${item.time || 'Horario'}</small>
              </div>
              <span class="reservation-status">Ver detalles</span>
            </summary>
            <div class="reservation-details">
              <div class="reservation-info">
                <p><strong>Actividad:</strong> ${item.title}</p>
                <p><strong>Fecha:</strong> ${new Date(item.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <p><strong>Hora:</strong> ${item.time || 'Horario por confirmar'}</p>
                <p><strong>Entrenador:</strong> ${item.trainer || 'Por asignar'}</p>
                <p><strong>Ubicación:</strong> ${item.location || 'MIFIT Centro'}</p>
                ${item.notes ? `<p><strong>Notas:</strong> ${item.notes}</p>` : ''}
              </div>
              <div class="reservation-actions">
                <button type="button" class="btn btn-secondary btn-sm" data-cancel-reservation="${item.id}">Cancelar reserva</button>
              </div>
            </div>
          </details>
        `).join('') : '<div class="empty-state">Todavía no has reservado actividades.</div>'}
      </div>
    </div>

    </div>

    <div class="profile-tab-panel hidden" data-profile-panel="premium" id="profile-premium-panel">
      <div class="profile-card premium-zone-card">
        <h3 class="premium-zone-title">${premium ? '<span class="premium-badge"><span class="premium-badge-star">★</span> Zona Premium</span>' : 'Zona Premium'}</h3>
        ${premiumPostsHtml}
      </div>
    </div>
  `;

  container.querySelectorAll('[data-buy-service]').forEach(button => {
    button.addEventListener('click', () => requestPurchase(Number(button.dataset.buyService)));
  });
  container.querySelectorAll('[data-cancel-purchase]').forEach(button => {
    button.addEventListener('click', () => cancelPurchase(button.dataset.cancelPurchase));
  });
  container.querySelectorAll('[data-cancel-reservation]').forEach(button => {
    button.addEventListener('click', () => cancelReservation(button.dataset.cancelReservation));
  });
}

async function requestPurchase(serviceId) {
  const user = getCurrentUser();
  if (!user) {
    openLoginModal();
    return;
  }
  if (isUserBaja(user) && user.role !== 'admin') {
    toastWarning('Tu cuenta está de baja y no puede solicitar bonos.', { title: 'Cuenta de baja' });
    return;
  }

  const service = state.services.find(item => item.id === serviceId);
  if (!service) return;

  const purchase = {
    id: Date.now(),
    userId: user.id,
    serviceId: service.id,
    serviceName: service.name,
    amount: service.price,
    date: new Date().toISOString(),
    status: 'pendiente',
    billingType: service.billingType || 'sessions',
    sessions: Number(service.sessions) || 0,
    durationDays: Number(service.durationDays) || 0
  };
  state.purchases.push(purchase);

  // Solo se crea el documento del propio usuario en /purchases.
  await createPurchaseDocument(purchase);
  renderProfile();
  renderAdminPanels();
  toastSuccess('Compra registrada. El administrador debe aprobarla desde su panel.');
}

function renderBonosList() {
  const container = document.getElementById('bonos-list');
  if (!container) return;

  container.innerHTML = state.services.map(service => `
    <article class="catalog-card">
      <div>
        <span class="label-badge">${service.type}</span>
        <h3>${service.name}</h3>
        <p>${service.description}</p>
      </div>
      <div class="price">${formatPrice(service.price)}</div>
      <small class="bonus-mode">${service.billingType === 'time' ? `${service.durationDays || 30} días de acceso` : `${service.sessions || 0} sesiones`}</small>
      <div class="card-actions">
        <button type="button" class="btn btn-primary btn-sm" data-buy-service="${service.id}">Solicitar</button>
      </div>
    </article>
  `).join('');

  container.querySelectorAll('[data-buy-service]').forEach(button => {
    button.addEventListener('click', () => requestPurchase(Number(button.dataset.buyService)));
  });
}

function isAdmin() {
  const user = getCurrentUser();
  return !!user && user.role === 'admin';
}

async function persistContent() {
  const result = await saveSiteContent();
  renderCenterConfig();
  renderAdminPanels();
  if (result !== 'ok') {
    toastError('No se pudo guardar el contenido en la nube. Comprueba tu conexión a internet e inténtalo de nuevo.');
  }
  return result;
}

/* ==========================================================
   CONTENIDO PREMIUM (ADMIN)
   Publicaciones, anuncios o recursos exclusivos para clientes Premium.
   ========================================================== */
function renderAdminPremium() {
  const container = document.getElementById('admin-premium-content');
  if (!container) return;
  const premium = mfitData.premium || [];
  container.innerHTML = premium.length ? premium.map(item => {
    const specific = item.audience && item.audience !== 'all'
      ? state.users.find(u => String(u.id) === String(item.audience))
      : null;
    const recipient = specific ? `<span class="premium-admin-recipient">★ Para: ${specific.name}</span>` : '<span class="premium-admin-recipient">Todos los Premium</span>';
    return `
    <div class="admin-item premium-admin-item">
      <strong>${item.title}</strong>
      <small>${item.type || 'Publicación'} · ${item.date ? new Date(item.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Sin fecha'} · ${recipient}</small>
      <p class="premium-admin-preview">${item.content}</p>
      <div class="admin-item-actions">
        <button type="button" class="icon-delete" data-delete-premium="${item.id}" aria-label="Eliminar publicación Premium" title="Eliminar publicación">×</button>
      </div>
    </div>`;
  }).join('') : '<div class="empty-state">Todavía no hay contenido Premium publicado.</div>';

  container.querySelectorAll('[data-delete-premium]').forEach(button => button.addEventListener('click', async () => {
    const confirmed = await showConfirm('¿Eliminar esta publicación Premium? Los clientes dejarán de verla.', { title: 'Eliminar contenido Premium', icon: '🗑️', confirmText: 'Eliminar' });
    if (!confirmed) return;
    const removedId = button.dataset.deletePremium;
    mfitData.premium = (mfitData.premium || []).filter(item => String(item.id) !== String(removedId));
    const result = await removePremiumPost(removedId);
    if (result !== 'ok') {
      // Si no se confirmó la eliminación en la nube, volvemos a la última versión real.
      await refreshFromCloud();
      renderAdminPanels();
      renderProfile();
      return;
    }
    renderProfile();
    toastInfo('Contenido Premium eliminado.');
  }));
}

/* Rellena el desplegable de clientes Premium del formulario admin */
function populatePremiumClientSelect() {
  const sel = document.getElementById('premium-client');
  if (!sel) return;
  const clients = state.users.filter(item => item.role !== 'admin' && item.isPremium);
  sel.innerHTML = '<option value="">Selecciona un cliente Premium…</option>' +
    clients.map(client => `<option value="${client.id}">${client.name} · ${client.email}</option>`).join('');
}

/* Muestra/oculta el selector de cliente según la audiencia elegida */
function updatePremiumAudienceFields() {
  const audienceSel = document.getElementById('premium-audience');
  const group = document.getElementById('premium-client-group');
  if (!audienceSel || !group) return;
  const isClient = audienceSel.value === 'client';
  group.classList.toggle('hidden', !isClient);
  if (isClient) populatePremiumClientSelect();
}

async function handleAdminPremiumSubmit(event) {
  event.preventDefault();
  if (!isAdmin()) return;
  const title = document.getElementById('premium-title').value.trim();
  const content = document.getElementById('premium-content').value.trim();
  const type = document.getElementById('premium-type').value;
  if (!title || !content) return;
  const form = document.getElementById('admin-premium-form');
  const imageInput = document.getElementById('premium-image');
  let imageUrl = null;
  const file = imageInput && imageInput.files && imageInput.files[0];
  if (file) {
    try {
      imageUrl = await uploadImage(file);
    } catch (err) {
      console.error('Error subiendo imagen premium:', err);
      toastError('No se pudo subir la imagen. Inténtalo de nuevo.');
      return;
    }
  }

  mfitData.premium = mfitData.premium || [];
  const audienceSel = document.getElementById('premium-audience');
  const clientSel = document.getElementById('premium-client');
  const wantsClient = (audienceSel && audienceSel.value) === 'client';
  if (wantsClient && (!clientSel || !clientSel.value)) {
    toastWarning('Selecciona el cliente Premium destinatario de esta publicación.');
    return;
  }
  const audience = wantsClient && clientSel ? clientSel.value : 'all';

  // Parte de la última versión guardada en la nube para no pisar contenido
  // publicado desde otra pestaña o dispositivo mientras teníamos la app abierta.
  await refreshFromCloud();
  if (state.loadFailed) {
    toastError('No se puede publicar porque no se pudieron cargar los datos de la nube. Refresca la página e inténtalo de nuevo.');
    return;
  }

  const newItem = {
    id: Date.now(),
    type,
    title,
    content,
    imageUrl: imageUrl || null,
    audience,
    date: new Date().toISOString().slice(0, 10)
  };
  mfitData.premium = mfitData.premium || [];
  mfitData.premium.unshift(newItem);

  const result = await addPremiumPost(newItem);
  if (result !== 'ok') {
    // El anuncio NO se guardó: lo quitamos de la vista local y dejamos el
    // texto en el formulario para que puedas reintentarlo sin reescribirlo.
    mfitData.premium = (mfitData.premium || []).filter(item => String(item.id) !== String(newItem.id));
    renderAdminPanels();
    renderProfile();
    toastWarning('No se pudo publicar. Tu anuncio sigue escrito en el formulario; revisa tu conexión y pulsa "Publicar" de nuevo.', { title: 'No publicado', duration: 7000 });
    return;
  }
  form.reset();
  const preview = document.getElementById('premium-image-preview');
  if (preview) {
    preview.style.display = 'none';
    preview.src = '';
  }
  renderProfile();
  toastSuccess('Contenido Premium publicado. Ya está disponible en la Zona Premium de tus clientes ★');
}

function renderAdminContent() {
  if (!isAdmin()) return;
  renderAttendancePanel();
  renderAdminPremium();
  const consultasContainer = document.getElementById('admin-consultas');
  if (consultasContainer) {
    const consultas = mfitData.consultas || [];
    consultasContainer.innerHTML = consultas.length ? consultas.map(item => `
      <details class="contact-message ${item.estado === 'nueva' ? 'is-new' : ''}">
        <summary><strong>${item.nombre}</strong><small>${item.email} · ${item.estado === 'nueva' ? 'Nuevo' : 'Leído'}</small></summary>
        <div class="contact-message-body"><p>${item.mensaje}</p><small>${item.fecha}</small><div class="contact-message-actions"><button type="button" class="btn btn-secondary btn-sm" data-read-consulta="${item.id}">${item.estado === 'nueva' ? 'Marcar como leído' : 'Ya leído'}</button><button type="button" class="btn btn-secondary btn-sm" data-delete-consulta="${item.id}">Eliminar</button></div></div>
      </details>
    `).join('') : '<div class="empty-state">No hay mensajes de contacto.</div>';
    consultasContainer.querySelectorAll('[data-read-consulta]').forEach(button => button.addEventListener('click', async () => {
      const item = mfitData.consultas.find(consulta => String(consulta.id) === button.dataset.readConsulta);
      if (item) item.estado = 'leída';
      await updateConsultaDocument(String(item.id), { estado: item.estado });
      renderAdminContent();
    }));
    consultasContainer.querySelectorAll('[data-delete-consulta]').forEach(button => button.addEventListener('click', async () => {
      mfitData.consultas = mfitData.consultas.filter(item => String(item.id) !== button.dataset.deleteConsulta);
      await deleteConsultaDocument(String(button.dataset.deleteConsulta));
      renderAdminContent();
    }));
  }
  const info = mfitData.info;
  ['name', 'description', 'address', 'phone', 'whatsapp', 'email'].forEach(key => {
    const input = document.getElementById(`info-${key}`);
    if (input) input.value = info[key] || '';
  });
  const heroInput = document.getElementById('info-hero-image');
  if (heroInput) heroInput.value = info.heroImage || '';

  const activities = document.getElementById('admin-activities');
  if (activities) activities.innerHTML = state.activities.map(item => `<div class="admin-item"><strong>${item.title}</strong><small>${new Date(item.date).toLocaleDateString('es-ES')} · ${item.time} · ${item.coach}</small><div class="admin-item-actions"><button type="button" class="btn btn-secondary btn-sm" data-edit-activity="${item.id}">Editar</button><button type="button" class="btn btn-secondary btn-sm" data-delete-activity="${item.id}">Eliminar</button></div></div>`).join('') || '<div class="empty-state">No hay actividades.</div>';

  const centerServices = document.getElementById('admin-center-services');
  if (centerServices) centerServices.innerHTML = mfitData.services.map(item => `<div class="admin-item"><strong>${item.name}</strong><small>${item.desc}</small><div class="admin-item-actions"><button type="button" class="btn btn-secondary btn-sm" data-edit-center-service="${item.id}">Editar</button><button type="button" class="btn btn-secondary btn-sm" data-delete-center-service="${item.id}">Eliminar</button></div></div>`).join('');

  const team = document.getElementById('admin-team');
  if (team) team.innerHTML = mfitData.team.map(item => `<div class="admin-item"><strong>${item.name}</strong><small>${item.role} · ${item.spec}</small><div class="admin-item-actions"><button type="button" class="btn btn-secondary btn-sm" data-edit-team="${item.id}">Editar</button><button type="button" class="btn btn-secondary btn-sm" data-delete-team="${item.id}">Eliminar</button></div></div>`).join('');

  const galleryNews = document.getElementById('admin-gallery-news');
  if (galleryNews) galleryNews.innerHTML = [
    ...mfitData.gallery.map(item => `<div class="admin-item"><strong>Foto: ${item.caption}</strong><button type="button" class="btn btn-secondary btn-sm" data-delete-gallery="${item.id}">Eliminar</button></div>`),
    ...mfitData.news.map(item => `<div class="admin-item"><strong>Novedad: ${item.title}</strong><button type="button" class="btn btn-secondary btn-sm" data-delete-news="${item.id}">Eliminar</button></div>`)
  ].join('') || '<div class="empty-state">No hay contenido.</div>';

  const tracking = document.getElementById('admin-client-tracking');
  if (tracking) {
    const clients = state.users.filter(item => item.role === 'cliente');
    // Recordar qué fichas estaban abiertas para que no se cierren al dar de baja/alta
    const openClientIds = new Set(Array.from(tracking.querySelectorAll('details.client-file[open]')).map(el => el.dataset.clientId));
    tracking.innerHTML = clients.length ? clients.map(client => {
      const recommendation = calculateProfileRecommendation(client.profile);
      const profile = client.profile || {};
      const history = client.profileHistory || [];
      const initial = history[history.length - 1] || profile;
      const latest = history[0] || profile;
      const progressRows = history.length ? history.map(entry => `<tr><td>${new Date(entry.recordedAt).toLocaleDateString('es-ES')}</td><td>${entry.weight || '-'} kg</td><td>${entry.waist || '-'} cm</td><td>${entry.hip || '-'} cm</td><td>${entry.goal || '-'}</td></tr>`).join('') : '<tr><td colspan="5">Sin registros de evolución todavía.</td></tr>';
      const measurementLabels = { waist: 'Cintura', hip: 'Cadera', chest: 'Pecho', arm: 'Brazo', thigh: 'Muslo' };
      const measurements = Object.entries(measurementLabels).filter(([key]) => profile[key]).map(([key, label]) => `<div class="measurement-card"><span>${label}</span><strong>${profile[key]} <small>cm</small></strong></div>`).join('') || '<span class="client-muted">Sin medidas adicionales</span>';
      const requestedServices = state.purchases.filter(item => item.userId === client.id);
      const servicesText = requestedServices.length ? requestedServices.map(item => `<span class="client-badge">${item.serviceName} · ${item.status}</span>`).join('') : '<span class="client-muted">Ningún bono solicitado</span>';
      const clientIsBaja = isUserBaja(client);
      const clientActionsHtml = `<div class="client-actions">${userStatusActionsHtml(client)}</div>`;
      return `<details class="client-file${clientIsBaja ? ' is-baja' : ''}" data-client-id="${client.id}"${openClientIds.has(String(client.id)) ? ' open' : ''}><summary><span class="client-avatar">${(client.name || 'Cliente').split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase()}</span><span class="client-summary-main"><span class="client-name-row"><strong>${client.name}</strong>${clientIsBaja ? userStatusPillHtml(client) : ''}</span><small>${client.email}</small></span><span class="client-summary-goal">${profile.goal || 'Sin objetivo'}</span><span class="client-chevron">⌄</span></summary><div class="client-file-body">${profile.weight ? `<div class="client-metrics"><div><span>Peso</span><strong>${profile.weight} <small>kg</small></strong></div><div><span>Altura</span><strong>${profile.height} <small>cm</small></strong></div><div><span>IMC</span><strong>${recommendation?.bmi}</strong></div><div><span>Calorías</span><strong>${recommendation?.calories} <small>kcal</small></strong></div></div><div class="client-block"><h4>Medidas corporales</h4><div class="measurement-grid">${measurements}</div></div>` : '<div class="client-empty">El cliente todavía no ha completado sus medidas.</div>'}<div class="evolution-summary"><div><span>Cómo empezó</span><strong>${initial.weight || '-'} kg · ${initial.waist || '-'} cm cintura</strong></div><div><span>Cómo va avanzando</span><strong>${latest.weight || '-'} kg · ${latest.waist || '-'} cm cintura</strong></div></div><div class="evolution-table-wrap"><table class="evolution-table"><thead><tr><th>Fecha</th><th>Peso</th><th>Cintura</th><th>Cadera</th><th>Objetivo</th></tr></thead><tbody>${progressRows}</tbody></table></div><div class="client-block"><h4>Bonos solicitados</h4><div class="client-badges">${servicesText}</div></div>${profile.notes ? `<div class="client-note"><strong>Notas</strong><span>${profile.notes}</span></div>` : ''}${clientActionsHtml}</div></details>`;
    }).join('') : '<div class="empty-state">Todavía no hay clientes registrados.</div>';
  }

  document.querySelectorAll('[data-delete-activity]').forEach(button => button.addEventListener('click', () => {
    state.activities = state.activities.filter(item => String(item.id) !== button.dataset.deleteActivity);
    deleteActivityDocument(button.dataset.deleteActivity);
    renderCalendar();
    renderSelectedDay();
  }));

  // Event listeners para botones de editar
  document.querySelectorAll('[data-edit-activity]').forEach(button => button.addEventListener('click', () => {
    const activity = state.activities.find(item => String(item.id) === button.dataset.editActivity);
    if (activity) {
      document.getElementById('edit-activity-id').value = activity.id;
      document.getElementById('edit-activity-title').value = activity.title;
      document.getElementById('edit-activity-date').value = new Date(activity.date).toISOString().split('T')[0];
      document.getElementById('edit-activity-time').value = activity.time;
      document.getElementById('edit-activity-coach').value = activity.coach;
      document.getElementById('edit-activity-duration').value = activity.duration;
      document.getElementById('edit-activity-capacity').value = activity.capacity;
      document.getElementById('edit-activity-description').value = activity.description;
      document.getElementById('edit-activity-modal').classList.remove('hidden');
    }
  }));
  document.querySelectorAll('[data-delete-center-service]').forEach(button => button.addEventListener('click', () => {
    mfitData.services = mfitData.services.filter(item => String(item.id) !== button.dataset.deleteCenterService);
    persistContent();
  }));

document.querySelectorAll('[data-edit-center-service]').forEach(button => button.addEventListener('click', () => {
  const service = mfitData.services.find(item => String(item.id) === button.dataset.editCenterService);
  if (service) {
    const modal = document.getElementById('edit-service-modal');
    modal.dataset.entityType = 'center'; // Identifica que es un servicio del centro

    document.getElementById('edit-service-id').value = service.id;
    document.getElementById('edit-service-name').value = service.name;
    document.getElementById('edit-service-type').value = service.type || 'Servicio';
    document.getElementById('edit-service-description').value = service.desc || '';
    modal.classList.remove('hidden');
  }
}));
  document.querySelectorAll('[data-delete-team]').forEach(button => button.addEventListener('click', () => {
    mfitData.team = mfitData.team.filter(item => String(item.id) !== button.dataset.deleteTeam);
    persistContent();
  }));

  document.querySelectorAll('[data-edit-team]').forEach(button => button.addEventListener('click', () => {
    const teamMember = mfitData.team.find(item => String(item.id) === button.dataset.editTeam);
    if (teamMember) {
      document.getElementById('edit-service-id').value = teamMember.id;
      document.getElementById('edit-service-name').value = teamMember.name;
      document.getElementById('edit-service-type').value = teamMember.role;
      document.getElementById('edit-team-role').value = teamMember.role;
      document.getElementById('edit-service-description').value = `${teamMember.spec} - ${teamMember.bio}`;
      document.getElementById('edit-service-modal').classList.remove('hidden');
    }
  }));
  document.querySelectorAll('[data-delete-gallery]').forEach(button => button.addEventListener('click', () => {
    mfitData.gallery = mfitData.gallery.filter(item => String(item.id) !== button.dataset.deleteGallery);
    persistContent();
  }));
  document.querySelectorAll('[data-delete-news]').forEach(button => button.addEventListener('click', () => {
    mfitData.news = mfitData.news.filter(item => String(item.id) !== button.dataset.deleteNews);
    persistContent();
  }));
}

async function handleAdminInfoSubmit(event) {
  event.preventDefault();
  ['name', 'description', 'address', 'phone', 'whatsapp', 'email'].forEach(key => {
    mfitData.info[key] = document.getElementById(`info-${key}`).value.trim();
  });
  const file = document.getElementById('info-hero-file').files[0];
  mfitData.info.heroImage = file ? await uploadImage(file, 'hero') : document.getElementById('info-hero-image').value.trim();
  await persistContent();
  toastSuccess('Contenido guardado correctamente.');
}

async function handleAdminHomeSubmit(event) {
  event.preventDefault();
  if (!mfitData.info.home) mfitData.info.home = {};

  mfitData.info.home.title = document.getElementById('home-title').value.trim();
  mfitData.info.home.subtitle = document.getElementById('home-subtitle').value.trim();
  mfitData.info.home.cta1 = document.getElementById('home-cta1').value.trim();
  mfitData.info.home.cta2 = document.getElementById('home-cta2').value.trim();
  mfitData.info.home.proof = document.getElementById('home-proof').value.trim();
  mfitData.info.home.value1Title = document.getElementById('home-value1-title').value.trim();
  mfitData.info.home.value1Desc = document.getElementById('home-value1-desc').value.trim();
  mfitData.info.home.value2Title = document.getElementById('home-value2-title').value.trim();
  mfitData.info.home.value2Desc = document.getElementById('home-value2-desc').value.trim();
  mfitData.info.home.value3Title = document.getElementById('home-value3-title').value.trim();
  mfitData.info.home.value3Desc = document.getElementById('home-value3-desc').value.trim();
  mfitData.info.home.ctaTitle = document.getElementById('home-cta-title').value.trim();
  mfitData.info.home.ctaButton = document.getElementById('home-cta-button').value.trim();

  await persistContent();
  renderHome();
  toastSuccess('Página de inicio actualizada correctamente.');
}

function loadHomeFormData() {
  const homeData = mfitData.info.home || {};
  document.getElementById('home-title').value = homeData.title || 'Tu mejor versión empieza hoy.';
  document.getElementById('home-subtitle').value = homeData.subtitle || 'Entrenamiento funcional, readaptación y acompañamiento real en un espacio diseñado para avanzar.';
  document.getElementById('home-cta1').value = homeData.cta1 || 'Ver calendario';
  document.getElementById('home-cta2').value = homeData.cta2 || 'Conocer MIFIT';
  document.getElementById('home-proof').value = homeData.proof || '+500 clientes activos en nuestra comunidad';
  document.getElementById('home-value1-title').value = homeData.value1Title || 'Entrenamiento Funcional';
  document.getElementById('home-value1-desc').value = homeData.value1Desc || 'Rutinas adaptadas a tu nivel con supervisión constante.';
  document.getElementById('home-value2-title').value = homeData.value2Title || 'Readaptación Física';
  document.getElementById('home-value2-desc').value = homeData.value2Desc || 'Recuperación guiada por profesionales especializados.';
  document.getElementById('home-value3-title').value = homeData.value3Title || 'Comunidad Activa';
  document.getElementById('home-value3-desc').value = homeData.value3Desc || 'Entrena en un ambiente motivador y seguro.';
  document.getElementById('home-cta-title').value = homeData.ctaTitle || '¿Listo para empezar tu transformación?';
  document.getElementById('home-cta-button').value = homeData.ctaButton || 'Únete ahora';
}

async function handleAdminActivitySubmit(event) {
  event.preventDefault();
  const date = document.getElementById('activity-date').value;
  const time = document.getElementById('activity-time').value;
  const recurrence = document.getElementById('activity-recurrence').value;
  const startDate = new Date(`${date}T${time}:00`);
  const weekdays = [...document.querySelectorAll('input[name="recurrence-day"]:checked')].map(input => Number(input.value));
  const weeks = recurrence === 'weekly' ? Number(document.getElementById('activity-weeks').value) : 1;
  const dates = [];

  if (recurrence === 'weekly') {
    const selectedDays = weekdays.length ? weekdays : [((startDate.getDay() + 6) % 7) + 1 === 7 ? 0 : ((startDate.getDay() + 6) % 7) + 1];
    for (let week = 0; week < weeks; week += 1) {
      selectedDays.forEach(day => {
        const daysFromStart = (day - startDate.getDay() + 7) % 7;
        const activityDate = new Date(startDate);
        activityDate.setDate(startDate.getDate() + daysFromStart + week * 7);
        dates.push(activityDate);
      });
    }
  } else {
    dates.push(startDate);
  }

  const activityData = {
    title: document.getElementById('activity-title').value.trim(),
    coach: document.getElementById('activity-coach').value.trim(),
    time,
    duration: Number(document.getElementById('activity-duration').value),
    capacity: Number(document.getElementById('activity-capacity').value),
    description: document.getElementById('activity-description').value.trim()
  };
  dates.forEach((activityDate, index) => {
    state.activities.push({
      id: Date.now() + index,
      ...activityData,
      booked: 0,
      date: activityDate.toISOString(),
      recurrence: recurrence === 'weekly' ? { frequency: 'weekly', weekdays, weeks } : null,
      reservations: []
    });
  });
  // Persistencia aislada: cada actividad se guarda en /activities.
  const createdActivities = state.activities.slice(-dates.length);
  await Promise.all(createdActivities.map(activity => createActivityDocument(activity)));
  event.target.reset();
  renderCalendar();
  renderSelectedDay();
  renderAdminPanels();
}

async function handleAdminCenterServiceSubmit(event) {
  event.preventDefault();
  const file = document.getElementById('center-service-file').files[0];
  const image = file ? await uploadImage(file, 'services') : document.getElementById('center-service-image').value.trim();
  if (!image) return;
  mfitData.services.push({ id: Date.now(), name: document.getElementById('center-service-name').value.trim(), desc: document.getElementById('center-service-desc').value.trim(), image, active: true });
  event.target.reset();
  persistContent();
}

async function handleAdminTeamSubmit(event) {
  event.preventDefault();
  const file = document.getElementById('team-file').files[0];
  const image = file ? await uploadImage(file, 'team') : document.getElementById('team-image').value.trim();
  if (!image) return;
  mfitData.team.push({ id: Date.now(), name: document.getElementById('team-name').value.trim(), role: document.getElementById('team-role').value.trim(), spec: document.getElementById('team-spec').value.trim(), bio: document.getElementById('team-bio').value.trim(), image, active: true });
  event.target.reset();
  persistContent();
  toastSuccess('¡Nuevo entrenador añadido al equipo con éxito!');

}

async function handleAdminGallerySubmit(event) {
  event.preventDefault();

  // Captura el archivo seleccionado desde el ordenador
  const file = document.getElementById('gallery-file').files[0];

  // Sube la imagen usando tu función y obtiene la URL
  const url = file ? await uploadImage(file, 'gallery') : document.getElementById('gallery-url').value.trim();

  if (!url) return;

  // Guarda los datos en el sistema
  mfitData.gallery.push({
    id: Date.now(),
    url,
    caption: document.getElementById('gallery-caption').value.trim(),
    active: true
  });

  event.target.reset();
  persistContent();
  toastSuccess('¡Nueva foto añadida a la galería con éxito!');
}

async function uploadImage(file) {
  // Pega aquí la clave que copiaste de ImgBB
  const API_KEY = 'ebd3acdf48c56b0fbdeb4a25cf89837c';

  if (!file) return null;

  const formData = new FormData();
  formData.append('image', file);

  try {
    // Petición POST a la API gratuita de ImgBB
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      // Retorna la URL directa de la imagen alojada gratis
      return data.data.url;
    } else {
      console.error('Error de ImgBB:', data);
      alert('No se pudo subir la imagen.');
      return null;
    }
  } catch (error) {
    console.error('Error de conexión con ImgBB:', error);
    alert('Error al conectar con el servidor de imágenes.');
    return null;
  }
}

async function handleAdminNewsSubmit(event) {
  event.preventDefault();

  // Obtener los campos del formulario
  const title = document.getElementById('news-title').value.trim();
  const desc = document.getElementById('news-desc').value.trim();

  // Generar la fecha actual automáticamente (Ejemplo: "21/09/2026")
  const date = new Date().toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // Crear la nueva entrada en la lista de novedades
  mfitData.news.push({
    id: Date.now(),
    title,
    date,
    desc,
    active: true,
    createdAt: new Date().toISOString()
  });

  // Limpiar el formulario y guardar
  event.target.reset();
  await persistContent();
  toastSuccess('Anuncio publicado correctamente.');
}

function renderAdminPanels() {
  const adminTab = document.querySelector('.admin-only-tab');
  const allowed = isAdmin();
  if (adminTab) adminTab.style.display = allowed ? 'inline-block' : 'none';
  const adminContent = document.getElementById('tab-admin');
  if (!allowed && adminContent) {
    adminContent.classList.remove('active');
    const infoTab = document.querySelector('[data-tab="info"]');
    if (infoTab) infoTab.click();
  }

  const purchasesContainer = document.getElementById('admin-purchases');
  const servicesContainer = document.getElementById('admin-services');
  const usersContainer = document.getElementById('admin-users');
  const historyContainer = document.getElementById('admin-purchase-history');
  const activePurchasesContainer = document.getElementById('admin-active-purchases');

  if (!purchasesContainer || !servicesContainer || !usersContainer) return;

  if (!allowed) {
    purchasesContainer.innerHTML = '<div class="empty-state">Inicia sesión como administrador para gestionar compras.</div>';
    servicesContainer.innerHTML = '<div class="empty-state">Sin acceso.</div>';
    usersContainer.innerHTML = '<div class="empty-state">Sin acceso.</div>';
    if (historyContainer) historyContainer.innerHTML = '<div class="empty-state">Sin acceso.</div>';
    if (activePurchasesContainer) activePurchasesContainer.innerHTML = '<div class="empty-state">Sin acceso.</div>';
    return;
  }

  const pendingPurchases = state.purchases.filter(item => item.status === 'pendiente');
  purchasesContainer.innerHTML = pendingPurchases.length ? pendingPurchases.map(item => `
    <div class="purchase-item">
      <strong>${item.serviceName}</strong>
      <small>${state.users.find(user => user.id === item.userId)?.name || 'Usuario'} · ${new Date(item.date).toLocaleDateString('es-ES')}</small>
      <span class="alert-badge ${item.status === 'aprobado' ? 'approved' : 'pending'}">${item.status}</span>
      ${item.status === 'pendiente' ? `<button type="button" class="btn btn-success btn-sm" data-approve-purchase="${item.id}">Aprobar</button>` : ''}
    </div>
  `).join('') : '<div class="empty-state">No hay compras pendientes.</div>';
  const activePurchases = state.purchases.filter(item => item.status === 'aprobado');
  if (activePurchasesContainer) {
    activePurchasesContainer.innerHTML = activePurchases.length ? activePurchases.map(item => '<div class="purchase-item"><strong>' + item.serviceName + '</strong><small>' + (state.users.find(user => user.id === item.userId)?.name || 'Usuario') + ' · ' + getPurchaseAvailability(item) + '</small><span class="alert-badge ' + purchaseStatusClass(getPurchaseStatus(item)) + '">' + getPurchaseStatus(item) + '</span><button type="button" class="icon-delete" data-delete-purchase="' + item.id + '" aria-label="Retirar bono" title="Retirar del listado">×</button></div>').join('') : '<div class="empty-state">No hay bonos aprobados.</div>';
  }

  servicesContainer.innerHTML = state.services.map(item => `
    <div class="admin-item">
      <strong>${item.name}</strong>
      <small>${item.type} · ${formatPrice(item.price)}</small>
      <div class="admin-item-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-edit-service="${item.id}">Editar</button>
        <button type="button" class="btn btn-secondary btn-sm" data-delete-service="${item.id}">Eliminar</button>
      </div>
    </div>
  `).join('');

  usersContainer.innerHTML = state.users.map(item => `
    <div class="user-item${item.isPremium ? ' is-premium' : ''}${isUserBaja(item) ? ' is-baja' : ''}">
      <strong>${item.name}${item.isPremium ? premiumBadgeHtml() : ''}</strong>
      <small>${item.email} · ${item.role}</small>
      ${item.role === 'cliente' ? userStatusPillHtml(item) : ''}
      ${userBajaSinceText(item) ? `<small>${userBajaSinceText(item)}</small>` : ''}
      <div class="admin-item-actions">
        <button type="button" class="btn btn-sm ${item.isPremium ? 'premium-toggle-active' : 'premium-toggle'}" data-toggle-premium="${item.id}" title="${item.isPremium ? 'Quitar Premium' : 'Marcar como Premium'}">${item.isPremium ? '★ Premium' : '☆ Hacer Premium'}</button>
        <button type="button" class="btn btn-secondary btn-sm" data-edit-user="${item.id}">Editar</button>
        ${userStatusActionsHtml(item)}
      </div>
    </div>
  `).join('');
  if (historyContainer) {
    historyContainer.innerHTML = state.purchaseHistory.length ? state.purchaseHistory.slice().reverse().map(item => `<div class="admin-item"><strong>${item.serviceName}</strong><small>${state.users.find(user => user.id === item.userId)?.name || 'Usuario'} · Aprobado el ${new Date(item.approvedAt || item.date).toLocaleDateString('es-ES')}</small><span class="alert-badge approved">Archivado</span><button type="button" class="icon-delete" data-delete-history="${item.id}" aria-label="Eliminar transacción histórica" title="Eliminar del histórico">×</button></div>`).join('') : '<div class="empty-state">Todavía no hay transacciones archivadas.</div>';
  }
  renderAdminContent();

  purchasesContainer.querySelectorAll('[data-approve-purchase]').forEach(button => {
    button.addEventListener('click', () => {
      const purchaseId = Number(button.dataset.approvePurchase);
      const purchase = state.purchases.find(item => item.id === purchaseId);
      if (purchase) {
        purchase.status = 'aprobado';
        purchase.approvedAt = new Date().toISOString();
        purchase.approvedBy = getCurrentUser()?.id || null;
        purchase.activatedAt = purchase.approvedAt;
        if (purchase.billingType === 'sessions') purchase.remainingSessions = purchase.sessions;
        if (purchase.billingType === 'time') {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + (purchase.durationDays || 30));
          purchase.expiresAt = expiresAt.toISOString();
        }
        state.purchaseHistory.push({ ...purchase, event: 'approved', archivedAt: new Date().toISOString() });
        // Persistencia aislada: se aprueba la compra del cliente y se archiva en su colección.
        updatePurchaseDocument(String(purchase.id), {
          status: purchase.status,
          approvedAt: purchase.approvedAt,
          approvedBy: purchase.approvedBy,
          activatedAt: purchase.activatedAt,
          remainingSessions: purchase.remainingSessions,
          expiresAt: purchase.expiresAt
        });
        addPurchaseHistoryDocument({ ...purchase, event: 'approved', archivedAt: new Date().toISOString() });
        renderAdminPanels();
        renderProfile();
      }
    });
  });

  activePurchasesContainer?.querySelectorAll('[data-delete-purchase]').forEach(button => {
    button.addEventListener('click', async () => {
      const purchase = state.purchases.find(item => String(item.id) === button.dataset.deletePurchase);
      if (!purchase) return;
      const confirmed = await showConfirm('¿Retirar este bono del listado activo? El histórico se conservará.', { title: 'Retirar bono', icon: '🎫', confirmText: 'Retirar' });
      if (!confirmed) return;
      state.purchases = state.purchases.filter(item => item !== purchase);
      state.purchaseHistory.push({ ...purchase, event: 'removed_from_active', removedAt: new Date().toISOString(), removedBy: getCurrentUser()?.id || null });
      // Escritura aislada: se retira el bono y se conserva en el histórico.
      deletePurchaseDocument(String(purchase.id));
      addPurchaseHistoryDocument({ ...purchase, event: 'removed_from_active', removedAt: new Date().toISOString(), removedBy: getCurrentUser()?.id || null });
      renderAdminPanels();
      renderProfile();
      toastInfo('Bono retirado del listado activo.');
    });
  });

  historyContainer?.querySelectorAll('[data-delete-history]').forEach(button => {
    button.addEventListener('click', async () => {
      const confirmed = await showConfirm('¿Eliminar físicamente esta transacción del histórico?', { title: 'Eliminar transacción', icon: '🗑️', confirmText: 'Eliminar' });
      if (!confirmed) return;
      state.purchaseHistory = state.purchaseHistory.filter(item => String(item.id) !== button.dataset.deleteHistory);
      await deletePurchaseHistoryDocument(String(button.dataset.deleteHistory));
      renderAdminPanels();
      toastInfo('Transacción eliminada del histórico.');
    });
  });

  servicesContainer.querySelectorAll('[data-delete-service]').forEach(button => {
    button.addEventListener('click', () => {
      const id = Number(button.dataset.deleteService);
      state.services = state.services.filter(item => item.id !== id);
      saveSiteContent();
      renderAdminPanels();
      renderBonosList();
      renderProfile();
    });
  });

servicesContainer.querySelectorAll('[data-edit-service]').forEach(button => button.addEventListener('click', () => {
  const service = state.services.find(item => String(item.id) === button.dataset.editService);
  if (service) {
    const modal = document.getElementById('edit-service-modal');
    modal.dataset.entityType = 'bonus'; // Identifica que es un bono/tarifa

    document.getElementById('edit-service-id').value = service.id;
    document.getElementById('edit-service-name').value = service.name;
    document.getElementById('edit-service-type').value = service.type;
    document.getElementById('edit-service-description').value = service.description || '';
    modal.classList.remove('hidden');
  }
}));

  usersContainer.querySelectorAll('[data-toggle-premium]').forEach(button => {
    button.addEventListener('click', () => toggleUserPremium(button.dataset.togglePremium));
  });

  usersContainer.querySelectorAll('[data-edit-user]').forEach(button => button.addEventListener('click', () => {
    const user = state.users.find(item => String(item.id) === button.dataset.editUser);
    if (user) {
      document.getElementById('edit-user-id').value = user.id;
      document.getElementById('edit-user-name').value = user.name;
      document.getElementById('edit-user-email').value = user.email;
      document.getElementById('edit-user-role').value = user.role;
      document.getElementById('edit-user-modal').classList.remove('hidden');
    }
  }));

  // --- NUEVA LÓGICA: Llenar el desplegable de clases vinculadas al crear bonos ---
  const linkedActivitySelect = document.getElementById('service-linked-activity');
  if (linkedActivitySelect && state.activities) {
    const uniqueActivities = [...new Set(state.activities.map(a => a.title))];
    linkedActivitySelect.innerHTML = '<option value="">Todas las clases (Bono General)</option>' +
      uniqueActivities.map(title => `<option value="${title}">${title}</option>`).join('');
  }
}

function handleAdminServiceSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('service-name').value.trim();
  const type = document.getElementById('service-type').value.trim();
  const price = Number(document.getElementById('service-price').value);
  const billingType = document.getElementById('service-billing-type').value;
  const sessions = Number(document.getElementById('service-sessions').value);
  const durationDays = Number(document.getElementById('service-duration-days').value);

  // NUEVO: Capturar la clase vinculada
  const linkedActivitySelect = document.getElementById('service-linked-activity');
  const linkedActivity = linkedActivitySelect ? linkedActivitySelect.value : '';

  if (!name || !type || !price) return;

  state.services.push({
    id: Date.now(),
    name,
    type,
    price,
    billingType,
    sessions: billingType === 'sessions' ? sessions : 0,
    durationDays: billingType === 'time' ? durationDays : 0,
    linkedActivity: linkedActivity, // Guardamos la vinculación en el servicio
    description: linkedActivity ? `Válido solo para ${linkedActivity}` : `${type} disponible en MIFIT`,
    active: true
  });
  saveSiteContent();
  document.getElementById('admin-service-form').reset();
  renderAdminPanels();
  renderBonosList();
  renderProfile();
}

async function handleAdminUserSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('user-name').value.trim();
  const email = document.getElementById('user-email').value.trim();
  const role = document.getElementById('user-role').value;
  const password = document.getElementById('user-password').value;

  if (!name || !email || !password) return;

  try {
    // Creación mediante la app secundaria para no cerrar la sesión del admin actual
    const credentials = await secondaryAuth.createUserWithEmailAndPassword(email, password);
    await credentials.user.updateProfile({ displayName: name });

    state.users.push({
      id: credentials.user.uid,
      name,
      email,
      role,
      profile: {},
      profileHistory: []
    });

    await db.collection('users').doc(credentials.user.uid).set({
      name,
      email,
      role,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await secondaryAuth.signOut();
    document.getElementById('admin-user-form').reset();
    renderAdminPanels();
    toastSuccess('Usuario creado correctamente.');
  } catch (error) {
    console.error(error);
    toastError(error.code === 'auth/email-already-in-use' ? 'Ese email ya está registrado.' : 'No se pudo crear el usuario.');
  }
}

// Funciones de edición
async function handleEditActivitySubmit(event) {
  event.preventDefault();
  const id = document.getElementById('edit-activity-id').value;
  const activity = state.activities.find(item => String(item.id) === id);
  if (!activity) return;

  activity.title = document.getElementById('edit-activity-title').value.trim();
  activity.date = new Date(document.getElementById('edit-activity-date').value + 'T' + document.getElementById('edit-activity-time').value).toISOString();
  activity.time = document.getElementById('edit-activity-time').value;
  activity.coach = document.getElementById('edit-activity-coach').value.trim();
  activity.duration = Number(document.getElementById('edit-activity-duration').value);
  activity.capacity = Number(document.getElementById('edit-activity-capacity').value);
  activity.description = document.getElementById('edit-activity-description').value.trim();

  await updateActivityDocument(String(activity.id), activity);
  document.getElementById('edit-activity-modal').classList.add('hidden');
  renderCalendar();
  renderSelectedDay();
  renderAdminPanels();
  toastSuccess('Actividad actualizada correctamente.');
}

async function handleEditServiceSubmit(event) {
  event.preventDefault();
  const id = document.getElementById('edit-service-id')?.value;
  const modal = document.getElementById('edit-service-modal');
  const entityType = modal?.dataset.entityType;

  if (!id) {
    console.error('No se encontró el ID del servicio a editar.');
    return;
  }

  // 1. Edición de Servicios del Centro
  if (entityType === 'center') {
    const centerService = mfitData.services.find(item => String(item.id) === String(id));
    if (centerService) {
      centerService.name = document.getElementById('edit-service-name').value.trim();
      centerService.desc = document.getElementById('edit-service-description').value.trim();

      await persistContent();
      modal.classList.add('hidden');
      renderAdminPanels();
      renderCenterConfig();
      toastSuccess('Servicio del centro actualizado correctamente.');
      return;
    }
  }

  // 2. Edición de Bonos / Tarifas
  if (entityType === 'bonus' || !entityType) {
    const bonusService = state.services.find(item => String(item.id) === String(id));
    if (bonusService) {
      bonusService.name = document.getElementById('edit-service-name').value.trim();
      bonusService.type = document.getElementById('edit-service-type').value.trim();
      bonusService.description = document.getElementById('edit-service-description').value.trim();

      await saveSiteContent();
      modal.classList.add('hidden');
      renderAdminPanels();
      renderBonosList();
      renderProfile();
      toastSuccess('Servicio/Bono actualizado correctamente.');
      return;
    }
  }

  console.warn('No se encontró ningún servicio con el ID:', id);
}

async function handleEditUserSubmit(event) {
  event.preventDefault();
  const id = document.getElementById('edit-user-id').value;
  const user = state.users.find(item => String(item.id) === id);
  if (!user) return;

  user.name = document.getElementById('edit-user-name').value.trim();
  user.email = document.getElementById('edit-user-email').value.trim();
  user.role = document.getElementById('edit-user-role').value;

  await db.collection('users').doc(id).set({
    name: user.name,
    email: user.email,
    role: user.role,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  document.getElementById('edit-user-modal').classList.add('hidden');
  renderAdminPanels();
  renderHeader();
  toastSuccess('Usuario actualizado correctamente.');
}

async function handleContactFormSubmit(event) {
  event.preventDefault();
  const nombre = document.getElementById('contact-nombre').value.trim();
  const contacto = document.getElementById('contact-email').value.trim();
  const mensaje = document.getElementById('contact-mensaje').value.trim();
  const error = document.getElementById('contact-email-error');
  const feedback = document.getElementById('contact-feedback');

  error.textContent = '';
  feedback.className = 'form-feedback';

  if (!nombre || !contacto || !mensaje) {
    feedback.textContent = 'Completa todos los campos.';
    feedback.classList.add('error');
    return;
  }

  if (contacto.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacto)) {
    error.textContent = 'Email no válido';
    return;
  }

  const consulta = {
    id: Date.now(),
    nombre,
    email: contacto,
    mensaje,
    fecha: new Date().toISOString().slice(0, 16).replace('T', ' '),
    estado: 'nueva'
  };
  mfitData.consultas.unshift(consulta);
  const saved = await createConsultaDocument(consulta);

  if (saved !== 'ok') {
    // No se guardó: quitamos la consulta local para no duplicarla si se reenvía.
    mfitData.consultas = (mfitData.consultas || []).filter(item => String(item.id) !== String(consulta.id));
    feedback.textContent = 'No se pudo enviar el mensaje. Comprueba tu conexión e inténtalo de nuevo.';
    feedback.classList.add('error');
    return;
  }

  feedback.textContent = 'Mensaje enviado correctamente.';
  feedback.classList.add('success');
  document.getElementById('contact-form').reset();
}

/* ==========================================================
   SUBNAVEGACIÓN DEL CENTRO: flechas de desplazamiento (móvil)
   ========================================================== */
function initCenterSubnavScroller() {
  const wrap = document.querySelector('.center-subnav-wrap');
  const nav = wrap?.querySelector('.center-subnav');
  const leftArrow = wrap?.querySelector('[data-subnav-scroll="left"]');
  const rightArrow = wrap?.querySelector('[data-subnav-scroll="right"]');
  if (!nav || !leftArrow || !rightArrow) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const behavior = () => (reduceMotion.matches ? 'auto' : 'smooth');

  // Deshabilita cada flecha cuando ya no hay más contenido hacia ese lado
  const updateArrows = () => {
    const maxScroll = nav.scrollWidth - nav.clientWidth;
    leftArrow.disabled = nav.scrollLeft <= 2;
    rightArrow.disabled = maxScroll <= 2 || nav.scrollLeft >= maxScroll - 2;
  };

  // Avanza un poco más de la mitad de lo visible, de forma gradual
  const scrollStep = direction => {
    nav.scrollBy({ left: direction * Math.max(nav.clientWidth * 0.6, 120), behavior: behavior() });
  };

  leftArrow.addEventListener('click', () => scrollStep(-1));
  rightArrow.addEventListener('click', () => scrollStep(1));
  nav.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);

  // Recalcula cuando aparecen/desaparecen pestañas (Clientes, Premium, Admin) o la vista pasa de oculta a visible
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(updateArrows);
    observer.observe(nav);
    nav.querySelectorAll('.subnav-btn').forEach(button => observer.observe(button));
  }

  // Al pulsar una pestaña, se centra en la barra para que no quede a medias
  nav.querySelectorAll('.subnav-btn').forEach(button => {
    button.addEventListener('click', () => {
      const navRect = nav.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const offset = buttonRect.left - navRect.left - (navRect.width - buttonRect.width) / 2;
      nav.scrollBy({ left: offset, behavior: behavior() });
    });
  });

  updateArrows();
}

function attachEvents() {
  // --- Listeners para Modal de Registro ---
  document.getElementById('register-form')?.addEventListener('submit', handleRegisterSubmit);
  document.getElementById('close-register-modal')?.addEventListener('click', () => {
    document.getElementById('register-modal').classList.add('hidden');
  });
  document.getElementById('register-toggle-btn')?.addEventListener('click', () => {
    document.getElementById('register-modal').classList.remove('hidden');
  });

  // --- Botón Premium de la cabecera y vista Premium ---
  document.getElementById('header-premium-btn')?.addEventListener('click', openPremiumView);

  // --- Gestión de clientes (baja temporal / eliminar definitivo) — delegado para los dos listados ---
  document.addEventListener('click', event => {
    const bajaButton = event.target.closest('[data-toggle-baja]');
    if (bajaButton) {
      toggleUserBaja(bajaButton.dataset.toggleBaja);
      return;
    }
    const deleteButton = event.target.closest('[data-delete-user]');
    if (deleteButton) deleteUserPermanently(deleteButton.dataset.deleteUser);
  });
  document.getElementById('premium-back-btn')?.addEventListener('click', closePremiumView);

  document.getElementById('premium-audience')?.addEventListener('change', updatePremiumAudienceFields);

  // --- Visibilidad de contraseña ---
  document.getElementById('toggle-password')?.addEventListener('click', () => {
    togglePasswordVisibility('login-password', 'toggle-password');
  });
  document.getElementById('toggle-register-password')?.addEventListener('click', () => {
    togglePasswordVisibility('register-password', 'toggle-register-password');
  });

  // --- Navegación y Vistas ---
  document.querySelectorAll('[data-open-editor]').forEach(button => {
    button.addEventListener('click', () => {
      if (!isAdmin()) return;
      const centerNav = document.querySelector('[data-view="view-centro"]');
      const adminTab = document.querySelector('[data-tab="admin"]');
      if (centerNav) centerNav.click();
      if (adminTab) adminTab.click();
      document.querySelectorAll('.admin-editor-section').forEach(section => section.classList.remove('editor-selected'));
      const editor = document.getElementById(`admin-${button.dataset.openEditor}-section`);
      if (editor) {
        editor.classList.add('editor-selected');
        editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        editor.querySelector('details').open = true;
        if (button.dataset.openEditor === 'home') {
          loadHomeFormData();
        }
      }
    });
  });

  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
      const target = document.getElementById(button.dataset.view);
      document.querySelectorAll('.view').forEach(view => view.classList.remove('active-view'));
      if (target) target.classList.add('active-view');
      document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      if (button.dataset.view === 'view-perfil') notifyUnreadNews();
    });
  });

  document.querySelectorAll('[data-go-view]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelector(`[data-view="${button.dataset.goView}"]`)?.click();
    });
  });

  document.querySelectorAll('.subnav-btn').forEach(button => {
    button.addEventListener('click', () => {
      if ((button.dataset.tab === 'admin' || button.dataset.tab === 'clientes') && !isAdmin()) return;
      if (button.dataset.tab === 'contacto' && isAdmin()) {
        const adminButton = document.querySelector('[data-tab="admin"]');
        if (adminButton) adminButton.click();
        return;
      }
      document.querySelectorAll('.center-tab').forEach(tab => tab.classList.remove('active'));
      const targetTab = document.getElementById(`tab-${button.dataset.tab}`);
      if (targetTab) targetTab.classList.add('active');
      document.querySelectorAll('.subnav-btn').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      if (button.dataset.tab === 'novedades') {
        const user = getCurrentUser();
        if (user && user.role !== 'admin') markNewsAsSeen(user);
      }
    });
  });

  initCenterSubnavScroller();

  // --- Controles de Calendario y Formularios ---
  document.getElementById('activity-recurrence')?.addEventListener('change', event => {
    const options = document.getElementById('recurrence-options');
    const isWeekly = event.target.value === 'weekly';
    options?.classList.toggle('hidden', !isWeekly);
    if (isWeekly && !document.querySelector('input[name="recurrence-day"]:checked')) {
      const startDate = new Date(`${document.getElementById('activity-date').value}T00:00:00`);
      const weekday = startDate.getDay();
      const checkbox = document.querySelector(`input[name="recurrence-day"][value="${weekday}"]`);
      if (checkbox) checkbox.checked = true;
    }
  });

  document.getElementById('premium-image')?.addEventListener('change', event => {
    const preview = document.getElementById('premium-image-preview');
    if (!preview) return;
    const file = event.target.files && event.target.files[0];
    if (file) {
      preview.src = URL.createObjectURL(file);
      preview.style.display = 'block';
    } else {
      preview.src = '';
      preview.style.display = 'none';
    }
  });

  document.getElementById('service-billing-type')?.addEventListener('change', event => {
    const sessionsField = document.getElementById('service-sessions-field');
    const daysField = document.getElementById('service-days-field');
    const sessions = event.target.value === 'sessions';
    sessionsField?.classList.toggle('hidden', !sessions);
    daysField?.classList.toggle('hidden', sessions);
  });

  document.getElementById('year-select')?.addEventListener('change', (event) => {
    state.currentYear = Number(event.target.value);
    state.selectedDate = new Date(state.currentYear, state.currentMonth, 1);
    renderCalendar();
    renderSelectedDay();
  });

  document.getElementById('prev-month-btn')?.addEventListener('click', () => {
    state.currentMonth -= 1;
    if (state.currentMonth < 0) {
      state.currentMonth = 11;
      state.currentYear -= 1;
    }
    renderYearOptions();
    renderCalendar();
    renderSelectedDay();
  });

  document.getElementById('next-month-btn')?.addEventListener('click', () => {
    state.currentMonth += 1;
    if (state.currentMonth > 11) {
      state.currentMonth = 0;
      state.currentYear += 1;
    }
    renderYearOptions();
    renderCalendar();
    renderSelectedDay();
  });

  // --- Formularios y Autenticación ---
  document.getElementById('close-login-modal')?.addEventListener('click', closeLoginModal);
  document.getElementById('login-toggle-btn')?.addEventListener('click', () => {
    const user = getCurrentUser();
    if (user) {
      handleLogout();
      return;
    }
    openLoginModal();
  });

  document.getElementById('login-form')?.addEventListener('submit', handleLoginSubmit);
  document.getElementById('reset-password-btn')?.addEventListener('click', handlePasswordReset);
  document.getElementById('contact-form')?.addEventListener('submit', handleContactFormSubmit);
  document.getElementById('profile-goals-form')?.addEventListener('submit', handleProfileGoalsSubmit);
  document.getElementById('admin-service-form')?.addEventListener('submit', handleAdminServiceSubmit);
  document.getElementById('admin-user-form')?.addEventListener('submit', handleAdminUserSubmit);
  document.getElementById('admin-info-form')?.addEventListener('submit', handleAdminInfoSubmit);
  document.getElementById('admin-home-form')?.addEventListener('submit', handleAdminHomeSubmit);
  document.getElementById('admin-activity-form')?.addEventListener('submit', handleAdminActivitySubmit);
  document.getElementById('admin-center-service-form')?.addEventListener('submit', handleAdminCenterServiceSubmit);
  document.getElementById('admin-team-form')?.addEventListener('submit', handleAdminTeamSubmit);
  document.getElementById('admin-gallery-form')?.addEventListener('submit', handleAdminGallerySubmit);
  document.getElementById('admin-premium-form')?.addEventListener('submit', handleAdminPremiumSubmit);
  document.getElementById('admin-news-form')?.addEventListener('submit', handleAdminNewsSubmit);
  document.getElementById('close-gallery-modal')?.addEventListener('click', () => document.getElementById('gallery-modal')?.classList.add('hidden'));
  document.getElementById('image-manager-upload-btn')?.addEventListener('click', handleImageManagerUpload);

  // Event listeners para modales de edición
  document.getElementById('close-edit-activity-modal')?.addEventListener('click', () => {
    document.getElementById('edit-activity-modal').classList.add('hidden');
  });
  document.getElementById('edit-activity-form')?.addEventListener('submit', handleEditActivitySubmit);

  document.getElementById('close-edit-service-modal')?.addEventListener('click', () => {
    document.getElementById('edit-service-modal').classList.add('hidden');
  });
  document.getElementById('edit-service-form')?.addEventListener('submit', handleEditServiceSubmit);

  document.getElementById('close-edit-user-modal')?.addEventListener('click', () => {
    document.getElementById('edit-user-modal').classList.add('hidden');
  });
  document.getElementById('edit-user-form')?.addEventListener('submit', handleEditUserSubmit);
}

/* ==========================================================
   GESTOR DE IMÁGENES (ADMIN) — subir / reemplazar imágenes
   ========================================================== */
function getImageManagerTargets() {
  const targets = [];
  targets.push({ key: 'info-hero', label: 'Portada del centro', get: () => mfitData.info.heroImage, set: url => { mfitData.info.heroImage = url; } });
  mfitData.services.forEach(item => targets.push({ key: `center-service-${item.id}`, label: `Servicio: ${item.name}`, get: () => item.image, set: url => { item.image = url; } }));
  mfitData.team.forEach(item => targets.push({ key: `team-${item.id}`, label: `Equipo: ${item.name}`, get: () => item.image, set: url => { item.image = url; } }));
  mfitData.gallery.forEach(item => targets.push({ key: `gallery-${item.id}`, label: `Galería: ${item.caption}`, get: () => item.url, set: url => { item.url = url; } }));
  mfitData.news.forEach(item => targets.push({ key: `news-${item.id}`, label: `Novedad: ${item.title}`, get: () => item.image, set: url => { item.image = url; } }));
  return targets;
}

function renderImageManager() {
  const select = document.getElementById('image-manager-target');
  const grid = document.getElementById('image-manager-grid');
  if (!select || !grid) return;
  if (!isAdmin()) {
    select.innerHTML = '<option value="">Sin acceso</option>';
    grid.innerHTML = '';
    return;
  }
  const targets = getImageManagerTargets();
  const currentValue = select.value;
  select.innerHTML = targets.map(item => `<option value="${item.key}">${item.label}</option>`).join('');
  if (currentValue && targets.some(item => item.key === currentValue)) select.value = currentValue;

  grid.innerHTML = targets.map(item => {
    const url = item.get() || '';
    return `
      <div class="image-manager-item">
        <img src="${url}" alt="${item.label}" onerror="this.style.opacity=0.3" />
        <div class="image-manager-meta">
          <strong title="${item.label}">${item.label}</strong>
          <small>${url ? 'Imagen asignada' : 'Sin imagen'}</small>
        </div>
      </div>
    `;
  }).join('');
}

async function handleImageManagerUpload() {
  if (!isAdmin()) return;
  const select = document.getElementById('image-manager-target');
  const fileInput = document.getElementById('image-manager-file');
  const progress = document.getElementById('image-manager-progress');
  const progressBar = progress?.querySelector('span');
  const file = fileInput?.files?.[0];

  if (!select?.value) { toastWarning('Selecciona el elemento que quieres actualizar.'); return; }
  if (!file) { toastWarning('Selecciona una imagen (.jpg, .png o .webp).'); return; }

  const target = getImageManagerTargets().find(item => item.key === select.value);
  if (!target) return;

  if (progress) progress.classList.remove('hidden');
  if (progressBar) progressBar.style.width = '0%';

  const url = await uploadImage(file, 'manager', percent => {
    if (progressBar) progressBar.style.width = `${percent}%`;
  });

  if (progress) progress.classList.add('hidden');
  if (!url) return;

  target.set(url);
  await persistContent();
  renderImageManager();
  fileInput.value = '';
  toastSuccess(`Imagen actualizada: ${target.label}.`);
}

function renderAll() {
  document.querySelectorAll('[data-admin-only]').forEach(item => item.classList.remove('is-admin-visible'));
  renderYearOptions();
  renderCalendar();
  renderSelectedDay();
  renderProfile();
  renderBonosList();
  renderCenterConfig();
  renderAdminPanels();
  renderHeader();
  renderCalendarReminders();
  renderImageManager();
  renderPremiumBoard();
  populatePremiumClientSelect();
}

document.addEventListener('DOMContentLoaded', async () => {
  attachEvents();
  await loadCloudState();
  renderAll();
  auth.onAuthStateChanged(syncAuthenticatedUser);
  // Archivado automático de bonos caducados (al cargar y cada 30 min)
  archiveExpiredPurchases();
  setInterval(archiveExpiredPurchases, 30 * 60 * 1000);
});
