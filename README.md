# StyleTrack – Garment Production, Job-Work & Costing System

**Node.js (Express) + PostgreSQL** backend and **React (Vite)** frontend.
The backend goes on **Railway** and the frontend goes on **Vercel**.

---

## System kya karta hai (voice note ke hisaab se)

| Requirement (audio se) | System mein kahan hai |
|---|---|
| Har style/order alag, usme 12–13 processes (dyeing, printing, embroidery, dori, button, cutting, stitching…) | **Styles → New Style**: process route editable hai (default 12 steps, add/remove/reorder) |
| Fabric consumption: jaise 100 pcs × 2 mtr = 200 mtr | Style form mein **consumption per piece + wastage %**. Total required apne aap calculate hota hai |
| Merchant fabric mill ko PO deta hai, PO store ke paas jaata hai, store goods receive karta hai | **Purchase Orders** (Material type) → **Store → Receive (GRN)** |
| Style ke against sabko dikhe ki kapda aaya ya nahi | Style page → **Tracker** tab: material Required / PO given / Received / Balance |
| Dyeing / printing / embroidery job work ka PO, store dispatch karta hai aur wapas receive karta hai | **Job Work PO** → Store **Dispatch (Challan)** → **Receive (GRN)** |
| 200 mtr mein se pehle 100, phir 100 aaye (multiple / split receiving) | Ek PO par jitni marzi receipts. Pending apne aap dikhta hai |
| Alag-alag parties | **Parties** master (Buyer, Fabric Mill, Dyeing, Printing, Embroidery, Stitching, Trims…) |
| Party-wise report: kis party ke paas kya pada hai, kya pending hai | **Reports → Party-wise pending** (party/style filter, print) |
| PO jis rate par bana, wo cost style mein add ho | PO value automatically style ki **Costing** mein add hoti hai |
| Karigar ko ₹50 diye, wo bhi cost mein jude | **Expenses** (Stitching / Karigar / Cutting / Transport…) style par lagte hain |
| Vendor ne last time kis rate par kaam kiya | New PO mein item likhte hi **"Last rate"** hint aata hai |
| Dispatch par sale rate daalo, poora profit calculate ho | **Sales Dispatch** → Costing mein cost/pc, margin/pc, projected aur actual profit |

Other features: login for each team member with roles (admin, merchant, store, production, accounts), a dashboard (goods lying with parties, overdue POs, upcoming deliveries), print for POs and reports, and a mobile-friendly layout.

### Roles
- **admin** – can do everything (users, deleting styles)
- **merchant** – styles, POs, parties, expenses, sales
- **store** – dispatch / receive, parties, sales dispatch
- **production** – process status updates, expenses
- **accounts** – expenses, sales, viewing costing

---

## Folder structure

```
garment-erp/
├── backend/     → Railway par deploy (Node + Express + PostgreSQL)
│   ├── src/index.js        server + CORS + routes
│   ├── src/db.js           database connection + tables (auto-create)
│   ├── src/routes/*.js     styles, pos, store, expenses, sales, reports, users
│   └── src/seed.js         demo data (optional)
└── frontend/    → Vercel par deploy (React + Vite)
    ├── src/pages/*.jsx     saari screens
    └── vercel.json         SPA routing
```

Tables **apne aap ban jaati hain** jab backend pehli baar start hota hai. Koi migration command chalane ki zarurat nahi.

---

## Local par chalana (optional)

You need Node 18+ and PostgreSQL.

```bash
# 1. Backend
cd backend
cp .env.example .env        # DATABASE_URL apne local postgres ka daalo
npm install
npm run seed                # (optional) demo data
npm run dev                 # http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:5000
npm install
npm run dev                 # http://localhost:5173
```

Login: `admin@styletrack.com` / `admin123` (`.env` mein badal sakte ho)

---

## Live karna – Step by step

### Step 0: Code GitHub par daalo
1. Unzip the zip file.
2. Create a new GitHub repo (it can be private) and push the whole `garment-erp` folder to it.

### Step 1: Backend on Railway
1. Go to https://railway.app → **New Project** → **Deploy from GitHub repo** → choose your repo.
2. Open the service → **Settings** → set **Root Directory** to `backend`.
3. In the project, click **+ New** → **Database** → **Add PostgreSQL**.
4. Backend service → **Variables** → add these:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway reference — dropdown se select ho jaata hai) |
   | `JWT_SECRET` | koi bhi lamba random text, jaise `k8s7Hq2...` |
   | `ADMIN_EMAIL` | apna email |
   | `ADMIN_PASSWORD` | strong password |
   | `ADMIN_NAME` | apna naam |
   | `CORS_ORIGIN` | abhi `*` rakho, Step 3 mein Vercel URL daalna hai |

   > Use the internal `DATABASE_URL` (as above) and you don't need SSL. If you use the public Postgres URL, also add `DATABASE_SSL=true`.
5. **Settings → Networking → Generate Domain**. You'll get a URL like `https://styletrack-backend-production.up.railway.app`.
6. Check it: open `https://<your-railway-url>/api/health` and it should show `{"status":"ok","db":"connected"}`.
7. (Optional) For demo data: Railway service → **⋮ → Run command** → `npm run seed`

### Step 2: Frontend on Vercel
1. Go to https://vercel.com → **Add New → Project** → import the same GitHub repo.
2. Set **Root Directory** to `frontend`. Framework will auto-detect as **Vite**.
3. **Environment Variables** → add:
   - `VITE_API_URL` = your Railway URL from Step 1 (with **no** `/` at the end)
4. **Deploy**. You'll get a URL like `https://styletrack.vercel.app`.

### Step 3: Connect them (CORS)
1. Railway → backend → **Variables** → set `CORS_ORIGIN` = your Vercel URL (e.g. `https://styletrack.vercel.app`).
   You can add more than one URL separated by commas (for a custom domain as well).
2. Railway will redeploy automatically. Then open the Vercel URL and log in with your `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Done ✅

> Note: if you change `VITE_API_URL` on Vercel, you have to **Redeploy** (Vite reads the variable at build time).

---

## Pehli baar use kaise karein (workflow)

1. **Users**: give each team member their own login (merchant, store…).
2. **Parties**: add buyers, the fabric mill, dyeing / printing / embroidery houses, and trims suppliers.
3. **New Style**: style no., buyer, order qty, sale rate → fabric/trims consumption → process route.
4. **New PO**:
   - *Material*: "Fill from style consumption" puts in the required fabric/trims automatically → party → rate.
   - *Job Work*: choose a process (Dyeing/Printing…) → party → qty & rate.
5. **Store**: Material PO → **Receive**. Job Work PO → **Dispatch**, then **Receive** when goods come back (multiple partial receipts are fine).
   The process status changes on its own: on dispatch it becomes "In Progress", and on full receipt it becomes "Done".
6. **Expenses**: add karigar/stitching/cutting payments to the style.
7. **Sales Dispatch**: when goods go to the buyer, enter qty + rate.
8. **Reports / Style → Costing**: party-wise pending, style status, cost per piece and profit.

---

## API quick reference

All routes are under `/api`. Every route except login needs the `Authorization: Bearer <token>` header.

| Method | Route | Kaam |
|---|---|---|
| POST | `/auth/login` | Login → token |
| GET/POST/PUT | `/users` | Users (admin) |
| GET/POST/PUT/DELETE | `/parties` | Parties |
| GET/POST/PUT/DELETE | `/styles`, `/styles/:id` | Styles + materials + processes |
| PATCH | `/processes/:id` | Process status |
| GET | `/styles/:id/costing` | Cost sheet |
| GET/POST/PUT/DELETE | `/pos`, `/pos/:id` | Purchase orders |
| GET | `/pos/last-rate?description=&party_id=` | Last rate |
| POST | `/pos/:id/cancel`, `/pos/:id/reopen` | Cancel / reopen |
| GET/POST/DELETE | `/movements` | Store dispatch (OUT) / receipt (IN) |
| GET/POST/DELETE | `/expenses`, `/sales` | Expenses, sales dispatch |
| GET | `/dashboard`, `/reports/party-pending`, `/reports/style-status`, `/reports/costing` | Reports |

---

## Aage kya add kar sakte hain
- Style image / tech-pack upload
- Fabric stock ledger (style-to-style transfer)
- PDF challan / PO format with company logo
- WhatsApp / email PO to party
- Size-wise breakup (S/M/L/XL) of order qty
