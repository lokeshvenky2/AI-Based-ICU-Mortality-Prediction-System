from fastapi import FastAPI, HTTPException, Body, Depends, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from jose import JWTError, jwt
import os
import random
import asyncio
import json
import uvicorn

from .model import predictor
from .database import SessionLocal, Institution, User, Subject, Staff
from .auth import verify_password, get_password_hash, create_access_token, SECRET_KEY, ALGORITHM

app = FastAPI(title="ICU Predict ML API")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# --- Database Dependency ---

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Security Dependency ---

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    username = None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
    except: pass

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=f"Could not validate clinical credentials - User Profile ({username}) Missing",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        if not username:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub")
            if username is None: raise credentials_exception
    except JWTError: raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user: return user
    
    # Check Institutions for Hospital role
    hosp = db.query(Institution).filter(Institution.username == username).first()
    if hosp: return hosp
    
    raise credentials_exception

# WebSocket Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, pId: str):
        await websocket.accept()
        if pId not in self.active_connections:
            self.active_connections[pId] = []
        self.active_connections[pId].append(websocket)

    def disconnect(self, websocket: WebSocket, pId: str):
        if pId in self.active_connections:
            self.active_connections[pId].remove(websocket)

    async def broadcast(self, message: dict, pId: str):
        if pId in self.active_connections:
            for connection in self.active_connections[pId]:
                await connection.send_json(message)

manager = ConnectionManager()

# Background Simulation Engine (Async Loop)
async def vibrate_vitals():
    while True:
        await asyncio.sleep(5)
        db = SessionLocal()
        try:
            subjects = db.query(Subject).all()
            for s in subjects:
                # Slight fluctuations for HR, SpO2, and Breath
                hr_list = list(s.vitals.get('hr', [72]))
                spo2_list = list(s.vitals.get('spo2', [98]))
                breath_list = list(s.vitals.get('breath', [16]))
                
                new_hr = max(60, min(140, hr_list[-1] + random.randint(-2, 2)))
                new_spo2 = max(85, min(100, spo2_list[-1] + random.randint(-1, 1)))
                new_breath = max(10, min(35, breath_list[-1] + random.randint(-1, 1)))
                
                # Keep history window of 6
                hr_list.append(new_hr); hr_list = hr_list[-6:]
                spo2_list.append(new_spo2); spo2_list = spo2_list[-6:]
                breath_list.append(new_breath); breath_list = breath_list[-6:]
                
                s.vitals = {
                    **s.vitals,
                    "hr": hr_list,
                    "spo2": spo2_list,
                    "breath": breath_list
                }
                
                # Broadcast to active streams
                await manager.broadcast({
                    "id": s.id,
                    "hr": new_hr,
                    "spo2": new_spo2,
                    "breath": new_breath,
                    "status": s.status
                }, s.id)
            
            db.commit()
        except Exception as e:
            print(f"Simulation error: {e}")
        finally:
            db.close()

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(vibrate_vitals())

@app.websocket("/api/vitals/stream/{pId}")
async def vitals_stream(websocket: WebSocket, pId: str):
    await manager.connect(websocket, pId)
    try:
        while True:
            await websocket.receive_text() # Keep alive
    except WebSocketDisconnect:
        manager.disconnect(websocket, pId)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# Schemas
class HospitalReg(BaseModel):
    name: str = "New Hospital"
    email: str = "admin@hospital.org"
    address: str = "Undisclosed Address"
    admin: str = "Institutional Admin"

class LoginRequest(BaseModel):
    username: str
    password: str
    role: str

class DoctorReg(BaseModel):
    name: str
    email: str
    specialty: str = "ICU Intensivist"
    hosp_id: str = "hosp_001"

class PatientReg(BaseModel):
    name: str
    email: str
    status: str = "Monitoring"
    doctor_name: str = "Dr. Sarah Mitchell"
    hosp_id: str = "hosp_001"

# Active Algorithms
active_algorithms = {"SVM", "Lin Reg", "SGD", "Radom Forest", "MLP"}

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.post("/api/login")
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    # Platform Admin Mock (Still using hardcoded for now, but hashed in DB)
    admin_user = db.query(User).filter(User.username == req.username, User.role == req.role).first()
    
    if admin_user and verify_password(req.password, admin_user.password):
        access_token = create_access_token(data={"sub": admin_user.username})
        
        redirects = {
            'platform': 'platform-dash.html',
            'doctor': 'doctor-dash.html', 
            'user': 'user-dash.html'
        }
        
        return {
            "success": True, 
            "access_token": access_token, 
            "token_type": "bearer",
            "redirect": redirects.get(req.role, "login.html"),
            "institution": admin_user.institution_id
        }

    # Hospital Admin Special Logic
    if req.role == 'hospital':
        h = db.query(Institution).filter(Institution.username == req.username).first()
        if h and verify_password(req.password, h.password):
            if h.status == 'Blocked':
                raise HTTPException(status_code=403, detail="Institution Blocked")
            
            access_token = create_access_token(data={"sub": h.username})
            return {
                "success": True, 
                "access_token": access_token, 
                "token_type": "bearer",
                "redirect": "hospital-dash.html", 
                "permissions": h.permissions, 
                "hosp_id": h.id
            }
                
    raise HTTPException(status_code=401, detail="Clinical Authentication Failed")

# --- Hospital Specific Endpoints ---

@app.get("/api/hospital/stats")
async def get_hospital_stats(hosp_id: str = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    target_id = hosp_id or (getattr(current_user, 'institution_id', None) or "hosp_001")
    h = db.query(Institution).filter(Institution.id == target_id).first()
    if not h: return {"total": 0, "active": 0, "discharged": 0, "accuracy": 0, "staff_count": 0}
    
    subjects = db.query(Subject).filter(Subject.institution_id == target_id).all()
    staff_count = db.query(Staff).filter(Staff.institution_id == target_id).count()
    
    total = len(subjects)
    active = len([s for s in subjects if "In ICU" in s.status or "Critical" in s.status])
    
    return {
        "total": total + 1200, # Base institutional history
        "active": active,
        "discharged": total + 1100,
        "accuracy": 94.8,
        "staff_count": staff_count
    }

@app.get("/api/hospital/staff")
async def get_hospital_staff(hosp_id: str = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    target_id = hosp_id or (getattr(current_user, 'institution_id', None) or "hosp_001")
    return db.query(Staff).filter(Staff.institution_id == target_id).all()

@app.get("/api/hospital/patients")
async def get_hospital_patients(hosp_id: str = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    target_id = hosp_id or (getattr(current_user, 'institution_id', None) or "hosp_001")
    return db.query(Subject).filter(Subject.institution_id == target_id).all()

@app.post("/api/hospital/register-doctor")
async def register_doctor(req: DoctorReg, db: Session = Depends(get_db)):
    doc_id = f"doc_{random.randint(100, 999)}"
    username = req.name.lower().replace(" ", ".") + str(random.randint(10, 99))
    password = "pass" + str(random.randint(100, 999))
    hashed_pass = get_password_hash(password)
    
    new_staff = Staff(
        id=doc_id, name=req.name, role=req.specialty, 
        email=req.email, status="Active", institution_id=req.hosp_id
    )
    new_user = User(username=username, password=hashed_pass, role="doctor", institution_id=req.hosp_id)
    
    db.add(new_staff)
    db.add(new_user)
    db.commit()
    
    return {"success": True, "username": username, "password": password}

@app.post("/api/hospital/train/local")
async def local_train(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Local model training simulation logic
    mock_weights = {'heart_rate': 0.15, 'gcs': -0.45}
    predictor.update_weights(mock_weights)
    return {"success": True, "message": "Local node weights recalibrated and synced."}

# --- Doctor Specific Endpoints ---

@app.get("/api/doctor/census")
async def get_doctor_census(doctor_name: str = "Dr. Sarah Mitchell", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Subject).filter(Subject.doctor_name == doctor_name).all()

@app.get("/api/patient/{pId}/snapshot")
async def get_patient_snapshot(pId: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    p = db.query(Subject).filter(Subject.id == pId).first()
    if not p: raise HTTPException(status_code=404, detail="Subject not found")
    return p

@app.post("/api/doctor/predict")
async def predict_mortality(req: Dict = Body(...), current_user: User = Depends(get_current_user)):
    patient_id = req.get("patient_id")
    data = {
        'age': random.randint(45, 85),
        'heart_rate': random.randint(65, 110),
        'blood_pressure': random.randint(90, 150),
        'glucose': random.randint(80, 200),
        'gcs': random.randint(8, 15)
    }
    res = predictor.predict(data)
    return {
        "success": True, "score": res['risk_score'], 
        "status": res['status'], "confidence": res['confidence'],
        "top_drivers": res['top_drivers'], "id": patient_id
    }

@app.post("/api/doctor/onboard")
async def onboard_subject(req: PatientReg, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    name = req.name
    doctor_name = req.doctor_name
    hosp_id = req.hosp_id
    
    pat_id = f"PF-{random.randint(8000, 9999)}"
    username = name.lower().replace(" ", "") + str(random.randint(10, 99))
    password = "pass123"
    
    new_sub = Subject(
        id=pat_id, name=name, admission_date="2026-04-06 10:30",
        doctor_name=doctor_name, status="In ICU (Recent)", institution_id=hosp_id,
        vitals={"hr": [75], "spo2": [98], "breath": [18], "bp": "120/80", "temp": "37.0"},
        lab_reports=[], medical_history=[], care_team=[]
    )
    new_user = User(username=username, password=password, role="user", institution_id=hosp_id)
    
    db.add(new_sub)
    db.add(new_user)
    db.commit()
    
    return {"success": True, "username": username, "password": password, "patient_id": pat_id}

# --- Patient Specific Endpoints ---

@app.get("/api/patient/my-data")
async def get_patient_data(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # In a real app, we'd use current_user.username
    p = db.query(Subject).filter(Subject.id == "PF-1042").first()
    if not p: raise HTTPException(status_code=404, detail="Subject not found")
    
    return {
        "id": p.id,
        "name": p.name,
        "status": p.status,
        "vitals": p.vitals,
        "recovery": 75,
        "next_round": "2026-04-06 14:00",
        "attending": p.doctor_name,
        "lab_reports": [
            {"test": "Glucose Level", "value": "110 mg/dL", "status": "Normal", "date": "2026-04-06 08:00"},
            {"test": "WBC Count", "value": "8.4 x10³/µL", "status": "Normal", "date": "2026-04-06 08:00"},
            {"test": "Platelets", "value": "150,000", "status": "Stable", "date": "2026-04-05 20:00"}
        ],
        "medical_history": p.medical_history,
        "care_team": p.care_team
    }

# --- Platform Admin Endpoints ---

@app.post("/api/hospitals/register")
async def register_hospital(req: HospitalReg, db: Session = Depends(get_db)):
    hosp_id = f"hosp_{random.randint(1000, 9999)}"
    username = req.name.lower().replace(" ", "_") + "_" + str(random.randint(10, 99))
    password = "pass" + str(random.randint(100, 999))
    
    h = Institution(
        id=hosp_id, username=username, password=password, name=req.name,
        email=req.email, address=req.address, admin_name=req.admin,
        last_login="Never", status="Active", permissions="Level 4 (Full Access)"
    )
    db.add(h)
    db.commit()
    return {"success": True, "username": username, "password": password, "hosp_id": hosp_id}

@app.get("/api/hospitals")
async def list_hospitals(db: Session = Depends(get_db)):
    return db.query(Institution).all()

@app.get("/api/stats")
async def get_global_stats(db: Session = Depends(get_db)):
    node_count = db.query(Institution).count()
    return {"active_nodes": node_count, "model_version": "v4.2.1-robust"}

@app.get("/api/analytics/network")
async def network_analytics():
    return {"labels": ["Mayo", "Hopkins", "MGH", "Stanford"], "data": [98, 92, 85, 94]}

@app.get("/api/analytics/accuracy-dist")
async def accuracy_dist():
    return {"labels": ["High", "Medium", "Low"], "data": [70, 20, 10], "colors": ["#14b8a6", "#0f172a", "#f59e0b"]}

@app.get("/api/analytics/convergence")
async def convergence():
    return {"labels": ["C1", "C2", "C3", "C4"], "loss": [0.5, 0.35, 0.25, 0.18]}

# Static mount
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app.mount("/", StaticFiles(directory=parent_dir, html=True), name="static")

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
