# Terra - Quick Start Guide

This guide will help you get the Terra application running in under 5 minutes.

## Prerequisites Check

Ensure you have the following installed:
- ✅ Podman or Docker

## Start All Services with One Command

From the project root directory:

```bash
# Using podman-compose
podman-compose up -d

# OR using docker-compose / docker compose
docker-compose up -d
```

This will automatically start:
- 🗄️ **Database**: PostgreSQL 16 on `localhost:5432`
- ⚙️ **Server**: FastAPI on `http://localhost:8000`
- 🖥️ **Client**: React UI on `http://localhost:5173`

## Alternative: Local Development Setup

If you prefer running server and client locally for development:

### 1. Database
```bash
podman-compose up -d postgres
```

### 2. Server (Backend)
```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Server will be at: http://localhost:8000

### 3. Client (Frontend)
```bash
cd client
npm install
npm run dev
```

Client will be at: http://localhost:5173

## Verify It Works

1. Open http://localhost:5173 in your browser
2. Enter a board name (e.g., "Sprint 42 Retrospective")
3. Click "Create Board"
4. You should see your board appear in the list below

