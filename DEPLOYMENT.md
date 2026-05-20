# Render.com Deployment Guide

This document explains how to deploy this full-stack application (React SPA hosted on Vite + Express Backend) to **Render.com** (Free Tier).

---

## 🎨 Application Architecture Overview
- **Frontend**: Single Page Application (SPA) built using React, Vite, and Tailwind CSS.
- **Backend / Web Server**: Express server (`server.ts`) which serves Vite's static assets in production and exposes API endpoints (e.g. `/api/health`).
- **Database / Auth**: Firebase Firestore & Firebase Authentication.
- **Production Build Flow**: Pre-bundles both client assets (via `vite build` into `dist/`) and the Express entry point (via `esbuild` into a self-contained ES module bundle in `dist/server.cjs`), eliminating runtime resolution issues.

---

## 🚀 Step-by-Step Render.com Deployment

### 1. Push Code to GitHub / GitLab / Bitbucket
Ensure your codebase is pushed to a private or public Git repository so Render.com can access it and pull updates automatically.

### 2. Create a "Web Service" on Render
1. Sign in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** and select **Web Service**.
3. Connect your Git provider and select this application's repository.

### 3. Configure the Web Service Settings
Provide the following configuration values:

| Configuration Area | Field | Recommended Value |
| :--- | :--- | :--- |
| **Basic Info** | **Name** | `my-finance-tracker` *(or any custom name)* |
| **Basic Info** | **Language** | `Node` |
| **Basic Info** | **Branch** | `main` *(or your primary development branch)* |
| **Build Settings** | **Build Command** | `npm install && npm run build` |
| **Build Settings** | **Start Command** | `npm run start` (this runs `node dist/server.cjs`) |
| **Free Tier Plan** | **Instance Type** | `Free` *(512 MB RAM, 0.1 CPU)* |

---

## 🔒 Environment Variables Configuration

Since API keys and project settings must never be hardcoded or checked into public source control, you can define them in Render's dashboard.

Go to the **Environment** tab of your Render web service and configure the following:

### Optional: Overriding Firebase Configurations
If you want to use a **separate** Firebase project for production than the default one provided in the local dev workspace (`firebase-applet-config.json`), add these secrets:

- `VITE_FIREBASE_API_KEY`: Your production Firebase API Key (e.g., `AIzaSy...`)
- `VITE_FIREBASE_AUTH_DOMAIN`: e.g. `your-app.firebaseapp.com`
- `VITE_FIREBASE_PROJECT_ID`: e.g. `your-app-id`
- `VITE_FIREBASE_STORAGE_BUCKET`: e.g. `your-app-id.firebasestorage.app`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`: e.g. `1234567890`
- `VITE_FIREBASE_APP_ID`: e.g. `1:1234:web:abcd`
- `VITE_FIREBASE_DATABASE_ID`: e.g. `(default)` *(If you use your own Firebase project, Firestore almost certainly uses the standard `(default)` database ID rather than the GUID-named database of the original AI Studio project. Our latest update automatically defaults to `(default)` if you override the project ID, but you can explicitly specify it here if needed)*

*Note: If these env variables are omitted, the application will fallback automatically to the configuration committed in `firebase-applet-config.json`.*

---

## 🛠️ Critical Troubleshooting: Google Login Infinite Loop / Reverts to Login

If authenticating via Google succeeds but instead of loading the app dashboard it redirects you back to the login screen, it means **a Firestore operation failed immediately after login** (such as fetching/creating user profiles or loading default transaction categories).

Here are the 2 steps to solve this in 30 seconds:

### 1. Upload Firestore Security Rules (Mandatory)
When setting up a new Firebase Project, Firestore's default rules are in locked mode, **fully blocking all reads and writes**.
- Open your [Firebase Console](https://console.firebase.google.com).
- Click on **Firestore Database** on the left menu.
- Click on the **Rules** tab.
- Copy the entire contents of the `/firestore.rules` file in this repository.
- Paste it into the Rules editor in the console and click **Publish**.

### 2. Verify Your Firestore Database is Provisioned
- Ensure you have clicked **Create Database** under the Firestore section of your Firebase console and configured it in either Test or Locked mode.
- If you override the `VITE_FIREBASE_PROJECT_ID` environment variable on Render, verify that you didn't accidentally include typos.

---

### Server Configs
- `NODE_ENV`: set to `production` *(Vite/Node performance optimization)*

---

## 💡 Pro Developer Notes: Render.com Free Tier

### ❄️ Spin-Down & Cold Starts
On Render's Free Tier, services spin down automatically after **15 minutes of inactivity**. 
When a user visits your app after a spin-down, Render starts the container back up. This process can take **50+ seconds** (known as a cold start). 

**Best Practice:**
- Use the built-in health check route `https://<your-render-subdomain>.onrender.com/api/health` with a monitoring tool (e.g., [UptimeRobot](https://uptimerobot.com) or [Cron-Job.org](https://cron-job.org)) to ping the app every 14 minutes, keeping it awake during your active hours.

### 💾 Local Disk Ephemerality
Any files written to the Render Free Tier server at runtime are temporary and deleted on service rebuild or restarts. 
Fortunately, this application stores all user data, budgets, categorisation categories, and transaction details directly in **Firebase Firestore**, which persists securely in the cloud independently of your web server.
