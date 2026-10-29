# From download to live on Netlify

## What the MVP actually needs

- **The website and its backend are the same project.** The `src/app/api/*` routes
  are the backend. Netlify runs them automatically as serverless functions, so there is
  no separate server to set up or rent.
- **A database is required (MongoDB Atlas, free).** Offers you add in the admin
  dashboard have to be stored somewhere every visitor can read. That's the only external
  service you must have.
- **Google Maps is optional.** Without a key, visitors can still use "Use my current
  location" (distance-based) or type a city and country. Add a key later for address
  autocomplete. The code for it is written but has not been tested yet.
- **Everything else is optional:** the daily re-check (`CRON_SECRET`), the staleness window.

Minimum to go live: Node.js, a free Atlas database, a GitHub repo, a free Netlify account.

---

## 1. Install Node.js

Install **Node.js 22 LTS** from https://nodejs.org. Check it in a terminal:

```bash
node -v   # should print v22.x
```

## 2. Unzip and install

```bash
cd offer-finder
npm install
```

## 3. Create the free database (MongoDB Atlas)

1. Sign up at https://www.mongodb.com/cloud/atlas/register.
2. Create a cluster and choose the free **M0** tier. Pick a region near your users
   (for Bangladesh, Mumbai or Singapore).
3. **Database Access** → Add database user → choose a username and a password made of
   letters and digits only. Special characters have to be URL-encoded later, so avoid
   them.
4. **Network Access** → Add IP Address → **Allow access from anywhere (0.0.0.0/0)**.
   Netlify has no fixed IP addresses, so this is needed. Your database password still
   protects the data.
5. **Database** → Connect → Drivers → copy the connection string. It looks like
   `mongodb+srv://USER:<db_password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`.
   Replace `<db_password>` with your password.

## 4. Create your settings file

Copy the example:

```bash
cp .env.example .env.local        # Windows: copy .env.example .env.local
```

Generate the admin password hash and a session secret:

```bash
npm run hash-password -- "choose-a-long-admin-password"
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Open `.env.local` and fill in:

| Variable | Value |
|---|---|
| `MONGODB_URI` | The Atlas string from step 3 |
| `MONGODB_DB` | `offer_finder` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` for now |
| `ADMIN_EMAIL` | The email you'll log in with |
| `ADMIN_PASSWORD_HASH` | The `scrypt:...` line printed by `hash-password` |
| `SESSION_SECRET` | The random string from the second command |
| `CRON_SECRET` | Any long random string (optional; needed for the daily re-check) |
| `GOOGLE_MAPS_SERVER_KEY` | Leave empty for now |

## 5. Run it on your computer

```bash
npm run db:init   # prints: Database "offer_finder" ready ...
npm run dev
```

- Open http://localhost:3000. The feed starts empty. That's expected, because there are
  no sample offers.
- Open http://localhost:3000/admin/login and sign in with `ADMIN_EMAIL` and your password.
- Click **Add offer from URL**, paste a real offer page, then click **Fetch details**.
  Check every field against the page, choose scope and category, set
  **Active + Approved**, write what you checked in the evidence box, and save.
- The offer now shows on the homepage.

## 6. Put the code on GitHub

Netlify's drag-and-drop upload only works for static sites, so this project has to deploy
from Git. Use the repository you created:

```bash
git init
git add -A
git commit -m "OfferFinder MVP"
git branch -M main
git remote add origin https://github.com/RiBpy/offer-finder.git
git push -u origin main
```

`.env.local` is in `.gitignore`, so your passwords are not uploaded. Check that it is
not listed by `git status` before you push.

## 7. Deploy on Netlify

1. https://app.netlify.com → **Add new site** → **Import an existing project** → GitHub →
   choose `offer-finder`.
2. Netlify detects Next.js. Leave the build command as `npm run build` and leave the
   publish directory at what Netlify suggests. `netlify.toml` already sets Node 22.
3. Before deploying, open **Environment variables** and add the same values as in
   `.env.local`, with two differences:
   - `NEXT_PUBLIC_SITE_URL`: set to your Netlify address (for example
     `https://offer-finder.netlify.app`). If you don't know it yet, deploy first,
     then set it and choose **Deploys → Trigger deploy**.
   - **Do not** add `FETCH_ALLOW_PRIVATE_HOSTS`. It is only for local tests.
4. Click **Deploy**.

## 8. Check it works

- `https://YOUR-SITE.netlify.app/api/health` should show `{"ok":true,"db":"up"}`.
  If it shows `"db":"down"`, recheck `MONGODB_URI` and Atlas Network Access.
- Open `/admin/login`, sign in, and add an offer.
- Open the homepage on your phone and allow location.

## 9. Daily re-check (optional)

`netlify/functions/daily-revalidate.mjs` runs every day at 03:00 UTC. It expires ended
offers, marks stale ones Unverified, and re-checks source pages. It only runs if
`CRON_SECRET` is set in Netlify. Scheduled functions run only on the published
production deploy. You can also click **Run revalidation now** in Admin → Sources & jobs.

## 10. Add Google address search later (optional)

1. https://console.cloud.google.com → create a project → enable billing.
2. Enable **Places API (New)** and **Geocoding API**.
3. Credentials → Create API key → restrict it to those two APIs.
4. Set a budget alert (Billing → Budgets) so a mistake can't cost you much.
5. Add `GOOGLE_MAPS_SERVER_KEY` in Netlify and redeploy. The location picker then shows
   address search.

## If something goes wrong

- **Build fails on Netlify:** open the deploy log and send me the red error lines.
- **Can't log in:** `ADMIN_PASSWORD_HASH` must be the whole `scrypt:...` line, with no
  quotes or spaces. After 5 wrong attempts, login is blocked for 15 minutes.
- **Feed is empty:** offers must be **Active** and **Approved**, and their end date must
  not have passed.

This project was built and tested with `next start` locally. Netlify's Next.js support
should handle it, but the deploy itself has not been tried yet. If the first deploy
fails, send me the log.
