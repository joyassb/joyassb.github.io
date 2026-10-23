// ===== JoyasSB — mantenedor de productos =====
// Guarda directo en el repositorio de GitHub del sitio: cada cambio sube la foto
// a img/productos/ y reescribe productos.js. GitHub Pages republica solo.

const TIPOS = { cadena: "Cadena", colgante: "Colgante", pulsera: "Pulsera" };
const IMG_SIZE = 800;     // px de la foto final (cuadrada)
const IMG_QUALITY = 0.78; // calidad JPEG
const ZOOM_MAX = 4;       // zoom máximo respecto a "llenar cuadro"
const ARCHIVO = "productos.js";
const CFG_KEY = "joyassb-github";

const $ = (id) => document.getElementById(id);
const clp = (n) => "$" + Number(n).toLocaleString("es-CL");
const ESTADOS = { vendido: "Vendido", agotado: "Agotado" };
const estado = (p) => p.estado || (p.disponible === false ? "agotado" : "disponible");
const mayuscula = (s) => s.charAt(0).toLocaleUpperCase("es-CL") + s.slice(1);
const escapeHtml = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let productos = [];
let editId = null;
let fotoActual = ""; // lo que se guarda: ruta "img/productos/..." o data URL recién recortada

// ---------- Conexión con GitHub ----------
let gh = null;
try { gh = JSON.parse(localStorage.getItem(CFG_KEY)); } catch {}

async function api(path, opts = {}) {
  const r = await fetch(`https://api.github.com/repos/${gh.owner}/${gh.repo}${path ? "/" + path : ""}`, {
    ...opts,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${gh.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!r.ok) {
    const err = new Error(`GitHub respondió ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return r.status === 204 ? null : r.json();
}

const aBase64 = (texto) => {
  const bytes = new TextEncoder().encode(texto);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const deBase64 = (b64) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

const textoProductos = (lista) =>
  "// Archivo generado por el mantenedor (admin.html). No es necesario editarlo a mano.\n" +
  "window.PRODUCTOS = " + JSON.stringify(lista, null, 2) + ";\n";

async function leerProductos() {
  let f;
  try { f = await api(`contents/${ARCHIVO}?ref=${gh.branch}`); }
  catch (e) { if (e.status === 404) return { sha: null, lista: [] }; throw e; }
  // sobre 1 MB la API no trae el contenido; se pide como blob
  const b64 = f.encoding === "base64" && f.content ? f.content : (await api(`git/blobs/${f.sha}`)).content;
  const texto = deBase64(b64);
  return { sha: f.sha, lista: JSON.parse(texto.slice(texto.indexOf("["), texto.lastIndexOf("]") + 1)) };
}

const escribir = (path, b64, message, sha) =>
  api(`contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: b64, branch: gh.branch, ...(sha ? { sha } : {}) }),
  });

async function subirFoto(dataUrl, id) {
  const path = `img/productos/${id}-${Date.now().toString(36)}.jpg`;
  await escribir(path, dataUrl.split(",")[1], `Foto ${id}`);
  return path;
}

async function borrarFoto(path) {
  if (!path || !path.startsWith("img/productos/")) return;
  try {
    const f = await api(`contents/${path}?ref=${gh.branch}`);
    await api(`contents/${path}`, {
      method: "DELETE",
      body: JSON.stringify({ message: "Borrar foto", sha: f.sha, branch: gh.branch }),
    });
  } catch {} // si falla solo queda una foto sin usar
}

// Aplica el cambio sobre la versión más reciente publicada, por si se editó
// desde otro aparato; si alguien guardó justo entremedio, reintenta.
async function publicar(cambio, mensaje) {
  for (let intento = 0; ; intento++) {
    const { sha, lista } = await leerProductos();
    const nueva = cambio(lista);
    try {
      await escribir(ARCHIVO, aBase64(textoProductos(nueva)), mensaje, sha);
      productos = nueva;
      return;
    } catch (e) {
      if ((e.status === 409 || e.status === 422) && intento < 2) continue;
      throw e;
    }
  }
}

function mensajeError(e) {
  if (e.status === 401) return "El token no es válido o expiró. Desconecta y vuelve a conectar.";
  if (e.status === 403) return "El token no tiene permiso para escribir en el repositorio.";
  if (e.status === 404) return "No se encontró el repositorio. Revisa usuario y nombre.";
  return "No se pudo guardar. Revisa tu conexión e intenta de nuevo.";
}

async function ocupado(texto, fn) {
  $("busyText").textContent = texto;
  $("busy").hidden = false;
  try { await fn(); return true; }
  catch (e) { console.error(e); toast(mensajeError(e), 5000); return false; }
  finally { $("busy").hidden = true; }
}

// Fotos ya publicadas se muestran desde GitHub (están disponibles al instante,
// antes de que el sitio termine de actualizarse)
const urlImg = (src) =>
  !src || /^(data:|blob:|https?:)/.test(src)
    ? src
    : `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/${gh.branch}/${src}`;

const urlSitio = () =>
  gh.repo.toLowerCase() === `${gh.owner.toLowerCase()}.github.io`
    ? `https://${gh.owner}.github.io/`
    : `https://${gh.owner}.github.io/${gh.repo}/`;

// ---------- Borrador antiguo (versión sin GitHub) en IndexedDB ----------
const db = {
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open("joyassb-admin", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("kv");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async get(key) {
    const d = await this.open();
    return new Promise((res, rej) => {
      const r = d.transaction("kv").objectStore("kv").get(key);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async set(key, val) {
    const d = await this.open();
    return new Promise((res, rej) => {
      const tx = d.transaction("kv", "readwrite");
      tx.objectStore("kv").put(val, key);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  },
};


// ---------- Foto: encuadre cuadrado ----------
// La foto se posiciona dentro de un cuadro de lado V (px en pantalla):
// "escala" es px de pantalla por px de la foto; (x, y) es su esquina superior izquierda.
const crop = { img: $("cropImg"), view: $("cropView"), escala: 1, x: 0, y: 0, min: 1, llenar: 1, V: 0 };

// Si el cuadro cambia de tamaño (girar el celular, carga de letras), escalar todo junto
new ResizeObserver(() => {
  const V = crop.view.clientWidth;
  if (!V || !crop.V || V === crop.V) { crop.V = V; return; }
  const f = V / crop.V;
  crop.V = V;
  crop.escala *= f; crop.llenar *= f; crop.min *= f; crop.x *= f; crop.y *= f;
  dibujarCrop();
}).observe(crop.view);

function abrirCrop(src) {
  const img = crop.img;
  img.crossOrigin = "anonymous"; // para poder recortar fotos ya publicadas en GitHub
  img.onload = () => {
    $("cropModal").hidden = false;
    const V = crop.V = crop.view.clientWidth;
    const w = img.naturalWidth, h = img.naturalHeight;
    crop.llenar = Math.max(V / w, V / h); // la foto cubre todo el cuadro
    crop.min = Math.min(V / w, V / h);    // la foto entera cabe en el cuadro
    zoomA(crop.llenar);
    centrar();
  };
  img.onerror = () => toast("No se pudo leer esa imagen");
  img.src = src;
}

function cerrarCrop() {
  $("cropModal").hidden = true;
  if (crop.img.src.startsWith("blob:")) URL.revokeObjectURL(crop.img.src);
}

function centrar() {
  const V = crop.view.clientWidth;
  crop.x = (V - crop.img.naturalWidth * crop.escala) / 2;
  crop.y = (V - crop.img.naturalHeight * crop.escala) / 2;
  dibujarCrop();
}

// Mantiene el cuadro sin bordes vacíos cuando la foto es más grande que él,
// y centrada en el eje donde es más chica.
function limitar() {
  const V = crop.view.clientWidth;
  const w = crop.img.naturalWidth * crop.escala, h = crop.img.naturalHeight * crop.escala;
  crop.x = w <= V ? (V - w) / 2 : Math.min(0, Math.max(V - w, crop.x));
  crop.y = h <= V ? (V - h) / 2 : Math.min(0, Math.max(V - h, crop.y));
}

function dibujarCrop() {
  limitar();
  crop.img.style.transform = `translate(${crop.x}px, ${crop.y}px) scale(${crop.escala})`;
}

// Zoom manteniendo fijo el centro del cuadro
function zoomA(escala) {
  const V = crop.view.clientWidth;
  const max = crop.llenar * ZOOM_MAX;
  escala = Math.min(max, Math.max(crop.min, escala));
  const cx = (V / 2 - crop.x) / crop.escala, cy = (V / 2 - crop.y) / crop.escala;
  crop.escala = escala;
  crop.x = V / 2 - cx * escala;
  crop.y = V / 2 - cy * escala;
  // el deslizador es logarítmico para que el zoom se sienta parejo
  $("cropZoom").value = Math.round(1000 * Math.log(escala / crop.min) / Math.log(max / crop.min) || 0);
  dibujarCrop();
}

$("cropZoom").addEventListener("input", (e) => {
  const max = crop.llenar * ZOOM_MAX;
  zoomA(crop.min * Math.pow(max / crop.min, e.target.value / 1000));
});
$("cropLlenar").addEventListener("click", () => { zoomA(crop.llenar); centrar(); });
$("cropEntera").addEventListener("click", () => { zoomA(crop.min); centrar(); });

// Arrastrar (mouse o dedo) y pellizcar para zoom en celular
const punteros = new Map();
let distInicial = 0, escalaInicial = 1;
crop.view.addEventListener("pointerdown", (e) => {
  crop.view.setPointerCapture(e.pointerId);
  punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (punteros.size === 2) {
    const [a, b] = [...punteros.values()];
    distInicial = Math.hypot(a.x - b.x, a.y - b.y);
    escalaInicial = crop.escala;
  }
});
crop.view.addEventListener("pointermove", (e) => {
  const prev = punteros.get(e.pointerId);
  if (!prev) return;
  punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (punteros.size === 1) {
    crop.x += e.clientX - prev.x;
    crop.y += e.clientY - prev.y;
    dibujarCrop();
  } else if (punteros.size === 2 && distInicial) {
    const [a, b] = [...punteros.values()];
    zoomA(escalaInicial * Math.hypot(a.x - b.x, a.y - b.y) / distInicial);
  }
});
const soltar = (e) => { punteros.delete(e.pointerId); distInicial = 0; };
crop.view.addEventListener("pointerup", soltar);
crop.view.addEventListener("pointercancel", soltar);
crop.view.addEventListener("wheel", (e) => {
  e.preventDefault();
  zoomA(crop.escala * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
}, { passive: false });

$("cropCancel").addEventListener("click", cerrarCrop);
$("cropOk").addEventListener("click", () => {
  const k = IMG_SIZE / crop.view.clientWidth;
  const c = document.createElement("canvas");
  c.width = c.height = IMG_SIZE;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, IMG_SIZE, IMG_SIZE);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(crop.img, crop.x * k, crop.y * k,
    crop.img.naturalWidth * crop.escala * k, crop.img.naturalHeight * crop.escala * k);
  mostrarFoto(c.toDataURL("image/jpeg", IMG_QUALITY));
  cerrarCrop();
});

function mostrarFoto(src) {
  fotoActual = src || "";
  $("photo").innerHTML = src ? `<img src="${escapeHtml(urlImg(src))}" alt="">` : `Toca para subir foto`;
  $("photoActions").hidden = !src;
}

$("photo").addEventListener("click", () => fotoActual ? abrirCrop(urlImg(fotoActual)) : $("file").click());
$("cambiarFoto").addEventListener("click", () => $("file").click());
$("ajustarFoto").addEventListener("click", () => abrirCrop(urlImg(fotoActual)));
$("file").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (f) abrirCrop(URL.createObjectURL(f));
  e.target.value = "";
});

// ---------- Formulario ----------
function limpiarForm() {
  editId = null;
  $("form").reset();
  $("estado").value = "disponible";
  $("ofertaInfo").textContent = "";
  mostrarFoto("");
  $("formTitle").textContent = "Nuevo producto";
  $("submit").textContent = "Agregar";
  $("cancel").hidden = true;
  render();
}

function editar(id) {
  const p = productos.find((x) => x.id === id);
  if (!p) return;
  editId = id;
  $("nombre").value = p.nombre;
  $("tipo").value = p.tipo;
  $("precio").value = p.precio;
  $("oferta").value = p.oferta ?? "";
  infoOferta();
  $("descripcion").value = p.descripcion || "";
  $("largo").value = p.largo ?? "";
  $("grosor").value = p.grosor ?? "";
  $("ley").value = p.ley || "";
  $("estado").value = estado(p);
  $("destacado").checked = !!p.destacado;
  mostrarFoto(p.imagen);
  $("formTitle").textContent = "Editar producto";
  $("submit").textContent = "Guardar";
  $("cancel").hidden = false;
  render();
  $("form").scrollIntoView({ behavior: "smooth" });
}

$("cancel").addEventListener("click", limpiarForm);

// Muestra el % de descuento mientras se escribe
function infoOferta() {
  const precio = Number($("precio").value), oferta = Number($("oferta").value);
  $("ofertaInfo").textContent =
    $("oferta").value === "" || !precio ? ""
    : oferta < precio ? `Descuento de ${Math.round((1 - oferta / precio) * 100)}%`
    : "Debe ser menor que el precio normal";
}
$("precio").addEventListener("input", infoOferta);
$("oferta").addEventListener("input", infoOferta);

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = {
    nombre: mayuscula($("nombre").value.trim()),
    tipo: $("tipo").value,
    precio: Math.round(Number($("precio").value)),
    oferta: $("oferta").value === "" ? null : Math.round(Number($("oferta").value)),
    descripcion: $("descripcion").value.trim(),
    // medidas opcionales: vacías se guardan como null
    largo: $("largo").value === "" ? null : Number($("largo").value),
    grosor: $("grosor").value === "" ? null : Number($("grosor").value),
    ley: $("ley").value || null,
    imagen: fotoActual,
    estado: $("estado").value,
    disponible: $("estado").value === "disponible",
    destacado: $("destacado").checked,
  };
  if (!datos.nombre || !(datos.precio >= 0)) return;
  if (datos.oferta !== null && !(datos.oferta < datos.precio)) {
    toast("El precio con descuento debe ser menor que el precio normal", 4000);
    $("oferta").focus();
    return;
  }

  const id = editId || "p" + Date.now().toString(36);
  const fotoAnterior = editId ? productos.find((p) => p.id === editId)?.imagen : "";
  const ok = await ocupado("Publicando…", async () => {
    if (datos.imagen.startsWith("data:")) {
      datos.imagen = await subirFoto(datos.imagen, id);
      fotoActual = datos.imagen; // si lo siguiente falla, no se vuelve a subir
    }
    if (editId) await publicar((l) => l.map((p) => (p.id === id ? { ...p, ...datos } : p)), `Editar: ${datos.nombre}`);
    else await publicar((l) => [{ id, ...datos }, ...l], `Agregar: ${datos.nombre}`);
    if (fotoAnterior && fotoAnterior !== datos.imagen) await borrarFoto(fotoAnterior);
  });
  if (!ok) return;
  toast(editId ? "Producto actualizado ✓" : "Producto publicado ✓");
  limpiarForm();
});

// ---------- Lista ----------
const ICON = {
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 9l6 6 6-6"/></svg>',
  vendido: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  del: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
};

function render() {
  $("status").innerHTML = `
    <span>${productos.length} producto${productos.length === 1 ? "" : "s"} publicado${productos.length === 1 ? "" : "s"}
      <br><small style="color:var(--muted)">Los cambios se ven en el sitio en 1–2 minutos.</small></span>
    <span class="btns">
      <a class="btn" href="${urlSitio()}" target="_blank" rel="noopener">Ver sitio</a>
      <button class="btn" id="desconectar" type="button">Desconectar</button>
    </span>`;
  $("desconectar").onclick = () => {
    if (!confirm("¿Desconectar este aparato de GitHub? Tendrás que volver a ingresar el token.")) return;
    localStorage.removeItem(CFG_KEY);
    location.reload();
  };

  $("list").innerHTML = productos.length
    ? productos.map((p, i) => `
      <div class="item${p.id === editId ? " editing" : ""}${estado(p) === "vendido" ? " vendido" : ""}">
        <div class="thumb">${p.imagen ? `<img src="${escapeHtml(urlImg(p.imagen))}" alt="" loading="lazy">` : "sin foto"}</div>
        <div class="meta">
          <strong>${escapeHtml(p.nombre)}</strong>
          <small>${[TIPOS[p.tipo], p.oferta ? `${clp(p.precio)} → ${clp(p.oferta)}` : clp(p.precio), p.ley && `Plata ${p.ley}`, p.largo && `${p.largo} cm`, p.grosor && `${p.grosor} mm`]
            .filter(Boolean).map(escapeHtml).join(" · ")}</small>
          ${ESTADOS[estado(p)] ? `<span class="tag">${ESTADOS[estado(p)]}</span>` : ""}
          ${p.destacado ? '<span class="tag">Nuevo</span>' : ""}
        </div>
        <div class="acts">
          <button class="icon-btn" title="Subir" data-act="up" data-i="${i}" ${i === 0 ? "disabled" : ""}>${ICON.up}</button>
          <button class="icon-btn" title="Bajar" data-act="down" data-i="${i}" ${i === productos.length - 1 ? "disabled" : ""}>${ICON.down}</button>
          <button class="icon-btn" title="${estado(p) === "vendido" ? "Volver a disponible" : "Marcar como vendido"}" data-act="vendido" data-i="${i}">${estado(p) === "vendido" ? ICON.undo : ICON.vendido}</button>
          <button class="icon-btn" title="Editar" data-act="edit" data-i="${i}">${ICON.edit}</button>
          <button class="icon-btn del" title="Borrar" data-act="del" data-i="${i}">${ICON.del}</button>
        </div>
      </div>`).join("")
    : '<p class="help">Aún no hay productos. Agrega el primero con el formulario.</p>';
}

// Mueve un producto según su posición en la versión publicada más reciente
const mover = (id, d) => (l) => {
  const i = l.findIndex((x) => x.id === id), j = i + d;
  if (i < 0 || j < 0 || j >= l.length) return l;
  [l[i], l[j]] = [l[j], l[i]];
  return l;
};

$("list").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const p = productos[Number(b.dataset.i)];
  switch (b.dataset.act) {
    case "edit": return editar(p.id);
    case "vendido": {
      const nuevo = estado(p) === "vendido" ? "disponible" : "vendido";
      const ok = await ocupado("Guardando…", () => publicar(
        (l) => l.map((x) => (x.id === p.id ? { ...x, estado: nuevo, disponible: nuevo === "disponible" } : x)),
        `${nuevo === "vendido" ? "Vendido" : "Disponible"}: ${p.nombre}`,
      ));
      if (ok) toast(nuevo === "vendido" ? "Marcado como vendido ✓" : "Vuelve a estar disponible ✓");
      break;
    }
    case "del":
      if (!confirm(`¿Borrar "${p.nombre}"?`)) return;
      if (await ocupado("Borrando…", async () => {
        await publicar((l) => l.filter((x) => x.id !== p.id), `Borrar: ${p.nombre}`);
        await borrarFoto(p.imagen);
      })) {
        if (editId === p.id) limpiarForm();
        toast("Producto borrado");
      }
      break;
    case "up":
    case "down":
      await ocupado("Guardando orden…", () => publicar(mover(p.id, b.dataset.act === "up" ? -1 : 1), "Reordenar productos"));
      break;
  }
  render();
});

// ---------- Productos que quedaron guardados solo en este navegador ----------
// (de la versión anterior del mantenedor, que no publicaba sola)
async function revisarBorradorAntiguo() {
  let borrador = null;
  try { borrador = await db.get("borrador"); } catch {}
  if (!Array.isArray(borrador)) return;
  const pendientes = borrador.filter((b) => !productos.some((p) => p.id === b.id));
  if (!pendientes.length) return;

  const aviso = $("pendientes");
  aviso.hidden = false;
  aviso.querySelector("span").textContent =
    `Hay ${pendientes.length} producto${pendientes.length === 1 ? "" : "s"} guardado${pendientes.length === 1 ? "" : "s"} solo en este navegador.`;
  $("pendPublicar").onclick = async () => {
    const ok = await ocupado("Publicando productos guardados…", async () => {
      for (const p of pendientes) {
        if (p.imagen && p.imagen.startsWith("data:")) p.imagen = await subirFoto(p.imagen, p.id);
      }
      await publicar((l) => [...pendientes, ...l], `Agregar ${pendientes.length} productos`);
      await db.set("borrador", null);
    });
    if (ok) { aviso.hidden = true; render(); toast("Productos publicados ✓"); }
  };
  $("pendDescartar").onclick = async () => {
    if (!confirm("¿Descartar esos productos? No se podrán recuperar.")) return;
    await db.set("borrador", null);
    aviso.hidden = true;
  };
}

// ---------- Aviso ----------
let toastTimer;
function toast(msg, ms = 2800) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

// ---------- Conectar ----------
$("setupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  gh = {
    owner: $("ghOwner").value.trim(),
    repo: $("ghRepo").value.trim(),
    token: $("ghToken").value.trim(),
    branch: "main",
  };
  const ok = await ocupado("Conectando…", async () => {
    const repo = await api("");
    gh.branch = repo.default_branch;
    if (!repo.permissions || !repo.permissions.push) throw Object.assign(new Error(), { status: 403 });
  });
  if (!ok) return;
  localStorage.setItem(CFG_KEY, JSON.stringify(gh));
  iniciar();
});

// ---------- Inicio ----------
async function iniciar() {
  if (!gh) { $("setup").hidden = false; return; }
  $("setup").hidden = true;
  $("app").hidden = false;
  const ok = await ocupado("Cargando productos…", async () => { productos = (await leerProductos()).lista; });
  render(); // aunque falle, para que quede a mano el botón "Desconectar"
  if (ok) revisarBorradorAntiguo();
}
iniciar();
