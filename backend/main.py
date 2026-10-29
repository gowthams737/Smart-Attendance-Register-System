import os
import logging
import asyncio
from fastapi import FastAPI, Request, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from backend.config import HOST, PORT, DATASET_DIR
from backend.db import (
    connect_to_postgres,
    close_postgres_connection,
    init_postgres_schema,
    connect_to_mongo,
    close_mongo_connection,
    get_students_collection,
    get_attendance_collection,
    get_settings_collection,
    get_leaves_collection
)
from backend.routes import auth, students, attendance, dashboard, settings, reports, scanner, student_portal

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("smart_attendance")

app = FastAPI(
    title="Smart Attendance Register System API",
    description="Backend API for managing student registration, attendance, and analytics.",
    version="1.0.0"
)

# CORS configuration
allowed_origins = [
    "https://smart-attendance-frontend-r0tq.onrender.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
frontend_env = os.getenv("FRONTEND_URL")
if frontend_env:
    for u in frontend_env.split(","):
        clean_u = u.strip().rstrip("/")
        if clean_u and clean_u not in allowed_origins:
            allowed_origins.append(clean_u)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "content-disposition"],
)

# Ensure dataset directory exists
os.makedirs(DATASET_DIR, exist_ok=True)

# Mount dataset directory to serve student images statically
app.mount("/dataset", StaticFiles(directory=DATASET_DIR), name="dataset")

# Global Exception Handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error on path {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please check logs."}
    )

# Seed database function
async def seed_database():
    student_coll = get_students_collection()
    attendance_coll = get_attendance_collection()
    settings_coll = get_settings_collection()
    leaves_coll = get_leaves_collection()

    student_count = await student_coll.count_documents({})
    if student_count == 0:
        logger.info("Seeding initial students data...")
        from backend.seed_data import INITIAL_STUDENTS
        await student_coll.insert_many(INITIAL_STUDENTS)
        logger.info(f"Seeded {len(INITIAL_STUDENTS)} students.")

    # Synchronize real students with biometrics and face encodings
    from backend.seed_data import REAL_STUDENTS
    for r_student in REAL_STUDENTS:
        reg_no = r_student.get("registerNo")
        if not reg_no:
            continue
        reg_str = str(reg_no)
        query = {"$or": [{"registerNo": reg_str}, {"registerNo": int(reg_str)}]} if reg_str.isdigit() else {"registerNo": reg_str}
        existing = await student_coll.find_one(query)
        if not existing:
            await student_coll.insert_one(dict(r_student))
            logger.info(f"Synchronized real student: {r_student['name']} ({reg_str})")
        else:
            curr_encodings = existing.get("faceEncodings") or []
            if not curr_encodings and r_student.get("faceEncodings"):
                await student_coll.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "faceEncodings": r_student["faceEncodings"],
                        "avatar": r_student.get("avatar") or existing.get("avatar"),
                        "rollNo": r_student.get("rollNo") or existing.get("rollNo"),
                        "section": r_student.get("section") or existing.get("section"),
                        "year": r_student.get("year") or existing.get("year"),
                    }}
                )
                logger.info(f"Updated face encodings for real student: {r_student['name']} ({reg_str})")

    # Ensure all existing students have default password hash if not custom
    from backend.routes.auth import get_default_student_password, hash_password
    async for s in student_coll.find({}):
        if not s.get("has_custom_password"):
            default_pwd = get_default_student_password(s.get("registerNo"))
            default_hash = hash_password(default_pwd)
            await student_coll.update_one({"_id": s["_id"]}, {"$set": {"password": default_hash, "has_custom_password": False}})

    attendance_count = await attendance_coll.count_documents({})

    if attendance_count == 0:
        logger.info("Seeding initial attendance data...")
        from backend.seed_data import ATTENDANCE_HISTORY
        await attendance_coll.insert_many(ATTENDANCE_HISTORY)
        logger.info(f"Seeded {len(ATTENDANCE_HISTORY)} attendance logs.")

    leaves_count = await leaves_coll.count_documents({})
    if leaves_count == 0:
        logger.info("Seeding initial leaves data...")
        from backend.seed_data import INITIAL_LEAVES
        await leaves_coll.insert_many(INITIAL_LEAVES)
        logger.info(f"Seeded {len(INITIAL_LEAVES)} leaves records.")

    settings_count = await settings_coll.count_documents({})
    if settings_count == 0:
        logger.info("Seeding default settings data...")
        default_settings = {
            "systemName": "Smart Attendance Register",
            "academicYear": "2026-2027",
            "attendanceThreshold": 75.0,
            "backupInterval": "Weekly",
            "enableNotifications": True,
            "cameraResolution": "1080p"
        }
        await settings_coll.insert_one(default_settings)
        logger.info("Seeded default settings.")

async def periodic_attendance_finalizer():
    logger.info("Started continuous background automatic attendance finalizer loop.")
    while True:
        try:
            from backend.routes.attendance import check_and_finalize_sessions
            await check_and_finalize_sessions()
        except Exception as e:
            logger.error(f"Error in periodic_attendance_finalizer: {e}")
        await asyncio.sleep(10)

# Lifespan/Startup events
@app.on_event("startup")
async def startup_event():
    await connect_to_postgres()
    await init_postgres_schema()
    await seed_database()
    try:
        from backend.routes.scanner import load_student_encodings
        await load_student_encodings()
    except Exception as e:
        logger.error(f"Failed to pre-load face encodings: {e}")
    asyncio.create_task(periodic_attendance_finalizer())

@app.on_event("shutdown")
async def shutdown_event():
    await close_postgres_connection()

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(student_portal.router, prefix="/api")
app.include_router(students.router, prefix="/api", dependencies=[Depends(auth.get_current_admin)])
app.include_router(attendance.router, prefix="/api", dependencies=[Depends(auth.get_current_admin)])
app.include_router(dashboard.router, prefix="/api", dependencies=[Depends(auth.get_current_admin)])
app.include_router(settings.router, prefix="/api", dependencies=[Depends(auth.get_current_admin)])
app.include_router(reports.router, prefix="/api", dependencies=[Depends(auth.get_current_admin)])
app.include_router(scanner.router, prefix="/api", dependencies=[Depends(auth.get_current_admin)])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "smart-attendance-backend"}
