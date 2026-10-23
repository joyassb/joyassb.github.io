// ===== JoyasSB — página pública =====
const WHATSAPP = "56932998373";

const TIPOS = { cadena: "Cadena", colgante: "Colgante", pulsera: "Pulsera" };

const clp = (n) => "$" + Number(n).toLocaleString("es-CL");
const mayuscula = (s) => String(s ?? "").charAt(0).toLocaleUpperCase("es-CL") + String(s ?? "").slice(1);

const waLink = (msg) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;

const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const PLACEHOLDER = `<div class="ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=".8"><path d="M6 3h12l3 5-9 13L3 8z"/><path d="M3 8h18M9 3l-1.5 5L12 21l4.5-13L15 3"/></svg></div>`;

let productos = [];

const num = (n) => String(n).replace(".", ",");

// Medidas opcionales del producto, como pares [etiqueta, valor]
const medidas = (p) =>
  [
    p.ley && ["Plata", p.ley],
    p.largo && ["Largo", `${num(p.largo)} cm`],
    p.grosor && ["Grosor", `${num(p.grosor)} mm`],
  ].filter(Boolean);

const mensaje = (p) =>
  [
    "Hola JoyasSB 👋 Me interesa este producto:",
    "",
    `*${p.nombre}*`,
    `Tipo: ${TIPOS[p.tipo] || p.tipo}`,
    ...medidas(p).map(([k, v]) => `${k}: ${v}`),
    p.descripcion ? `Detalle: ${p.descripcion}` : null,
    `Precio: ${clp(p.precio)}`,
    "",
    "¿Está disponible?",
  ].filter((l) => l !== null).join("\n");

function tarjeta(p) {
  const tipo = TIPOS[p.tipo] || p.tipo;
  const agotado = p.disponible === false;
  const msg = mensaje(p);
  const img = p.imagen
    ? `<img src="${escapeHtml(p.imagen)}" alt="${escapeHtml(p.nombre)}" loading="lazy">`
    : PLACEHOLDER;
  const badge = agotado
    ? `<span class="badge out">Agotado</span>`
    : p.destacado ? `<span class="badge">Nuevo</span>` : "";

  return `
    <article class="card${agotado ? " sold" : ""}" data-id="${escapeHtml(p.id)}" tabindex="0" aria-label="Ver detalle de ${escapeHtml(p.nombre)}">
      <div class="card-img">${img}${badge}</div>
      <div class="card-body">
        <span class="card-type">${escapeHtml(tipo)}</span>
        <h3 class="card-name">${escapeHtml(p.nombre)}</h3>
        ${medidas(p).length ? `<p class="card-specs">${medidas(p).map(([k, v]) => escapeHtml(k === "Plata" ? `${k} ${v}` : v)).join(" · ")}</p>` : ""}
        ${p.descripcion ? `<p class="card-desc">${escapeHtml(p.descripcion)}</p>` : ""}
        <span class="card-price">${clp(p.precio)}</span>
        <a class="btn btn-wa" href="${waLink(msg)}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="currentColor"><use href="#i-wa"/></svg>
          ${agotado ? "Consultar" : "Pedir por WhatsApp"}
        </a>
      </div>
    </article>`;
}

function render(tipo) {
  const grid = document.getElementById("grid");
  const lista = tipo === "todos" ? productos : productos.filter((p) => p.tipo === tipo);
  grid.innerHTML = lista.length
    ? lista.map(tarjeta).join("")
    : `<p class="empty">Pronto habrá nuevas piezas aquí. Escríbeme por WhatsApp para ver lo disponible.</p>`;
}

// Filtros
document.getElementById("filters").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
  render(chip.dataset.tipo);
});

// ---------- Detalle de producto ----------
// Cada producto abierto queda en la URL (#producto-<id>) para poder compartirlo,
// y el botón "atrás" del celular cierra la ventana.
const modal = document.getElementById("detalle");
const HASH = "#producto-";

function pintarDetalle(p) {
  const tipo = TIPOS[p.tipo] || p.tipo;
  const agotado = p.disponible === false;
  modal.querySelector(".det-img").innerHTML =
    (p.imagen ? `<img src="${escapeHtml(p.imagen)}" alt="${escapeHtml(p.nombre)}">` : PLACEHOLDER) +
    (agotado ? `<span class="badge out">Agotado</span>` : p.destacado ? `<span class="badge">Nuevo</span>` : "");
  modal.querySelector(".card-type").textContent = tipo;
  modal.querySelector(".det-name").textContent = p.nombre;
  modal.querySelector(".det-desc").textContent = p.descripcion || "";
  modal.querySelector(".det-specs").innerHTML = medidas(p)
    .map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join("");
  modal.querySelector(".det-price").textContent = clp(p.precio);
  const wa = modal.querySelector(".btn-wa");
  wa.href = waLink(mensaje(p));
  wa.lastChild.textContent = agotado ? " Consultar por WhatsApp" : " Pedir por WhatsApp";
}

function mostrarDetalle(id) {
  const p = productos.find((x) => String(x.id) === id);
  if (!p) return cerrarDetalle();
  pintarDetalle(p);
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  modal.querySelector(".det-close").focus({ preventScroll: true });
}

function cerrarDetalle() {
  if (modal.hidden) return;
  modal.hidden = true;
  document.body.style.overflow = "";
}

function abrirDetalle(id) {
  history.pushState({ detalle: true }, "", HASH + encodeURIComponent(id));
  mostrarDetalle(id);
}

function salirDetalle() {
  if (history.state && history.state.detalle) history.back();
  else { history.replaceState(null, "", location.pathname + location.search); cerrarDetalle(); }
}

function sincronizarConUrl() {
  if (location.hash.startsWith(HASH)) mostrarDetalle(decodeURIComponent(location.hash.slice(HASH.length)));
  else cerrarDetalle();
}

document.getElementById("grid").addEventListener("click", (e) => {
  if (e.target.closest(".btn-wa")) return; // el botón de WhatsApp funciona directo
  const card = e.target.closest(".card");
  if (card) abrirDetalle(card.dataset.id);
});
document.getElementById("grid").addEventListener("keydown", (e) => {
  const card = e.target.closest(".card");
  if (card && e.target === card && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    abrirDetalle(card.dataset.id);
  }
});
modal.addEventListener("click", (e) => {
  if (e.target === modal || e.target.closest(".det-close")) salirDetalle();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) salirDetalle(); });
window.addEventListener("popstate", sincronizarConUrl);

// Enlaces generales de WhatsApp
document.querySelectorAll(".js-wa").forEach((a) => {
  a.href = waLink(a.dataset.msg || "Hola JoyasSB");
  a.target = "_blank";
  a.rel = "noopener";
});

// Menú en celular
const nav = document.getElementById("nav");
document.getElementById("menuBtn").addEventListener("click", () => nav.classList.toggle("open"));
nav.addEventListener("click", (e) => { if (e.target.tagName === "A") nav.classList.remove("open"); });

document.getElementById("year").textContent = new Date().getFullYear();

// productos.js se pide sin caché para mostrar al tiro lo publicado desde el mantenedor
const s = document.createElement("script");
s.src = "productos.js?v=" + Date.now();
s.onload = s.onerror = () => {
  productos = (Array.isArray(window.PRODUCTOS) ? window.PRODUCTOS : []).map((p) => ({ ...p, nombre: mayuscula(p.nombre) }));
  render("todos");
  sincronizarConUrl();
};
document.head.appendChild(s);
