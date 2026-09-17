"""
Comprehensive Automated RBAC Verification Suite for ContractIQ.

Tests authentication tokens and access controls across all 5 canonical roles:
1. Admin (admin@contractiq.com / Admin123!)
2. Legal Manager (legal@contractiq.com / Legal123!)
3. Contract Manager (contract@contractiq.com / Contract123!)
4. Compliance Officer (compliance@contractiq.com / Compliance123!)
5. Viewer (viewer@contractiq.com / Viewer123!)
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.utils.security import decode_access_token

client = TestClient(app)

PASSWORDS = {
    "admin@contractiq.com": "Admin123!",
    "legal@contractiq.com": "Legal123!",
    "contract@contractiq.com": "Contract123!",
    "compliance@contractiq.com": "Compliance123!",
    "viewer@contractiq.com": "Viewer123!",
}

def login(email: str) -> tuple[str, dict]:
    response = client.post(
        "/auth/login",
        data={"username": email, "password": PASSWORDS[email]},
    )
    assert response.status_code == 200, f"Login failed for {email}: {response.text}"
    data = response.json()
    token = data["access_token"]
    decoded = decode_access_token(token)
    return token, decoded

def run_tests():
    print("=" * 70)
    print("CONTRACTIQ RBAC AUTOMATED AUDIT & VERIFICATION")
    print("=" * 70)

    tokens = {}
    decoded_payloads = {}

    # 1. Login and Token verification
    print("\n[STEP 1] Testing Login & JWT Payloads for All Roles...")
    expected_roles = {
        "admin@contractiq.com": "Admin",
        "legal@contractiq.com": "Legal Manager",
        "contract@contractiq.com": "Contract Manager",
        "compliance@contractiq.com": "Compliance Officer",
        "viewer@contractiq.com": "Viewer",
    }

    for email, expected_role in expected_roles.items():
        token, payload = login(email)
        tokens[expected_role] = token
        decoded_payloads[expected_role] = payload
        assert payload.get("role") == expected_role, f"Role mismatch for {email}: got {payload.get('role')} vs {expected_role}"
        assert "user_id" in payload, f"Missing user_id in token for {email}"
        assert "email" in payload, f"Missing email in token for {email}"
        print(f"  [OK] {expected_role}: JWT verified with role='{payload['role']}', user_id={payload['user_id']}")

    def auth_headers(role: str) -> dict:
        return {"Authorization": f"Bearer {tokens[role]}"}

    # 2. User Management Endpoints
    print("\n[STEP 2] Testing User Management RBAC (/users/)...")
    # GET /users/ -> Admin only
    res_admin = client.get("/users/", headers=auth_headers("Admin"))
    assert res_admin.status_code == 200, f"Admin GET /users/ failed: {res_admin.status_code}"
    print("  [OK] Admin can list all users (200)")

    for non_admin in ["Legal Manager", "Contract Manager", "Compliance Officer", "Viewer"]:
        res = client.get("/users/", headers=auth_headers(non_admin))
        assert res.status_code == 403, f"{non_admin} got {res.status_code} instead of 403 on GET /users/"
        print(f"  [OK] {non_admin} blocked from listing users (403 Forbidden)")

    # GET /users/assignees -> Accessible to all authenticated users
    for role in ["Admin", "Legal Manager", "Contract Manager", "Compliance Officer", "Viewer"]:
        res = client.get("/users/assignees", headers=auth_headers(role))
        assert res.status_code == 200, f"{role} failed on /users/assignees: {res.status_code}"
        assignees = res.json()
        assert isinstance(assignees, list) and len(assignees) > 0
        assert "password_hash" not in assignees[0]
        print(f"  [OK] {role} can access /users/assignees (200, {len(assignees)} items)")

    # 3. Contract Creation and Management
    print("\n[STEP 3] Testing Contract Endpoints RBAC (/contracts)...")
    import uuid
    run_id = uuid.uuid4().hex[:6].upper()
    base_contract = {
        "description": "Validation of RBAC permissions",
        "category": "Service",
        "start_date": "2026-09-01",
        "end_date": "2027-09-01",
        "department": "Engineering",
    }

    # Admin create contract
    res_c_admin = client.post("/contracts", json={**base_contract, "title": "Admin Contract", "contract_number": f"CNT-ADM-{run_id}"}, headers=auth_headers("Admin"))
    assert res_c_admin.status_code == 201, f"Admin create contract failed: {res_c_admin.text}"
    admin_contract_id = res_c_admin.json()["id"]
    print(f"  [OK] Admin created contract #{admin_contract_id} (201)")

    # Legal Manager create contract
    res_c_legal = client.post("/contracts", json={**base_contract, "title": "Legal Contract", "contract_number": f"CNT-LEG-{run_id}"}, headers=auth_headers("Legal Manager"))
    assert res_c_legal.status_code == 201, f"Legal create contract failed: {res_c_legal.text}"
    legal_contract_id = res_c_legal.json()["id"]
    print(f"  [OK] Legal Manager created contract #{legal_contract_id} (201)")

    # Contract Manager create contract
    res_c_mgr = client.post("/contracts", json={**base_contract, "title": "Mgr Contract", "contract_number": f"CNT-MGR-{run_id}"}, headers=auth_headers("Contract Manager"))
    assert res_c_mgr.status_code == 201, f"Contract Manager create contract failed: {res_c_mgr.text}"
    mgr_contract_id = res_c_mgr.json()["id"]
    print(f"  [OK] Contract Manager created contract #{mgr_contract_id} (201)")

    # Compliance Officer & Viewer CANNOT create contract
    for role in ["Compliance Officer", "Viewer"]:
        res_fail = client.post("/contracts", json={**base_contract, "title": "Unauthorized Contract", "contract_number": f"CNT-FAIL-{run_id}"}, headers=auth_headers(role))
        assert res_fail.status_code == 403, f"{role} got {res_fail.status_code} instead of 403 on POST /contracts"
        print(f"  [OK] {role} blocked from creating contract (403 Forbidden)")

    # Contract Approval
    print("\n[STEP 4] Testing Contract Approval RBAC (/contracts/{id}/approve)...")
    # First submit to Under Review
    client.post(f"/contracts/{mgr_contract_id}/submit-review", headers=auth_headers("Contract Manager"))

    # Viewer & Compliance Officer & Contract Manager CANNOT approve
    for role in ["Viewer", "Compliance Officer", "Contract Manager"]:
        res_app_fail = client.post(f"/contracts/{mgr_contract_id}/approve", headers=auth_headers(role))
        assert res_app_fail.status_code == 403, f"{role} got {res_app_fail.status_code} instead of 403 on /approve"
        print(f"  [OK] {role} blocked from approving contract (403 Forbidden)")

    # Legal Manager CAN approve
    res_app_legal = client.post(f"/contracts/{mgr_contract_id}/approve", headers=auth_headers("Legal Manager"))
    assert res_app_legal.status_code == 200, f"Legal Manager approve failed: {res_app_legal.text}"
    print(f"  [OK] Legal Manager approved contract #{mgr_contract_id} (200)")

    # Contract Deletion: Admin ONLY
    print("\n[STEP 5] Testing Contract Deletion RBAC (/contracts/{id})...")
    for role in ["Legal Manager", "Contract Manager", "Compliance Officer", "Viewer"]:
        res_del_fail = client.delete(f"/contracts/{mgr_contract_id}", headers=auth_headers(role))
        assert res_del_fail.status_code == 403, f"{role} got {res_del_fail.status_code} instead of 403 on DELETE /contracts"
        print(f"  [OK] {role} blocked from deleting contract (403 Forbidden)")

    res_del_admin = client.delete(f"/contracts/{mgr_contract_id}", headers=auth_headers("Admin"))
    assert res_del_admin.status_code == 200, f"Admin delete contract failed: {res_del_admin.text}"
    print(f"  [OK] Admin deleted contract #{mgr_contract_id} (200)")

    # 4. Reports RBAC
    print("\n[STEP 6] Testing Reports RBAC (/reports/)...")
    for role in ["Admin", "Legal Manager", "Compliance Officer"]:
        res_rep = client.get("/reports/", headers=auth_headers(role))
        assert res_rep.status_code == 200, f"{role} failed on /reports/: {res_rep.status_code}"
        print(f"  [OK] {role} can view reports (200)")

    for role in ["Contract Manager", "Viewer"]:
        res_rep_fail = client.get("/reports/", headers=auth_headers(role))
        assert res_rep_fail.status_code == 403, f"{role} got {res_rep_fail.status_code} instead of 403 on /reports/"
        print(f"  [OK] {role} blocked from viewing reports (403 Forbidden)")

    # 5. Audit Logs RBAC
    print("\n[STEP 7] Testing Audit Logs RBAC (/audit-logs/)...")
    for role in ["Admin", "Legal Manager", "Compliance Officer"]:
        res_audit = client.get("/audit-logs/", headers=auth_headers(role))
        assert res_audit.status_code == 200, f"{role} failed on /audit-logs/: {res_audit.status_code}"
        print(f"  [OK] {role} can view audit logs (200)")

    for role in ["Contract Manager", "Viewer"]:
        res_audit_fail = client.get("/audit-logs/", headers=auth_headers(role))
        assert res_audit_fail.status_code == 403, f"{role} got {res_audit_fail.status_code} instead of 403 on /audit-logs/"
        print(f"  [OK] {role} blocked from viewing audit logs (403 Forbidden)")

    # 6. Obligations RBAC
    print("\n[STEP 8] Testing Obligations RBAC (/obligations)...")
    obligation_payload = {
        "contract_id": admin_contract_id,
        "title": "Delivery milestone",
        "description": "Deliver initial beta release",
        "obligation_type": "Milestone",
        "priority": "High",
        "due_date": "2026-11-01",
        "assigned_to": decoded_payloads["Viewer"]["user_id"],
    }

    # Contract Manager can create obligation
    res_ob_mgr = client.post("/obligations", json=obligation_payload, headers=auth_headers("Contract Manager"))
    assert res_ob_mgr.status_code == 201, f"Contract Manager create obligation failed: {res_ob_mgr.text}"
    ob_id = res_ob_mgr.json()["id"]
    print(f"  [OK] Contract Manager created obligation #{ob_id} (201)")

    # Viewer & Compliance Officer CANNOT create obligation
    for role in ["Viewer", "Compliance Officer"]:
        res_ob_fail = client.post("/obligations", json=obligation_payload, headers=auth_headers(role))
        assert res_ob_fail.status_code == 403, f"{role} got {res_ob_fail.status_code} instead of 403 on POST /obligations"
        print(f"  [OK] {role} blocked from creating obligation (403 Forbidden)")

    # Delete obligation: Admin or Legal Manager only
    res_ob_del_mgr = client.delete(f"/obligations/{ob_id}", headers=auth_headers("Contract Manager"))
    assert res_ob_del_mgr.status_code == 403, f"Contract Manager delete obligation should fail with 403"
    print("  [OK] Contract Manager blocked from deleting obligation (403 Forbidden)")

    res_ob_del_legal = client.delete(f"/obligations/{ob_id}", headers=auth_headers("Legal Manager"))
    assert res_ob_del_legal.status_code in [200, 204], f"Legal Manager delete obligation failed: {res_ob_del_legal.text}"
    print(f"  [OK] Legal Manager deleted obligation #{ob_id} ({res_ob_del_legal.status_code})")

    # 7. Renewals RBAC
    print("\n[STEP 9] Testing Renewals RBAC (/renewals)...")
    renewal_payload = {
        "contract_id": admin_contract_id,
        "renewal_date": "2027-08-01",
        "previous_expiry_date": "2027-09-01",
        "new_expiry_date": "2028-09-01",
        "assigned_to": decoded_payloads["Contract Manager"]["user_id"],
        "notes": "Annual automatic extension",
    }
    # Contract Manager can create renewal
    res_ren_mgr = client.post("/renewals", json=renewal_payload, headers=auth_headers("Contract Manager"))
    assert res_ren_mgr.status_code == 201, f"Contract Manager create renewal failed: {res_ren_mgr.text}"
    ren_id = res_ren_mgr.json()["id"]
    print(f"  [OK] Contract Manager created renewal #{ren_id} (201)")

    # Viewer & Compliance Officer CANNOT create renewal
    for role in ["Viewer", "Compliance Officer"]:
        res_ren_fail = client.post("/renewals", json=renewal_payload, headers=auth_headers(role))
        assert res_ren_fail.status_code == 403, f"{role} got {res_ren_fail.status_code} instead of 403 on POST /renewals"
        print(f"  [OK] {role} blocked from creating renewal (403 Forbidden)")

    # Delete renewal: Admin ONLY
    res_ren_del_legal = client.delete(f"/renewals/{ren_id}", headers=auth_headers("Legal Manager"))
    assert res_ren_del_legal.status_code == 403, f"Legal Manager delete renewal should fail with 403"
    print("  [OK] Legal Manager blocked from deleting renewal (403 Forbidden)")

    res_ren_del_admin = client.delete(f"/renewals/{ren_id}", headers=auth_headers("Admin"))
    assert res_ren_del_admin.status_code in [200, 204], f"Admin delete renewal failed: {res_ren_del_admin.text}"
    print(f"  [OK] Admin deleted renewal #{ren_id} ({res_ren_del_admin.status_code})")

    # Cleanup remaining test contracts
    client.delete(f"/contracts/{admin_contract_id}", headers=auth_headers("Admin"))
    client.delete(f"/contracts/{legal_contract_id}", headers=auth_headers("Admin"))

    print("\n" + "=" * 70)
    print("ALL RBAC AUDIT TESTS PASSED SUCCESSFULLY! (100% SUCCESS)")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
