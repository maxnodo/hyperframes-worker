# hyperframes-worker

Worker en Node.js que procesa los jobs de la tabla `video_jobs` (Lovable Cloud / Supabase):

1. Hace polling buscando jobs con `status = 'pending'`.
2. Marca el job como `rendering` (con guardia optimista para evitar duplicados).
3. Renderiza el video (actualmente con un **stub** basado en `ffmpeg`; se reemplazará por HyperFrames).
4. Sube el `.mp4` al bucket privado de Supabase Storage (`videos` por defecto).
5. Actualiza el job: `status = 'completed'`, `storage_path`, `video_url`.
6. Si algo falla, marca `status = 'error'` con `error_message`.

El frontend genera **signed URLs** on-demand para reproducir/descargar el video, así que el bucket puede mantenerse privado.

## Requisitos

- Node.js ≥ 20
- `ffmpeg` en el `PATH` (necesario para el stub; en el `Dockerfile` ya viene incluido)

## Configuración

Copia `.env.example` a `.env` y rellena los valores:

```bash
cp .env.example .env
```

| Variable                    | Descripción                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------ |
| `SUPABASE_URL`              | URL del proyecto (Lovable Cloud → Connectors)                                        |
| `SUPABASE_SERVICE_ROLE_KEY` | **Service role key** (NUNCA exponer en cliente). Bypassea RLS y storage policies.    |
| `SUPABASE_STORAGE_BUCKET`   | Bucket donde subir los `.mp4`. Default: `videos`.                                    |
| `POLL_INTERVAL_MS`          | Intervalo entre polls cuando no hay jobs. Default: `5000`.                           |
| `WORK_DIR`                  | Carpeta local de trabajo para los renders. Default: `/tmp/hyperframes`.              |
| `CONCURRENCY`               | Jobs procesados en paralelo. Default: `1`.                                           |
| `RENDER_TIMEOUT_MS`         | Timeout máximo por render. Default: `600000` (10 min).                               |

> ⚠️ La `SERVICE_ROLE_KEY` da acceso total a la base de datos y al storage. Úsala **solo en este worker**, nunca en el frontend ni la subas al repo.

## Uso

```bash
npm install
npm start            # arranca el loop de polling
npm run dev          # con --watch
npm run render:once  # procesa UN job y sale (útil para tests/debug)
```

## Docker

```bash
docker build -t hyperframes-worker .
docker run --rm --env-file .env hyperframes-worker
```

## Esquema esperado de `video_jobs`

```
id            uuid pk
title         text
status        text  -- pending | rendering | completed | error
template      text
input_data    jsonb -- { mainText, subText, imageNames[], format }
video_url     text  -- URL pública o señalizada (opcional, lo rellena el worker)
storage_path  text  -- path dentro del bucket (lo rellena el worker)
error_message text
created_at    timestamptz
updated_at    timestamptz
```

## Garantías de concurrencia

El claim de un job se hace con un `UPDATE … WHERE status = 'pending'` y comprobando que la fila devuelta sea la esperada. Si dos workers compiten, solo uno verá la transición `pending → rendering`; el otro saltará al siguiente.

## Integrar HyperFrames

El render real vive en `src/render.js`, función `renderWithHyperframes(job, outPath)`. Hoy genera un MP4 dummy con `ffmpeg`. Para conectar HyperFrames:

1. Añade `HYPERFRAMES_API_URL` y `HYPERFRAMES_API_KEY` al `.env`.
2. Reemplaza el cuerpo de `renderWithHyperframes` por la llamada al SDK/REST de HyperFrames.
3. Asegúrate de que el archivo final quede en `outPath` (mp4).

El resto del pipeline (claim, upload, update) no necesita cambios.
