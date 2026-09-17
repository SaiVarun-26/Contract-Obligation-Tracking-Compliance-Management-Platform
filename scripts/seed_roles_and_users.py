import sys
import os

sys.path.insert(0, os.path.abspath("."))

from app.database.database import SessionLocal
from app.models.user import User
from app.utils.security import hash_password
from app.core.role_checker import normalize_role

def seed():
    db = SessionLocal()
    try:
        # 1. Normalize existing roles
        users = db.query(User).all()
        for u in users:
            new_role = normalize_role(u.role)
            if new_role and new_role != u.role:
                print(f"Normalizing user {u.email}: {u.role} -> {new_role}")
                u.role = new_role
        db.commit()

        # 2. Ensure test users for each role
        test_accounts = [
            ("admin@contractiq.com", "Admin User", "Admin", "Admin123!"),
            ("legal@contractiq.com", "Legal Manager User", "Legal Manager", "Legal123!"),
            ("contract@contractiq.com", "Contract Manager User", "Contract Manager", "Contract123!"),
            ("compliance@contractiq.com", "Compliance Officer User", "Compliance Officer", "Compliance123!"),
            ("viewer@contractiq.com", "Viewer User", "Viewer", "Viewer123!"),
        ]

        for email, name, role, password in test_accounts:
            existing = db.query(User).filter(User.email == email).first()
            if not existing:
                print(f"Creating test user: {email} ({role})")
                user = User(
                    full_name=name,
                    email=email,
                    password=hash_password(password),
                    role=role,
                    is_active=True,
                )
                db.add(user)
            else:
                existing.role = role
                existing.password = hash_password(password)
                existing.is_active = True
                print(f"Updated test user: {email} ({role})")
        db.commit()
        print("Role normalization and test accounts successfully configured.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
