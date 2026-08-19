# CampScout — Deployment Guide

Everything needed to go from local dev to a live, auto-refreshing app on the free tier.

**Stack:** Neon (DB) · Render (API) · Vercel (Frontend) · GitHub Actions (pipeline scheduler)

---

## Prerequisites

- Code pushed to a GitHub repository (public or private)
- `.env` working locally (all 4 env vars set)
- Neon database already running with PostGIS and all migrations applied

---

## Step 1 — Push to GitHub

If you haven't already:

```bash
git remote add origin https://github.com/YOUR_USERNAME/campscout.git
git push -u origin master
```

If the remote is already set:

```bash
git push origin master
```

Verify all files are on GitHub before continuing — the pipeline and deploy services pull from this repo.

---

## Step 2 — Add GitHub Repository Secrets

The GitHub Actions workflows need your credentials to connect to the DB and APIs.

1. Go to your repo on GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** for each of the following:

| Secret name | Value |
|---|---|
| `DATABASE_URL` | Your full Neon connection string — e.g. `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |
| `RECREATION_GOV_API_KEY` | Your Recreation.gov RIDB API key |
| `NPS_API_KEY` | Your NPS API key |
| `NOAA_USER_AGENT` | Your NOAA user-agent string — e.g. `campscout (your@email.com)` |

> These secrets are injected as environment variables into the GitHub Actions runners. They never appear in logs.

---

## Step 3 — Run the National Metadata Pipeline (first-time fill)

The DB currently has only the Southeast campgrounds (~500). This step fills all 6 regions (~4,000 campgrounds).

1. Go to your repo on GitHub → **Actions** tab
2. In the left sidebar, click **Weekly National Metadata Sync**
3. Click **Run workflow** → **Run workflow** (green button)
4. Watch the logs — the run takes 30–90 minutes depending on Recreation.gov rate limits
5. When it finishes (green checkmark), verify in your Neon console:
   ```sql
   SELECT region_id, COUNT(*) FROM campgrounds GROUP BY region_id ORDER BY region_id;
   ```
   You should see 6 rows with non-zero counts.

> After this first manual run, the workflow will automatically run every Sunday at 03:00 UTC.

---

## Step 4 — Deploy the Backend to Render

Render will host the FastAPI API. It reads `render.yaml` from the repo root.

1. Go to [render.com](https://render.com) and sign in (or sign up — free tier works)
2. Click **New** → **Blueprint**
3. Connect your GitHub account if prompted, then select your `campscout` repo
4. Render will detect `render.yaml` and show a service named `campscout-api` — click **Apply**
5. You'll be prompted to set environment variables. Add the same 4 values from Step 2:
   - `DATABASE_URL`
   - `RECREATION_GOV_API_KEY`
   - `NPS_API_KEY`
   - `NOAA_USER_AGENT`
6. Click **Save** — Render will start the first deploy

**After deploy (~3-5 min):**
- Render gives you a URL like `https://campscout-api.onrender.com`
- Test it: `https://campscout-api.onrender.com/api/regions`
- You should get back 6 regions with campground counts

> **Free tier note:** Render free web services spin down after 15 minutes of inactivity and take ~30 seconds to cold-start on the next request. This is fine for a portfolio project. Upgrade to the $7/month Starter plan to eliminate cold starts.

---

## Step 5 — Deploy the Frontend to Vercel

Vercel hosts the React app. The `frontend/vercel.json` is already configured.

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New Project** → select your `campscout` repo
3. In the project settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `dist` (auto-detected)
4. Under **Environment Variables**, add one variable:
   - Name: `VITE_API_BASE_URL`
   - Value: your Render API URL — e.g. `https://campscout-api.onrender.com`

   > **Important:** In `frontend/src/`, the Vite proxy only works in local dev. In production, the app hits Render directly. If your frontend uses `/api/...` paths with a Vite proxy you'll need to confirm the base URL handling. If `VITE_API_BASE_URL` isn't used yet, the `/api/...` paths will 404 on Vercel. See note below.

5. Click **Deploy**

**After deploy (~1-2 min):**
- Vercel gives you a URL like `https://campscout.vercel.app`
- Open it — you should see the home page with region cards

### Note on API base URL in production

In dev, Vite proxies `/api/...` → `localhost:8000`. In production on Vercel, there's no proxy — the browser calls `/api/...` which goes to Vercel (not Render) and 404s.

**Fix:** Update `frontend/src/` API calls to use an absolute base URL in production:

```js
// frontend/src/api/client.js  (or wherever fetch calls are made)
const BASE = import.meta.env.VITE_API_BASE_URL ?? ''
// then use: fetch(`${BASE}/api/campgrounds`)
```

After adding this, set `VITE_API_BASE_URL=https://campscout-api.onrender.com` in Vercel's environment variables and redeploy.

---

## Step 6 — Verify Automatic Scheduling

After both services are live, confirm the scheduled pipeline runs work:

1. **Check GitHub Actions schedule:**
   - Daily availability sync: every day at 05:00 UTC (`.github/workflows/pipeline-availability.yml`)
   - Weekly metadata sync: every Sunday at 03:00 UTC (`.github/workflows/pipeline-metadata.yml`)
   - You can also trigger either manually from the **Actions** tab → **Run workflow**

2. **Check data freshness in the UI:**
   - Open your Vercel URL
   - The green/amber/red freshness badge (bottom-right of the map) shows how recently data was updated
   - Green = data fetched within 12 hours

3. **Check availability data:**
   ```sql
   SELECT COUNT(*), MIN(date), MAX(date) FROM availability_snapshots;
   ```
   Should span today → today + 90 days. Past dates are pruned automatically after each run.

---

## Step 7 — Connect Vercel Redeploys to GitHub

By default Vercel redeploys on every push to `master` — confirm this is enabled:

1. Vercel dashboard → your project → **Settings** → **Git**
2. **Production Branch** should be `master`
3. **Auto-deploy** should be enabled

Now every `git push origin master` automatically redeploys the frontend.

---

## Troubleshooting

### API returns 502 / takes 30s to respond
Render free tier cold start. Wait 30 seconds and retry. Normal behavior.

### `/api/regions` returns 404 on Render
SSH into the Render service or check logs. Confirm `src/api/main.py` registers routers with `/api` prefix (already done in Phase 7d).

### GitHub Actions run fails with `psycopg` error
Check that `DATABASE_URL` secret uses `postgresql://` scheme (not `postgres://`) and includes `?sslmode=require` for Neon.

### Photos not loading on home page
The home page fetches from `/api/campgrounds?region=southeast&limit=20` and shows campgrounds with `photo_urls`. If the pipeline hasn't run yet, photo_urls will be null. Run the metadata pipeline (Step 3) first.

### Availability shows "No sites available" for everything
The availability pipeline (daily Actions workflow) hasn't run yet, or the SE campgrounds haven't been ingested. Trigger the daily workflow manually from the Actions tab.

---

## Summary checklist

- [ ] `git push origin master`
- [ ] Add 4 GitHub repo secrets
- [ ] Trigger **Weekly National Metadata Sync** manually → wait for it to finish
- [ ] Deploy backend to Render via Blueprint, add env vars
- [ ] Test `https://YOUR-RENDER-URL/api/regions`
- [ ] Deploy frontend to Vercel, set root dir to `frontend/`, add `VITE_API_BASE_URL`
- [ ] Fix API base URL in frontend fetch calls if needed, redeploy
- [ ] Open Vercel URL — home page loads, map works, campgrounds appear
- [ ] Confirm GitHub Actions auto-runs daily/weekly
