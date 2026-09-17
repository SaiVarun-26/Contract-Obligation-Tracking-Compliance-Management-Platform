"""
End-to-end verification script for Vercel deployment readiness.
Tests:
1. Cold startup without environment variables (simulating fresh Vercel serverless environment)
2. FastAPI app and api/index entrypoint import
3. Database URL normalization and resilient engine initialization
4. Health check endpoints (/ and /api/health)
5. Route availability both with and without /api prefix
6. CORS configuration for Vercel domains
7. Security configuration (SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES)
8. All models and Alembic metadata
9. Critical third-party dependencies (openpyxl, reportlab, etc.)
"""
import os
import sys
from pathlib import Path

# Add project root to sys.path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

print("=" * 60)
print("RUNNING VERCEL DEPLOYMENT READINESS CHECKS")
print("=" * 60)

# -------------------------------------------------------------
# Check 1: Simulating Cold Start with NO Environment Variables
# -------------------------------------------------------------
print("\n[Check 1] Simulating isolated environment (no DATABASE_URL provided)...")
os.environ.pop("DATABASE_URL", None)

try:
    from app.core.config import settings
    print(f"  [OK] Settings loaded successfully. DATABASE_URL default: {settings.DATABASE_URL}")
    print(f"  [OK] Security settings: ALGORITHM={settings.ALGORITHM}, EXPIRE={settings.ACCESS_TOKEN_EXPIRE_MINUTES}m")
except Exception as e:
    print(f"  [FAIL] Settings failed to load: {e}")
    sys.exit(1)

# -------------------------------------------------------------
# Check 2: Database URL Normalization
# -------------------------------------------------------------
print("\n[Check 2] Testing postgres:// URL normalization...")
from app.database.database import get_database_url

test_postgres_url = "postgres://user:pass@ep-cool-db.us-east-2.aws.neon.tech/neondb"
old_db_url = settings.DATABASE_URL
settings.DATABASE_URL = test_postgres_url
normalized = get_database_url()
assert normalized.startswith("postgresql://"), f"Failed to normalize postgres://, got: {normalized}"
print(f"  [OK] postgres:// correctly normalized to: {normalized[:20]}...")
settings.DATABASE_URL = old_db_url

# -------------------------------------------------------------
# Check 3: Import api/index.py entrypoint and app/main.py
# -------------------------------------------------------------
print("\n[Check 3] Testing serverless entrypoints...")
try:
    from app.main import app as main_app
    print("  [OK] app.main:app imported successfully")
except Exception as e:
    print(f"  ✗ Failed to import app.main:app: {e}")
    sys.exit(1)

try:
    from api.index import app as index_app
    print("  [OK] api.index:app imported successfully")
except Exception as e:
    print(f"  ✗ Failed to import api.index:app: {e}")
    sys.exit(1)

# -------------------------------------------------------------
# Check 4: TestClient Endpoint Invocations
# -------------------------------------------------------------
print("\n[Check 4] Testing endpoints with Starlette/FastAPI TestClient...")
from starlette.testclient import TestClient

client = TestClient(main_app, raise_server_exceptions=False)

# Root endpoint
res_root = client.get("/")
assert res_root.status_code == 200, f"Root returned {res_root.status_code}"
print(f"  [OK] GET / returned 200: {res_root.json()}")

# API health endpoint
res_health = client.get("/api/health")
assert res_health.status_code == 200, f"Health returned {res_health.status_code}"
print(f"  [OK] GET /api/health returned 200: {res_health.json()}")

# Auth routes (available at both /auth/login and /api/auth/login)
# Unauthenticated POST should return 422 (validation error for form data), NOT 404 or 500
res_auth_root = client.post("/auth/login", data={})
assert res_auth_root.status_code == 422, f"Expected 422 for empty form, got {res_auth_root.status_code}"
print(f"  [OK] POST /auth/login is accessible (status: {res_auth_root.status_code})")

res_auth_api = client.post("/api/auth/login", data={})
assert res_auth_api.status_code == 422, f"Expected 422 for empty form, got {res_auth_api.status_code}"
print(f"  [OK] POST /api/auth/login is accessible (status: {res_auth_api.status_code})")

# OpenAPI schema
res_openapi = client.get("/openapi.json")
assert res_openapi.status_code == 200, f"OpenAPI returned {res_openapi.status_code}"
print(f"  [OK] GET /openapi.json returned 200 (Title: {res_openapi.json().get('info', {}).get('title')})")

# -------------------------------------------------------------
# Check 5: CORS Verification for Vercel domains
# -------------------------------------------------------------
print("\n[Check 5] Testing CORS headers for Vercel domains...")
res_cors = client.options(
    "/api/health",
    headers={
        "Origin": "https://contractiq-beryl.vercel.app",
        "Access-Control-Request-Method": "GET",
    },
)
allowed_origin = res_cors.headers.get("access-control-allow-origin")
assert allowed_origin == "https://contractiq-beryl.vercel.app", f"CORS rejected Vercel origin: {allowed_origin}"
print(f"  [OK] CORS allows Vercel production origin: {allowed_origin}")

res_cors_preview = client.options(
    "/api/health",
    headers={
        "Origin": "https://contractiq-1kzcgpu2n-sai-varuns-projects-64f5d5bf.vercel.app",
        "Access-Control-Request-Method": "GET",
    },
)
allowed_preview = res_cors_preview.headers.get("access-control-allow-origin")
assert allowed_preview == "https://contractiq-1kzcgpu2n-sai-varuns-projects-64f5d5bf.vercel.app", f"CORS rejected preview: {allowed_preview}"
print(f"  [OK] CORS allows Vercel preview origin: {allowed_preview}")

# -------------------------------------------------------------
# Check 6: Models and Alembic Metadata
# -------------------------------------------------------------
print("\n[Check 6] Testing Database Models and Alembic Metadata...")
from app.database.database import Base
import app.models

tables = sorted(Base.metadata.tables.keys())
print(f"  [OK] Registered tables ({len(tables)}): {', '.join(tables)}")
expected_tables = {'users', 'contracts', 'obligations', 'renewals', 'notifications', 'reports', 'audit_logs', 'activities'}
missing_tables = expected_tables - set(tables)
assert not missing_tables, f"Missing models: {missing_tables}"

# -------------------------------------------------------------
# Check 7: Report Dependencies (openpyxl & reportlab)
# -------------------------------------------------------------
print("\n[Check 7] Testing report generator dependencies...")
try:
    import openpyxl
    print(f"  [OK] openpyxl imported successfully (version: {openpyxl.__version__})")
except ImportError as e:
    print(f"  [FAIL] openpyxl import failed: {e}")
    sys.exit(1)

try:
    import reportlab
    print(f"  [OK] reportlab imported successfully (version: {reportlab.__version__})")
except ImportError as e:
    print(f"  [FAIL] reportlab import failed: {e}")
    sys.exit(1)

# -------------------------------------------------------------
# Check 8: Security Token Operations
# -------------------------------------------------------------
print("\n[Check 8] Testing JWT Security token generation & verification...")
from app.utils.security import create_access_token, decode_access_token

token = create_access_token({"sub": "admin@example.com", "user_id": 1})
decoded = decode_access_token(token)
assert decoded["sub"] == "admin@example.com", f"Token subject mismatch: {decoded}"
assert decoded["user_id"] == 1, f"Token user_id mismatch: {decoded}"
print(f"  [OK] Token generated and verified successfully: {token[:25]}...")

print("\n" + "=" * 60)
print("ALL BACKEND VERIFICATION CHECKS PASSED!")
print("=" * 60)
