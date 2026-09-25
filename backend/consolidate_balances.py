import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models import LeaveBalance, LeaveTypeEnum
from sqlalchemy import text

db = SessionLocal()

try:
    # 1. Fetch all balances
    balances = db.query(LeaveBalance).all()
    
    # 2. Group by employee_id
    emp_balances = {}
    for b in balances:
        if b.employee_id not in emp_balances:
            emp_balances[b.employee_id] = []
        emp_balances[b.employee_id].append(b)
    
    # 3. Consolidate and delete
    for emp_id, bals in emp_balances.items():
        total_used = sum((b.used or 0) for b in bals)
        quota = bals[0].total if bals else 6
        
        # Delete all balances for this employee
        db.query(LeaveBalance).filter(LeaveBalance.employee_id == emp_id).delete()
        
        # Create single LEAVE balance
        new_balance = LeaveBalance(
            employee_id=emp_id,
            leave_type=LeaveTypeEnum.LEAVE,
            total=quota,
            used=total_used
        )
        db.add(new_balance)
        
    db.commit()
    print("Successfully consolidated duplicate leave balances!")

except Exception as e:
    db.rollback()
    print(f"Error: {e}")
finally:
    db.close()
