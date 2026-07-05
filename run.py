import uvicorn
import os

if __name__ == "__main__":
    # Ensure database tables are created and seed data is populated
    # Run uvicorn on all interfaces for local accessibility
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
