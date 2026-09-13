import psycopg
from fastapi import FastAPI, HTTPException

from app.config import settings

app = FastAPI(title="ktc4-pusan4-ai")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/health/db")
def health_db():
    try:
        with psycopg.connect(settings.database_url, connect_timeout=3) as conn:
            conn.execute("SELECT 1")
    except psycopg.Error as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return {"status": "ok"}