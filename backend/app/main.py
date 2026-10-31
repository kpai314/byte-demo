from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .database import engine, Base, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.app_name,
    version="0.4.0",
    description="Campus food services and kitchen operating system for DJSCE"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {
        "success": True,
        "data": {
            "status": "ok",
            "service": "BYTE Campus Food OS FastAPI Backend",
            "version": "0.4.0",
            "database": "PostgreSQL / SQLAlchemy 2.0 Ready",
            "campus": settings.campus_name
        },
        "message": None
    }
