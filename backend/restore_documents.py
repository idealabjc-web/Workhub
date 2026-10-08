import sys
from app.database import SessionLocal
from app import models

def restore():
    db = SessionLocal()
    try:
        # 1. Restore HR Documents
        print("--- Checking HR Documents ---")
        hr_docs = [
            ("Employee Handbook 2026", "Policy", "Comprehensive guidelines on company code of conduct and workplace ethics.", False),
            ("Leave & Attendance Policy", "Policy", "Rules regarding casual, sick, maternity leaves, and attendance cutoffs.", False),
            ("IT & Cybersecurity Guidelines", "Compliance", "Security protocols, password policies, and data protection rules.", False),
            ("Travel & Expense Claim Form", "Form", "Standard reimbursement claim template.", False),
            ("Performance Review Framework", "Template", "KRA and KPI rating template for managers.", True),
            ("Salary Slip Template", "Template", "Official payslip format.", True),
            ("Confidential NDA Agreement", "Contract", "Standard employee non-disclosure agreement.", True),
        ]
        
        added_hr = 0
        for name, cat, desc, conf in hr_docs:
            exists = db.query(models.HRDocument).filter(models.HRDocument.name == name).first()
            if not exists:
                db.add(models.HRDocument(
                    name=name,
                    category=cat,
                    description=desc,
                    is_confidential=conf,
                ))
                added_hr += 1
        
        db.commit()
        print(f"Added {added_hr} HR Documents. Total now: {db.query(models.HRDocument).count()}")

        # 2. Restore Employee Documents
        print("--- Checking Employee Documents ---")
        employees = db.query(models.Employee).all()
        print(f"Total employees found: {len(employees)}")

        added_emp_docs = 0
        for emp in employees:
            existing_docs = db.query(models.EmployeeDocument).filter(
                models.EmployeeDocument.employee_id == emp.id
            ).all()
            existing_types = {d.doc_type for d in existing_docs}

            fname = emp.first_name.strip() if emp.first_name else "Employee"
            
            # Ensure Resume
            if "Resume" not in existing_types:
                db.add(models.EmployeeDocument(
                    employee_id=emp.id,
                    doc_type="Resume",
                    file_name=f"{fname}_Resume_2026.pdf"
                ))
                added_emp_docs += 1

            # Ensure Degree / Certificate
            if "Certificates" not in existing_types:
                db.add(models.EmployeeDocument(
                    employee_id=emp.id,
                    doc_type="Certificates",
                    file_name=f"{fname}_Degree_Certificate.pdf"
                ))
                added_emp_docs += 1

        db.commit()
        total_emp_docs = db.query(models.EmployeeDocument).count()
        print(f"Added {added_emp_docs} Employee Documents. Total now: {total_emp_docs}")

    finally:
        db.close()

if __name__ == "__main__":
    restore()
