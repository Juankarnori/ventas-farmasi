# Farmasi Bella — Gestión

App para gestionar el negocio de reventa de productos Farmasi entre dos usuarias (Mamá / Yo), con catálogo, inventario, pedidos, ventas, préstamos entre las dos y finanzas — datos compartidos en una base de datos común.

## Stack

- **Next.js 16** (App Router, TypeScript, `src/`) + **Tailwind CSS v4**
- **Supabase**: Postgres + Auth (Google OAuth) + Storage
- Server Actions para las mutaciones, Route Handler solo para el callback de OAuth
- Recharts para el gráfico de Finanzas, Zod para validaciones

> Nota: este proyecto se generó con Next.js 16, que renombró `middleware.ts` a `proxy.ts` (mismo propósito, refrescar la sesión en cada request) — no te confundas si buscás un `middleware.ts` y no está.

## 1. Instalación local

```bash
npm install
cp .env.local.example .env.local
```

Vas a completar `.env.local` en el paso 2.

## 2. Crear el proyecto de Supabase

1. Entrá a [supabase.com](https://supabase.com/dashboard) y creá un proyecto nuevo.
2. En **Project Settings → API**, copiá:
   - `Project URL` → pegalo en `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → pegalo en `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Habilitar login con Google

1. En Google Cloud Console, creá credenciales OAuth (tipo "Aplicación web"). Como **URI de redireccionamiento autorizado** agregá la que te muestra Supabase en el paso siguiente (algo como `https://<tu-proyecto>.supabase.co/auth/v1/callback`).
2. En el dashboard de Supabase: **Authentication → Providers → Google**, activalo y pegá el Client ID / Client Secret que te dio Google.
3. En **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` (en producción, la URL de Vercel)
   - **Redirect URLs**: agregá `http://localhost:3000/auth/callback` (y luego la de producción, `https://tu-app.vercel.app/auth/callback`)

No hace falta crear usuarios a mano: la app tiene un flujo de "auto-registro" — la primera vez que cada una entra con su cuenta de Google, elige si es "Mamá" o "Yo" una única vez. Una vez ocupados los dos perfiles, cualquier otra cuenta de Google queda bloqueada automáticamente.

## 3. Correr las migraciones

Los archivos de `supabase/migrations/` están numerados y se corren en orden. Dos formas de hacerlo:

**Opción A — SQL Editor (más simple, no requiere instalar nada):**
Abrí **SQL Editor** en el dashboard de Supabase y pegá el contenido de cada archivo `0001_...sql` a `0013_...sql` en orden, ejecutando uno por uno.

**Opción B — Supabase CLI:**
```bash
npx supabase login
npx supabase link --project-ref <tu-project-ref>
npx supabase db push
```

### Datos de ejemplo (opcional)

Para probar la app con productos de ejemplo, corré también `supabase/seed.sql` en el SQL Editor. Los precios están en **pesos argentinos (ARS)** y son aproximados — ajustalos a tu lista real desde el Catálogo.

### Bucket de imágenes

La migración `0012_storage_bucket.sql` crea el bucket `product-images` (público, escritura solo para usuarias autenticadas). Si preferís crearlo a mano: **Storage → New bucket**, nombre `product-images`, marcado como público.

## 4. Correr en local

```bash
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000), entrá con Google, y elegí tu perfil la primera vez.

## 5. Desplegar en Vercel

1. Subí el repo a GitHub (este proyecto se generó con git local, sin remoto — lo conectás vos).
2. En Vercel, importá el repo.
3. En **Environment Variables**, agregá `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Una vez desplegado, agregá la URL de producción a **Site URL** y **Redirect URLs** en Supabase (paso 2), con `/auth/callback` al final para la redirect URL.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (anon) del proyecto |

## Estructura

```
supabase/migrations/   Esquema SQL versionado (tablas, RLS, funciones, storage)
supabase/seed.sql       Datos de ejemplo
src/app/auth/           Login, callback OAuth, reclamo de perfil
src/app/(app)/          Shell autenticado + los 6 módulos
src/components/         UI compartida + componentes por módulo
src/lib/                Clientes de Supabase, validaciones Zod, utils
```

## Alcance de esta versión

Incluido: catálogo, inventario, pedidos, ventas, préstamos, finanzas/dashboard (home), alertas de stock bajo y préstamos pendientes.

Dejado afuera a propósito (se puede agregar después sin reestructurar nada): modo oscuro, y exportar reportes a Excel/PDF.
