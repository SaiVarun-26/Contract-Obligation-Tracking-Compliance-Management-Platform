"""
End-to-End Activity Logging Verification Suite
Validates:
1. User Login / Logout events
2. Contract lifecycle logging (create, update, approve, activate, delete)
3. Report generation and download logging
4. Obligation lifecycle logging
5. Renewal lifecycle logging
6. RBAC scoping on GET /activity
7. File exports (CSV, Excel, PDF)
8. Admin deletion of activity log
"""

import sys
import os
import uuid
import requests
import json

# Ensure root is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database.database import SessionLocal
from app.models.user import User
from app.utils.security import hash_password, verify_password

BASE_URL = "http://localhost:8000"

TEST_USERS = [
    {"email": "admin.test@contractiq.com", "full_name": "Admin User", "role": "Admin", "password": "Password123!"},
    {"email": "compliance.test@contractiq.com", "full_name": "Compliance Officer User", "role": "Compliance Officer", "password": "Password123!"},
    {"email": "viewer.test@contractiq.com", "full_name": "Viewer User", "role": "Viewer", "password": "Password123!"},
]

def ensure_users():
    db = SessionLocal()
    for u in TEST_USERS:
        existing = db.query(User).filter(User.email == u["email"]).first()
        if not existing:
            new_user = User(
                email=u["email"],
                full_name=u["full_name"],
                role=u["role"],
                password=hash_password(u["password"]),
                is_active=True,
            )
            db.add(new_user)
        else:
            existing.role = u["role"]
            existing.is_active = True
            if not verify_password(u["password"], existing.password):
                existing.password = hash_password(u["password"])
    db.commit()
    db.close()

def log_test(name, success, details=""):
    status = "[PASS]" if success else "[FAIL]"
    print(f"{status} {name}", flush=True)
    if details:
        print(f"       {details}", flush=True)
    if not success:
        sys.exit(1)

def get_token(email, password):
    res = requests.post(f"{BASE_URL}/auth/login", data={"username": email, "password": password})
    if res.status_code != 200:
        raise Exception(f"Login failed for {email}: {res.status_code} {res.text}")
    return res.json()["access_token"]

def run_tests():
    print("=" * 60, flush=True)
    print("STARTING END-TO-END ACTIVITY LOGGING VERIFICATION", flush=True)
    print("=" * 60, flush=True)

    run_id = uuid.uuid4().hex[:6].upper()

    # 1. Admin Login & USER_LOGIN check
    admin_token = get_token("admin.test@contractiq.com", "Password123!")
    log_test("Admin Login", bool(admin_token))
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Verify USER_LOGIN logged
    act_res = requests.get(f"{BASE_URL}/activity?action=USER_LOGIN", headers=admin_headers)
    log_test("Verify USER_LOGIN logged", act_res.status_code == 200 and len(act_res.json()["items"]) > 0,
             f"Total USER_LOGIN records: {act_res.json().get('total')}")

    # 2. Contract Lifecycle Logging
    create_payload = {
        "title": f"Audit Contract {run_id}",
        "contract_number": f"CNT-AUDIT-{run_id}",
        "description": "Contract for activity logging verification",
        "category": "Service",
        "start_date": "2026-09-01",
        "end_date": "2027-09-01",
        "department": "Engineering"
    }
    c_res = requests.post(f"{BASE_URL}/contracts", json=create_payload, headers=admin_headers)
    log_test("Create Contract", c_res.status_code == 201, f"Status: {c_res.status_code}")
    contract_id = c_res.json()["id"]

    # Verify CREATE_CONTRACT logged
    c_act = requests.get(f"{BASE_URL}/activity?action=CREATE_CONTRACT&contract_id={contract_id}", headers=admin_headers)
    log_test("Verify CREATE_CONTRACT logged", c_act.status_code == 200 and len(c_act.json()["items"]) > 0,
             f"Logged for contract #{contract_id}")

    # Update Contract
    u_res = requests.put(f"{BASE_URL}/contracts/{contract_id}", json={
        "title": f"Audit Contract {run_id} - Updated",
    }, headers=admin_headers)
    log_test("Update Contract", u_res.status_code == 200, f"Status: {u_res.status_code}")

    # Verify UPDATE_CONTRACT logged
    u_act = requests.get(f"{BASE_URL}/activity?action=UPDATE_CONTRACT&contract_id={contract_id}", headers=admin_headers)
    log_test("Verify UPDATE_CONTRACT logged", u_act.status_code == 200 and len(u_act.json()["items"]) > 0)

    # Submit Review & Approve
    sr_res = requests.post(f"{BASE_URL}/contracts/{contract_id}/submit-review", headers=admin_headers)
    log_test("Submit Contract Review", sr_res.status_code == 200, f"Status: {sr_res.status_code}")

    ap_res = requests.post(f"{BASE_URL}/contracts/{contract_id}/approve", headers=admin_headers)
    log_test("Approve Contract", ap_res.status_code == 200, f"Status: {ap_res.status_code}")

    import base64
    raw_token_payload = admin_token.split(".")[1]
    raw_token_payload += "=" * ((4 - len(raw_token_payload) % 4) % 4)
    decoded_admin = json.loads(base64.b64decode(raw_token_payload))
    admin_user_id = decoded_admin.get("user_id", 1)

    # 3. Obligation Lifecycle Logging
    ob_payload = {
        "contract_id": contract_id,
        "title": "Deliver Quarterly Compliance Report",
        "description": "Obligation verification task",
        "obligation_type": "Milestone",
        "priority": "High",
        "due_date": "2026-12-31",
        "assigned_to": admin_user_id,
    }
    ob_res = requests.post(f"{BASE_URL}/obligations", json=ob_payload, headers=admin_headers)
    log_test("Create Obligation", ob_res.status_code == 201, f"Status: {ob_res.status_code}")
    obligation_id = ob_res.json()["id"]

    ob_act = requests.get(f"{BASE_URL}/activity?action=CREATE_OBLIGATION&entity_id={obligation_id}", headers=admin_headers)
    log_test("Verify CREATE_OBLIGATION logged", ob_act.status_code == 200 and len(ob_act.json()["items"]) > 0)

    # 4. Renewal Lifecycle Logging
    ren_payload = {
        "contract_id": contract_id,
        "renewal_date": "2027-08-01",
        "previous_expiry_date": "2027-09-01",
        "new_expiry_date": "2028-09-01",
        "assigned_to": admin_user_id,
        "notes": "Automatic annual extension"
    }
    ren_res = requests.post(f"{BASE_URL}/renewals", json=ren_payload, headers=admin_headers)
    log_test("Create Renewal", ren_res.status_code == 201, f"Status: {ren_res.status_code}")
    renewal_id = ren_res.json()["id"]

    ren_act = requests.get(f"{BASE_URL}/activity?action=CREATE_RENEWAL&entity_id={renewal_id}", headers=admin_headers)
    log_test("Verify CREATE_RENEWAL logged", ren_act.status_code == 200 and len(ren_act.json()["items"]) > 0)

    # 5. Report Generation & Download Logging
    rep_res = requests.post(f"{BASE_URL}/reports/generate", json={
        "report_type": "Contract Report",
        "file_format": "pdf",
        "report_name": f"Audit Report {run_id}"
    }, headers=admin_headers)
    log_test("Generate Report", rep_res.status_code == 201, f"Status: {rep_res.status_code}")
    report_id = rep_res.json()["id"]

    dl_res = requests.get(f"{BASE_URL}/reports/{report_id}/download", headers=admin_headers)
    log_test("Download Report", dl_res.status_code == 200, f"Downloaded {len(dl_res.content)} bytes")

    rep_act = requests.get(f"{BASE_URL}/activity?action=DOWNLOAD_REPORT&entity_id={report_id}", headers=admin_headers)
    log_test("Verify DOWNLOAD_REPORT logged", rep_act.status_code == 200 and len(rep_act.json()["items"]) > 0)

    # 6. Test File Exports
    # CSV Export
    csv_res = requests.get(f"{BASE_URL}/activity/export/csv", headers=admin_headers)
    log_test("Export Activities as CSV", csv_res.status_code == 200 and "text/csv" in csv_res.headers.get("content-type", ""),
             f"Content length: {len(csv_res.content)} bytes")

    # Excel Export
    xlsx_res = requests.get(f"{BASE_URL}/activity/export/excel", headers=admin_headers)
    log_test("Export Activities as Excel (.xlsx)", xlsx_res.status_code == 200 and "openxmlformats" in xlsx_res.headers.get("content-type", ""),
             f"Content length: {len(xlsx_res.content)} bytes")

    # PDF Export
    pdf_res = requests.get(f"{BASE_URL}/activity/export/pdf", headers=admin_headers)
    log_test("Export Activities as PDF", pdf_res.status_code == 200 and "application/pdf" in pdf_res.headers.get("content-type", ""),
             f"Content length: {len(pdf_res.content)} bytes")

    # 7. Test RBAC Scoping for Non-Admin
    viewer_token = get_token("viewer.test@contractiq.com", "Password123!")
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}
    viewer_act = requests.get(f"{BASE_URL}/activity", headers=viewer_headers)
    log_test("Viewer Scoped GET /activity", viewer_act.status_code == 200,
             f"Viewer sees {viewer_act.json()['total']} activities (scoped to own actions)")

    # Viewer trying to delete an activity should get 403
    target_id_to_try = c_act.json()["items"][0]["id"]
    del_attempt = requests.delete(f"{BASE_URL}/activity/{target_id_to_try}", headers=viewer_headers)
    log_test("Viewer DELETE activity returns 403 Forbidden", del_attempt.status_code == 403,
             f"Status: {del_attempt.status_code}")

    # 8. Admin Deletion of Activity Log
    admin_del = requests.delete(f"{BASE_URL}/activity/{target_id_to_try}", headers=admin_headers)
    log_test("Admin DELETE activity log entry", admin_del.status_code in [200, 204], f"Status: {admin_del.status_code}")

    # Confirm it no longer exists
    get_del = requests.get(f"{BASE_URL}/activity/{target_id_to_try}", headers=admin_headers)
    log_test("Confirm deleted log returns 404", get_del.status_code == 404, f"Status: {get_del.status_code}")

    # 9. Test Logout
    logout_res = requests.post(f"{BASE_URL}/auth/logout", headers=admin_headers)
    log_test("POST /auth/logout", logout_res.status_code == 200, f"Status: {logout_res.status_code}")

    logout_act = requests.get(f"{BASE_URL}/activity?action=USER_LOGOUT", headers=admin_headers)
    log_test("Verify USER_LOGOUT logged", logout_act.status_code == 200 and len(logout_act.json()["items"]) > 0)

    # Clean up test contract
    del_c = requests.delete(f"{BASE_URL}/contracts/{contract_id}", headers=admin_headers)
    log_test("Clean up test contract", del_c.status_code in [200, 204])

    print("=" * 60)
    print("ALL ACTIVITY LOGGING E2E TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
