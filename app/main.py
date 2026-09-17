import sys
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

# Ensure root directory is always in sys.path for serverless runtime environments
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.core.config import settings
from app.database.database import test_database_connection

from app.api.user_api import router as user_router
from app.api.contract_api import router as contract_router
from app.api.obligation_api import router as obligation_router
from app.api.renewal_api import router as renewal_router
from app.api.notification_api import router as notification_router
from app.api.report_api import router as report_router
from app.api.audit_log_api import router as audit_log_router
from app.api.activity_api import router as activity_router
from app.api.auth_api import router as auth_router
from app.api.compliance_api import router as compliance_router
from app.api.dashboard_api import router as dashboard_router

app = FastAPI(
    title="ContractIQ API",
    version="1.0.0",
    swagger_ui_parameters={"persistAuthorization": True},
)

# -----------------------------
# CORS
# -----------------------------
configured_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins if configured_origins else ["*"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|([a-zA-Z0-9-]+\.)*vercel\.app)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def normalize_vercel_path(request: Request, call_next):
    # Vercel rewrites to /api/index.py pass /api/index.py or /api/index in request.scope['path']
    raw_path = request.scope.get("path", "")
    for prefix in ("/api/index.py", "/api/index"):
        if raw_path.startswith(prefix):
            stripped = raw_path[len(prefix):]
            request.scope["path"] = stripped if (not stripped or stripped.startswith("/")) else ("/" + stripped)
            if not request.scope["path"]:
                request.scope["path"] = "/"
            break
    return await call_next(request)


@app.on_event("startup")
def startup_event():
    try:
        test_database_connection()
    except Exception as e:
        print("Startup warning: Database connection check failed:", e)


# -----------------------------
# Routers (Registered both directly and under /api for full compatibility)
# -----------------------------
routers = [
    user_router,
    contract_router,
    obligation_router,
    renewal_router,
    notification_router,
    report_router,
    audit_log_router,
    activity_router,
    auth_router,
    compliance_router,
    dashboard_router,
]

for r in routers:
    app.include_router(r)
    app.include_router(r, prefix="/api")


@app.get("/")
@app.get("/health")
def root():
    return {
        "status": "healthy",
        "service": "ContractIQ API",
        "version": "1.0.0",
        "message": "ContractIQ Backend is running successfully."
    }


@app.get("/api")
@app.get("/api/health")
def api_health():
    return {
        "status": "healthy",
        "service": "ContractIQ API",
        "version": "1.0.0"
    }