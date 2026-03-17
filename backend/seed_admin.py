#!/usr/bin/env python3
"""Seed a default admin user if no users exist in the database.

Run automatically by docker-compose after alembic upgrade head.
Credentials are configurable via environment variables.
"""
import os
import sys
import bcrypt
from datetime import datetime, timezone
from sqlalchemy import create_engine, text

DATABASE_SYNC_URL = os.environ.get(
    "DATABASE_SYNC_URL", "postgresql://crm:crm@localhost:5432/crm"
)
ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "admin@crm.local")
ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD", "Admin1234!")
ADMIN_NAME = os.environ.get("SEED_ADMIN_NAME", "CRM Admin")

engine = create_engine(DATABASE_SYNC_URL)

with engine.connect() as conn:
    count = conn.execute(text("SELECT COUNT(*) FROM users")).scalar()
    if count > 0:
        print(f"[seed] {count} user(s) already exist – skipping admin seed.")
        sys.exit(0)

    hashed = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
    conn.execute(
        text(
            "INSERT INTO users (email, full_name, hashed_password, role, is_active, created_at) "
            "VALUES (:email, :name, :pw, 'admin', true, :now)"
        ),
        {
            "email": ADMIN_EMAIL,
            "name": ADMIN_NAME,
            "pw": hashed,
            "now": datetime.now(timezone.utc),
        },
    )
    conn.commit()
    print(f"[seed] Created admin user: {ADMIN_EMAIL}  password: {ADMIN_PASSWORD}")
