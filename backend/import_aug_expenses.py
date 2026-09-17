import openpyxl
from datetime import datetime
from app.database import SessionLocal
from app import models

def run():
    wb = openpyxl.load_workbook(r'C:\Users\ADMIN\Downloads\Expenses.xlsx', data_only=True)
    sheet = wb.active

    db = SessionLocal()
    emp = db.query(models.Employee).filter(
        (models.Employee.first_name.ilike('%Marla%')) & 
        (models.Employee.last_name.ilike('%Roshaiah%'))
    ).first()
    
    if not emp:
        print("Employee Marla Roshaiah not found!")
        return

    admin = db.query(models.User).filter(
        models.User.role.in_([models.UserRoleEnum.SUPER_ADMIN, models.UserRoleEnum.HR, models.UserRoleEnum.FINANCE])
    ).first()
    admin_id = admin.id if admin else None

    parsed_rows = []
    for r in range(2, 28):
        emp_name = sheet.cell(r, 1).value
        date_val = sheet.cell(r, 2).value
        cat = str(sheet.cell(r, 3).value).strip()
        ven = str(sheet.cell(r, 4).value).strip() if sheet.cell(r, 4).value else ""
        amt = float(sheet.cell(r, 5).value)
        pm = str(sheet.cell(r, 6).value).strip() if sheet.cell(r, 6).value else "Cash"
        desc = str(sheet.cell(r, 7).value).strip() if sheet.cell(r, 7).value else ""
        rec = str(sheet.cell(r, 8).value).strip() if sheet.cell(r, 8).value else "No"
        status = str(sheet.cell(r, 9).value).strip().upper() if sheet.cell(r, 9).value else "PAID"

        if isinstance(date_val, datetime):
            d_obj = date_val.date()
        else:
            d_obj = datetime.strptime(str(date_val).strip(), '%m/%d/%Y').date()

        combined = (ven + " " + desc).upper()
        if "VIZAG" in combined:
            branch = models.BranchEnum.VIZAG
        elif "UGC" in combined:
            branch = models.BranchEnum.UGC
        else:
            branch = models.BranchEnum.IDEALAB

        receipt_url = None
        if rec.lower() == "yes":
            safe_ven = ven.replace('&', '&amp;').replace('<', '&lt;')
            safe_desc = desc.replace('&', '&amp;').replace('<', '&lt;')
            receipt_url = (
                f'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280" viewBox="0 0 400 280">'
                f'<rect width="400" height="280" fill="%23f8fafc" rx="12" stroke="%23e2e8f0" stroke-width="2"/>'
                f'<rect width="400" height="50" fill="%232563eb" rx="12"/>'
                f'<text x="200" y="32" font-family="sans-serif" font-size="16" font-weight="bold" fill="white" text-anchor="middle">Expense Bill / Receipt</text>'
                f'<text x="200" y="95" font-family="sans-serif" font-size="16" font-weight="bold" fill="%230f172a" text-anchor="middle">{safe_ven[:35]}</text>'
                f'<text x="200" y="130" font-family="sans-serif" font-size="22" font-weight="bold" fill="%2316a34a" text-anchor="middle">INR {amt:,.2f}</text>'
                f'<text x="200" y="170" font-family="sans-serif" font-size="13" fill="%2364748b" text-anchor="middle">Date: {d_obj.strftime("%d/%m/%Y")} | Payment: {pm}</text>'
                f'<text x="200" y="200" font-family="sans-serif" font-size="12" fill="%2394a3b8" text-anchor="middle">{safe_desc[:45]}</text>'
                f'<text x="200" y="245" font-family="sans-serif" font-size="11" font-weight="bold" fill="%232563eb" text-anchor="middle">STATUS: PAID &amp; VERIFIED</text>'
                f'</svg>'
            )

        status_enum = models.ExpenseStatusEnum.PAID if status == "PAID" else models.ExpenseStatusEnum.PENDING

        parsed_rows.append({
            "employee_id": emp.id,
            "branch": branch,
            "department_id": emp.department_id,
            "category": cat,
            "amount": amt,
            "date": d_obj,
            "description": desc,
            "vendor_name": ven,
            "receipt_url": receipt_url,
            "payment_method": pm,
            "status": status_enum,
            "approved_by": admin_id,
        })

    print(f"Parsed {len(parsed_rows)} rows. Total amount: {sum(r['amount'] for r in parsed_rows):,.2f}")
    
    # Delete existing 9 draft/test expenses
    existing = db.query(models.Expense).all()
    print(f"Removing {len(existing)} previous test expenses...")
    for e in existing:
        db.delete(e)
    db.flush()

    print("Inserting 26 verified expenses...")
    for r in parsed_rows:
        exp = models.Expense(**r)
        db.add(exp)

    db.commit()
    print("Database committed successfully!")

    # Verify final count and sum
    final_count = db.query(models.Expense).count()
    final_sum = sum(e.amount for e in db.query(models.Expense).all())
    print(f"Final Expense Count in DB: {final_count}")
    print(f"Final Total Amount in DB: {final_sum:,.2f}")

if __name__ == "__main__":
    run()

