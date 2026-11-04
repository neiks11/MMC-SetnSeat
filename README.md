# MMC Set n Seat Rentals — Web Booking & Admin Management System

Complete, mobile-first web booking system and admin dashboard for **MMC Set n Seat Rentals** serving **Lemery and Taal, Batangas**.

## 1. Business Overview
- **Business Name:** MMC Set n Seat Rentals
- **Service Area:** Lemery and Taal, Batangas (and nearby towns)
- **Contact:** `0956 403 5020` | `setnseatrentals@gmail.com`
- **Facebook / Messenger:** [MMC Setnseat Rentals](https://www.facebook.com/profile.php?id=61585212946153)
- **Supported Payment Methods:** Cash, GCash, Maya, and Bank Transfer

---

## 2. How to Edit Prices, Stock, Photos & Business Settings Yourself (No Coding Needed!)

1. Open the website and click **Admin Portal** in the top bar (or go directly to `/admin`, e.g., `http://localhost:3000/admin`).
2. Sign in with the default owner credentials:
   - **Username:** `admin`
   - **Password:** `password123`
3. **To Quickly Edit Prices & Stock Quantities:**
   - Click **Edit Inventory & Prices** in the left sidebar.
   - Type your real **Price / Day (₱)** or **Total Stock** right inside the table row for any item (Monobloc chairs, Tiffany chairs, Round tables, Rectangular tables, Packages, or Add-ons) and click **Save**.
4. **To Upload Your Own Photos or Add New Items/Packages:**
   - Inside **Edit Inventory & Prices**, click **Edit Full / Photo** on any item (or click **+ Add New Chair, Table, Package or Add-on**).
   - Under **Item Photo**, click **Choose File** to upload a photo directly from your phone or computer, or paste an image link.
   - Click **Save Inventory Item**.
5. **To Edit Your Reservation Deposit %, Delivery Fees & GCash/Bank Numbers:**
   - Click **App & Pricing Settings** in the left sidebar.
   - Change the **Required Reservation Deposit (%)**, **Default On-Site Setup Fee**, **Free Delivery Minimum Order**, or **GCash / Bank Details** and click **Save All Changes**.

---

## 3. Connecting Your Firebase Cloud Firestore Database

This application uses **Google Firebase Cloud Firestore** (`firebase` SDK) as its cloud database, with automatic initial seeding and a synchronized local fallback cache (`data/mmc-database.json`) so the app runs out-of-the-box before you enter your Firebase keys.

### Option 1: Connect Directly Inside the Admin Dashboard (Fastest — No Code Editing!)
1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/) and create a new project (e.g., `mmc-set-n-seat-rentals`).
2. In your Firebase project, go to **Build → Firestore Database** and click **Create database** (start in test mode or paste the rules from [`firestore.rules`](./firestore.rules)).
3. Go to **Project Settings (gear icon) → General → Your apps → Web App (`</>`)** to get your `projectId` and `apiKey`.
4. Open your Admin Dashboard at `http://localhost:3000/admin`, go to **App & Pricing Settings**, paste your **Firebase Project ID** and **Firebase Web API Key** into the **🔥 Firebase Cloud Firestore Database** card, and click **Connect & Sync Data to Firebase Firestore**.
5. All sample/edited inventory, bookings, customers, and settings will immediately sync to your Firestore collections (`settings`, `inventory`, `bookings`, `customers`, `damage_logs`, and `mmc_system/state_snapshot`)!

### Option 2: Connect via `.env.local` Environment Variables
Copy `.env.example` to `.env.local` and paste your Firebase keys:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abcdef
```

---

## 4. Running Locally

```bash
cd mmc-set-n-seat-rentals
npm install
npm run dev
```

- **Customer Website:** `http://localhost:3000`
- **Admin Dashboard:** `http://localhost:3000/admin`
- **Reset Sample Data Anytime:** `npm run db:seed`

---

## 4. Deployment Guide

### Option A: Deploy to Render / Railway / DigitalOcean App Platform / VPS (Recommended for Persistent Local Storage)
1. Push this project folder to a GitHub repository.
2. Create a new Web Service on **Railway** or **Render**.
3. Set Build Command: `npm install && npm run build`
4. Set Start Command: `npm run start`
5. Attach a persistent volume mounted at `/app/data` (or connect `DATABASE_URL` with `prisma/schema.prisma` for SQLite/PostgreSQL).

### Option B: Deploy to Vercel + Supabase / Turso
1. Push repository to GitHub and import into **Vercel**.
2. Set `DATABASE_URL` in Vercel Environment Variables pointing to your Supabase PostgreSQL or Turso SQLite instance and run `npx prisma db push`.

