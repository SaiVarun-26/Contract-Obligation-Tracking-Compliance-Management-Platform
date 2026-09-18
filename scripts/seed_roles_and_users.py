import os
import sys

# Ensure root directory is on sys.path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from sqlalchemy import func
from app.database.database import SessionLocal
from app.models.user import User
from app.utils.security import hash_password, verify_password

DEMO_ACCOUNTS = [
    {
        "title": "Admin",
        "name": "Admin User",
        "email": "admin@contractiq.com",
        "password": "Admin@123",
        "role": "admin",
    },
    {
        "title": "Legal",
        "name": "Legal Manager User",
        "email": "legal@contractiq.com",
        "password": "Legal@123",
        "role": "legal",
    },
    {
        "title": "Contract Manager",
        "name": "Contract Manager User",
        "email": "contract@contractiq.com",
        "password": "Contract@123",
        "role": "contract_manager",
    },
    {
        "title": "Compliance",
        "name": "Compliance Officer User",
        "email": "compliance@contractiq.com",
        "password": "Compliance@123",
        "role": "compliance",
    },
    {
        "title": "Viewer",
        "name": "Viewer User",
        "email": "viewer@contractiq.com",
        "password": "Viewer@123",
        "role": "viewer",
    },
]


def seed():
    db = SessionLocal()
    try:
        # Create or update each demo account
        for acc in DEMO_ACCOUNTS:
            email = acc["email"].strip().lower()
            existing = db.query(User).filter(func.lower(User.email) == email).first()

            hashed = hash_password(acc["password"])

            if not existing:
                user = User(
                    full_name=acc["name"],
                    email=acc["email"],
                    password=hashed,
                    role=acc["role"],
                    is_active=True,
                )
                db.add(user)
            else:
                existing.password = hashed
                existing.role = acc["role"]
                existing.is_active = True
                if not existing.full_name:
                    existing.full_name = acc["name"]

        db.commit()

        # Verify each account exists and passes verify_password()
        for acc in DEMO_ACCOUNTS:
            email = acc["email"].strip().lower()
            user = db.query(User).filter(func.lower(User.email) == email).first()

            if not user:
                raise ValueError(f"Verification failed: {acc['email']} does not exist.")

            if not user.is_active:
                raise ValueError(f"Verification failed: {acc['email']} is not active.")

            if user.role != acc["role"]:
                raise ValueError(
                    f"Verification failed: {acc['email']} has role '{user.role}', expected '{acc['role']}'."
                )

            if not verify_password(acc["password"], user.password):
                raise ValueError(
                    f"Verification failed: password check failed for {acc['email']}."
                )

        # Print the exact requested format
        print("====================================")
        print("Demo Accounts")
        print("====================================")
        print()
        for i, acc in enumerate(DEMO_ACCOUNTS):
            print(acc["title"])
            print(acc["email"])
            print(f"Password: {acc['password']}")
            if i < len(DEMO_ACCOUNTS) - 1:
                print()
        print()
        print("====================================")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
