"""
Migration: Add LEAVE to LeaveTypeEnum and migrate all existing leave records
to use the new unified 'LEAVE' type.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from sqlalchemy import text

db = SessionLocal()

try:
    # Step 1: Add LEAVE value to the postgres enum type
    with engine.connect() as conn:
        conn.execute(text("ALTER TYPE leavetypeenum ADD VALUE IF NOT EXISTS 'LEAVE'"))
        conn.commit()
    print("Step 1: Added 'LEAVE' to leavetypeenum enum")

    # Step 2: Migrate all Leave records
    result = db.execute(text("UPDATE leaves SET leave_type = 'LEAVE' WHERE leave_type IN ('CASUAL','SICK','PAID','UNPAID','MATERNITY','PATERNITY','OPTIONAL')"))
    db.commit()
    print(f"Step 2: Migrated {result.rowcount} leave request records to 'LEAVE'")

    # Step 3: Migrate all LeaveBalance records
    result = db.execute(text("UPDATE leave_balances SET leave_type = 'LEAVE' WHERE leave_type IN ('CASUAL','SICK','PAID','UNPAID','MATERNITY','PATERNITY','OPTIONAL')"))
    db.commit()
    print(f"Step 3: Migrated {result.rowcount} leave balance records to 'LEAVE'")

    # Verify
    counts = db.execute(text("SELECT leave_type, COUNT(*) FROM leaves GROUP BY leave_type")).fetchall()
    print("\nLeave records after migration:")
    for t, c in counts:
        print(f"  {t}: {c}")

    bal_counts = db.execute(text("SELECT leave_type, COUNT(*) FROM leave_balances GROUP BY leave_type")).fetchall()
    print("Leave balance records after migration:")
    for t, c in bal_counts:
        print(f"  {t}: {c}")

    print("\nMigration complete!")

except Exception as e:
    db.rollback()
    print(f"ERROR: {e}")
    import traceback; traceback.print_exc()
finally:
    db.close()
