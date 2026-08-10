# LOTUS-HR Portal (Idealab · UGC · Vizag)

A modern full-stack HR + Operations Portal built with **React (Vite + TypeScript + Tailwind)** on the frontend and **FastAPI + PostgreSQL** on the backend. Supports dual experience views for **HR/Admin Portal** vs **Employee Self-Service Portal** with strict Role-Based Access Control (RBAC).

---

## 📱 Mobile & Multi-Device Support

Yes! The entire portal is **100% responsive** across all devices:
- **Smartphones & Mobile**: iPhone, Android phones (slide-over navigation drawer, card-based tables, touch-friendly cell grids).
- **Tablets & iPads**: Full touch & responsive navigation layout.
- **Desktops & Laptops**: Multi-column statistics, side-by-side data tables, and persistent sidebar navigation.

---

## 🗄️ Backend & Database Architecture

### How the backend works:
- **Framework**: Python 3.11+ **FastAPI** web server running asynchronously on Uvicorn (`http://127.0.0.1:8000`).
- **ORM / Driver**: **SQLAlchemy 2.0** with `psycopg2` driver.
- **Authentication**: JWT Tokens with bcrypt password hashing and strict endpoint-level RBAC guards (`SUPER_ADMIN`, `HR`, `MANAGER`, `FINANCE`, `EMPLOYEE`).

### Database & How to view it:
- **Current Database**: **PostgreSQL** running on port `5432` (`postgresql://postgres:postgres@localhost:5432/hr_portal`).
- **How to view local data**: You can inspect tables using any database GUI client:
  - **DBeaver** or **pgAdmin** (Connect to `localhost:5432`, Database: `hr_portal`, User: `postgres`, Password: `postgres`).
  - Command line: `psql -U postgres -d hr_portal`

### Switching to Supabase:
**Yes! You can switch to Supabase in under 1 minute.**
Supabase provides hosted PostgreSQL. To switch:
1. Create a project on [Supabase.com](https://supabase.com).
2. Copy your Supabase PostgreSQL connection URI from Project Settings -> Database.
3. Update `DATABASE_URL` in your backend `.env` file:
   ```env
   DATABASE_URL=postgresql://postgres.xxx:YOUR_PASSWORD@db.xxx.supabase.co:5432/postgres
   ```
4. Run `python -m app.seed` (or start the FastAPI app) — SQLAlchemy will automatically create all tables and populate data on your cloud Supabase database!

---

## ☁️ Cloud Deployment (Vercel + Supabase + Render)

When you host your project in the cloud:
- **Do I need to keep Docker or VS Code open on my laptop?**
  **NO!** Once deployed to cloud providers (Vercel, Supabase, Render), the application runs 24/7 independently in the cloud. You can turn off your laptop, close VS Code, and close Docker completely.

### Recommended 3-Step Cloud Hosting Setup:

1. **Database -> Supabase (Free Managed Postgres)**:
   - Host PostgreSQL on [Supabase](https://supabase.com).
2. **Backend API -> Render or Railway (Free FastAPI Hosting)**:
   - Push code to GitHub.
   - Connect your GitHub repo to [Render.com](https://render.com) or [Railway.app](https://railway.app).
   - Set environment variable `DATABASE_URL` to your Supabase connection string.
3. **Frontend -> Vercel (Free React Hosting)**:
   - Connect your GitHub repo to [Vercel.com](https://vercel.com).
   - Set build settings: Framework `Vite`, Build Command `npm run build`, Output Directory `dist`.
   - Set environment variable: `VITE_API_URL=https://your-backend.onrender.com`.

---

## 🚀 Local Quickstart

### Prerequisites
Python 3.10+, Node.js 18+, PostgreSQL (or Docker).

### Running Backend:
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python -m app.seed
uvicorn app.main:app --reload --port 8000
```
API Documentation: **http://127.0.0.1:8000/docs**

### Running Frontend:
```bash
cd frontend
npm install
npm run dev
```
Portal Web App: **http://localhost:5173**

---

## 🔑 Login Access

- **Employees**: Log in with registered **Email ID** (e.g. `sheebathimmapuram@gmail.com`) and password (`Employee123!`).
- **HR / Admin Accounts**:
  - Super Admin: `admin@hrportal.com` / `Admin123!`
  - HR Manager: `hr@hrportal.com` / `Hr123!`
  - Manager: `manager@hrportal.com` / `Manager123!`
  - Finance: `finance@hrportal.com` / `Finance123!`
