# ROBY ERP SaaS — Deployment Guide

> **Stack**: React 19 + TypeScript + Vite 7 + TailwindCSS 4 + Supabase (self-hosted)

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Prerequisites](#2-prerequisites)
3. [Supabase Setup](#3-supabase-setup)
4. [.env Configuration](#4-env-configuration)
5. [Build & Deploy the Frontend](#5-build--deploy-the-frontend)
6. [Deployment Options](#6-deployment-options)
7. [Post-Deploy Setup](#7-post-deploy-setup)
8. [Verification](#8-verification)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Architecture

```
  Browser (React SPA)
     │
     ├──→ Static files served from nginx / Vercel / Netlify
     │
     ├──→ HTTPS to Supabase (Auth, DB, Storage)
     │        ↳ http://163.172.55.95:8002  (self-hosted)
     │        ↳ or https://xxx.supabase.co (cloud)
     │
     └──→ HTTPS to Scaleway AI (optional AI features)
```

| Component | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite 7 |
| Styling | TailwindCSS 4 + Headless UI |
| State/Data | Supabase JS Client (`@supabase/supabase-js`) |
| Auth | Supabase Auth (email/password) |
| Database | PostgreSQL via Supabase (17 tables, full RLS) |
| Storage | Supabase Storage (article photos, tenant logos) |
| AI (optional) | Scaleway Generative API |
| Routing | React Router v7 |

---

## 2. Prerequisites

- **Node.js** 18+ (recommended: 20 LTS or 22)
- **npm** 9+ (comes with Node)
- A **Supabase** instance (self-hosted or cloud)
- A **domain** for the frontend (e.g. `app.roby.com`)

---

## 3. Supabase Setup

### Option A: Self-Hosted (current setup)

Your current self-hosted instance is at `http://163.172.55.95:8002`. If setting up fresh:

1. Run the full schema script in the **SQL Editor**:
   - File: `sql/ROBY_FULL_REBUILD.sql`
   - This creates all 17 tables, views, functions, triggers, RLS policies, storage buckets, indexes, and seeds the root user

2. Configure Auth:
   - Go to **Authentication > Providers > Email**
   - Enable Email provider
   - **Toggle OFF** "Confirm email" (users can log in immediately)

### Option B: Supabase Cloud

1. Create a project at [app.supabase.com](https://app.supabase.com)
2. Run `sql/ROBY_FULL_REBUILD.sql` in the SQL Editor
3. Configure Auth as above
4. Get your credentials from **Settings > API**

---

## 4. .env Configuration

Create a `.env` file in the project root:

```env
# ===========================================================================
# ROBY ERP SaaS — Environment Variables
# ===========================================================================

# ── Supabase ───────────────────────────────────────────────────────────────
# Find these in: Supabase Dashboard → Settings → API
#
# VITE_SUPABASE_URL      = Your Supabase project URL
# VITE_SUPABASE_ANON_KEY = Your Supabase anon/public key (safe for frontend)

# For SELF-HOSTED Supabase:
VITE_SUPABASE_URL=http://163.172.55.95:8002
VITE_SUPABASE_ANON_KEY=eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImFub24iLCAiaXNzIjogInN1cGFiYXNlIiwgImlhdCI6IDE3MDAwMDAwMDAsICJleHAiOiAyMDAwMDAwMDAwfQ.YX-f3CbjhZwwfRmMwcANtEeVhO43Q89rlR44hOfNOJU

# For SUPABASE CLOUD, replace with:
# VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...your-anon-key

# ── Scaleway AI (optional — used for AI features) ─────────────────────────
VITE_SCALEWAY_API_KEY=1e604035-ed2f-46c1-8191-ecb43843f73b
```

### Where to Find Supabase Values

| Variable | Self-Hosted | Supabase Cloud |
|---|---|---|
| `VITE_SUPABASE_URL` | Your server IP/domain + port (e.g. `http://163.172.55.95:8002`) | `https://YOUR-REF.supabase.co` (Settings → API → URL) |
| `VITE_SUPABASE_ANON_KEY` | The JWT token from your self-hosted config (`/docker/.env` or Kong config) | Settings → API → `anon` `public` key |

> ⚠️ **Important**: All `VITE_` prefixed variables are embedded in the built JS bundle and visible to end users. Never put secrets (service_role key, DB password) here — only the `anon` key.

---

## 5. Build & Deploy the Frontend

### Build the production bundle

```bash
# Install dependencies
npm install

# Build for production (TypeScript check + Vite build)
npm run build
```

This produces a `dist/` folder with:
- `index.html` — entry point
- `assets/` — JS/CSS chunks (hashed filenames for cache busting)

The `dist/` folder is your entire deployable artifact — just static files.

---

## 6. Deployment Options

### Option A: nginx on a VPS (Recommended)

#### 1. Copy build to server

```bash
# From your local machine
scp -r dist/* user@your-server:/var/www/roby/
```

#### 2. nginx config

Create `/etc/nginx/sites-available/roby`:

```nginx
server {
    listen 443 ssl http2;
    server_name app.roby.com;

    ssl_certificate     /etc/letsencrypt/live/app.roby.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.roby.com/privkey.pem;

    root /var/www/roby;
    index index.html;

    # SPA routing — all paths serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets aggressively (they have hashed filenames)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}

server {
    listen 80;
    server_name app.roby.com;
    return 301 https://$host$request_uri;
}
```

#### 3. Enable & SSL

```bash
sudo ln -s /etc/nginx/sites-available/roby /etc/nginx/sites-enabled/
sudo nginx -t
sudo certbot --nginx -d app.roby.com
sudo systemctl reload nginx
```

---

### Option B: Vercel (Easiest)

1. Push your repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import project
3. Set environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SCALEWAY_API_KEY`
4. Vercel auto-detects Vite — deploys on every push

---

### Option C: Netlify

1. Push repo to GitHub
2. Go to [netlify.com](https://netlify.com) → Add new site → Import from Git
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Set environment variables in site settings
6. Add `_redirects` file in `public/` for SPA routing:

```
/*    /index.html   200
```

---

### Option D: Docker

Create a `Dockerfile`:

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `nginx.conf`:

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Build and run:

```bash
docker build --build-arg VITE_SUPABASE_URL=http://163.172.55.95:8002 \
             --build-arg VITE_SUPABASE_ANON_KEY=eyJ... \
             -t roby .
docker run -d -p 80:80 --name roby roby
```

> **Note**: Vite env vars are baked in at build time, not runtime. Pass them as `--build-arg` or set them in `.env` before `npm run build`.

---

## 7. Post-Deploy Setup

### 7.1 Login with Root User

After running `ROBY_FULL_REBUILD.sql`, a root user is seeded:

| Field | Value |
|---|---|
| Email | `root@roby.com` |
| Password | `rootroot` |

> ⚠️ **Change this password** immediately after first login in production.

### 7.2 Create Your First Tenant

1. Login as root → you'll land on the **Root Console** (`/root`)
2. Create a tenant (e.g. "My Company")
3. Add users to the tenant via the Root Console

### 7.3 Supabase Auth Settings

Make sure these are configured:

| Setting | Value |
|---|---|
| Email provider | **Enabled** |
| Confirm email | **OFF** (for self-hosted) |
| Site URL | `https://app.roby.com` (your deployed URL) |
| Redirect URLs | `https://app.roby.com/**` |

---

## 8. Verification

### Check the build

```bash
# Preview locally before deploying
npm run preview
# Opens at http://localhost:4173
```

### Check the deployed app

1. Open `https://app.roby.com/login`
2. Login with `root@roby.com` / `rootroot`
3. Verify you see the Root Console
4. Create a tenant, switch to it
5. Test each module:
   - `/app/articles` — Article management
   - `/app/stock` — Stock overview
   - `/app/services` — Sales & rentals
   - `/app/clients` — Client management
   - `/app/depenses` — Expenses
   - `/app/ouvriers` — Workers / HR
   - `/app/fournisseurs` — Suppliers
   - `/app/kpi` — Dashboard

### Check Supabase connectivity

Open browser DevTools → Network tab. You should see successful requests to your Supabase URL. Any `401` or `403` errors mean RLS policies or auth is misconfigured.

---

## 9. Troubleshooting

### Blank page after deploy

The server isn't configured for SPA routing. All paths must serve `index.html`. Add `try_files $uri $uri/ /index.html;` in nginx or `_redirects` in Netlify.

### "Missing Supabase environment variables"

The `.env` file wasn't present at build time, or the variables aren't `VITE_` prefixed. Remember: Vite only exposes env vars starting with `VITE_`.

### Auth "Invalid login credentials"

- Check `VITE_SUPABASE_URL` points to the correct Supabase instance
- Check `VITE_SUPABASE_ANON_KEY` matches the instance
- Make sure "Confirm email" is toggled OFF (for self-hosted)

### RLS errors (empty data, 403s)

- Verify `ROBY_FULL_REBUILD.sql` ran completely without errors
- Check that the user is a member of a tenant (`tenant_members` table)
- Root users bypass all RLS — test with root first

### CORS errors

If your frontend domain differs from your Supabase domain, add the frontend origin to Supabase's allowed CORS origins in the dashboard or Kong config.

### Self-hosted Supabase on HTTP (not HTTPS)

Your current setup uses `http://163.172.55.95:8002`. This works but:
- Cookies may not persist properly on some browsers (SameSite restrictions)
- Put an HTTPS reverse proxy (nginx + certbot) in front of Supabase if possible

---

## Quick Reference

| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Local dev server (hot reload) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

---

*Last updated: 2026-06-22*
