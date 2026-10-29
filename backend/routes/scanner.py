import logging
import os
import cv2
import numpy as np
import face_recognition
from fastapi import APIRouter, File, UploadFile, HTTPException, status, Header, Query
from typing import Optional
from datetime import datetime

from backend.db import get_students_collection, get_attendance_collection
from backend.config import DATASET_DIR
from backend.routes import auth

router = APIRouter(prefix="/scanner", tags=["scanner"])
logger = logging.getLogger("smart_attendance")

# Ensure logger writes to scanner.log in the workspace root
log_file_path = os.path.join(os.getcwd(), "scanner.log")
if not any(isinstance(h, logging.FileHandler) for h in logger.handlers):
    file_handler = logging.FileHandler(log_file_path, encoding="utf-8")
    file_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(file_handler)
    logger.setLevel(logging.INFO)
    logger.info("[Face Scanner] Scanner logging initialized.")

# Cache to hold face encodings to avoid reading files from disk every time
cached_encodings = {}  # Format: {registerNo_str: [encoding1, encoding2, ...]}
cached_student_details = {}  # Format: {registerNo_str: student_doc}

async def load_student_encodings():
    """Load and cache encodings for all registered students who have images or DB encodings."""
    student_coll = get_students_collection()
    cursor = student_coll.find({})
    
    global cached_encodings, cached_student_details
    new_encodings = {}
    new_details = {}
    
    async for student in cursor:
        reg_no = student.get("registerNo") or student.get("registerNumber") or student.get("register_no") or student.get("regNo")
        if reg_no is None:
            continue
        reg_no_str = str(reg_no).strip()
            
        uploaded_images = student.get("uploadedImages") or student.get("images") or []
        db_encodings = student.get("faceEncodings", [])
        
        if not uploaded_images and not db_encodings:
            continue
            
        student_encodings = []
        
        if db_encodings:
            # Load from DB cache directly
            student_encodings = [np.array(enc) for enc in db_encodings]
        elif uploaded_images:
            # Calculate and cache
            updated_db_encodings = []
            needs_save = False
            for img_path in uploaded_images:
                relative_path = img_path.lstrip("/")
                full_path = os.path.join(os.getcwd(), relative_path)
                
                if not os.path.exists(full_path):
                    filename = os.path.basename(img_path)
                    full_path = os.path.join(DATASET_DIR, reg_no_str, filename)
                    
                if os.path.exists(full_path):
                    try:
                        image = face_recognition.load_image_file(full_path)
                        encodings = face_recognition.face_encodings(image)
                        if encodings:
                            student_encodings.append(encodings[0])
                            updated_db_encodings.append(encodings[0].tolist())
                            needs_save = True
                    except Exception as e:
                        logger.error(f"Error loading face encoding for {reg_no_str} from {full_path}: {e}")
            
            if needs_save:
                await student_coll.update_one(
                    {"_id": student["_id"]},
                    {"$set": {"faceEncodings": updated_db_encodings}}
                )
                
        if student_encodings:
            new_encodings[reg_no_str] = student_encodings
            new_details[reg_no_str] = student
            
    cached_encodings = new_encodings
    cached_student_details = new_details
    logger.info(f"Loaded face encodings for {len(cached_encodings)} students.")

@router.post("/recognize")
async def recognize_face(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
):
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Empty frame received.")
            
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file format")
            
        # Convert BGR to RGB
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        
        # Fast resize for face detection (target width 480px)
        h, w, _ = rgb_img.shape
        target_w = 480
        if w > target_w:
            scale = target_w / float(w)
            small_w = target_w
            small_h = int(h * scale)
            small_frame = cv2.resize(rgb_img, (small_w, small_h))
        else:
            scale = 1.0
            small_frame = rgb_img
            
        # Perform face detection on small_frame once
        face_locations = face_recognition.face_locations(small_frame)
        
        if not face_locations:
            return {"match": False, "face_detected": False, "detail": "No face detected in the frame."}
            
        # Compute face encodings on small_frame
        face_encodings = face_recognition.face_encodings(small_frame, face_locations)
        if not face_encodings:
            return {"match": False, "face_detected": True, "detail": "No face encoding extracted."}
            
        # Reload encodings cache if empty
        if not cached_encodings:
            await load_student_encodings()
            
        unknown_encoding = face_encodings[0]
        best_match_reg = None
        min_distance_found = 1.0
        
        for reg_no, encodings in cached_encodings.items():
            matches = face_recognition.compare_faces(encodings, unknown_encoding, tolerance=0.6)
            face_distances = face_recognition.face_distance(encodings, unknown_encoding)
            if True in matches:
                min_dist = min(face_distances)
                if min_dist < min_distance_found:
                    min_distance_found = min_dist
                    best_match_reg = reg_no
                    
        highest_similarity = 0.0
        if best_match_reg:
            highest_similarity = (1.0 - (min_distance_found / 0.6) * 0.5) * 100
            
        if best_match_reg and highest_similarity >= 50.0:
            student = cached_student_details[best_match_reg]
            reg_no_str = str(best_match_reg)

            # Security Scope Validation for Class Teacher (Sub Admin)
            current_admin = None
            try:
                current_admin = await auth.get_current_admin(authorization=authorization, token=token)
            except Exception:
                pass
            scope = auth.get_admin_scope(current_admin)

            if scope["is_restricted"]:
                s_year = (student.get("year") or student.get("academicYear") or "").strip()
                s_sec = (student.get("section") or student.get("class") or student.get("className") or "").strip().upper()
                s_sec_clean = s_sec.replace("CSE", "").replace("SECTION", "").replace("SEC", "").strip()
                scope_sec_clean = (scope.get("section") or "").replace("CSE", "").replace("SECTION", "").replace("SEC", "").strip().upper()

                norm_s_year = auth.normalize_year(s_year)
                norm_scope_year = auth.normalize_year(scope["year"])

                if norm_s_year != norm_scope_year or (s_sec_clean != scope_sec_clean and s_sec != str(scope["section"]).strip().upper()):
                    logger.info(f"[Face Scanner] Student {reg_no_str} ({s_year} - {s_sec}) rejected because admin scope is {scope['year']} {scope['section']}.")
                    return {
                        "match": False,
                        "face_detected": True,
                        "out_of_scope": True,
                        "detail": f"Recognized student {student.get('name') or reg_no_str}, but student is in {s_year} Sec {s_sec} (Outside your assigned class: {scope['year']} Sec {scope['section']})."
                    }

            from backend.routes.attendance import get_ist_now, is_holiday_date
            now = get_ist_now()
            current_time_str = now.strftime("%I:%M %p")
            current_date_str = now.strftime("%Y-%m-%d")
            day_name = now.strftime("%A")

            student_payload = {
                "name": student.get("name") or student.get("studentName") or "Unnamed Student",
                "registerNo": reg_no_str,
                "rollNo": student.get("rollNo") or student.get("roll_no") or "---",
                "department": student.get("department") or "Computer Science & Engineering",
                "section": student.get("section") or student.get("class") or "A",
                "year": student.get("year") or "3rd Year",
                "avatar": student.get("avatar")
            }

            # Holiday Check
            if is_holiday_date(current_date_str, day_name):
                return {
                    "match": True,
                    "face_detected": True,
                    "already_processed": False,
                    "save_record": False,
                    "confidence": round(highest_similarity, 1),
                    "time": current_time_str,
                    "date": current_date_str,
                    "day": day_name,
                    "morningSession": "---",
                    "afternoonSession": "---",
                    "status": "Absent",
                    "session": "Holiday",
                    "attendance_time": current_time_str,
                    "detail": "Today is a holiday! Attendance is not recorded today.",
                    "student": student_payload
                }

            # Determine session (Morning before 1:00 PM IST, Afternoon from 1:00 PM IST onward)
            decimal_time = now.hour + now.minute / 60.0
            if decimal_time < 13.0:
                session_name = "Morning"
                morning_session = "Present"
                afternoon_session = "---"
            else:
                session_name = "Afternoon"
                morning_session = "---"
                afternoon_session = "Present"
            status_determined = "Present"
            save_record = True
            detail_msg = f"Recognized: {student_payload['name']} -> Marked Present for {session_name} Session"

            # Check database for existing attendance record today
            attendance_coll = get_attendance_collection()
            query_reg_no = reg_no_str
            existing_record = await attendance_coll.find_one({
                "$or": [
                    {"registerNo": query_reg_no},
                    {"registerNo": int(query_reg_no) if query_reg_no.isdigit() else query_reg_no}
                ],
                "date": current_date_str
            })

            if existing_record:
                session_already_present = False
                if session_name == "Morning":
                    session_already_present = (existing_record.get("morningSession") == "Present")
                    if existing_record.get("afternoonSession"):
                        afternoon_session = existing_record.get("afternoonSession")
                elif session_name == "Afternoon":
                    session_already_present = (existing_record.get("afternoonSession") == "Present")
                    if existing_record.get("morningSession"):
                        morning_session = existing_record.get("morningSession")
                else:
                    session_already_present = (existing_record.get("status") == "Present")

                if session_already_present:
                    curr_status = existing_record.get("status") or "Present"
                    return {
                        "match": True,
                        "face_detected": True,
                        "already_processed": True,
                        "save_record": False,
                        "confidence": round(highest_similarity, 1),
                        "time": current_time_str,
                        "date": current_date_str,
                        "day": day_name,
                        "morningSession": existing_record.get("morningSession", "---"),
                        "afternoonSession": existing_record.get("afternoonSession", "---"),
                        "status": curr_status,
                        "session": session_name,
                        "attendance_time": existing_record.get("attendance_time", current_time_str),
                        "detail": f"{student_payload['name']} already recorded as Present for {session_name} session.",
                        "student": student_payload
                    }

            return {
                "match": True,
                "face_detected": True,
                "already_processed": False,
                "save_record": save_record,
                "confidence": round(highest_similarity, 1),
                "time": current_time_str,
                "date": current_date_str,
                "day": day_name,
                "morningSession": morning_session,
                "afternoonSession": afternoon_session,
                "status": status_determined,
                "session": session_name,
                "attendance_time": current_time_str,
                "detail": detail_msg,
                "student": student_payload
            }

        return {
            "match": False,
            "face_detected": True,
            "detail": "Face detected, but no matching student met the confidence threshold."
        }

    except Exception as e:
        logger.error(f"Error in recognition endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reload")
async def reload_encodings():
    """Reload all student face encodings from disk/database."""
    await load_student_encodings()
    return {"success": True, "count": len(cached_encodings)}
