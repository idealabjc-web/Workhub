import uuid
from app import models
from app.database import SessionLocal, engine

db = SessionLocal()
try:
    # 1. Get or create 'Tech Team' department
    dept = db.query(models.Department).filter(
        (models.Department.name == "Tech Team") | (models.Department.name == "Tech")
    ).first()

    if not dept:
        dept = models.Department(
            id=str(uuid.uuid4()),
            name="Tech Team",
            branch=models.BranchEnum.IDEALAB
        )
        db.add(dept)
        db.flush()
        print("Created Department: Tech Team")
    else:
        print(f"Existing Department found: {dept.name} ({dept.id})")

    # 2. Get or create 'Tech Team' in teams table
    team = db.query(models.Team).filter(models.Team.name == "Tech Team").first()
    if not team:
        team = models.Team(
            id=str(uuid.uuid4()),
            name="Tech Team",
            branch=models.BranchEnum.IDEALAB,
            department_id=dept.id
        )
        db.add(team)
        print("Created Team: Tech Team")
    else:
        print(f"Existing Team found: {team.name} ({team.id})")

    db.commit()
    print("Tech Team successfully added to database!")
finally:
    db.close()
