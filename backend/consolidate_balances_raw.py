import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app.models import LeaveTypeEnum, LeaveBalance
from sqlalchemy import text

db = SessionLocal()

try:
    with engine.connect() as conn:
        # 1. Get raw data bypassing SQLAlchemy ORM enum validation
        res = conn.execute(text("SELECT id, employee_id, leave_type, total, used FROM leave_balances"))
        rows = res.fetchall()

        emp_balances = {}
        for r in rows:
            emp_id = r[1]
            if emp_id not in emp_balances:
                emp_balances[emp_id] = []
            emp_balances[emp_id].append(r)
        
        # 2. Delete all existing records directly via SQL
        conn.execute(text("DELETE FROM leave_balances"))
        
        # 3. Insert consolidated records
        for emp_id, bals in emp_balances.items():
            total_used = sum((b[4] or 0) for b in bals)
            quota = bals[0][3] if bals else 6
            
            conn.execute(text("INSERT INTO leave_balances (id, employee_id, leave_type, total, used) VALUES (gen_random_uuid(), :emp_id, 'LEAVE', :total, :used)"), 
                         {"emp_id": emp_id, "total": quota, "used": total_used})
        
        conn.commit()

    print("Successfully consolidated duplicate leave balances using raw SQL!")

except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
