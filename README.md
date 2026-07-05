# My Money API

A lightweight **FastAPI** based personal finance tracker.

## Overview

This project provides a RESTful API for managing users, accounts, transactions, and budgets. It leverages **FastAPI**, **SQLAlchemy**, **JWT** authentication, and supports both **SQLite** (local development) and **PostgreSQL** (via Neon) as database backends.

## Quick Start

```bash
# Clone and navigate to the project directory
cd path/to/my-money

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the backend server
python run.py
