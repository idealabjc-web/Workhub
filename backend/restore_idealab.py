from sqlalchemy import text
from app.database import SessionLocal, engine

db = SessionLocal()

try:
    with engine.connect() as conn:
        conn.execute(text("UPDATE employees SET branch = 'IDEALAB' WHERE branch::text = 'HYD';"))
        conn.execute(text("UPDATE departments SET branch = 'IDEALAB' WHERE branch::text = 'IDEALAB';"))
        conn.execute(text("UPDATE teams SET branch = 'IDEALAB' WHERE branch::text = 'IDEALAB';"))
        conn.commit()
    print("SUCCESSFULLY RESTORED DATABASE BRANCH RECORDS TO IDEALAB!")
except Exception as e:
    print("RESTORE NOTE:", e)
finally:
    db.close()
