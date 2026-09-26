# Despliegue en producción — Azure Static Web Apps + AWS EC2 (Nginx + PM2)

Guía paso a paso del despliegue de **Gestión de Empleados** según la práctica **PDA06 — Despliegue de Aplicaciones Node.js en Producción utilizando AWS, Nginx y PM2**, con el frontend publicado en **Azure Static Web Apps**. La creación de la instancia EC2 (práctica PW15) se da por hecha.

| Pieza | Valor |
|---|---|
| **Frontend (Azure)** | https://blue-sand-076769b1e.1.azurestaticapps.net/ |
| **API (EC2)** | https://empleados-miguel.duckdns.org/api/v1/empleados |
| **Swagger** | https://empleados-miguel.duckdns.org/api/docs/ |
| Repositorio | `git@github.com:miguesj-hub/practica-mean-unidad2.git` (rama `main`) |
| Servidor | Ubuntu Server en EC2, región `us-east-2`, 2 vCPU |
| IP elástica | `18.116.22.239` |
| Dominio de la API | `empleados-miguel.duckdns.org` (DuckDNS) → `18.116.22.239` |
| Ruta en el servidor | `/var/www/empleados` |
| Proceso PM2 | `gestion-empleados` (cluster, 2 réplicas) |
| Base de datos | MongoDB Atlas, base `usuarios_db` |
| Alertas | Discord (webhook) con `pm2-discord` |

---

## Índice

0. [Arquitectura](#0-arquitectura)
1. [Qué se adaptó en el repositorio](#1-qué-se-adaptó-en-el-repositorio)
2. [Fase 1 · Red segura en AWS](#fase-1--red-segura-en-aws)
3. [Fase 2 · Preparar el servidor](#fase-2--preparar-el-servidor)
4. [Fase 3 · Vincular el servidor con GitHub y preparar carpetas](#fase-3--vincular-el-servidor-con-github-y-preparar-carpetas)
5. [Fase 4 · Nginx como proxy inverso](#fase-4--nginx-como-proxy-inverso)
6. [Fase 5 · PM2 y despliegue automatizado del backend (CI/CD)](#fase-5--pm2-y-despliegue-automatizado-del-backend-cicd)
7. [Fase 6 · Monitorización, alertas y rotación de logs](#fase-6--monitorización-alertas-y-rotación-de-logs)
8. [Fase 7 · Dominio y HTTPS para la API](#fase-7--dominio-y-https-para-la-api)
9. [Fase 8 · Frontend en Azure Static Web Apps](#fase-8--frontend-en-azure-static-web-apps)
10. [Pruebas de verificación](#pruebas-de-verificación-criterios-de-evaluación)
11. [Operación diaria](#operación-diaria)
12. [Solución de problemas](#solución-de-problemas)
13. [Checklist de evidencias para el informe](#checklist-de-evidencias-para-el-informe)

---

## 0. Arquitectura

```
                    ┌──────────── Azure Static Web Apps (plan Free) ────────────┐
                    │  https://blue-sand-076769b1e.1.azurestaticapps.net         │
Navegador ──(1)────►│  index.html · main-*.js · styles-*.css (build de Angular)  │
    │               └────────────────────────────────────────────────────────────┘
    │
    │ (2) fetch https://empleados-miguel.duckdns.org/api/v1/...   (CORS)
    ▼
┌──────────────────────────────── AWS EC2 (Ubuntu) ─────────────────────────────────┐
│ Security Group: 80 · 443 · 22 (solo mi IP)          IP elástica 18.116.22.239     │
│                                                                                   │
│  Nginx :443 (Let's Encrypt) ── /api/* ──► upstream 127.0.0.1:3000                 │
│  Nginx :80  → 301 a HTTPS                          │                              │
│                                        PM2 cluster (2 réplicas) → dist/index.js   │
│                                        + pm2-discord + pm2-logrotate              │
└────────────────────────────────────────────────────┼──────────────────────────────┘
                                                     ▼
                                            MongoDB Atlas (externo)

CI/CD:  git push main ──► GitHub Actions ──► Azure (frontend)
        pm2 deploy ecosystem.config.cjs production ──► EC2 (backend)
```

**Por qué así**

- **Azure solo entrega archivos estáticos.** Las llamadas a la API no pasan por Azure: el JavaScript de Angular se ejecuta en el navegador del usuario y llama directamente a la EC2. Por eso basta el plan Free de *Static Web Apps* y no hace falta *App Service*.
- **La API necesita HTTPS.** Una página servida por HTTPS (Azure) no puede llamar a una API por HTTP: el navegador lo bloquea (*mixed content*). Let's Encrypt no emite certificados para una IP, así que se usa un subdominio gratuito de DuckDNS.
- **CORS limitado.** Frontend y API están en dominios distintos; el backend solo responde con `Access-Control-Allow-Origin` al dominio de Azure y a `localhost:4200`.
- **Nginx** es el único proceso de la EC2 expuesto a Internet: termina TLS y reenvía `/api/*` al backend. El resto de rutas devuelve 404.
- **PM2 en modo cluster** levanta una réplica de Express por vCPU, reparte las conexiones y reinicia las que caen.
- **El puerto 3000 no se abre** en el Security Group.
- **La base de datos está fuera de la EC2** (Atlas), como recomienda la práctica.

---

## 1. Qué se adaptó en el repositorio

La práctica asume una app Node.js con `index.js` en la raíz. Este repo es un monorepo TypeScript (`backend/` + `frontend/`), así que se hicieron estos ajustes:

| Archivo | Cambio | Motivo |
|---|---|---|
| `backend/tsconfig.build.json` | Compila `src/` → `dist/` sin los `*.spec.ts`. | El modo cluster de PM2 ejecuta los workers con `node`; no admite `tsx` como intérprete. |
| `backend/package.json` | Scripts `build` y `start`. | Compilación y arranque de producción. |
| `backend/src/app.ts` | `cors({ origin: [dominio de Azure, localhost:4200] })`. | Solo el frontend propio puede consumir la API desde un navegador. |
| `backend/src/docs/openapi.ts` | `servers: /api/v1` (relativo). | “Try it out” de Swagger funciona detrás de Nginx. |
| `frontend/src/environments/environment.ts` | `apiUrl: 'https://empleados-miguel.duckdns.org/api/v1'`. | URL de la API en producción (Azure). |
| `frontend/src/environments/environment.development.ts` + `angular.json` (`fileReplacements`) | `apiUrl: '/api/v1'` en desarrollo. | `ng serve` sigue usando el backend local. |
| `frontend/proxy.conf.json` + `angular.json` (`proxyConfig`) | `ng serve` reenvía `/api` a `http://127.0.0.1:3000`. | Desarrollo local sin CORS. |
| `frontend/src/app/services/employee.service.ts` (+ spec) | Usa `environment.apiUrl`. | Una sola fuente para la URL; las 28 pruebas pasan. |
| `frontend/public/staticwebapp.config.json` | `navigationFallback` a `index.html`. | Una ruta profunda de la SPA no da 404 en Azure. |
| `.github/workflows/azure-static-web-apps-*.yml` | Generado por Azure; ajustado para compilar con Node 24 (`setup-node`) y subir el build (`skip_app_build`). | Angular 22 exige Node ≥ 24.15 y el compilador de Azure (Oryx) no siempre lo tiene. |
| `ecosystem.config.cjs` | App en modo cluster + `deploy.production`. | PM2 y PM2 Deploy. Es `.cjs` porque `backend/package.json` declara `"type": "module"`. |
| `deploy/nginx.conf` | Configuración final de Nginx (solo `/api`, HTTPS). | Copia de `/etc/nginx/sites-available/default`. |

> **Secretos:** ni `ecosystem.config.cjs` ni el repo contienen la URI de Atlas, el webhook de Discord ni el token de DuckDNS. La URI vive solo en el servidor (`/var/www/empleados/shared/.env`) y en cada despliegue se enlaza como `backend/.env`.

### Comprobación local antes de desplegar (en tu Mac)

```bash
cd backend  && npm run build && npm test && rm -rf dist && cd ..      # 53 pruebas
cd frontend && npx ng test --watch=false && npx ng build && rm -rf dist && cd ..   # 28 pruebas
```

---

## Fase 1 · Red segura en AWS

### 1.1 Grupo de seguridad (firewall)

1. Consola de AWS → **EC2 → Instancias** → selecciona la instancia → pestaña **Seguridad** → clic en el **Grupo de seguridad**.
2. **Editar reglas de entrada** y deja exactamente estas:

   | Tipo | Puerto | Origen | Motivo |
   |---|---|---|---|
   | HTTP | 80 | `0.0.0.0/0` | Validación de Let's Encrypt y redirección a HTTPS |
   | HTTPS | 443 | `0.0.0.0/0` | API cifrada |
   | SSH | 22 | **Mi IP** | Administración y PM2 Deploy |

3. **Elimina** cualquier regla del puerto `3000` que haya quedado de la práctica PW15 y guarda.

> Si tu IP de casa cambia, el SSH dejará de conectar (`Connection timed out`): vuelve aquí y actualiza la regla 22 con **Mi IP**.

### 1.2 IP elástica (IP fija)

1. **EC2 → Red y seguridad → IP elásticas → Asignar la dirección IP elástica → Asignar**.
2. Selecciónala → **Acciones → Asociar la dirección IP elástica** → tu instancia → **Asociar**.
3. Anota la IP (`18.116.22.239`). Si fuera otra, cámbiala en `ecosystem.config.cjs` (`host`), en Atlas y en DuckDNS.

### 1.3 Permitir la IP del servidor en MongoDB Atlas

1. Atlas → **Security → Network Access → Add IP Address** → `18.116.22.239/32` → **Confirm**. Espera a que aparezca *Active*.
2. Copia la cadena de conexión (**Database → Connect → Drivers**):
   ```
   mongodb+srv://USUARIO:PASSWORD@cluster0.xxxxx.mongodb.net/usuarios_db?appName=Cluster0
   ```

> Sin este paso el backend no conecta, ejecuta `process.exit(1)` (ver `connection.ts`) y Nginx devuelve **502**. El log lo dice claramente: `MongooseServerSelectionError: ... IP that isn't whitelisted`.

---

## Fase 2 · Preparar el servidor

### 2.1 Acceso SSH desde tu Mac

La instancia se creó con un par de llaves `.pem`, pero si no la tienes (o entras por *EC2 Instance Connect* en el navegador), autoriza la llave SSH de tu Mac. En el **servidor**:

```bash
echo 'ssh-ed25519 AAAA...contenido de ~/.ssh/id_ed25519.pub de tu Mac...' >> ~/.ssh/authorized_keys
chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys
```

Hazlo como usuario `ubuntu`, sin `sudo`. En la **Mac**:

```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@18.116.22.239 "echo conectado"
```

> La primera conexión pregunta si confías en el host: responde `yes`. Si se ejecuta sin terminal interactiva (por ejemplo, con el prefijo `!`), falla con `Host key verification failed`; en ese caso añade `-o StrictHostKeyChecking=accept-new`.

Todo lo que sigue en esta fase se ejecuta **en el servidor**.

### 2.2 Sistema, Node.js 24, Git y herramientas de compilación

```bash
sudo apt update && sudo apt upgrade -y

curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs git build-essential
node -v      # v24.x
npm -v
```

> **No ejecutes `sudo apt install npm`**: el paquete `nodejs` de NodeSource ya incluye npm. Con un Node menor a 20.6, el backend no arranca porque no existe `--env-file`.

### 2.3 Memoria swap

Una instancia pequeña se queda sin RAM al instalar dependencias o compilar:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h        # Swap: 2.0Gi
```

### 2.4 Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

`http://18.116.22.239` debe mostrar **“Welcome to nginx!”**.

### 2.5 Firewall de Ubuntu (UFW, opcional)

**Permite OpenSSH antes de activarlo** o perderás el acceso:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

### 2.6 PM2 global

```bash
sudo npm install -g pm2
pm2 -v
```

---

## Fase 3 · Vincular el servidor con GitHub y preparar carpetas

### 3.1 Llave del servidor para GitHub

```bash
ssh-keygen -t ed25519 -C "servidor-produccion"     # Enter en todas las preguntas
cat ~/.ssh/id_ed25519.pub
```

En GitHub: repositorio → **Settings → Deploy keys → Add deploy key** → pega la llave (sin *write access*). Valida:

```bash
ssh -T git@github.com       # yes → "Hi miguesj-hub/...! You've successfully authenticated"
```

### 3.2 Carpetas y permisos

```bash
sudo mkdir -p /var/www/empleados
sudo chown -R ubuntu:ubuntu /var/www/empleados
mkdir -p /var/www/empleados/shared /var/www/empleados/logs
```

Estructura que genera PM2 Deploy:

```
/var/www/empleados/
├── source/     ← clon del repositorio
├── current  →  source
├── shared/     ← .env (sobrevive entre despliegues)
└── logs/       ← err.log y out.log
```

> No hace falta un `git clone` ni un `npm i` manual (apartado 3.3 del PDF): `pm2 deploy` hace ambas cosas. Un clon manual dentro de `/var/www/empleados` no se usa y solo confunde.

### 3.3 Variables de entorno (secreto)

```bash
nano /var/www/empleados/shared/.env
```

```dotenv
MONGO_URI=mongodb+srv://USUARIO:PASSWORD@cluster0.xxxxx.mongodb.net/usuarios_db?appName=Cluster0
```

```bash
chmod 600 /var/www/empleados/shared/.env
```

> Sin comillas ni espacios alrededor de `=`. Si la contraseña tiene `@ : / # ? %`, codifícalos (`@` → `%40`). `PORT` y `NODE_ENV` los pone PM2.

---

## Fase 4 · Nginx como proxy inverso

Configuración inicial, **solo HTTP**, antes de la Fase 7 (Certbot añadirá después el bloque 443):

```bash
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.bak
sudo nano /etc/nginx/sites-available/default
```

```nginx
upstream backend_empleados {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name empleados-miguel.duckdns.org;

    # API REST y Swagger (/api/v1/..., /api/docs)
    location /api/ {
        proxy_pass http://backend_empleados;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # La raíz del dominio de la API lleva a la documentación
    location = / {
        return 302 /api/docs/;
    }

    # El frontend vive en Azure: aquí no se sirve nada más
    location / {
        return 404;
    }
}
```

| Bloque | Qué hace |
|---|---|
| `upstream backend_empleados` | Destino del proxy (cluster PM2 en `127.0.0.1:3000`) con conexiones reutilizables. Para balancear entre más servidores bastaría con añadir líneas `server`. |
| `location /api/` | La API (`/api/v1/empleados`) y Swagger (`/api/docs`) van a Express. |
| `location = /` | La raíz del dominio redirige a Swagger (`/api/docs/`). |
| `location /` | Cualquier otra ruta da 404: la EC2 ya no sirve el frontend. |
| Cabeceras `X-*` | Pasan al backend la IP real del cliente y el protocolo original. |

```bash
sudo nginx -t && sudo systemctl reload nginx
```

La versión final, con HTTPS, está en [`deploy/nginx.conf`](deploy/nginx.conf).

Comandos útiles:

```bash
sudo systemctl reload nginx                          # recarga sin cortar conexiones
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

---

## Fase 5 · PM2 y despliegue automatizado del backend (CI/CD)

### 5.1 El archivo de ecosistema

[`ecosystem.config.cjs`](ecosystem.config.cjs):

```js
const path = require('node:path');
const APP_DIR = '/var/www/empleados';

module.exports = {
  apps: [
    {
      name: 'gestion-empleados',
      cwd: path.join(__dirname, 'backend'),
      script: 'dist/index.js',
      // Ruta absoluta: los workers del cluster no heredan el cwd de la app
      node_args: `--env-file=${path.join(__dirname, 'backend', '.env')}`,
      instances: 'max',               // modo cluster: una réplica por vCPU
      exec_mode: 'cluster',
      env_production: { NODE_ENV: 'production', PORT: 3000 },
      error_file: `${APP_DIR}/logs/err.log`,
      out_file: `${APP_DIR}/logs/out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ],
  deploy: {
    production: {
      user: 'ubuntu',
      host: '18.116.22.239',
      ref: 'origin/main',
      repo: 'git@github.com:miguesj-hub/practica-mean-unidad2.git',
      path: APP_DIR,
      'post-deploy': [ /* ver tabla */ ].join(' && '),
      ssh_options: 'IdentityFile=~/.ssh/id_ed25519'
    }
  }
};
```

`post-deploy` se ejecuta **en el servidor**, dentro de `current/`, tras cada `git pull`:

| # | Comando | Para qué |
|---|---|---|
| 1 | `mkdir -p /var/www/empleados/logs` | Carpeta de logs. |
| 2 | `ln -sf /var/www/empleados/shared/.env backend/.env` | Enlaza el secreto sin versionarlo. |
| 3 | `npm ci --prefix backend` | Dependencias exactas del lockfile. |
| 4 | `npm run build --prefix backend` | TypeScript → `backend/dist/`. |
| 5 | `pm2 reload ecosystem.config.cjs --env production` | Arranca o recarga réplica a réplica (sin caída). |
| 6 | `pm2 save` | Guarda la lista de procesos para restaurarla tras un reinicio. |

> El frontend ya no se compila en la EC2: lo hace GitHub Actions para Azure (Fase 8).

### 5.2 Subir cambios y desplegar (en tu Mac)

PM2 Deploy despliega lo que hay en `origin/main`, **no** tu copia local.

```bash
npm install -g pm2                                    # solo la primera vez
git add <archivos> && git commit -m "..." && git push origin main

pm2 deploy ecosystem.config.cjs production setup      # solo la primera vez: clona en source/
pm2 deploy ecosystem.config.cjs production            # cada despliegue
```

Termina con `--> Success`.

### 5.3 Verificar (en el servidor)

```bash
pm2 list                                   # gestion-empleados ×2, cluster, online
pm2 logs gestion-empleados --lines 20      # "Conexión exitosa a MongoDB" + "Servidor escuchando en el puerto 3000"
curl -s http://127.0.0.1:3000/api/v1/empleados
```

### 5.4 Arranque automático tras reiniciar la instancia

```bash
pm2 startup systemd        # ejecuta la línea "sudo env PATH=..." que imprime
pm2 save
systemctl is-enabled pm2-ubuntu            # enabled
```

### 5.5 Otros comandos de PM2 Deploy (Mac)

```bash
pm2 deploy ecosystem.config.cjs production revert 1         # vuelve al commit anterior
pm2 deploy ecosystem.config.cjs production curr             # commit desplegado
pm2 deploy ecosystem.config.cjs production exec "pm2 list"  # comando remoto
```

---

## Fase 6 · Monitorización, alertas y rotación de logs

### 6.1 Webhook de Discord

Se eligió Discord porque no requiere instalar ninguna app en un espacio de trabajo:

1. Discord → tu servidor (o crea uno con **+** → *Crear el mío*) → canal `#alertas-servidor`.
2. **⚙️ Editar canal → Integraciones → Webhooks → Nuevo webhook → Copiar URL del webhook**.

Prueba desde el servidor (debe responder `HTTP 204` y aparecer el mensaje):

```bash
curl -s -w "HTTP %{http_code}\n" -H "Content-Type: application/json" \
     -d '{"content":"Prueba de webhook desde EC2"}' "URL_DEL_WEBHOOK"
```

> La URL del webhook es un secreto: quien la tenga puede escribir en el canal. No la subas al repositorio. Si se filtra, bórrala y crea otra.

### 6.2 Alertas de PM2 (`pm2-discord`)

```bash
pm2 install pm2-discord               # queda "errored" hasta definir la URL: es normal
pm2 set pm2-discord:discord_url "URL_DEL_WEBHOOK"
pm2 set pm2-discord:process_name gestion-empleados
pm2 set pm2-discord:log false         # no reenviar stdout (morgan escribe una línea por petición)
for e in error exception stop exit restart kill online; do pm2 set pm2-discord:$e true; done
pm2 set pm2-discord:"restart overlimit" true
pm2 save
```

> El PDF propone `pm2-notify`; en este despliegue se usó `pm2-discord`, que se instala como módulo nativo de PM2 (`pm2 install`) y lleva la configuración con `pm2 set`. Para Slack existe el equivalente `pm2-slack` (`pm2 set pm2-slack:slack_url ...`).

### 6.3 Rotación de logs

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
pm2 conf pm2-logrotate
```

### 6.4 Monitorización en vivo

```bash
pm2 monit
pm2 show gestion-empleados
df -h
```

---

## Fase 7 · Dominio y HTTPS para la API

El frontend de Azure se sirve por HTTPS, así que la API también debe estarlo. Let's Encrypt no emite certificados para IPs ni para `*.compute.amazonaws.com`, por eso se usa un subdominio gratuito.

### 7.1 Subdominio en DuckDNS

1. Entra en https://www.duckdns.org (con GitHub o Google).
2. Crea el subdominio `empleados-miguel`.
3. **Ojo:** DuckDNS rellena *current ip* con la IP **de tu casa**. Cámbiala por la IP elástica. La forma más fiable es por URL (desde cualquier equipo):
   ```bash
   curl "https://www.duckdns.org/update?domains=empleados-miguel&token=TU_TOKEN&ip=18.116.22.239"
   # OK
   ```
   El token aparece arriba en duckdns.org. No lo subas al repositorio.
4. Verifica contra los servidores de DuckDNS (no depende de caché):
   ```bash
   dig +short empleados-miguel.duckdns.org @ns5.duckdns.org     # 18.116.22.239
   ```

### 7.2 Certificado con Certbot (en el servidor)

Con Nginx ya configurado con `server_name empleados-miguel.duckdns.org` (Fase 4):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d empleados-miguel.duckdns.org \
     --non-interactive --agree-tos --register-unsafely-without-email --redirect
sudo nginx -t
systemctl is-active certbot.timer       # active → renovación automática
sudo certbot renew --dry-run            # simulación de renovación
```

Certbot añade `listen 443 ssl`, los certificados y la redirección 301 de HTTP a HTTPS. El resultado está en [`deploy/nginx.conf`](deploy/nginx.conf). El certificado dura 90 días y `certbot.timer` lo renueva solo.

> A partir de aquí la API se usa siempre por el dominio: `http://18.116.22.239/api/...` devuelve 404 porque ya no coincide con `server_name`.

---

## Fase 8 · Frontend en Azure Static Web Apps

### 8.1 Crear el recurso

Portal de Azure → **Aplicación web estática → Crear**:

| Campo | Valor |
|---|---|
| Suscripción | *Azure for Students* |
| Grupo de recursos | Nuevo, p. ej. `rg-gestion-empleados` |
| Nombre | `front-empleados` |
| Plan | **Free** |
| Región | **East US 2** (o Central US / West Europe; ver nota) |
| Origen | **GitHub** → `miguesj-hub` → `practica-mean-unidad2` → `main` |
| Valores preestablecidos | **Angular** |
| Ubicación de la aplicación | `/frontend` |
| Ubicación de la API | *(vacío)* |
| Ubicación de salida | `dist/frontend/browser` |

**Revisar y crear.** Azure hace un commit en el repo con `.github/workflows/azure-static-web-apps-<nombre>.yml` y un secreto `AZURE_STATIC_WEB_APPS_API_TOKEN_...` en GitHub.

> **`RequestDisallowedByAzure`**: la suscripción de estudiante solo permite ciertas regiones. Elige otra región entre las que admite Static Web Apps (East US 2, Central US, West US 2, West Europe, East Asia). Las regiones permitidas se ven en **Directiva → Asignaciones → *Allowed resource deployment regions* → Parámetros**.

### 8.2 Traer el workflow al repo local

```bash
git pull origin main
```

### 8.3 Ajustar el workflow (compilar con Node 24)

El compilador de Azure (Oryx) elige su propia versión de Node y puede quedarse por debajo de la que exige Angular 22 (`^24.15`). Por eso el workflow compila Angular con `actions/setup-node` y Azure solo sube el resultado:

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - name: Build Angular
        working-directory: frontend
        run: |
          npm ci
          npx ng build
        env:
          NG_CLI_ANALYTICS: "false"
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          # ...
          app_location: "./frontend/dist/frontend/browser"
          api_location: ""
          output_location: ""
          skip_app_build: true
```

### 8.4 URL de la API y CORS

- `frontend/src/environments/environment.ts` → `apiUrl: 'https://empleados-miguel.duckdns.org/api/v1'`.
- `backend/src/app.ts` → `cors({ origin: [/^https:\/\/blue-sand-076769b1e(-\d+)?\.(\w+\.)?\d\.azurestaticapps\.net$/, 'http://localhost:4200'] })`. La expresión regular también admite los entornos de vista previa que Azure crea para cada pull request.

Tras cambiar el CORS hay que desplegar el backend (`pm2 deploy ecosystem.config.cjs production`).

### 8.5 Flujo CI/CD del frontend

```bash
git push origin main          # → GitHub Actions compila Angular y publica en Azure (~1 min)
gh run list --limit 3         # estado de los despliegues (o pestaña Actions en GitHub)
```

---

## Pruebas de verificación (criterios de evaluación)

### Prueba 1 · Red

| URL | Resultado esperado |
|---|---|
| https://blue-sand-076769b1e.1.azurestaticapps.net/ | La app con la lista de empleados (datos desde Atlas). |
| https://empleados-miguel.duckdns.org/api/v1/empleados | `{ "success": true, "data": [...] }`, candado válido (Let's Encrypt). |
| https://empleados-miguel.duckdns.org/api/docs/ | Swagger UI; “Try it out” funciona. |
| http://empleados-miguel.duckdns.org/api/v1/empleados | Redirección 301 a HTTPS. |
| http://18.116.22.239:3000/ | **No carga** (timeout): el puerto está cerrado. |

Desde terminal:

```bash
A=https://empleados-miguel.duckdns.org/api/v1/empleados
curl -i $A
curl -m 5 http://18.116.22.239:3000/                                   # timeout
# CORS: el dominio de Azure recibe la cabecera, uno ajeno no
curl -si $A -H "Origin: https://blue-sand-076769b1e.1.azurestaticapps.net" | grep -i access-control
curl -si $A -H "Origin: https://evil.com" | grep -i access-control      # sin salida
```

Crea, edita y borra un empleado desde la interfaz de Azure para confirmar el CRUD completo. En DevTools (F12 → Red) se ven las peticiones a `empleados-miguel.duckdns.org`.

### Prueba 2 · Resiliencia (simular una caída)

En el servidor:

```bash
pm2 stop gestion-empleados       # → alertas "stop"/"exit" en Discord (una por réplica)
pm2 list                         # stopped; la API devuelve 502
pm2 start gestion-empleados      # → online de nuevo
```

Autorrecuperación del cluster:

```bash
pm2 list                         # anota el PID de una réplica
kill -9 <PID>
pm2 list                         # PM2 la relanza sola (sube el contador ↺)
```

### Prueba 3 · CI/CD

- **Frontend:** cambia algo visible en `frontend/src/app/app.html` → `git push origin main` → espera a que termine GitHub Actions → refresca la URL de Azure.
- **Backend:** cambia algo en el backend → `git push origin main` → `pm2 deploy ecosystem.config.cjs production` → comprueba el cambio en la API.

En ninguno de los dos casos hace falta entrar a la consola de AWS o Azure.

### Prueba 4 · Carga (opcional)

```bash
npx artillery run --target https://empleados-miguel.duckdns.org stress-test.yml
```

`--target` sustituye el `http://127.0.0.1:3000` del archivo; las rutas (`/api/v1/empleados`) no cambian. Cada réplica abre un pool de 20 conexiones a Atlas (`minPoolSize`); el plan M0 admite 500.

---

## Operación diaria

| Acción | Comando |
|---|---|
| Ver procesos (servidor) | `pm2 list` |
| Logs en vivo (servidor) | `pm2 logs gestion-empleados` |
| Log del daemon de PM2 (servidor) | `tail -n 30 ~/.pm2/pm2.log` |
| Reiniciar sin caída (servidor) | `pm2 reload gestion-empleados` |
| Cambiar la URI de Atlas (servidor) | `nano /var/www/empleados/shared/.env` y luego `pm2 reload gestion-empleados` |
| Desplegar backend (Mac) | `pm2 deploy ecosystem.config.cjs production` |
| Revertir backend (Mac) | `pm2 deploy ecosystem.config.cjs production revert 1` |
| Desplegar frontend (Mac) | `git push origin main` |
| Estado del frontend (Mac) | `gh run list --limit 3` |
| Estado de Nginx (servidor) | `sudo systemctl status nginx` |
| Estado del certificado (servidor) | `sudo certbot certificates` |

---

## Solución de problemas

| Síntoma | Causa probable | Cómo resolverlo |
|---|---|---|
| La app de Azure carga pero **sin datos** (“No se pudo contactar con el servidor”) | API caída, DNS mal, sin HTTPS o CORS. | F12 → Consola/Red. Luego `curl -i https://empleados-miguel.duckdns.org/api/v1/empleados` y las pruebas de CORS de la Prueba 1. |
| Consola: `Mixed Content ... requested an insecure resource 'http://...'` | `environment.ts` apunta a `http://`. | Usa `https://empleados-miguel.duckdns.org/api/v1` y haz push. |
| Consola: `blocked by CORS policy: No 'Access-Control-Allow-Origin'` | El origen de Azure no está en `cors({ origin })`. | Revisa `backend/src/app.ts` y despliega el backend. |
| **502** en `/api/...` | El backend no está `online` o se cae al arrancar. | `pm2 list`, `pm2 logs gestion-empleados --lines 50` y `tail ~/.pm2/pm2.log`. |
| Log: `MongooseServerSelectionError ... isn't whitelisted` | Atlas no permite la IP de la EC2. | Fase 1.3. |
| Log: `bad auth : authentication failed` | Usuario o contraseña incorrectos en `MONGO_URI`. | Corrige `shared/.env` y `pm2 reload gestion-empleados`. |
| `~/.pm2/pm2.log`: `node: .env: not found` y estado `errored` | Falta `shared/.env`, falta el enlace, o `node_args` usa una ruta relativa (en modo cluster se resuelve desde el directorio del daemon). | `ls -l /var/www/empleados/current/backend/.env`; `node_args` debe llevar ruta absoluta. |
| `npm ERR! Missing script: "build"` en el servidor | El servidor tiene una versión del repo anterior a los cambios, o se ejecutan a mano comandos pensados para la Mac. | Haz push y usa `pm2 deploy`; no compiles a mano en el servidor. |
| `http://18.116.22.239/` o una ruta fuera de `/api` devuelve 404 | Es lo esperado: la EC2 solo expone `/api` por el dominio (la raíz `https://empleados-miguel.duckdns.org/` redirige a Swagger). | Usa `https://empleados-miguel.duckdns.org/api/...`. |
| `dig` devuelve la IP de tu casa | DuckDNS guardó la IP del navegador. | `curl "https://www.duckdns.org/update?domains=empleados-miguel&token=...&ip=18.116.22.239"`. |
| Certbot: `Timeout during connect` / `unauthorized` | El DNS aún no apunta a la EC2 o el puerto 80 está cerrado. | `dig @ns5.duckdns.org` y regla HTTP 80 en el Security Group. |
| Azure: `RequestDisallowedByAzure` | Región no permitida en la suscripción de estudiante. | Fase 8.1, nota de regiones. |
| GitHub Actions: `The Angular CLI requires a minimum Node.js version` | Oryx compiló con un Node demasiado antiguo. | Workflow con `setup-node` + `skip_app_build` (Fase 8.3). No declares `engines` en `frontend/package.json`: Oryx lo usaría para elegir un Node inadecuado. |
| Azure muestra 404 en una ruta profunda | Falta `staticwebapp.config.json`. | Debe estar en `frontend/public/` para que se copie al build. |
| `pm2 deploy`: `Permission denied (publickey)` | La llave de `ssh_options` no está autorizada en el servidor. | Fase 2.1. |
| `pm2 deploy`: `Connection timed out` | Tu IP cambió y la regla SSH ya no coincide. | Regla 22 → **Mi IP**. |
| `pm2 deploy`: `destination path ... already exists` | Ya se había ejecutado `setup`. | No repitas `setup`. |
| No llegan alertas a Discord | Módulo `errored` o URL incorrecta. | `pm2 list` (sección Modules), prueba el webhook con `curl` (6.1). |
| El deploy muere con `Killed` | Falta memoria. | Fase 2.3 (swap). |

---

## Checklist de evidencias para el informe

- [ ] Reglas de entrada del Security Group (80, 443, 22 con Mi IP; sin 3000).
- [ ] IP elástica asociada a la instancia.
- [ ] IP de la EC2 en Network Access de Atlas.
- [ ] `node -v`, `nginx -v`, `pm2 -v` en el servidor.
- [ ] `ssh -T git@github.com` exitoso desde el servidor.
- [ ] Salida de `pm2 deploy ecosystem.config.cjs production` terminando en `Success`.
- [ ] `pm2 list` con 2 réplicas en modo `cluster` y los módulos `pm2-discord` y `pm2-logrotate`.
- [ ] Subdominio de DuckDNS apuntando a `18.116.22.239`.
- [ ] Salida de Certbot (“Congratulations! You have successfully enabled HTTPS”) y candado en el navegador.
- [ ] `sudo nginx -t` y contenido final de `/etc/nginx/sites-available/default`.
- [ ] Recurso Static Web App en el portal de Azure (plan Free).
- [ ] Ejecución exitosa en GitHub → Actions.
- [ ] App en `https://blue-sand-076769b1e.1.azurestaticapps.net/` con datos, y DevTools mostrando las llamadas a `empleados-miguel.duckdns.org`.
- [ ] Swagger en `https://empleados-miguel.duckdns.org/api/docs/`.
- [ ] `http://18.116.22.239:3000/` sin respuesta.
- [ ] Alertas en Discord tras `pm2 stop gestion-empleados`.
- [ ] Cambio visual antes/después del flujo CI/CD (frontend y backend).
- [ ] `pm2 conf pm2-logrotate`.
- [ ] `pm2 list` después de `sudo reboot` (arranque automático).
