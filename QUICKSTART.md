# Terra - Quick Start Guide

This guide will help you get the Terra application running in under 5 minutes.

## Prerequisites Check

Ensure you have the following installed:
- ✅ Podman or Docker
- ✅ Python 3.9+
- ✅ Node.js v18+ and npm (recommend using nvm)

## Start All Services

### Terminal 1: Database
```bash
# From project root
podman-compose up
# OR: docker-compose up
```

### Terminal 2: Server (Backend)
```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Server will be at: http://localhost:8000

### Terminal 3: Client (Frontend)
```bash
cd client
nvm use v22.22.0
npm install
npm run dev
```

Client will be at: http://localhost:5173

## Verify It Works

1. Open http://localhost:5173 in your browser
2. Enter a board name (e.g., "Sprint 42 Retrospective")
3. Click "Create Board"
4. You should see your board appear in the list below

