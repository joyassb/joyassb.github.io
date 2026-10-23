# JoyasSB — sitio web

El sitio vive en **GitHub Pages** (gratis). El mantenedor (`admin.html`) guarda directo en GitHub,
así que puedes agregar productos desde el celular y el sitio se actualiza solo en 1–2 minutos.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La página que ven tus clientes |
| `admin.html` | Tu mantenedor de productos |
| `productos.js` | El catálogo. Lo escribe el mantenedor, no se toca a mano |
| `img/productos/` | Las fotos de los productos. Las sube el mantenedor |
| `styles.css`, `app.js`, `admin.js`, `favicon.svg`, `.nojekyll` | Diseño y funcionamiento |

---

## Configuración (una sola vez)

### 1. Crear la cuenta y el repositorio
1. Crea una cuenta en https://github.com/signup. Tu **usuario** será parte de la dirección del sitio.
2. Arriba a la derecha: **+ → New repository**.
   - Repository name: `joyassb`
   - Marca **Public** (GitHub Pages gratis lo requiere)
   - Presiona **Create repository**.

### 2. Subir los archivos del sitio
En la página del repositorio recién creado, haz clic en **uploading an existing file**,
arrastra **todos los archivos de esta carpeta** y presiona **Commit changes**.

> Windows esconde `.nojekyll`. Si no se sube, no pasa nada: el sitio funciona igual.

### 3. Activar la página
En el repositorio: **Settings → Pages**.
- Source: **Deploy from a branch**
- Branch: **main**, carpeta **/ (root)** → **Save**

En 1–2 minutos tu sitio queda en: `https://TU-USUARIO.github.io/joyassb/`

### 4. Crear el token para el mantenedor
El token es la "llave" que permite al mantenedor guardar productos. Es como una contraseña: no lo compartas.

1. Abre https://github.com/settings/personal-access-tokens/new
2. **Token name:** `mantenedor joyassb`
3. **Expiration:** elige la más larga disponible y anota la fecha. Cuando venza, creas otro igual.
4. **Repository access:** *Only select repositories* → elige `joyassb`.
5. **Permissions → Repository permissions → Contents:** cambia a **Read and write**.
6. **Generate token** y **copia el token** (empieza con `github_pat_`). GitHub lo muestra una sola vez.
   Guárdalo en las notas de tu celular o en tu gestor de contraseñas.

### 5. Conectar el mantenedor
1. En el celular abre `https://TU-USUARIO.github.io/joyassb/admin.html`
2. Escribe tu usuario, el repositorio (`joyassb`) y pega el token → **Conectar**.
3. Tip: agrégalo a la pantalla de inicio (Safari → Compartir → *Agregar a inicio*) para abrirlo como app.

Repite el paso 5 en cada aparato que quieras usar.

---

## Uso diario

1. Abre el mantenedor.
2. Toca el cuadro de foto, elige la foto, ajústala y presiona **Usar foto**.
3. Completa nombre, tipo y precio → **Agregar**.
4. Listo. En 1–2 minutos aparece en el sitio.

Puedes editar, borrar, marcar como *Agotado* o *Nuevo* y cambiar el orden con las flechas.
Cada cambio se publica al instante y GitHub guarda el historial.

### Productos que cargaste antes de esto
Si agregaste productos con la versión anterior del mantenedor, quedaron guardados solo en ese navegador.
Abre el mantenedor **en la misma dirección donde los cargaste** (por ejemplo `http://192.168.1.91:8000/admin.html`),
conéctalo con tu usuario y token, y aparecerá un aviso para **Publicarlos**.

---

## Opcional

- **Dominio propio:** compra `joyassb.cl` en https://nic.cl (aprox. $10.000 al año) y conéctalo en
  *Settings → Pages → Custom domain*.
- **Textos:** en `index.html` hay comentarios marcados con ✏️ ("Sobre mí", medios de pago).
  Puedes editarlos en GitHub: abre el archivo y presiona el lápiz.
- Pon el enlace del sitio en la biografía de Instagram @joyassb.cl.
