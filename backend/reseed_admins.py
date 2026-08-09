import psycopg2, uuid

DB = "postgresql://hr_portal_db_7vxl_user:12nqBSzRJE8USES8NfrrImWRL2MesG4g@dpg-d9s9av942hec73btrcg0-a.oregon-postgres.render.com/hr_portal_db_7vxl"

conn = psycopg2.connect(DB)
conn.autocommit = True
cur = conn.cursor()

# Add profile_complete column if not exists
cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT FALSE")

# Re-seed admin and HR users (with bcrypt hashed passwords)
# Admin123! and Hr123! pre-hashed
admin_hash = "$2b$12$oKDd3l4JLNtIEhHzMVy.YuOYvuXiHkbm8K.PJf1.uW0EcGUDxCMGa"
hr_hash    = "$2b$12$oKDd3l4JLNtIEhHzMVy.YuOYvuXiHkbm8K.PJf1.uW0EcGUDxCMGa"

# Use Python bcrypt to hash properly
import sys
sys.path.insert(0, '.')
from app.auth import hash_password

admin_hash = hash_password("Admin123!")
hr_hash = hash_password("Hr123!")

admin_id = str(uuid.uuid4())
hr_id = str(uuid.uuid4())

cur.execute("""
    INSERT INTO users (id, email, hashed_password, role, profile_complete, is_active)
    VALUES (%s, %s, %s, 'SUPER_ADMIN', TRUE, TRUE)
    ON CONFLICT (email) DO UPDATE SET hashed_password = EXCLUDED.hashed_password, profile_complete = TRUE
""", (admin_id, "admin@hrportal.com", admin_hash))

cur.execute("""
    INSERT INTO users (id, email, hashed_password, role, profile_complete, is_active)
    VALUES (%s, %s, %s, 'HR', TRUE, TRUE)
    ON CONFLICT (email) DO UPDATE SET hashed_password = EXCLUDED.hashed_password, profile_complete = TRUE
""", (hr_id, "hr@hrportal.com", hr_hash))

print("Admin and HR users re-created")

# Add a few holidays
holidays = [
    ("Republic Day", "2025-01-26"),
    ("Holi", "2025-03-14"),
    ("Independence Day", "2025-08-15"),
    ("Gandhi Jayanti", "2025-10-02"),
    ("Diwali", "2025-10-20"),
    ("Christmas", "2025-12-25"),
]
for name, hdate in holidays:
    cur.execute(
        "INSERT INTO holidays (id, name, date) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
        (str(uuid.uuid4()), name, hdate)
    )
print("Holidays added")

# Verify
cur.execute("SELECT email, role, profile_complete FROM users")
for row in cur.fetchall():
    print("USER:", row)

conn.close()
print("Done!")
