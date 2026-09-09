"""
Backfill attendance from 2026-01-01 to 2026-07-31 based on each employee's Date of Joining (DOJ).
- Mondays through Saturdays are marked PRESENT (09:30:00 - 18:30:00).
- Sundays are marked WEEK_OFF (check_in=None, check_out=None).
- Employees only receive records starting from max(DOJ, 2026-01-01).
- Employees who joined after 2026-07-31 receive 0 records for this period.
- Updates both Neon PostgreSQL and local SQLite.
"""

import datetime
import uuid
import psycopg2
from psycopg2.extras import execute_values
import sqlite3

NEON_URL = "postgresql://neondb_owner:npg_NHY3C9uGfWki@ep-snowy-cherry-azfm1y9n-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
SQLITE_PATH = "backend/hr_portal.db"

START_DATE = datetime.date(2026, 1, 1)
END_DATE = datetime.date(2026, 7, 31)

def generate_records_for_employees(employees):
    """
    employees: list of dicts with keys: id, employee_number, name, doj
    Returns list of tuples ready for database insertion.
    """
    records = []
    skipped_after_end = 0
    joined_during = 0
    joined_before = 0

    for emp in employees:
        doj = emp["doj"]
        if not doj or doj > END_DATE:
            skipped_after_end += 1
            continue

        if doj < START_DATE:
            joined_before += 1
            emp_start = START_DATE
        else:
            joined_during += 1
            emp_start = doj

        curr = emp_start
        while curr <= END_DATE:
            rec_id = str(uuid.uuid4())
            is_sunday = (curr.weekday() == 6)

            if is_sunday:
                status = "WEEK_OFF"
                cin = None
                cout = None
            else:
                status = "PRESENT"
                cin = datetime.datetime.combine(curr, datetime.time(9, 30, 0))
                cout = datetime.datetime.combine(curr, datetime.time(18, 30, 0))

            records.append((
                rec_id,
                emp["id"],
                curr,
                cin,
                cout,
                status,
                0.0,    # overtime_hours
                False,  # is_late
                False,  # is_early_logout
                None,   # notes
                datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) # created_at
            ))
            curr += datetime.timedelta(days=1)

    print(f"Summary of generation:")
    print(f"  Joined before {START_DATE}: {joined_before}")
    print(f"  Joined during {START_DATE} to {END_DATE}: {joined_during}")
    print(f"  Joined after {END_DATE} (skipped): {skipped_after_end}")
    print(f"  Total records generated: {len(records)}")
    present_cnt = sum(1 for r in records if r[5] == "PRESENT")
    weekoff_cnt = sum(1 for r in records if r[5] == "WEEK_OFF")
    print(f"    - PRESENT: {present_cnt}")
    print(f"    - WEEK_OFF: {weekoff_cnt}")

    return records


def run_neon_sync(records):
    print("\n--- Connecting to Neon PostgreSQL ---")
    conn = psycopg2.connect(NEON_URL)
    cur = conn.cursor()

    # 1. Delete existing records in the window
    cur.execute(
        "DELETE FROM attendance WHERE date >= %s AND date <= %s;",
        (START_DATE, END_DATE)
    )
    deleted_count = cur.rowcount
    print(f"Deleted {deleted_count} existing records in range {START_DATE} to {END_DATE}")

    # 2. Insert new records in batches
    insert_sql = """
        INSERT INTO attendance (
            id, employee_id, date, check_in, check_out, status,
            overtime_hours, is_late, is_early_logout, notes, created_at
        ) VALUES %s
    """
    batch_size = 1000
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        execute_values(cur, insert_sql, batch)
        print(f"Inserted batch {i // batch_size + 1} ({len(batch)} records)...")

    conn.commit()
    print("Neon PostgreSQL commit successful!")

    # Verify
    cur.execute("SELECT COUNT(*) FROM attendance WHERE date >= %s AND date <= %s;", (START_DATE, END_DATE))
    total_in_db = cur.fetchone()[0]
    cur.execute("SELECT status, COUNT(*) FROM attendance WHERE date >= %s AND date <= %s GROUP BY status;", (START_DATE, END_DATE))
    by_status = cur.fetchall()
    print(f"Verification in Neon DB -> Total: {total_in_db}, By Status: {by_status}")

    cur.close()
    conn.close()


def run_sqlite_sync(records):
    print(f"\n--- Connecting to SQLite ({SQLITE_PATH}) ---")
    try:
        conn = sqlite3.connect(SQLITE_PATH)
        cur = conn.cursor()

        # Check if table exists
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='attendance';")
        if not cur.fetchone():
            print("attendance table does not exist in SQLite, skipping.")
            conn.close()
            return

        cur.execute("DELETE FROM attendance WHERE date >= ? AND date <= ?;", (str(START_DATE), str(END_DATE)))
        deleted_count = cur.rowcount
        print(f"Deleted {deleted_count} existing records from SQLite.")

        # Convert datetimes to strings for SQLite
        sqlite_records = []
        for r in records:
            sqlite_records.append((
                r[0],
                r[1],
                str(r[2]),
                str(r[3]) if r[3] else None,
                str(r[4]) if r[4] else None,
                r[5],
                r[6],
                1 if r[7] else 0,
                1 if r[8] else 0,
                r[9],
                str(r[10])
            ))

        insert_sql = """
            INSERT INTO attendance (
                id, employee_id, date, check_in, check_out, status,
                overtime_hours, is_late, is_early_logout, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        batch_size = 1000
        for i in range(0, len(sqlite_records), batch_size):
            cur.executemany(insert_sql, sqlite_records[i:i + batch_size])
        conn.commit()
        print(f"SQLite inserted {len(sqlite_records)} records successfully!")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"SQLite sync notice: {e}")


def main():
    # 1. Fetch active employees from Neon
    conn = psycopg2.connect(NEON_URL)
    cur = conn.cursor()
    cur.execute("""
        SELECT id, employee_number, first_name, last_name, date_of_joining
        FROM employees
        WHERE status = 'ACTIVE'
        ORDER BY date_of_joining;
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    employees = [
        {
            "id": r[0],
            "employee_number": r[1],
            "name": f"{r[2]} {r[3]}".strip(),
            "doj": r[4]
        }
        for r in rows
    ]
    print(f"Fetched {len(employees)} active employees.")

    # 2. Generate records
    records = generate_records_for_employees(employees)

    # 3. Insert to Neon PostgreSQL
    run_neon_sync(records)

    # 4. Insert to SQLite
    run_sqlite_sync(records)

    print("\nAll operations completed successfully!")


if __name__ == "__main__":
    main()
