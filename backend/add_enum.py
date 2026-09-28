from app.database import SessionLocal, engine
from sqlalchemy import text

def run():
    db = SessionLocal()
    try:
        with engine.connect() as conn:
            for val in ['CASUAL', 'SICK', 'PAID', 'UNPAID', 'MATERNITY', 'PATERNITY', 'OPTIONAL']:
                try:
                    conn.execute(text(f"ALTER TYPE leavetypeenum ADD VALUE IF NOT EXISTS '{val}'"))
                    conn.commit()
                except Exception as e:
                    print(e)
                    conn.rollback()
        print('Done adding enum values to Postgres')
    except Exception as e:
        print(f'Error: {e}')
    finally:
        db.close()

if __name__ == '__main__':
    run()
