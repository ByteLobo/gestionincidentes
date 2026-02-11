# Gestión de Incidentes

Proyecto base en Next.js (App Router + TypeScript) con autenticación JWT y formularios con validaciones y cálculos automáticos.

## Requisitos

- Node.js 18+
- PostgreSQL

## Configuración

1) Copia variables de entorno:

```bash
cp .env.example .env.local
```

2) Crea la base de datos y aplica el esquema:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

3) Instala dependencias y ejecuta:

```bash
npm install
npm run dev
```

## Entorno de producción (misma BD)

Este proyecto ya incluye scripts de build/start para producción y puede apuntar a la misma base de datos.

1) Crea archivo de entorno de producción:

```bash
cp .env.production.example .env.production.local
```

2) Configura variables reales en `.env.production.local`:
- `DATABASE_URL` (puede ser la misma que usas hoy)
- `JWT_SECRET`
- opcionales: `EXTERNAL_API_KEY`, `WEBHOOK_TARGET_URL`, `WEBHOOK_SECRET`

3) Compila y levanta:

```bash
npm ci
npm run build
npm run start:prod
```

Comando combinado:

```bash
npm run prod
```

## Rutas principales

- `/login` login con JWT
- `/incidentes` formulario de incidentes
- `/soporte` formulario de soporte

## Webhooks de catálogos (opcional)

Cuando se crea/actualiza/inactiva un catálogo, el sistema puede enviar un POST a un sistema externo.

Variables de entorno:
- `WEBHOOK_TARGET_URL` URL destino para recibir eventos de catálogos.
- `WEBHOOK_SECRET` (opcional) secreto enviado en header `x-webhook-secret`.

El payload enviado tiene esta forma:
```json
{
  "event": "catalog.changed",
  "occurred_at": "2026-02-03T12:00:00.000Z",
  "catalogo": "tiposervicio",
  "action": "create",
  "item": {
    "id": 1,
    "name": "CRS",
    "active": true
  }
}
```

Outbox (admin):
- `GET /api/webhooks/outbox` lista últimos eventos.
- `POST /api/webhooks/outbox` reintenta envíos (`{ "id": 123 }` opcional).

## Notas

- No se incluyen migraciones; el esquema vive en `db/schema.sql`.
- La lógica de categorización y reglas KPI está preparada en tablas (`kpi_rules`) para implementación posterior.

## Subir a GitHub (paso a paso)

Importante:
- `/.env*` ya está ignorado en `.gitignore`, por lo que tus secretos no deben subirse.
- Si algún secreto se compartió en chat/captura, róta esos valores antes de publicar.

Flujo recomendado:

```bash
# 1) revisa estado
git status

# 2) agrega cambios
git add .

# 3) crea commit
git commit -m "feat: soporte y configuracion de entorno de produccion"

# 4) crea rama principal si aun no existe
git branch -M main

# 5) conecta repositorio remoto (reemplaza URL)
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git

# 6) sube cambios
git push -u origin main
```

Si ya existe `origin`, omite el paso 5 y usa solo `git push`.
