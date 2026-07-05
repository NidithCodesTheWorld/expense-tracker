# My Money API

A lightweight **FastAPI** based personal finance tracker.

## Overview

This project provides a RESTful API for managing users, accounts, transactions and budgets. It uses **FastAPI**, **SQLAlchemy**, **JWT** authentication and **SQLite** (or PostgreSQL via Neon) as the backend.

## Quick Start

```bash
# Navigate to the project directory
cd "/Users/nidithpokala/Desktop/AI - Access Folder/Projects/my-money"

# (If not already) Create a virtual environment and install dependencies
./venv/bin/pip install -r requirements.txt

# Run the server
./venv/bin/python run.py
```

The API will be available at `http://127.0.0.1:8000`. Swagger UI can be accessed at `http://127.0.0.1:8000/docs`.

## Project Structure

```
my-money/
├─ backend/            # FastAPI application source
│   ├─ __pycache__/   # compiled byte‑code (ignored)
│   ├─ auth.py        # authentication utilities (JWT)
│   ├─ chatbot.py     # optional chatbot helpers
│   ├─ database.py    # SQLAlchemy engine & session
│   ├─ main.py        # FastAPI entry point (app instance)
│   ├─ models.py      # ORM models (User, Account, Transaction …)
│   └─ schemas.py     # Pydantic request/response schemas
├─ frontend/           # Minimal static demo UI (HTML/JS/CSS)
│   ├─ index.html
│   ├─ app.js
│   └─ style.css
├─ .env.local          # Environment variables (Neon DB URLs) – **keep secret**
├─ requirements.txt    # Python dependencies
├─ run.py              # Helper to launch the server with uvicorn
├─ my_money.db         # SQLite DB (created on first run)
└─ README.md           # ← this file
```

## Environment Variables

- `NEON_BRANCH` – Neon branch (usually `production`).
- `DATABASE_URL` – Full PostgreSQL URL for production.
- `DATABASE_URL_UNPOOLED` – Same URL without connection pooling (useful for migrations).

> **Note:** Do **not** commit `.env.local` to version control. It contains credentials.

## Development

- The server runs with `reload=True` for hot‑reloading during development.
- Modify code in `backend/` and the changes will be reflected automatically.

## Contributing

1. Fork the repository.
2. Create a feature branch.
3. Install dependencies in a fresh virtual environment.
4. Submit a pull request.

## License

MIT – feel free to use and adapt.
