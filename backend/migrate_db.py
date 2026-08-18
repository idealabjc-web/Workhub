import os
from sqlalchemy import create_engine, MetaData

OLD_DB = "postgresql://hr_portal_db_7vxl_user:12nqBSzRJE8USES8NfrrImWRL2MesG4g@dpg-d9s9av942hec73btrcg0-a.oregon-postgres.render.com/hr_portal_db_7vxl"
NEW_DB = "postgresql://neondb_owner:npg_NHY3C9uGfWki@ep-snowy-cherry-azfm1y9n-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

def migrate():
    print("Connecting to databases...")
    engine_old = create_engine(OLD_DB)
    engine_new = create_engine(NEW_DB)

    print("Reflecting old schema...")
    meta_old = MetaData()
    meta_old.reflect(bind=engine_old)

    print("Creating schema in new database...")
    meta_new = MetaData()
    for table in meta_old.sorted_tables:
        table.tometadata(meta_new)
    
    meta_new.create_all(engine_new)

    print("Migrating data...")
    with engine_old.connect() as conn_old:
        with engine_new.connect() as conn_new:
            with conn_new.begin(): # Transaction block
                for table in meta_old.sorted_tables:
                    print(f"Migrating table {table.name}...")
                    
                    # Delete existing data just in case, in reverse order if we were deleting, but here we just insert
                    
                    result = conn_old.execute(table.select())
                    rows = result.fetchall()
                    
                    if rows:
                        rows_dicts = [dict(row._mapping) for row in rows]
                        conn_new.execute(table.insert(), rows_dicts)
                    
                    print(f"OK Table {table.name} migrated: {len(rows)} rows.")
                    
    print("\nVerifying row counts...")
    with engine_old.connect() as conn_old, engine_new.connect() as conn_new:
        print(f"{'Table':<30} | {'Old Count':<10} | {'New Count':<10} | {'Status'}")
        print("-" * 70)
        for table in meta_old.sorted_tables:
            old_count = conn_old.execute(table.select()).rowcount
            # For accurate counts, use scalar
            old_count = conn_old.scalar(table.select().with_only_columns(table.c.id).count() if 'id' in table.c else table.select())
            # Actually easier:
            from sqlalchemy import select, func
            old_count = conn_old.scalar(select(func.count()).select_from(table))
            new_count = conn_new.scalar(select(func.count()).select_from(meta_new.tables[table.name]))
            
            status = "OK" if old_count == new_count else "MISMATCH"
            print(f"{table.name:<30} | {old_count:<10} | {new_count:<10} | {status}")
            
if __name__ == "__main__":
    migrate()
