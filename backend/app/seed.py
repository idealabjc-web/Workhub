"""
Comprehensive seed: 25 employees across 3 branches & 10 departments,
attendance grid logs, leaves & balances, 3 months payroll & payslips,
revenue targets, expenses, company events, announcements, HR documents,
employee documents, attendance corrections, audit logs, notifications, and system settings.
"""
import random
from datetime import date, datetime, timedelta

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app import models

Base.metadata.create_all(bind=engine)


def run():
    db = SessionLocal()
    try:
        rng = random.Random(42)

        # Clear existing data to ensure a completely fresh rich dataset
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()

        print("Creating fresh departments and teams...")
        dept_data = [
            ("Engineering", "IDEALAB"),
            ("Tech Team", "IDEALAB"),
            ("Product", "IDEALAB"),
            ("Design", "IDEALAB"),
            ("Human Resources", "IDEALAB"),
            ("Finance", "UGC"),
            ("Accounts", "UGC"),
            ("Sales", "VIZAG"),
            ("Operations", "VIZAG"),
            ("Marketing", "VIZAG"),
            ("Customer Success", "UGC"),
        ]
        departments = {}
        for name, branch in dept_data:
            d = models.Department(name=name, branch=branch)
            db.add(d)
            departments[name] = d
        db.flush()

        teams_data = [
            ("Tech Team", "IDEALAB", "Tech Team"),
            ("Team Alpha", "IDEALAB", "Engineering"),
            ("Team Beta", "IDEALAB", "Product"),
            ("Team Gamma", "VIZAG", "Sales"),
            ("Team Delta", "UGC", "Finance"),
            ("Team Sigma", "VIZAG", "Operations"),
        ]
        teams = []
        for name, branch, dept in teams_data:
            t = models.Team(
                name=name,
                branch=branch,
                department_id=departments[dept].id,
            )
            db.add(t)
            teams.append(t)
        db.flush()

        # ── Demo accounts ───────────────────────────────────────────────
        demo_users = [
            ("admin@hrportal.com",    "Admin123!",    "SUPER_ADMIN", "Ava",     "Admin",    "IDEALAB", "Human Resources",  "Super Admin"),
            ("alluriroshitha999@gmail.com", "Hr123!", "HR", "Roshitha", "Alluri", "IDEALAB", "Human Resources", "HR Manager"),
            ("manager@hrportal.com",  "Manager123!",  "MANAGER",     "Ravi",    "Kumar",    "VIZAG",   "Sales",            "Sales Manager"),
            ("finance@hrportal.com",  "Finance123!",  "FINANCE",     "Neha",    "Verma",    "UGC",     "Finance",          "Finance Head"),
            ("employee@hrportal.com", "Employee123!", "EMPLOYEE",    "Arjun",   "Rao",      "VIZAG",   "Sales",            "Sales Executive"),
        ]

        extra_employees = [
            ("Ananya",   "Krishnan",   "IDEALAB", "Engineering",     "Senior Developer",   "EMPLOYEE", 85000),
            ("Vikram",   "Singh",      "IDEALAB", "Engineering",     "DevOps Engineer",    "EMPLOYEE", 78000),
            ("Sanjana",  "Patel",      "IDEALAB", "Design",          "UI/UX Designer",     "EMPLOYEE", 65000),
            ("Rohit",    "Mehta",      "IDEALAB", "Product",         "Product Manager",    "MANAGER",  90000),
            ("Divya",    "Nair",       "IDEALAB", "Human Resources", "HR Executive",       "HR",       55000),
            ("Kiran",    "Bose",       "UGC",     "Finance",         "Senior Accountant",  "FINANCE",  70000),
            ("Aditya",   "Joshi",      "UGC",     "Accounts",        "Junior Accountant",  "EMPLOYEE", 45000),
            ("Shreya",   "Gupta",      "UGC",     "Customer Success","CS Manager",         "MANAGER",  75000),
            ("Manish",   "Tiwari",     "UGC",     "Customer Success","CS Executive",       "EMPLOYEE", 50000),
            ("Pooja",    "Iyer",       "VIZAG",   "Sales",           "Sales Executive",    "EMPLOYEE", 48000),
            ("Suresh",   "Reddy",      "VIZAG",   "Sales",           "Senior Sales Exec",  "EMPLOYEE", 60000),
            ("Kavitha",  "Pillai",     "VIZAG",   "Operations",      "Operations Lead",    "MANAGER",  72000),
            ("Rajesh",   "Das",        "VIZAG",   "Operations",      "Operations Exec",    "EMPLOYEE", 46000),
            ("Meera",    "Nambiar",    "VIZAG",   "Marketing",       "Marketing Manager",  "MANAGER",  68000),
            ("Arun",     "Saxena",     "VIZAG",   "Marketing",       "Content Writer",     "EMPLOYEE", 42000),
            ("Lakshmi",  "Iyengar",    "IDEALAB", "Engineering",     "QA Engineer",        "EMPLOYEE", 62000),
            ("Deepak",   "Malhotra",   "IDEALAB", "Engineering",     "Backend Developer",  "EMPLOYEE", 80000),
            ("Nisha",    "Kaur",       "UGC",     "Finance",         "Finance Analyst",    "FINANCE",  58000),
            ("Rahul",    "Sharma",     "IDEALAB", "Product",         "Business Analyst",   "EMPLOYEE", 55000),
            ("Sunita",   "Mishra",     "VIZAG",   "Operations",      "Procurement Exec",   "EMPLOYEE", 44000),
        ]

        all_employees = []
        blood_groups = ["O+", "A+", "B+", "AB+", "O-", "A-"]
        genders = ["Male", "Female"]

        def make_user_emp(email, pw, role, fname, lname, branch, dept_name, designation, salary, idx):
            user = models.User(email=email, hashed_password=hash_password(pw), role=role)
            db.add(user)
            db.flush()
            doj = date.today() - timedelta(days=365 + idx * 15)
            emp = models.Employee(
                user_id=user.id,
                employee_number=f"EMP{1001 + idx}",
                first_name=fname,
                last_name=lname,
                email=email,
                phone=f"9{rng.randint(100000000, 999999999)}",
                blood_group=rng.choice(blood_groups),
                date_of_birth=date(1988 + (idx % 10), (idx % 12) + 1, (idx % 28) + 1),
                gender=rng.choice(genders),
                address=f"{rng.randint(1,200)}, Innovation Parkway, Hyderabad",
                emergency_contact=f"9{rng.randint(100000000, 999999999)}",
                date_of_joining=doj,
                department_id=departments.get(dept_name, list(departments.values())[0]).id,
                designation=designation,
                branch=branch,
                employment_type="Full-Time",
                status="Active",
                basic_salary=salary,
            )
            db.add(emp)
            db.flush()

            # Leave balances
            for lt in models.LeaveTypeEnum:
                used = rng.randint(0, 5)
                db.add(models.LeaveBalance(
                    employee_id=emp.id,
                    leave_type=lt,
                    total=12 if lt in [models.LeaveTypeEnum.CASUAL, models.LeaveTypeEnum.SICK] else 15,
                    used=used,
                ))

            # Employee Documents
            db.add(models.EmployeeDocument(employee_id=emp.id, doc_type="Resume", file_name=f"{fname}_Resume_2026.pdf"))
            db.add(models.EmployeeDocument(employee_id=emp.id, doc_type="Certificates", file_name=f"{fname}_Degree_Certificate.pdf"))

            return emp

        print("Seeding demo and employee records...")
        for idx, (email, pw, role, fname, lname, branch, dept, designation) in enumerate(demo_users):
            salary = [100000, 80000, 75000, 70000, 48000][idx]
            emp = make_user_emp(email, pw, role, fname, lname, branch, dept, designation, salary, idx)
            all_employees.append(emp)

        for idx, (fname, lname, branch, dept, designation, role, salary) in enumerate(extra_employees):
            email = f"{fname.lower()}.{lname.lower()}@hrportal.com"
            pw = f"{fname}123!"
            emp = make_user_emp(email, pw, role, fname, lname, branch, dept, designation, salary, len(demo_users) + idx)
            all_employees.append(emp)

        db.commit()

        # ── Reporting Managers & Team Leads ─────────────────────────────
        branch_managers = {}
        for emp in all_employees:
            b = emp.branch.value if hasattr(emp.branch, "value") else emp.branch
            if b not in branch_managers:
                branch_managers[b] = emp.id

        for emp in all_employees:
            b = emp.branch.value if hasattr(emp.branch, "value") else emp.branch
            mgr_id = branch_managers.get(b)
            if mgr_id and mgr_id != emp.id:
                emp.reporting_manager_id = mgr_id

        for i, team in enumerate(teams):
            if i < len(all_employees):
                team.team_leader_id = all_employees[i].id
        db.commit()

        # ── Attendance Log (last 60 days) ──────────────────────────────
        print("Seeding attendance records...")
        statuses = [
            models.AttendanceStatusEnum.PRESENT,
            models.AttendanceStatusEnum.PRESENT,
            models.AttendanceStatusEnum.PRESENT,
            models.AttendanceStatusEnum.PRESENT,
            models.AttendanceStatusEnum.WFH,
            models.AttendanceStatusEnum.ABSENT,
            models.AttendanceStatusEnum.LEAVE,
            models.AttendanceStatusEnum.HALF_DAY,
        ]
        for emp in all_employees:
            for day_offset in range(60):
                d = date.today() - timedelta(days=day_offset)
                if d.weekday() == 6:
                    status = models.AttendanceStatusEnum.WEEK_OFF
                    db.add(models.Attendance(employee_id=emp.id, date=d, status=status))
                    continue

                status = rng.choice(statuses)
                check_in = datetime.combine(d, datetime.min.time()) + timedelta(hours=9, minutes=rng.randint(0, 45))
                check_out = check_in + timedelta(hours=rng.randint(7, 10), minutes=rng.randint(0, 59))
                db.add(models.Attendance(
                    employee_id=emp.id,
                    date=d,
                    check_in=check_in if status not in [models.AttendanceStatusEnum.ABSENT, models.AttendanceStatusEnum.LEAVE] else None,
                    check_out=check_out if status not in [models.AttendanceStatusEnum.ABSENT, models.AttendanceStatusEnum.LEAVE] else None,
                    status=status,
                    is_late=check_in.hour > 9 if check_in else False,
                ))
        db.commit()

        # ── Attendance Corrections ─────────────────────────────────────
        print("Seeding attendance corrections...")
        for emp in rng.choices(all_employees, k=10):
            d = date.today() - timedelta(days=rng.randint(1, 20))
            db.add(models.AttendanceCorrection(
                employee_id=emp.id,
                date=d,
                requested_status=models.AttendanceStatusEnum.PRESENT,
                reason=rng.choice(["Swipe card issue", "Forgotten check-in", "Client site visit", "Network glitch"]),
                status=rng.choice([models.LeaveStatusEnum.PENDING, models.LeaveStatusEnum.APPROVED, models.LeaveStatusEnum.REJECTED]),
            ))
        db.commit()

        # ── Leaves ─────────────────────────────────────────────────────
        print("Seeding leave requests...")
        leave_types = list(models.LeaveTypeEnum)
        leave_statuses = [
            models.LeaveStatusEnum.PENDING,
            models.LeaveStatusEnum.APPROVED,
            models.LeaveStatusEnum.REJECTED,
            models.LeaveStatusEnum.MANAGER_APPROVED,
        ]
        for emp in rng.choices(all_employees, k=25):
            start = date.today() - timedelta(days=rng.randint(1, 60))
            end = start + timedelta(days=rng.randint(1, 3))
            db.add(models.Leave(
                employee_id=emp.id,
                leave_type=rng.choice(leave_types),
                start_date=start,
                end_date=end,
                reason=rng.choice(["Personal work", "Medical appointment", "Family event", "Vacation", "Emergency"]),
                status=rng.choice(leave_statuses),
            ))
        db.commit()

        # ── Payroll & Payslips ──────────────────────────────────────────
        print("Seeding payroll and payslips...")
        for emp in all_employees:
            for m_offset in range(3):
                d = date.today().replace(day=1) - timedelta(days=30 * m_offset)
                month_str = d.strftime("%Y-%m")
                basic = emp.basic_salary or 50000
                hra = round(basic * 0.4)
                bonus = rng.randint(0, 5000) if m_offset == 0 else 0
                incentives = rng.randint(0, 3000)
                pf = round(basic * 0.12)
                esi = round(basic * 0.0175) if basic <= 21000 else 0
                pt = 200
                tds = round(basic * 0.1) if basic > 50000 else 0
                net = basic + hra + bonus + incentives - pf - esi - pt - tds
                p = models.Payroll(
                    employee_id=emp.id,
                    month=month_str,
                    basic_salary=basic,
                    hra=hra,
                    bonus=bonus,
                    incentives=incentives,
                    pf=pf,
                    esi=esi,
                    professional_tax=pt,
                    income_tax=tds,
                    other_deductions=0,
                    net_salary=max(net, 0),
                    status="Paid" if m_offset > 0 else "Processed",
                )
                db.add(p)
                db.flush()
                db.add(models.Payslip(
                    payroll_id=p.id,
                    employee_id=emp.id,
                    month=month_str,
                    sent_to_email=emp.email if m_offset > 0 else None,
                    sent_at=datetime.utcnow() if m_offset > 0 else None,
                ))
        db.commit()

        # ── Revenue ────────────────────────────────────────────────────
        print("Seeding revenue targets...")
        for team in teams:
            for m_offset in range(6):
                d = date.today().replace(day=1) - timedelta(days=30 * m_offset)
                month_str = d.strftime("%Y-%m")
                target = rng.randint(500000, 2000000)
                achieved = round(target * rng.uniform(0.75, 1.25))
                db.add(models.Revenue(
                    team_id=team.id,
                    branch=team.branch,
                    month=month_str,
                    target=target,
                    achieved=achieved,
                    incentives=round(achieved * 0.05) if achieved > target else 0,
                ))
        db.commit()

        # ── Expenses ───────────────────────────────────────────────────
        print("Seeding expense claims...")
        categories_exp = ["Travel", "Food", "Accommodation", "Office Supplies", "Training", "Events", "Marketing", "Other"]
        exp_statuses = list(models.ExpenseStatusEnum)
        for emp in rng.choices(all_employees, k=35):
            db.add(models.Expense(
                employee_id=emp.id,
                branch=emp.branch,
                department_id=emp.department_id,
                category=rng.choice(categories_exp),
                amount=rng.randint(500, 28000),
                date=date.today() - timedelta(days=rng.randint(0, 60)),
                description=rng.choice([
                    "Client lunch & meeting", "Conference registration", "Office stationary",
                    "Flight ticket to Vizag branch", "Team dinner celebration", "Hotel accommodation"
                ]),
                payment_method=rng.choice(["Cash", "Card", "Bank Transfer", "UPI"]),
                status=rng.choice(exp_statuses),
            ))
        db.commit()

        # ── Holidays ───────────────────────────────────────────────────
        print("Seeding holidays...")
        current_year = date.today().year
        holiday_data = [
            ("Republic Day",          date(current_year, 1, 26),  "National",  None),
            ("Holi",                  date(current_year, 3, 14),  "Festival",  None),
            ("Good Friday",           date(current_year, 4, 18),  "National",  None),
            ("May Day",               date(current_year, 5, 1),   "National",  None),
            ("Independence Day",      date(current_year, 8, 15),  "National",  None),
            ("Gandhi Jayanti",        date(current_year, 10, 2),  "National",  None),
            ("Dussehra",              date(current_year, 10, 8),  "Festival",  None),
            ("Diwali",                date(current_year, 11, 8),  "Festival",  None),
            ("Company Foundation Day",date(current_year, 12, 1),  "Company",   None),
            ("Christmas",             date(current_year, 12, 25), "National",  None),
            ("IDEALAB Tech Fest",     date(current_year, 7, 15),  "Company",   "IDEALAB"),
            ("UGC Founders Day",      date(current_year, 9, 10),  "Company",   "UGC"),
        ]
        for name, d, htype, branch in holiday_data:
            db.add(models.Holiday(name=name, date=d, type=htype, branch=branch))
        db.commit()

        # ── Moments ────────────────────────────────────────────────────
        print("Seeding moments feed...")
        moment_templates = [
            ("🎂 Happy Birthday {name}!", "Wishing {name} a wonderful year ahead filled with joy and success!", "Birthday"),
            ("🎉 {years} Year Work Anniversary!", "Congratulations to {name} for completing {years} fantastic years with us!", "Anniversary"),
            ("🏆 Star Performer Award", "Recognizing {name} for extraordinary contribution to Q2 targets!", "Achievement"),
            ("🚀 Promotion Announcement", "Huge congratulations to {name} on being promoted!", "Promotion"),
            ("👋 Warm Welcome to {name}", "Let's all welcome {name} to the team!", "New Joiner"),
        ]
        for emp in rng.choices(all_employees, k=20):
            tmpl = rng.choice(moment_templates)
            name = f"{emp.first_name} {emp.last_name}"
            db.add(models.Moment(
                title=tmpl[0].format(name=name, years=rng.randint(1, 5)),
                description=tmpl[1].format(name=name, years=rng.randint(1, 5)),
                employee_id=emp.id,
                date=date.today() - timedelta(days=rng.randint(0, 45)),
                branch=emp.branch,
                category=tmpl[2],
            ))
        db.commit()

        # ── Company Events ──────────────────────────────────────────────
        print("Seeding company events...")
        events_data = [
            ("Annual Day 2026",           date(current_year, 12, 15), "18:00", "Grand Hyatt, Hyderabad", "HR Team", "All hands annual celebration and awards night"),
            ("Diwali Festival Night",     date(current_year, 11, 8),  "17:00", "Company Main Campus",  "Culture Committee", "Cultural performances, sweets and fireworks"),
            ("Q3 All-Hands Townhall",     date(current_year, 9, 25),  "11:00", "Auditorium A",         "Leadership", "Business update and Q&A session"),
            ("Tech Hackathon 2026",       date(current_year, 10, 12), "09:00", "Idealab Innovation Lab","Engineering", "24-hour product hackathon with prizes"),
            ("Company Sports Tournament", date(current_year, 10, 28), "08:00", "Sports Complex",       "Sports Club", "Cricket, Badminton, and Table Tennis tournaments"),
            ("Leadership Excellence Retreat", date(current_year, 11, 20), "09:00", "Novotel Vizag",    "Executive Office", "Strategy planning session for managers"),
        ]
        for name, d, time, location, organizer, desc in events_data:
            db.add(models.CompanyEvent(
                name=name, date=d, time=time, location=location, organizer=organizer, description=desc
            ))
        db.commit()

        # ── Announcements ───────────────────────────────────────────────
        print("Seeding announcements...")
        announcements_data = [
            ("Work From Home Policy Guidelines", "Employees can work remotely up to 2 days per week with prior manager approval.", "HIGH", None),
            ("Q3 Performance Appraisal Cycle", "Self-assessments are open until September 15. Please complete your reviews in the portal.", "HIGH", None),
            ("Health Insurance Card Distribution", "Physical health cards are available at the HR desk. Digital copies uploaded to documents.", "NORMAL", None),
            ("Office Hours Adjustment - Vizag", "Starting next month, Vizag office hours will run from 9:00 AM to 6:00 PM.", "NORMAL", "VIZAG"),
            ("Annual Health Checkup Drive", "Free executive health checkup camp arranged at IDEALAB campus on October 5.", "URGENT", "IDEALAB"),
            ("New Leave Policy 2026 Update", "Optional holidays increased from 3 to 5 days per calendar year.", "NORMAL", None),
        ]
        for title, desc, priority, branch in announcements_data:
            db.add(models.Announcement(
                title=title, description=desc, date=date.today() - timedelta(days=rng.randint(0, 30)),
                priority=priority, branch=branch
            ))
        db.commit()

        # ── HR Documents ────────────────────────────────────────────────
        print("Seeding HR policy documents...")
        hr_docs = [
            ("Employee Handbook 2026", "Policy", "Comprehensive guidelines on company code of conduct and workplace ethics.", False),
            ("Leave & Attendance Policy", "Policy", "Rules regarding casual, sick, maternity leaves, and attendance cutoffs.", False),
            ("IT & Cybersecurity Guidelines", "Compliance", "Security protocols, password policies, and data protection rules.", False),
            ("Travel & Expense Claim Form", "Form", "Standard reimbursement claim template.", False),
            ("Performance Review Framework", "Template", "KRA and KPI rating template for managers.", True),
            ("Salary Slip Template", "Template", "Official payslip format.", True),
            ("Confidential NDA Agreement", "Contract", "Standard employee non-disclosure agreement.", True),
        ]
        for name, cat, desc, conf in hr_docs:
            db.add(models.HRDocument(name=name, category=cat, description=desc, is_confidential=conf))
        db.commit()

        # ── Notifications & System Settings ────────────────────────────
        print("Seeding notifications and audit logs...")
        users = db.query(models.User).all()
        for u in users:
            db.add(models.Notification(
                user_id=u.id,
                title="Welcome to LOTUS-HR Portal 2.1",
                message="Your account is active. Explore your portal features today!",
                type="SUCCESS",
            ))
            db.add(models.Notification(
                user_id=u.id,
                title="System Maintenance Notice",
                message="Scheduled system maintenance on Sunday at 2:00 AM UTC.",
                type="INFO",
            ))

        admin_u = db.query(models.User).filter(models.User.email == "admin@hrportal.com").first()
        if admin_u:
            db.add(models.AuditLog(user_id=admin_u.id, user_email=admin_u.email, action="SYSTEM_SEED", entity_type="System", details="Seeded fresh comprehensive test data"))
            db.add(models.AuditLog(user_id=admin_u.id, user_email=admin_u.email, action="POLICY_UPDATE", entity_type="Policy", details="Updated Leave Policy to 2026 version"))

        db.add(models.SystemSetting(key="company_name", value="Idealab · UGC · Vizag"))
        db.add(models.SystemSetting(key="leave_policy_year", value=str(current_year)))
        import json
        vizag_cfg = json.dumps({"name": "Lotus Vizag Office", "lat": 17.6829765, "lng": 83.1828647, "radius_meters": 100.0})
        db.add(models.SystemSetting(key="office_location_VIZAG", value=vizag_cfg))

        db.commit()
        print("All test data successfully seeded!")
    finally:
        db.close()


if __name__ == "__main__":
    run()
