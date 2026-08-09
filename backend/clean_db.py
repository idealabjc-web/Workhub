import psycopg2

DB = "postgresql://hr_portal_db_7vxl_user:12nqBSzRJE8USES8NfrrImWRL2MesG4g@dpg-d9s9av942hec73btrcg0-a.oregon-postgres.render.com/hr_portal_db_7vxl"

conn = psycopg2.connect(DB)
conn.autocommit = True
cur = conn.cursor()

print("Getting all tables...")
cur.execute("""
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename != 'alembic_version'
    ORDER BY tablename
""")
tables = [r[0] for r in cur.fetchall()]
print("Tables found:", tables)

# Drop ALL data using TRUNCATE ALL TABLES with CASCADE
table_list = ", ".join(tables)
print(f"Truncating all {len(tables)} tables with CASCADE...")
cur.execute(f"TRUNCATE TABLE {table_list} RESTART IDENTITY CASCADE")
print("All tables truncated!")

# Verify
for t in tables:
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    count = cur.fetchone()[0]
    if count > 0:
        print(f"  {t}: {count} rows")

conn.close()
print("Done! Database is completely clean.")
