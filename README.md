# terra

**TERRA** is a team retrospective board application.

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
- Node.js v18+ and npm (for client development)
- Python 3.9+ (for server development)

## Getting Started

### 1. Start the Database

Ensure Podman is running. You can check its status and start it with:

```bash
podman machine info
podman machine start
```

From the project root:

```bash
# Using podman-compose
podman-compose up -d

# OR using docker-compose
docker-compose up -d
```

The PostgreSQL database will be available at `localhost:5432` with credentials defined in `.env`.

### 2. Set Up and Run the Server

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The server will be available at http://localhost:8000 with hot-reloading enabled.

### 3. Set Up and Run the Client

```bash
cd client
npm install
npm run dev
```

The client will be available at http://localhost:5173 with hot-reloading (HMR) enabled.

To build the client for production:

```bash
cd client
npm run build
```

The built files will be in the `client/dist/` directory.

### 4. Access the Application

Open your browser and navigate to http://localhost:5173. You should see the Terra application where you can create and view boards.

## Development

### Hot-Reloading

Both the client and server support hot-reloading:

- **Client**: Vite provides instant Hot Module Replacement (HMR). Changes to React components are reflected immediately.
- **Server**: Uvicorn's `--reload` flag automatically restarts the server when Python files change.

### Project Structure

```
.
├── compose.yaml          # PostgreSQL container configuration
├── .env                  # Database credentials
├── client/               # React + TypeScript frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── services/     # API layer (Axios)
│   │   └── App.tsx       # Main application component
│   └── package.json
└── server/               # FastAPI backend
    ├── main.py           # FastAPI application and endpoints
    ├── database.py       # SQLAlchemy models and configuration
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
