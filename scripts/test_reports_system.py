import os
import sys
from pathlib import Path

# Ensure root is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import requests
from sqlalchemy import text
from app.database.database import SessionLocal, engine
from app.utils.security import hash_password
from app.models.user import User

BASE_URL = "http://localhost:8000"

TEST_USERS = [
    {"email": "admin.test@contractiq.com", "full_name": "Admin User", "role": "Admin", "password": "Password123!"},
    {"email": "legal.test@contractiq.com", "full_name": "Legal Manager User", "role": "Legal Manager", "password": "Password123!"},
    {"email": "contract.test@contractiq.com", "full_name": "Contract Manager User", "role": "Contract Manager", "password": "Password123!"},
    {"email": "compliance.test@contractiq.com", "full_name": "Compliance Officer User", "role": "Compliance Officer", "password": "Password123!"},
    {"email": "viewer.test@contractiq.com", "full_name": "Viewer User", "role": "Viewer", "password": "Password123!"},
]


from app.utils.security import hash_password, verify_password

def ensure_test_users():
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


def get_token(email: str, password: str) -> str:
    res = requests.post(f"{BASE_URL}/auth/login", data={"username": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


def test_schema():
    print("\n--- 1. Testing Database Schema ---")
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'reports';
        """)).fetchall()
        cols = {row[0]: row[1] for row in result}
        print(f"Columns in 'reports' table: {list(cols.keys())}")
        
        required_cols = [
            "id", "report_name", "report_type", "generated_by",
            "generated_at", "file_path", "file_format", "status", "download_count"
        ]
        for rc in required_cols:
            assert rc in cols, f"Missing column '{rc}' in reports table!"
        print("[PASS] Database schema verified: All 9 required columns exist.")


def test_end_to_end_generation_and_download():
    print("\n--- 2. Testing End-to-End Report Generation (PDF & Excel) ---")
    admin_token = get_token("admin.test@contractiq.com", "Password123!")
    headers = {"Authorization": f"Bearer {admin_token}"}

    report_types = [
        "Compliance Report",
        "Contract Report",
        "Renewal Report",
        "Obligation Report",
        "Audit Report",
    ]

    generated_ids = []

    for r_type in report_types:
        for fmt in ["pdf", "excel"]:
            print(f"Generating {r_type} ({fmt.upper()})...")
            res = requests.post(
                f"{BASE_URL}/reports/generate",
                headers=headers,
                json={"report_type": r_type, "file_format": fmt, "report_name": f"Test {r_type} {fmt.upper()}"},
            )
            assert res.status_code == 201, f"Failed to generate {r_type} ({fmt}): {res.text}"
            data = res.json()
            assert data["report_type"] == r_type
            assert data["file_format"] == fmt
            assert data["status"] == "Completed"
            assert data["download_count"] == 0
            assert data["id"] > 0
            assert "admin" in data["generated_by_name"].lower()
            
            # Verify file exists on disk
            file_on_disk = Path(data["file_path"]).resolve()
            assert file_on_disk.is_file(), f"File {file_on_disk} was not created on disk!"
            file_size = file_on_disk.stat().st_size
            assert file_size > 1000, f"File size too small ({file_size} bytes)!"
            print(f"[PASS] {r_type} ({fmt.upper()}) created (ID={data['id']}, Size={file_size} bytes)")
            generated_ids.append((data["id"], fmt, data["file_path"]))

    # Test downloading and download count increments
    print("\n--- 3. Testing Download & Increment Counter ---")
    test_report_id, test_fmt, _ = generated_ids[0]
    
    # Download #1
    dl_res1 = requests.get(f"{BASE_URL}/reports/{test_report_id}/download", headers=headers)
    assert dl_res1.status_code == 200, f"Download failed: {dl_res1.text}"
    assert "application/pdf" in dl_res1.headers.get("content-type", "")
    assert "attachment; filename=" in dl_res1.headers.get("content-disposition", "")
    assert len(dl_res1.content) > 1000
    
    # Verify download count incremented to 1
    meta_res1 = requests.get(f"{BASE_URL}/reports/{test_report_id}", headers=headers)
    assert meta_res1.status_code == 200
    assert meta_res1.json()["download_count"] == 1
    print(f"[PASS] Download #1 successful, download_count incremented to {meta_res1.json()['download_count']}")

    # Download #2
    dl_res2 = requests.get(f"{BASE_URL}/reports/{test_report_id}/download", headers=headers)
    assert dl_res2.status_code == 200
    meta_res2 = requests.get(f"{BASE_URL}/reports/{test_report_id}", headers=headers)
    assert meta_res2.json()["download_count"] == 2
    print(f"[PASS] Download #2 successful, download_count incremented to {meta_res2.json()['download_count']}")

    # Test Excel download
    excel_report_id, _, _ = generated_ids[1]
    dl_excel = requests.get(f"{BASE_URL}/reports/{excel_report_id}/download", headers=headers)
    assert dl_excel.status_code == 200
    assert "spreadsheetml" in dl_excel.headers.get("content-type", "")
    assert ".xlsx" in dl_excel.headers.get("content-disposition", "")
    print(f"[PASS] Excel download verified with correct MIME type and .xlsx filename.")

    return generated_ids


def test_rbac_rules(sample_report_id: int):
    print("\n--- 4. Testing RBAC Rules Across Roles ---")
    
    # 1. Viewer
    viewer_token = get_token("viewer.test@contractiq.com", "Password123!")
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}
    
    # Viewer can list
    v_list = requests.get(f"{BASE_URL}/reports", headers=viewer_headers)
    assert v_list.status_code == 200, f"Viewer cannot list reports: {v_list.text}"
    print("[PASS] Viewer: Can view reports list (200)")

    # Viewer can download
    v_dl = requests.get(f"{BASE_URL}/reports/{sample_report_id}/download", headers=viewer_headers)
    assert v_dl.status_code == 200, f"Viewer cannot download report: {v_dl.text}"
    print("[PASS] Viewer: Can download report file (200)")

    # Viewer cannot generate
    v_gen = requests.post(
        f"{BASE_URL}/reports/generate",
        headers=viewer_headers,
        json={"report_type": "Compliance Report", "file_format": "pdf"},
    )
    assert v_gen.status_code == 403, f"Viewer generation should be 403, got {v_gen.status_code}"
    print("[PASS] Viewer: Blocked from generating report (403 Forbidden)")

    # Viewer cannot delete
    v_del = requests.delete(f"{BASE_URL}/reports/{sample_report_id}", headers=viewer_headers)
    assert v_del.status_code == 403, f"Viewer delete should be 403, got {v_del.status_code}"
    print("[PASS] Viewer: Blocked from deleting report (403 Forbidden)")

    # 2. Compliance Officer
    comp_token = get_token("compliance.test@contractiq.com", "Password123!")
    comp_headers = {"Authorization": f"Bearer {comp_token}"}

    # Can generate Compliance Report
    c_gen1 = requests.post(
        f"{BASE_URL}/reports/generate",
        headers=comp_headers,
        json={"report_type": "Compliance Report", "file_format": "pdf"},
    )
    assert c_gen1.status_code == 201, f"Compliance Officer should generate Compliance Report, got {c_gen1.status_code}"
    print("[PASS] Compliance Officer: Generated Compliance Report (201)")

    # Can generate Obligation Report
    c_gen2 = requests.post(
        f"{BASE_URL}/reports/generate",
        headers=comp_headers,
        json={"report_type": "Obligation Report", "file_format": "pdf"},
    )
    assert c_gen2.status_code == 201, f"Compliance Officer should generate Obligation Report, got {c_gen2.status_code}"
    print("[PASS] Compliance Officer: Generated Obligation Report (201)")

    # Cannot generate Contract Report
    c_gen3 = requests.post(
        f"{BASE_URL}/reports/generate",
        headers=comp_headers,
        json={"report_type": "Contract Report", "file_format": "pdf"},
    )
    assert c_gen3.status_code == 403, f"Compliance Officer should not generate Contract Report, got {c_gen3.status_code}"
    print("[PASS] Compliance Officer: Blocked from generating Contract Report (403 Forbidden)")

    # 3. Contract Manager
    cm_token = get_token("contract.test@contractiq.com", "Password123!")
    cm_headers = {"Authorization": f"Bearer {cm_token}"}

    # Can generate Contract Report
    cm_gen1 = requests.post(
        f"{BASE_URL}/reports/generate",
        headers=cm_headers,
        json={"report_type": "Contract Report", "file_format": "excel"},
    )
    assert cm_gen1.status_code == 201, f"Contract Manager should generate Contract Report, got {cm_gen1.status_code}"
    print("[PASS] Contract Manager: Generated Contract Report (201)")

    # Can generate Renewal Report
    cm_gen2 = requests.post(
        f"{BASE_URL}/reports/generate",
        headers=cm_headers,
        json={"report_type": "Renewal Report", "file_format": "excel"},
    )
    assert cm_gen2.status_code == 201, f"Contract Manager should generate Renewal Report, got {cm_gen2.status_code}"
    print("[PASS] Contract Manager: Generated Renewal Report (201)")

    # Cannot generate Compliance Report
    cm_gen3 = requests.post(
        f"{BASE_URL}/reports/generate",
        headers=cm_headers,
        json={"report_type": "Compliance Report", "file_format": "excel"},
    )
    assert cm_gen3.status_code == 403, f"Contract Manager should not generate Compliance Report, got {cm_gen3.status_code}"
    print("[PASS] Contract Manager: Blocked from generating Compliance Report (403 Forbidden)")

    # 4. Legal Manager
    legal_token = get_token("legal.test@contractiq.com", "Password123!")
    legal_headers = {"Authorization": f"Bearer {legal_token}"}

    # Can generate Audit Report
    l_gen = requests.post(
        f"{BASE_URL}/reports/generate",
        headers=legal_headers,
        json={"report_type": "Audit Report", "file_format": "pdf"},
    )
    assert l_gen.status_code == 201, f"Legal Manager should generate Audit Report, got {l_gen.status_code}"
    print("[PASS] Legal Manager: Generated Audit Report (201)")

    # Cannot delete report
    l_del = requests.delete(f"{BASE_URL}/reports/{sample_report_id}", headers=legal_headers)
    assert l_del.status_code == 403, f"Legal Manager should not delete report, got {l_del.status_code}"
    print("[PASS] Legal Manager: Blocked from deleting report (403 Forbidden)")


def test_deletion_flow(report_id: int, file_path_str: str):
    print("\n--- 5. Testing Report Deletion (Admin Only) ---")
    admin_token = get_token("admin.test@contractiq.com", "Password123!")
    headers = {"Authorization": f"Bearer {admin_token}"}

    file_on_disk = Path(file_path_str).resolve()
    assert file_on_disk.is_file(), f"File {file_on_disk} should exist before deletion"

    del_res = requests.delete(f"{BASE_URL}/reports/{report_id}", headers=headers)
    assert del_res.status_code == 200, f"Admin failed to delete report: {del_res.text}"
    print(f"[PASS] Admin deleted report ID {report_id} (200 OK)")

    # Check file was unlinked from disk
    assert not file_on_disk.is_file(), f"File {file_on_disk} was not removed from disk!"
    print("[PASS] File was removed from disk storage")

    # Check database query returns 404
    get_res = requests.get(f"{BASE_URL}/reports/{report_id}", headers=headers)
    assert get_res.status_code == 404, f"Deleted report should return 404, got {get_res.status_code}"
    print("[PASS] Database record was deleted (GET returns 404)")


def main():
    print("==================================================")
    print("STARTING COMPLETE REPORT SYSTEM INTEGRATION TESTS")
    print("==================================================")
    ensure_test_users()
    test_schema()
    generated = test_end_to_end_generation_and_download()
    test_rbac_rules(sample_report_id=generated[0][0])
    test_deletion_flow(report_id=generated[-1][0], file_path_str=generated[-1][2])
    print("\n==================================================")
    print("ALL TESTS PASSED WITH 100% SUCCESS!")
    print("==================================================")


if __name__ == "__main__":
    main()
