# terra

**TERRA** is a team retrospective board application done with agentic coding.

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Development](#development)
- [Testing](#testing)
- [License](#license)

## Features

- Collaborative team retrospective boards
- _(More features to be documented as the project develops)_

## Architecture

The application is structured as a 3-tier architecture with a reactive frontend.

- **Client**: React with TypeScript, built with Vite (hot-reloading enabled)
- **Server**: FastAPI with Python 3 and SQLAlchemy ORM (hot-reloading enabled)
- **Database**: PostgreSQL 16
- **Containers**: Podman/Docker for database orchestration

## Prerequisites

- [Podman](https://podman.io/) or Docker installed and running
- [Bun](https://bun.sh/) (for client development)
- Python 3.9+ (for server development)

## Getting Started

### Quick Start (All Services with One Command)

From the project root:

```bash
# Using podman-compose
podman-compose up -d

# OR using docker-compose
docker-compose up -d
```

This starts all three tiers:
- **Database**: PostgreSQL 16 on `localhost:5432`
- **Server**: FastAPI application on `http://localhost:8000`
- **Client**: React application on `http://localhost:5173`

### Local Development Setup

If you wish to run backend or frontend locally outside of containers:

#### 1. Start Database Container Only

```bash
podman-compose up -d postgres
```

#### 2. Set Up and Run the Server

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### 3. Set Up and Run the Client

```bash
cd client
bun install
bun run dev
```

### Access the Application

Open your browser and navigate to http://localhost:5173.

## Development

### Hot-Reloading

Both the client and server support hot-reloading:

- **Client**: Vite provides instant Hot Module Replacement (HMR). Changes to React components are reflected immediately.
- **Server**: Uvicorn's `--reload` flag automatically restarts the server when Python files change.

### Project Structure

```
.
├── compose.yaml          # Podman/Docker Compose configuration (database, server, client)
├── client/               # React + TypeScript frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── services/     # API layer (Axios)
│   │   └── App.tsx       # Main application component
│   ├── Dockerfile        # Frontend multi-stage container
│   ├── nginx.conf        # Nginx SPA config
│   └── package.json
└── server/               # FastAPI backend
    ├── main.py           # FastAPI application and endpoints
    ├── database.py       # SQLAlchemy models and configuration
    ├── Dockerfile        # Backend Python container
    └── requirements.txt
```

### API Documentation

When the server is running, interactive API documentation is available at:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### API Endpoints

- `GET /api/boards` - Get all boards
- `POST /api/boards` - Create a new board
  - Request body: `{"name": "Board Name"}`

## Testing

Test instructions will be added once the test suite is in place.

## License

This project is licensed under the [MIT License](LICENSE).
