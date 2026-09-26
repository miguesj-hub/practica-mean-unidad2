# Resumen del despliegue — Práctica 06

Registro de lo que se hizo para poner en producción **Gestión de Empleados**: resultado final, cambios, problemas encontrados y cómo se resolvieron. El paso a paso para repetirlo está en [DESPLIEGUE.md](DESPLIEGUE.md).

**Fecha:** 26 de septiembre de 2026

---

## Resultado

| Pieza | URL | Dónde corre |
|---|---|---|
| **Aplicación (UI)** | https://blue-sand-076769b1e.1.azurestaticapps.net/ | Azure Static Web Apps (plan Free) |
| **API REST** | https://empleados-miguel.duckdns.org/api/v1/empleados | AWS EC2 · Nginx + PM2 |
| **Swagger** | https://empleados-miguel.duckdns.org/api/docs/ (también desde la raíz del dominio) | AWS EC2 |
| **Base de datos** | — | MongoDB Atlas (`usuarios_db`) |
| **Alertas** | canal de Discord | webhook + `pm2-discord` |

```
Navegador ──► Azure Static Web Apps (Angular)
    │
    └──► https://empleados-miguel.duckdns.org ──► EC2: Nginx :443 ──► PM2 cluster ×2 :3000 ──► MongoDB Atlas
```

## Objetivos de la PDA06

| # | Objetivo | Estado | Cómo |
|---|---|---|---|
| 1 | Red segura en AWS EC2 | ✅ | Security Group con 80/443 públicos y 22 solo para mi IP; el 3000 cerrado. IP elástica `18.116.22.239`. |
| 2 | Nginx como proxy inverso y balanceador | ✅ | `upstream` hacia el cluster PM2; HTTPS con Let's Encrypt; HTTP redirige a HTTPS. |
| 3 | PM2: cluster y variables de entorno seguras | ✅ | `instances: 'max'` (2 réplicas). La URI de Atlas vive solo en `shared/.env` del servidor (permisos `600`), fuera del repo. Arranque automático con `pm2 startup`. |
| 4 | CI/CD | ✅ | Backend: `pm2 deploy ecosystem.config.cjs production`. Frontend: `git push` → GitHub Actions → Azure. |
| 5 | Monitorización y alertas por webhook | ✅ | `pm2-discord` (stop, exit, error, exception, restart…) y `pm2-logrotate` (10 MB, 7 archivos, comprimidos). |
| Rec. | Migrar a HTTPS | ✅ | Subdominio DuckDNS + Certbot, con renovación automática (`certbot.timer`). |
| Rec. | Base de datos fuera de la EC2 | ✅ | MongoDB Atlas. |

## Pruebas de verificación

| Prueba | Estado | Evidencia |
|---|---|---|
| 1 · Red | ✅ | UI en Azure con datos; API y Swagger por HTTPS; `:3000` no responde desde Internet. |
| 2 · Resiliencia | ✅ | `pm2 stop gestion-empleados` → alertas `stop`/`exit` en Discord (una por réplica) → `pm2 start` → API en 200. |
| 3 · CI/CD | ✅ | Mensaje “Desplegado desde CI/CD” en `app.html` → `git push` (`eddc427`) → GitHub Actions en verde (1 min) → visible en Azure sin tocar ninguna consola. |
| CRUD en producción | ✅ | POST 201 · GET 200 · PUT 200 · DELETE 200 · GET del borrado 404 · payload inválido 400. |
| CORS | ✅ | El dominio de Azure recibe `Access-Control-Allow-Origin`; un origen ajeno no. |
| Pruebas automáticas | ✅ | Backend 53/53 (Jest) · Frontend 28/28 (Vitest). |

---

## Cambios en el repositorio

| Área | Cambio |
|---|---|
| Backend | `tsconfig.build.json` y scripts `build`/`start`, porque el cluster de PM2 necesita JavaScript compilado. CORS limitado a Azure y a `localhost:4200`. Swagger con URL relativa. |
| Frontend | `environments/` con la URL de la API por entorno (HTTPS de DuckDNS en producción, `/api/v1` con proxy en desarrollo). `proxy.conf.json` para `ng serve`. `staticwebapp.config.json` para las rutas de la SPA. |
| CI/CD | `ecosystem.config.cjs` (app + deploy). Workflow de Azure ajustado para compilar con Node 24. |
| Infraestructura | `deploy/nginx.conf`: la configuración final de Nginx con HTTPS. |
| Documentación | `DESPLIEGUE.md` (guía completa) y este resumen. |

### Commits

| Commit | Descripción |
|---|---|
| `30d390f` | Primera versión de la configuración de despliegue (build del backend, ecosistema PM2, Nginx, proxy de Angular). |
| `4f85421` | Guía `DESPLIEGUE.md` y ajuste del ecosistema. |
| `a8eee9d` | Corrección de la ruta de `--env-file` para los workers del cluster. |
| `662290d` | Workflow de GitHub Actions creado por Azure. |
| `e27d33b` | Frontend en Azure, API por HTTPS, CORS, Nginx solo para `/api`. |
| `11363da` | Build de Angular con Node 24 en el workflow. |
| `6496c7d` | Guía actualizada con Azure y HTTPS. |
| `54a876e` | La raíz del dominio de la API redirige a Swagger. |
| `eddc427` | Mensaje visible para la prueba de CI/CD. |

---

## Problemas encontrados y soluciones

| # | Problema | Causa | Solución |
|---|---|---|---|
| 1 | El frontend llamaba a `http://127.0.0.1:3000`. | URL fija para desarrollo local. | URL por entorno (`environment.ts`) y proxy para `ng serve`. |
| 2 | `npm ERR! Missing script: "build"` en el servidor. | Los cambios no estaban subidos a GitHub y se ejecutaron en el servidor comandos pensados para la Mac. | Commit y push; en el servidor solo se despliega con `pm2 deploy`. |
| 3 | No había archivo `.pem` para `pm2 deploy`. | El acceso al servidor era por EC2 Instance Connect. | Se autorizó la llave `~/.ssh/id_ed25519` de la Mac en `authorized_keys`. |
| 4 | `Host key verification failed`. | La conexión sin terminal interactiva no podía aceptar el host. | `StrictHostKeyChecking=accept-new` en la primera conexión. |
| 5 | Réplicas en estado `errored`: `node: .env: not found`. | En modo cluster los workers se lanzan desde el directorio del daemon de PM2, no desde el `cwd` de la app. | `node_args` con ruta absoluta a `backend/.env`. |
| 6 | 502: `MongooseServerSelectionError ... isn't whitelisted`. | Atlas bloqueaba la IP de la EC2. | `18.116.22.239/32` en Network Access. |
| 7 | 502 en `/` con Nginx. | Seguía la configuración del PDF (todo al puerto 3000). | Configuración propia de Nginx. |
| 8 | Azure: `RequestDisallowedByAzure`. | La suscripción de estudiante limita las regiones. | Se creó la Static Web App en otra región permitida. |
| 9 | La UI en Azure (HTTPS) no podía llamar a la API (HTTP). | El navegador bloquea el *mixed content*. | Subdominio DuckDNS + certificado de Let's Encrypt. |
| 10 | DuckDNS apuntaba a la IP de casa (`149.50.204.252`). | DuckDNS rellena la IP de quien crea el subdominio. | Actualización por URL con `&ip=18.116.22.239`. |
| 11 | El build de Azure falló: Angular exige Node ≥ 24.15. | Oryx eligió Node 24.13 a partir del campo `engines`. | Se quitó `engines`; el workflow compila con `setup-node` y usa `skip_app_build`. |
| 12 | La raíz del dominio de la API devolvía 404. | Por diseño, la EC2 solo sirve `/api`. | Redirección de `/` a `/api/docs/`. |

## Decisiones de diseño

- **Azure Static Web Apps y no App Service:** el frontend son solo archivos estáticos y las llamadas a la API salen del navegador, no de Azure. El plan Free basta.
- **DuckDNS solo para la API:** un subdominio de DuckDNS apunta a una sola IP y no admite CNAME, que es lo que Azure exige para un dominio propio. La UI se queda con su URL de Azure.
- **Discord en lugar de Slack:** el webhook se crea en un minuto sin instalar apps en un espacio de trabajo.
- **`pm2-discord` en lugar de `pm2-notify`:** es un módulo nativo de PM2 y se configura con `pm2 set`.
- **El frontend no se compila en la EC2:** menos tiempo de despliegue y menos uso de disco (86 % de 6.7 GB).

---

## Pendientes y recomendaciones

- [ ] **Capturas del informe** (incluida la ejecución de GitHub Actions de `eddc427`): ver la checklist en [DESPLIEGUE.md](DESPLIEGUE.md#checklist-de-evidencias-para-el-informe).
- [ ] **Regenerar secretos al terminar la práctica:** la contraseña de Atlas, el webhook de Discord y el token de DuckDNS se compartieron durante la configuración.
- [ ] **Confirmar que `18.116.22.239` es una IP elástica:** si no lo es, cambiará al detener la instancia.
- [ ] **Ampliar el volumen EBS** a 10–15 GB (el disco va al 86 %).
- [ ] **Opcional:** un dominio propio con CNAME para tener la UI y la API bajo el mismo dominio (`app.` y `api.`).
