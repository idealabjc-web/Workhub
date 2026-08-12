from sqlalchemy import text
from app.database import SessionLocal, engine

db = SessionLocal()

try:
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TYPE branchenum ADD VALUE IF NOT EXISTS 'HYD';"))
            conn.commit()
        except Exception as ex:
            print("Enum note:", ex)
        conn.execute(text("UPDATE employees SET branch = 'HYD' WHERE branch::text = 'IDEALAB';"))
        conn.execute(text("UPDATE departments SET branch = 'HYD' WHERE branch::text = 'IDEALAB';"))
        conn.execute(text("UPDATE teams SET branch = 'HYD' WHERE branch::text = 'IDEALAB';"))
        conn.commit()
    print("SUCCESSFULLY UPDATED DB BRANCHES FROM IDEALAB TO HYD!")
except Exception as e:
    print("DB UPDATE ERROR:", e)
finally:
    db.close()
