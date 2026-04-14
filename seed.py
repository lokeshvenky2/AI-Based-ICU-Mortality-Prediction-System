from .database import SessionLocal, init_db, Institution, User, Subject, Staff
from .auth import get_password_hash
import random

def seed_db():
    print("🧹 Cleaning Diagnostic Node Database...")
    from .database import Base, engine
    Base.metadata.drop_all(bind=engine)
    init_db()
    db = SessionLocal()
    
    print("🏥 Provisioning Institutional Network...")
    # 1. Institutions (Hospitals)
    institutions = [
        Institution(
            id="hosp_001", username="hospital", password=get_password_hash("password123"), name="Mayo Clinic Central",
            email="admin@mayo.edu", address="200 First St SW, Rochester, MN", admin_name="Dr. Sarah Mitchell",
            last_login="2026-04-06 08:00", status="Active", permissions="Level 4 (Full Access)"
        ),
        Institution(
            id="hosp_002", username="hopkins_admin", password=get_password_hash("password123"), name="Johns Hopkins Hospital",
            email="admin@hopkins.edu", address="1800 Orleans St, Baltimore, MD", admin_name="Dr. Alan Grant",
            last_login="2026-04-06 09:15", status="Active", permissions="Level 4 (Full Access)"
        ),
        Institution(
            id="hosp_003", username="stanford_icu", password=get_password_hash("password123"), name="Stanford Medical Center",
            email="vitals@stanford.edu", address="300 Pasteur Dr, Stanford, CA", admin_name="Dr. Ellie Sattler",
            last_login="2026-04-05 22:40", status="Active", permissions="Level 3 (Diagnostic)"
        ),
        Institution(
            id="hosp_004", username="mgh_health", password=get_password_hash("password123"), name="Mass General Hospital",
            email="ops@mgh.harvard.edu", address="55 Fruit St, Boston, MA", admin_name="Dr. Ian Malcolm",
            last_login="Never", status="Provisioning", permissions="Level 4 (Full Access)"
        )
    ]
    for inst in institutions: db.add(inst)
    
    print("👨‍⚕️ Hydrating Clinician and Staff Registry...")
    # 2. Staff (Doctors, Nurses)
    staff_members = [
        # Mayo Clinic Staff
        Staff(id="doc_01", name="Dr. Sarah Mitchell", role="Head Intensivist", email="s.mitchell@mayo.edu", institution_id="hosp_001"),
        Staff(id="doc_02", name="Dr. Robert Chen", role="Critical Care Specialist", email="r.chen@mayo.edu", institution_id="hosp_001"),
        Staff(id="nur_01", name="Nurse Emily Davis", role="Senior RN", email="e.davis@mayo.edu", institution_id="hosp_001"),
        Staff(id="nur_02", name="Nurse Mark Taylor", role="ICU Nurse", email="m.taylor@mayo.edu", institution_id="hosp_001"),
        # Johns Hopkins Staff
        Staff(id="doc_03", name="Dr. James Wilson", role="Oncology Intensivist", email="j.wilson@hopkins.edu", institution_id="hosp_002"),
        Staff(id="nur_03", name="Nurse Lisa Cuddy", role="Charge Nurse", email="l.cuddy@hopkins.edu", institution_id="hosp_002"),
    ]
    for s in staff_members: db.add(s)

    print("🔐 Provisioning Unified User Accounts...")
    # 3. Users (Platform, Doctors, Patients)
    users = [
        User(username="admin", password=get_password_hash("password123"), role="platform"),
        User(username="doctor", password=get_password_hash("password123"), role="doctor", institution_id="hosp_001"),
        User(username="dr.sarah.72", password=get_password_hash("pass123"), role="doctor", institution_id="hosp_001"),
        User(username="dr.chen", password=get_password_hash("password123"), role="doctor", institution_id="hosp_001"),
        User(username="user", password=get_password_hash("password123"), role="user", institution_id="hosp_001"),
        User(username="johndoe", password=get_password_hash("password123"), role="user", institution_id="hosp_001"),
        User(username="sarahm", password=get_password_hash("password123"), role="user", institution_id="hosp_001"),
    ]
    for u in users: db.add(u)

    print("🧬 Ingesting High-Fidelity Subject Cohorts...")
    # 4. Subjects (Diverse Patients)
    subjects = [
        Subject(
            id="PF-1042", name="John Doe", admission_date="2026-04-06 14:20", doctor_name="Dr. Sarah Mitchell",
            status="In ICU (Critical)", institution_id="hosp_001",
            vitals={"hr": [72, 75, 71, 74, 72, 73], "spo2": [98, 99, 98, 98, 97, 98], "breath": [16, 18, 17, 19, 18, 17], "bp": "120/80", "temp": "37.1"},
            lab_reports=[{"test": "Glucose Level", "value": "110 mg/dL", "status": "Normal", "date": "2026-04-06 08:00"}],
            medical_history=[{"event": "ICU Stabilization", "date": "2026-04-04"}],
            care_team=[{"name": "Dr. Sarah Mitchell", "role": "ICU Intensivist", "contact": "Ext 4522"}]
        ),
        Subject(
            id="PF-0982", name="Sarah Miller", admission_date="2026-04-05 09:12", doctor_name="Dr. Sarah Mitchell",
            status="Stable", institution_id="hosp_001",
            vitals={"hr": [68, 70, 69, 71, 70, 72], "spo2": [99, 99, 100, 99, 99, 99], "breath": [14, 15, 14, 16, 15, 14], "bp": "118/78", "temp": "36.8"},
            lab_reports=[{"test": "WBC Count", "value": "7.2 x10³/µL", "status": "Normal", "date": "2026-04-06 08:00"}],
            medical_history=[{"event": "Post-Op Observation", "date": "2026-04-05"}],
            care_team=[]
        ),
        Subject(
            id="PF-1102", name="Robert Smith", admission_date="2026-04-06 10:45", doctor_name="Dr. Sarah Mitchell",
            status="Monitoring", institution_id="hosp_001",
            vitals={"hr": [88, 92, 90, 94, 91, 95], "spo2": [96, 95, 96, 95, 94, 95], "breath": [20, 22, 21, 23, 22, 24], "bp": "135/85", "temp": "37.5"},
            lab_reports=[], medical_history=[], care_team=[]
        ),
        Subject(
            id="PF-1155", name="Michael Brown", admission_date="2026-04-06 11:00", doctor_name="Dr. Robert Chen",
            status="Critical Tier", institution_id="hosp_001",
            vitals={"hr": [105, 110, 108, 112, 107, 115], "spo2": [92, 91, 92, 90, 91, 89], "breath": [28, 30, 29, 32, 31, 33], "bp": "95/60", "temp": "38.2"},
            lab_reports=[], medical_history=[], care_team=[]
        ),
        Subject(
            id="PF-2001", name="Elena Rodriguez", admission_date="2026-04-06 12:00", doctor_name="Dr. James Wilson",
            status="Stable (Ventilated)", institution_id="hosp_002",
            vitals={"hr": [78], "spo2": [95], "breath": [14], "bp": "110/70", "temp": "37.5"},
            lab_reports=[], medical_history=[], care_team=[]
        )
    ]
    
    # Bulk seed additional patients (10 more for volume)
    for i in range(1, 15):
        h_id = "hosp_001" if i < 10 else "hosp_002"
        doc = "Dr. Sarah Mitchell" if i < 8 else ("Dr. Robert Chen" if i < 12 else "Dr. James Wilson")
        subjects.append(Subject(
            id=f"PF-30{i:02d}", name=f"Patient Cohort {i}", admission_date="2026-04-06 15:00", 
            doctor_name=doc, status="In ICU (General)", institution_id=h_id,
            vitals={"hr": [70+random.randint(-5, 15)], "spo2": [98], "breath": [18], "bp": "120/80", "temp": "37.0"},
            lab_reports=[], medical_history=[], care_team=[]
        ))

    for sub in subjects: db.add(sub)
    
    db.commit()
    print("✅ Full-Stack Clinical Data Provisioning Complete!")

if __name__ == "__main__":
    seed_db()

if __name__ == "__main__":
    seed_db()
