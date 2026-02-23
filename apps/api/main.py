from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import get_settings
from api.routers import auth, spaces, layout, reservations, admin_settings, admin_dashboard

settings = get_settings()

app = FastAPI(
    title="HotPep - 席予約SaaS API",
    description="マルチテナント対応の席予約システム",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(spaces.router)
app.include_router(layout.router)
app.include_router(reservations.router)
app.include_router(admin_settings.router)
app.include_router(admin_dashboard.router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "data": None,
            "error": {"message": "サーバーエラーが発生しました", "code": "INTERNAL_ERROR"},
        },
    )


@app.get("/health")
async def health_check():
    return {"status": "ok"}
