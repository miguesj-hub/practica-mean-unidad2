# Despliegue en producción — AWS EC2 + Nginx + PM2

Guía paso a paso para desplegar **Gestión de Empleados** (Angular + Express/TypeScript + MongoDB Atlas) según la práctica **PDA06 — Despliegue de Aplicaciones Node.js en Producción utilizando AWS, Nginx y PM2**. La creación de la instancia EC2 (práctica PW15) se da por hecha.

| Dato | Valor |
|---|---|
| Repositorio | `git@github.com:miguesj-hub/practica-mean-unidad2.git` |
| Rama de despliegue | `main` |
| Servidor | Ubuntu Server en EC2, región `us-east-2` |
| IP pública | `18.116.22.239` (debe ser una **IP elástica**, ver Fase 1) |
| DNS público | `http://ec2-18-116-22-239.us-east-2.compute.amazonaws.com/` |
| Ruta en el servidor | `/var/www/empleados` |
| Proceso PM2 | `gestion-empleados` |
| Puerto interno del backend | `3000` (nunca expuesto al público) |

---

## Índice

0. [Arquitectura](#0-arquitectura)
1. [Qué se adaptó en el repositorio](#1-qué-se-adaptó-en-el-repositorio)
2. [Fase 1 · Red segura en AWS](#fase-1--red-segura-en-aws)
3. [Fase 2 · Preparar el servidor](#fase-2--preparar-el-servidor)
4. [Fase 3 · Vincular el servidor con GitHub y preparar carpetas](#fase-3--vincular-el-servidor-con-github-y-preparar-carpetas)
5. [Fase 4 · Nginx como proxy inverso](#fase-4--nginx-como-proxy-inverso)
6. [Fase 5 · PM2 y despliegue automatizado (CI/CD)](#fase-5--pm2-y-despliegue-automatizado-cicd)
7. [Fase 6 · Monitorización, alertas y rotación de logs](#fase-6--monitorización-alertas-y-rotación-de-logs)
8. [Pruebas de verificación](#pruebas-de-verificación-criterios-de-evaluación)
9. [Operación diaria](#operación-diaria)
10. [Solución de problemas](#solución-de-problemas)
11. [Checklist de evidencias para el informe](#checklist-de-evidencias-para-el-informe)
12. [Opcional: HTTPS con Certbot](#opcional-https-con-certbot)

---

## 0. Arquitectura

```
                         ┌──────────────────── AWS EC2 (Ubuntu) ─────────────────────┐
                         │                                                           │
Navegador ──► Security ──► IP elástica ──► Nginx :80 ─┬─ /       → archivos estáticos │
              Group                                   │            de Angular (disco)│
              80 · 443 · 22 (solo mi IP)              │                               │
                                                      └─ /api/*  → upstream           │
                                                                   127.0.0.1:3000     │
                                                                        │             │
                                                      PM2 (modo cluster, 1 réplica    │
                                                      por vCPU) → backend/dist/index.js
                                                                        │             │
                         └──────────────────────────────────────────────┼─────────────┘
                                                                        ▼
                                                               MongoDB Atlas (externo)
```

**Por qué así**

- **Nginx** es el único proceso expuesto a Internet. Sirve el frontend compilado directamente desde disco (sin pasar por Node) y reenvía `/api/*` al backend.
- **PM2 en modo cluster** levanta una réplica de Express por núcleo y reparte las conexiones entre ellas. Si una réplica cae, PM2 la reinicia.
- **El puerto 3000 no se abre en el Security Group**: el backend solo es accesible desde el propio servidor, a través de Nginx.
- **La base de datos está fuera de la EC2** (MongoDB Atlas), como recomienda la práctica: si la instancia se satura o se reemplaza, los datos no se pierden.
- **Frontend y API comparten origen** (`http://IP/` y `http://IP/api`), así que no hay problemas de CORS ni direcciones codificadas.

---

## 1. Qué se adaptó en el repositorio

La práctica asume una app Node.js con un `index.js` en la raíz. Este repo es un monorepo TypeScript (`backend/` + `frontend/`), así que se hicieron estos ajustes:

| Archivo | Cambio | Motivo |
|---|---|---|
| `backend/tsconfig.build.json` | Nuevo. Compila `src/` → `dist/` excluyendo los `*.spec.ts`. | El modo cluster de PM2 ejecuta los workers con `node`; no puede usar `tsx` como intérprete. Se necesita JavaScript compilado. |
| `backend/package.json` | Scripts `build` (`tsc -p tsconfig.build.json`) y `start` (`node --env-file=.env dist/index.js`). | Compilación y arranque de producción. |
| `backend/src/docs/openapi.ts` | `servers` pasa a `/api/v1` (relativo). | Para que “Try it out” de Swagger funcione detrás de Nginx. |
| `frontend/src/app/services/employee.service.ts` | La URL de la API pasa de `http://127.0.0.1:3000/api/v1/empleados` a `/api/v1/empleados`. | En producción, `127.0.0.1` apuntaría a la máquina del **usuario**, no al servidor. |
| `frontend/proxy.conf.json` + `frontend/angular.json` | `ng serve` redirige `/api` a `http://127.0.0.1:3000`. | El desarrollo local sigue funcionando igual con `npm start`. |
| `frontend/src/app/services/employee.service.spec.ts` | La constante de la URL se actualizó. | Las 28 pruebas siguen pasando. |
| `ecosystem.config.cjs` | Nuevo, en la raíz. App en modo cluster + bloque `deploy.production`. | Configuración de PM2 y PM2 Deploy. Es `.cjs` porque `backend/package.json` declara `"type": "module"`. |
| `deploy/nginx.conf` | Nuevo. Configuración del sitio para Nginx. | Se copia a `/etc/nginx/sites-available/default` en el servidor. |

> **Secretos:** `ecosystem.config.cjs` **no** contiene la URI de Atlas. Esta vive únicamente en el servidor, en `/var/www/empleados/shared/.env`, y en cada despliegue se enlaza como `backend/.env`. Por eso el ecosistema se puede subir a GitHub sin riesgo.

> **Archivo sobrante:** `module.js` (borrador anterior del ecosistema) ya no se usa y puede eliminarse.

### Comprobación local antes de desplegar

```bash
cd backend  && npm run build && ls dist/index.js && rm -rf dist && cd ..
cd frontend && npm run build && ls dist/frontend/browser/index.html && rm -rf dist && cd ..
cd frontend && npx ng test --watch=false && cd ..        # 28 pruebas en verde
```

---

## Fase 1 · Red segura en AWS

### 1.1 Grupo de seguridad (firewall)

1. Consola de AWS → **EC2 → Instancias** → selecciona tu instancia.
2. Pestaña **Seguridad** → clic en el **Grupo de seguridad**.
3. **Editar reglas de entrada** y deja exactamente estas:

   | Tipo | Puerto | Origen | Motivo |
   |---|---|---|---|
   | HTTP | 80 | `0.0.0.0/0` (Anywhere-IPv4) | Tráfico web |
   | HTTPS | 443 | `0.0.0.0/0` (Anywhere-IPv4) | Tráfico web cifrado (futuro) |
   | SSH | 22 | **Mi IP** | Administración y PM2 Deploy |

4. **Elimina** cualquier regla del puerto `3000` que haya quedado de la práctica PW15.
5. Guarda las reglas.

> Si tu IP de casa cambia (por ejemplo, al reiniciar el router), el SSH dejará de conectar. Vuelve a esta pantalla y actualiza la regla 22 con **Mi IP**.

### 1.2 IP elástica (IP fija)

Sin IP elástica, AWS cambia la IP pública cada vez que la instancia se detiene y arranca, y se rompen tanto el `host` de PM2 Deploy como la regla de Atlas.

1. **EC2 → Red y seguridad → IP elásticas**.
2. Si `18.116.22.239` ya aparece en la lista asociada a tu instancia, ya está hecho; pasa a 1.3.
3. Si no: **Asignar la dirección IP elástica → Asignar**.
4. Selecciónala → **Acciones → Asociar la dirección IP elástica** → elige tu instancia → **Asociar**.
5. Si la IP nueva es distinta de `18.116.22.239`, actualiza el campo `host` de `ecosystem.config.cjs` y usa la nueva IP en el resto de la guía.

### 1.3 Permitir la IP del servidor en MongoDB Atlas

1. Atlas → tu proyecto → **Security → Network Access → Add IP Address**.
2. Introduce `18.116.22.239/32` (tu IP elástica) y una descripción, por ejemplo `EC2 produccion`.
3. **Confirm** y espera a que el estado pase a *Active*.

> Si falta este paso, el backend arranca, no consigue conectar, ejecuta `process.exit(1)` (ver `connection.ts`) y Nginx devuelve **502 Bad Gateway**.

4. Ten a mano la cadena de conexión: **Database → Connect → Drivers**, del tipo:
   ```
   mongodb+srv://USUARIO:PASSWORD@cluster0.xxxxx.mongodb.net/usuarios_db?retryWrites=true&w=majority
   ```

---

## Fase 2 · Preparar el servidor

### 2.1 Conectarse por SSH (desde tu Mac)

```bash
chmod 400 ~/.ssh/TU-LLAVE-AWS.pem
ssh -i ~/.ssh/TU-LLAVE-AWS.pem ubuntu@18.116.22.239
```

Todo lo que sigue en esta fase se ejecuta **en el servidor**.

### 2.2 Actualizar el sistema

```bash
sudo apt update && sudo apt upgrade -y
```

Si aparece una pantalla preguntando por reiniciar servicios, acepta con Enter.

### 2.3 Node.js 24 LTS y npm

El proyecto exige **Node 24+** (usa `--env-file` y lo indica el README).

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v      # v24.x
npm -v
```

> **No ejecutes `sudo apt install npm`**: el paquete `nodejs` de NodeSource ya trae npm, y el `npm` de Ubuntu entra en conflicto con él.

### 2.4 Git y herramientas de compilación

```bash
sudo apt install -y git build-essential
git --version
```

### 2.5 Memoria swap (imprescindible en t2.micro/t3.micro)

`ng build` puede consumir más de 1 GB de RAM y, sin swap, el proceso muere con `Killed` o `JavaScript heap out of memory`.

```bash
free -h                                   # mira la memoria actual
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab   # persistente tras reinicio
free -h                                   # ahora debe aparecer Swap: 2.0Gi
```

### 2.6 Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx
sudo systemctl status nginx               # active (running); sal con q
```

Abre `http://18.116.22.239` en el navegador: debe aparecer **“Welcome to nginx!”**.

### 2.7 Firewall de Ubuntu (UFW, opcional)

El Security Group ya filtra el tráfico; UFW añade una segunda capa. **Permite OpenSSH antes de activarlo** o perderás el acceso a la instancia.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'               # 80 y 443
sudo ufw enable                           # responde y
sudo ufw status
```

### 2.8 PM2 global

```bash
sudo npm install -g pm2
pm2 -v
```

---

## Fase 3 · Vincular el servidor con GitHub y preparar carpetas

### 3.1 Deploy key (el servidor debe poder hacer `git clone`)

En el **servidor**:

```bash
ssh-keygen -t ed25519 -C "servidor-produccion"
# Pulsa Enter en todas las preguntas (ruta por defecto, sin passphrase)
cat ~/.ssh/id_ed25519.pub
```

Copia la línea completa (`ssh-ed25519 AAAA... servidor-produccion`) y en GitHub:

1. Repositorio **miguesj-hub/practica-mean-unidad2** → **Settings → Deploy keys → Add deploy key**.
2. *Title*: `EC2 produccion`. *Key*: pega la llave. **No** marques *Allow write access*.
3. **Add key**.

Valida la conexión desde el servidor:

```bash
ssh -T git@github.com
# Are you sure you want to continue connecting (yes/no)? → yes
# Hi miguesj-hub/practica-mean-unidad2! You've successfully authenticated...
```

### 3.2 Carpeta de despliegue y permisos

```bash
sudo mkdir -p /var/www/empleados
sudo chown -R ubuntu:ubuntu /var/www/empleados
mkdir -p /var/www/empleados/shared /var/www/empleados/logs
```

PM2 Deploy creará dentro esta estructura:

```
/var/www/empleados/
├── source/     ← clon del repositorio (lo crea "pm2 deploy ... setup")
├── current  →  source (enlace simbólico que usa Nginx y PM2)
├── shared/     ← archivos que sobreviven entre despliegues (.env)
└── logs/       ← err.log y out.log del backend
```

### 3.3 Variables de entorno de producción (secreto)

```bash
nano /var/www/empleados/shared/.env
```

Contenido (con tu cadena real de Atlas):

```dotenv
MONGO_URI=mongodb+srv://USUARIO:PASSWORD@cluster0.xxxxx.mongodb.net/usuarios_db?retryWrites=true&w=majority
```

Guarda con `Ctrl+O`, Enter, `Ctrl+X`. Luego:

```bash
chmod 600 /var/www/empleados/shared/.env
```

> `PORT` y `NODE_ENV` los define PM2 (`env_production` en `ecosystem.config.cjs`). Si la contraseña tiene caracteres especiales (`@`, `:`, `/`, `#`…), codifícalos en la URI (por ejemplo, `@` → `%40`).

> No hace falta el `git clone` ni el `npm i` manual del apartado 3.3 del PDF: `pm2 deploy` clona, instala y compila automáticamente.

---

## Fase 4 · Nginx como proxy inverso

### 4.1 Configurar el sitio por defecto

En el **servidor**:

```bash
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.bak   # respaldo
sudo nano /etc/nginx/sites-available/default
```

Borra todo el contenido (`Ctrl+K` repetidamente) y pega el de [`deploy/nginx.conf`](deploy/nginx.conf):

```nginx
# /etc/nginx/sites-available/default
# Nginx sirve el build de Angular y hace de proxy inverso hacia el cluster PM2.

upstream backend_empleados {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/empleados/current/frontend/dist/frontend/browser;
    index index.html;

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

    # SPA de Angular: cualquier ruta desconocida vuelve a index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

| Bloque | Qué hace |
|---|---|
| `upstream backend_empleados` | Define el destino del proxy (el cluster PM2 en `127.0.0.1:3000`) y mantiene conexiones reutilizables con `keepalive`. Para añadir más backends bastaría con más líneas `server`. |
| `root …/browser` | Carpeta donde `ng build` deja el frontend compilado. |
| `location /api/` | Todo lo que empieza por `/api/` va a Express: la API (`/api/v1/empleados`) y Swagger (`/api/docs`). |
| `location /` | Sirve archivos de Angular; si no existen, devuelve `index.html` (necesario en una SPA). |
| Cabeceras `X-*` | Pasan al backend la IP real del cliente y el protocolo original. |

### 4.2 Validar y recargar

```bash
sudo nginx -t                    # syntax is ok / test is successful
sudo systemctl reload nginx
```

> Hasta que termine el primer despliegue, la carpeta `current/` no existe y Nginx responderá **404/500**. Es lo esperado.

### Comandos útiles de Nginx

```bash
sudo systemctl stop nginx        # detener
sudo systemctl start nginx       # iniciar
sudo systemctl reload nginx      # recargar configuración sin cortar conexiones
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

---

## Fase 5 · PM2 y despliegue automatizado (CI/CD)

### 5.1 El archivo de ecosistema

[`ecosystem.config.cjs`](ecosystem.config.cjs), en la raíz del repo:

```js
const path = require('node:path');
const APP_DIR = '/var/www/empleados';

module.exports = {
  apps: [
    {
      name: 'gestion-empleados',
      cwd: path.join(__dirname, 'backend'),
      script: 'dist/index.js',
      node_args: '--env-file=.env',   // carga MONGO_URI desde backend/.env → shared/.env
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
      'post-deploy': [ /* ver abajo */ ].join(' && '),
      ssh_options: 'IdentityFile=~/.ssh/TU-LLAVE-AWS.pem'
    }
  }
};
```

El `post-deploy` se ejecuta **en el servidor**, dentro de `current/`, después de cada `git pull`:

| # | Comando | Para qué |
|---|---|---|
| 1 | `mkdir -p /var/www/empleados/logs` | Asegura la carpeta de logs. |
| 2 | `ln -sf /var/www/empleados/shared/.env backend/.env` | Enlaza el secreto sin versionarlo. |
| 3 | `npm ci --prefix backend` | Instala las dependencias exactas del `package-lock.json`. |
| 4 | `npm run build --prefix backend` | Compila TypeScript → `backend/dist/`. |
| 5 | `npm ci --prefix frontend` | Dependencias del frontend. |
| 6 | `NG_CLI_ANALYTICS=false npm run build --prefix frontend` | Compila Angular → `frontend/dist/frontend/browser/`. |
| 7 | `pm2 reload ecosystem.config.cjs --env production` | Arranca el cluster o lo recarga réplica a réplica (sin caída del servicio). |
| 8 | `pm2 save` | Guarda la lista de procesos para restaurarla tras un reinicio. |

### 5.2 Ajustar la llave SSH local

En tu **Mac**, edita `ecosystem.config.cjs` y cambia:

```js
ssh_options: 'IdentityFile=~/.ssh/TU-LLAVE-AWS.pem'
```

por la ruta real de tu `.pem` (la **privada** que descargaste al crear la instancia, **no** un archivo `.pub`). Comprueba que conecta:

```bash
ssh -i ~/.ssh/TU-LLAVE-AWS.pem ubuntu@18.116.22.239 "echo conectado"
```

### 5.3 Subir los cambios a GitHub

En tu **Mac**, desde la raíz del repo. Añade los archivos de forma explícita: `git add .` incluiría cambios que no pertenecen al despliegue (por ejemplo, el borrado de `INFORME-PRUEBAS.docx`).

```bash
cd ~/dev/code-p3
git status
git add DESPLIEGUE.md ecosystem.config.cjs deploy/ \
        backend/package.json backend/tsconfig.build.json backend/src/docs/openapi.ts \
        frontend/angular.json frontend/proxy.conf.json frontend/src/app/services/
git commit -m "feat: configuración de despliegue con PM2 y Nginx"
git push origin main
```

> PM2 Deploy despliega lo que hay en `origin/main`, **no** tu copia local. Todo cambio debe estar en GitHub antes de desplegar.

### 5.4 Instalar PM2 en local

```bash
npm install -g pm2
pm2 -v
```

### 5.5 Primer despliegue

En tu **Mac**, en la raíz del repo:

```bash
# 1. Crea /var/www/empleados/{source,shared,current} y clona el repositorio en el servidor
pm2 deploy ecosystem.config.cjs production setup

# 2. git pull + post-deploy (instala, compila y levanta el cluster)
pm2 deploy ecosystem.config.cjs production
```

El segundo comando tarda unos minutos la primera vez (dos `npm ci` y el build de Angular). Al final debe terminar con `--> Success`.

### 5.6 Verificar en el servidor

```bash
pm2 list
```

Debe mostrar `gestion-empleados` con modo `cluster`, estado `online` y tantas filas como vCPU tenga la instancia.

```bash
pm2 logs gestion-empleados --lines 30
# Busca: 🔄 [Database]: Conexión exitosa a MongoDB ...
#        Servidor escuchando en el puerto 3000

curl -s http://127.0.0.1:3000/api/v1/empleados    # respuesta JSON directa del backend
curl -s http://127.0.0.1/api/v1/empleados         # la misma respuesta, pasando por Nginx
```

### 5.7 Arranque automático tras reiniciar la instancia

En el **servidor**:

```bash
pm2 startup systemd
# Imprime una línea que empieza por "sudo env PATH=..." → cópiala y ejecútala
pm2 save
```

Prueba: `sudo reboot`, espera un minuto, vuelve a conectar y ejecuta `pm2 list`. La app debe estar `online` sin haber hecho nada.

### 5.8 Despliegues siguientes (flujo CI/CD)

```bash
# en tu Mac
git add <archivos> && git commit -m "..." && git push origin main
pm2 deploy ecosystem.config.cjs production
```

Otros comandos de PM2 Deploy:

```bash
pm2 deploy ecosystem.config.cjs production revert 1      # vuelve al commit anterior
pm2 deploy ecosystem.config.cjs production curr          # commit desplegado actualmente
pm2 deploy ecosystem.config.cjs production exec "pm2 list"   # ejecuta un comando remoto
```

---

## Fase 6 · Monitorización, alertas y rotación de logs

### 6.1 Crear el webhook de Slack

1. Entra en el **Slack App Directory** e inicia sesión en tu espacio de trabajo.
2. Busca **Incoming WebHooks → Añadir a Slack**.
3. Elige o crea el canal, por ejemplo `#alertas-servidor`.
4. **Añadir integración con Incoming WebHooks**.
5. Copia la **URL de Webhook** (`https://hooks.slack.com/services/...`).

> Con Discord: *Ajustes del canal → Integraciones → Webhooks → Nuevo webhook → Copiar URL*.

Antes de configurar PM2, comprueba que el webhook funciona desde el servidor:

```bash
curl -X POST -H 'Content-type: application/json' \
     --data '{"text":"Prueba de webhook desde EC2"}' \
     "https://hooks.slack.com/services/XXX/YYY/ZZZ"
# Debe responder "ok" y aparecer el mensaje en el canal
```

### 6.2 Notificaciones automáticas de PM2

En el **servidor**. Primero la opción que propone la práctica:

```bash
sudo npm install pm2-notify -g
pm2 set pm2-notify:slackUrl "https://hooks.slack.com/services/XXX/YYY/ZZZ"
# pm2 set pm2-notify:discordUrl "URL_DEL_WEBHOOK_DE_DISCORD"
pm2 set pm2-notify:events "error,exit"
pm2 set pm2-notify:apps "gestion-empleados"
pm2 save --force
pm2 logs pm2-notify
```

**Si con esa opción no llegan alertas** (haz la prueba de resiliencia para comprobarlo), usa el módulo `pm2-slack`, que se instala como módulo nativo de PM2:

```bash
pm2 install pm2-slack
pm2 set pm2-slack:slack_url "https://hooks.slack.com/services/XXX/YYY/ZZZ"
pm2 set pm2-slack:servername "EC2-produccion"
pm2 set pm2-slack:stop true
pm2 set pm2-slack:exit true
pm2 set pm2-slack:error true
pm2 set pm2-slack:exception true
pm2 set pm2-slack:restart true
pm2 save
```

Para Discord existe el equivalente `pm2-discord`:

```bash
pm2 install pm2-discord
pm2 set pm2-discord:discord_url "URL_DEL_WEBHOOK_DE_DISCORD"
```

### 6.3 Rotación de logs (evita llenar el disco)

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M       # rota cada 10 MB
pm2 set pm2-logrotate:retain 7           # conserva 7 archivos
pm2 set pm2-logrotate:compress true      # comprime los rotados
pm2 conf pm2-logrotate                   # muestra la configuración
```

### 6.4 Monitorización en vivo

```bash
pm2 monit                 # CPU, memoria y logs por réplica, en tiempo real
pm2 show gestion-empleados
df -h                     # espacio en disco
```

---

## Pruebas de verificación (criterios de evaluación)

### Prueba 1 · Red

| Desde tu navegador | Resultado esperado |
|---|---|
| `http://18.116.22.239/` | Interfaz de Angular con la lista de empleados, **sin** poner `:3000`. |
| `http://ec2-18-116-22-239.us-east-2.compute.amazonaws.com/` | Lo mismo. |
| `http://18.116.22.239/api/v1/empleados` | JSON `{ "success": true, "data": [...] }`. |
| `http://18.116.22.239/api/docs` | Swagger UI; “Try it out” funciona. |
| `http://18.116.22.239:3000/` | **No carga** (timeout): el puerto está cerrado al público. |

También desde terminal:

```bash
curl -i http://18.116.22.239/api/v1/empleados
curl -m 5 http://18.116.22.239:3000/      # debe fallar por timeout
```

Crea, edita y borra un empleado desde la interfaz para confirmar el CRUD completo contra Atlas.

### Prueba 2 · Resiliencia (simular una caída)

En el **servidor**:

```bash
pm2 stop gestion-empleados       # → debe llegar la alerta a Slack/Discord
pm2 list                         # estado: stopped
# la web devuelve 502 mientras está detenida
pm2 start gestion-empleados      # → vuelve a online
```

Prueba adicional de autorrecuperación del cluster:

```bash
pm2 list                          # anota el PID de una réplica
kill -9 <PID>
pm2 list                          # PM2 la relanza sola (sube el contador ↺)
```

### Prueba 3 · CI/CD

1. En tu Mac, haz un cambio visible, por ejemplo en `frontend/src/app/app.html` (un título o un texto).
2. `git add frontend/src/app/app.html && git commit -m "feat: cambio visual de prueba" && git push origin main`
3. `pm2 deploy ecosystem.config.cjs production`
4. Refresca el navegador (`Cmd+Shift+R`): el cambio aparece **sin haber entrado a la consola de AWS**.

### Prueba 4 · Carga (opcional, reutiliza `stress-test.yml`)

Apunta el `target` de Artillery a la IP pública para comparar con las pruebas locales:

```bash
npx artillery run --target http://18.116.22.239 stress-test.yml
```

> `--target` sustituye el `http://127.0.0.1:3000` del archivo; las rutas (`/api/v1/empleados`) no cambian. Con `instances: 'max'`, cada réplica abre su propio pool de 20 conexiones a Atlas (`minPoolSize`); el plan M0 admite 500, así que hay margen de sobra.

---

## Operación diaria

| Acción | Comando (en el servidor salvo que se indique) |
|---|---|
| Ver procesos | `pm2 list` |
| Logs en vivo | `pm2 logs gestion-empleados` |
| Últimas líneas de error | `tail -n 50 /var/www/empleados/logs/err.log` |
| Reiniciar sin caída | `pm2 reload gestion-empleados` |
| Parar / arrancar | `pm2 stop gestion-empleados` / `pm2 start gestion-empleados` |
| Cambiar la URI de Atlas | `nano /var/www/empleados/shared/.env` y luego `pm2 reload gestion-empleados` |
| Desplegar (Mac) | `pm2 deploy ecosystem.config.cjs production` |
| Revertir (Mac) | `pm2 deploy ecosystem.config.cjs production revert 1` |
| Estado de Nginx | `sudo systemctl status nginx` |
| Logs de Nginx | `sudo tail -f /var/log/nginx/error.log` |

---

## Solución de problemas

| Síntoma | Causa probable | Cómo resolverlo |
|---|---|---|
| **502 Bad Gateway** en `/` y en `/api` | Nginx aún tiene la configuración del PDF (todo va al 3000) y el backend no corre. | Aplica la Fase 4 con `deploy/nginx.conf` y completa la Fase 5. |
| **502** solo en `/api/...` | El backend no está `online` o se cae al arrancar. | `pm2 list` y `pm2 logs gestion-empleados --lines 50`. |
| Logs: `❌ Error crítico al conectar a la base de datos` / `MongoServerSelectionError` | Atlas no permite la IP de la EC2. | Fase 1.3: añade `18.116.22.239/32` en Network Access. |
| Logs: `bad auth : authentication failed` | Usuario o contraseña incorrectos en `MONGO_URI`. | Corrige `shared/.env` (codifica los caracteres especiales) y `pm2 reload gestion-empleados`. |
| Logs: `node: .env: not found` | Falta `shared/.env` o el enlace simbólico. | `ls -l /var/www/empleados/current/backend/.env` y crea el archivo (Fase 3.3). |
| **404/500** en `/` pero `/api` funciona | No existe el build de Angular. | `ls /var/www/empleados/current/frontend/dist/frontend/browser/`; revisa la salida del deploy. |
| **403 Forbidden** en `/` | Nginx (`www-data`) no puede leer la carpeta. | `chmod 755 /var/www /var/www/empleados` y `namei -l /var/www/empleados/current/frontend/dist/frontend/browser/index.html`. |
| El deploy se corta con `Killed` durante `ng build` | Falta memoria. | Fase 2.5 (swap). |
| `pm2 deploy`: `Permission denied (publickey)` al conectar | Ruta de la `.pem` incorrecta o permisos abiertos. | `chmod 400` a la `.pem` y corrige `ssh_options`. |
| `pm2 deploy`: `Connection timed out` | Tu IP cambió y la regla SSH ya no coincide. | Actualiza la regla 22 → **Mi IP** en el Security Group. |
| `pm2 deploy`: `git@github.com: Permission denied` (en el servidor) | Falta la deploy key o no se validó el host. | Fase 3.1 y `ssh -T git@github.com` en el servidor. |
| `pm2 deploy`: `fatal: destination path ... already exists` | Ya se había ejecutado `setup`. | No repitas `setup`; usa solo `pm2 deploy ecosystem.config.cjs production`. |
| La web no muestra los cambios tras desplegar | No hiciste `git push` o el navegador usa caché. | `pm2 deploy ... production curr` para ver el commit y `Cmd+Shift+R`. |
| No llegan alertas a Slack | El módulo de notificaciones no está activo o la URL es incorrecta. | Prueba el webhook con `curl` (6.1) y usa `pm2-slack` (6.2). |
| La IP cambió tras detener la instancia | No era una IP elástica. | Fase 1.2 y actualiza `host`, Atlas y el Security Group. |

Para ver el despliegue paso a paso en el servidor:

```bash
cd /var/www/empleados/current
git log -1 --oneline
ls backend/dist/index.js frontend/dist/frontend/browser/index.html
```

---

## Checklist de evidencias para el informe

- [ ] Reglas de entrada del Security Group (80, 443, 22 con Mi IP; sin 3000).
- [ ] IP elástica asociada a la instancia.
- [ ] IP de la EC2 en Network Access de Atlas.
- [ ] `node -v`, `npm -v`, `nginx -v`, `pm2 -v` en el servidor.
- [ ] Deploy key registrada en GitHub y `ssh -T git@github.com` exitoso.
- [ ] `sudo nginx -t` correcto y contenido de `/etc/nginx/sites-available/default`.
- [ ] Salida de `pm2 deploy ecosystem.config.cjs production` terminando en `Success`.
- [ ] `pm2 list` con varias réplicas en modo `cluster`.
- [ ] Navegador en `http://18.116.22.239/` mostrando la app (sin `:3000`).
- [ ] Navegador en `http://18.116.22.239:3000/` sin respuesta.
- [ ] Swagger en `http://18.116.22.239/api/docs`.
- [ ] Alerta recibida en Slack/Discord tras `pm2 stop gestion-empleados`.
- [ ] Cambio visual antes y después del flujo CI/CD.
- [ ] `pm2 conf pm2-logrotate` mostrando la rotación de logs.
- [ ] `pm2 list` después de `sudo reboot` (arranque automático).

---

## Opcional: HTTPS con Certbot

Let's Encrypt **no emite certificados para IPs ni para dominios `*.compute.amazonaws.com`**: necesitas un dominio propio.

1. Crea un registro DNS `A` (por ejemplo `empleados.tudominio.com`) → `18.116.22.239`.
2. En `/etc/nginx/sites-available/default`, cambia `server_name _;` por `server_name empleados.tudominio.com;` y ejecuta `sudo nginx -t && sudo systemctl reload nginx`.
3. Instala y ejecuta Certbot:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d empleados.tudominio.com
   sudo certbot renew --dry-run          # comprueba la renovación automática
   ```

Certbot añade el bloque `listen 443 ssl` y la redirección de HTTP a HTTPS. El puerto 443 ya está abierto desde la Fase 1.
