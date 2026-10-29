import logging
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Query, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from bson import ObjectId

from backend.db import (
    get_students_collection, 
    get_attendance_collection, 
    get_leaves_collection,
    get_leave_letters_collection,
    get_notifications_collection
)
from backend.routes import auth
from backend.routes.attendance import is_holiday_date, get_ist_now, check_and_finalize_sessions

router = APIRouter(prefix="/student", tags=["student_portal"])
logger = logging.getLogger("smart_attendance")

class LeaveRequest(BaseModel):
    date: str
    reason: str
    confirmLowAttendance: Optional[bool] = False

class LeaveLetterRequest(BaseModel):
    leaveDate: str
    fromDate: Optional[str] = None
    toDate: Optional[str] = None
    reason: str
    letterContent: str
    confirmLowAttendance: Optional[bool] = False

def format_date_ddmmyyyy(date_str: str) -> str:
    if not date_str or str(date_str).strip() in ["---", "N/A", "None", ""]:
        return "---"
    date_str = str(date_str).strip()
    if "-" in date_str:
        parts = date_str.split("T")[0].split(" ")[0].split("-")
        if len(parts) == 3 and len(parts[0]) == 4:
            return f"{int(parts[2]):02d}/{int(parts[1]):02d}/{int(parts[0]):04d}"
        elif len(parts) == 3 and len(parts[2]) == 4:
            return f"{int(parts[0]):02d}/{int(parts[1]):02d}/{int(parts[2]):04d}"
    elif "/" in date_str:
        parts = date_str.split("/")
        if len(parts) == 3:
            if len(parts[2]) == 4:
                return f"{int(parts[0]):02d}/{int(parts[1]):02d}/{int(parts[2]):04d}"
            elif len(parts[2]) == 2:
                return f"{int(parts[0]):02d}/{int(parts[1]):02d}/20{int(parts[2]):02d}"
            elif len(parts[0]) == 4:
                return f"{int(parts[2]):02d}/{int(parts[1]):02d}/{int(parts[0]):04d}"
    return date_str

format_date_ddmmyy = format_date_ddmmyyyy

class PasswordChangeRequest(BaseModel):
    oldPassword: str
    newPassword: str
    confirmPassword: str

@router.get("/me")
async def get_student_profile(current_student = Depends(auth.get_current_student)):
    return {
        "id": current_student.get("id"),
        "name": current_student.get("name"),
        "registerNo": current_student.get("registerNo"),
        "rollNo": current_student.get("rollNo", "23"),
        "department": current_student.get("department"),
        "year": current_student.get("year"),
        "section": current_student.get("section"),
        "email": current_student.get("email"),
        "phone": current_student.get("phone"),
        "gender": current_student.get("gender", "Not Specified"),
        "avatar": current_student.get("avatar"),
        "uploadedImages": current_student.get("uploadedImages", []),
        "createdDate": current_student.get("createdDate"),
        "createdTime": current_student.get("createdTime")
    }

async def calculate_student_attendance_percentage(reg_no: str) -> float:
    from backend.routes.attendance import recalculate_all_student_stats
    await recalculate_all_student_stats()
    student_coll = get_students_collection()
    student = await student_coll.find_one({"registerNo": reg_no})
    if student and "attendanceRate" in student:
        return float(student["attendanceRate"])
    return 100.0

@router.get("/summary")
async def get_student_summary(current_student = Depends(auth.get_current_student)):
    reg_no = current_student.get("registerNo")
    
    # 1. Ensure sessions are finalized up to today
    await check_and_finalize_sessions()
    
    attendance_coll = get_attendance_collection()
    leaves_coll = get_leaves_collection()
    
    now = get_ist_now()
    today_str = now.strftime("%Y-%m-%d")
    decimal_time = now.hour + now.minute / 60.0 + now.second / 3600.0
    
    cursor = attendance_coll.find({"registerNo": reg_no})
    attendance_records = []
    async for doc in cursor:
        attendance_records.append(doc)

    leave_cursor = leaves_coll.find({"registerNo": reg_no})
    leave_records = []
    async for l_doc in leave_cursor:
        leave_records.append(l_doc)
        
    total_working_sessions = 0
    present_sessions = 0
    
    distinct_working_days = set()
    present_days_set = set()
    absent_days_set = set()
    
    for doc in attendance_records:
        d_date = doc.get("date", "")
        d_day = doc.get("day", "")
        
        # Exclude holidays
        if is_holiday_date(d_date, d_day):
            continue
            
        m_s = doc.get("morningSession")
        a_s = doc.get("afternoonSession")
        
        m_comp = d_date < today_str or (d_date == today_str and decimal_time >= 9.5)
        a_comp = d_date < today_str or (d_date == today_str and decimal_time >= 14.25)
        
        if m_comp or a_comp:
            distinct_working_days.add(d_date)
            
        if m_comp:
            total_working_sessions += 1
            if m_s == "Present":
                present_sessions += 1
                
        if a_comp:
            total_working_sessions += 1
            if a_s == "Present":
                present_sessions += 1
                
        if m_s == "Present" or a_s == "Present":
            present_days_set.add(d_date)
        elif m_comp and a_comp and m_s == "Absent" and a_s == "Absent":
            absent_days_set.add(d_date)
            
    working_days_count = len(distinct_working_days)
    present_days_count = len(present_days_set)
    absent_days_count = len(absent_days_set)
    leave_days_count = len(leave_records)
    
    if total_working_sessions > 0:
        overall_percentage = round((present_sessions / total_working_sessions) * 100, 2)
    else:
        overall_percentage = 100.0
        
    return {
        "student": {
            "name": current_student.get("name"),
            "registerNo": current_student.get("registerNo"),
            "department": current_student.get("department"),
            "year": current_student.get("year"),
            "section": current_student.get("section"),
            "email": current_student.get("email"),
            "phone": current_student.get("phone"),
            "gender": current_student.get("gender", "Not Specified"),
            "avatar": current_student.get("avatar")
        },
        "overallPercentage": overall_percentage,
        "presentCount": present_days_count,
        "absentCount": absent_days_count,
        "leaveCount": leave_days_count,
        "workingDays": working_days_count,
        "totalSessions": total_working_sessions,
        "presentSessions": present_sessions
    }

@router.get("/attendance")
async def get_student_attendance(
    date: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    current_student = Depends(auth.get_current_student)
):
    if hasattr(date, "default"):
        date = None
    if hasattr(status_filter, "default"):
        status_filter = None

    reg_no = current_student.get("registerNo")
    await check_and_finalize_sessions()

    
    query = {"registerNo": reg_no}
    if date:
        iso_date = date
        if "/" in date:
            parts = date.split("/")
            if len(parts) == 3 and len(parts[2]) == 4:
                iso_date = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
        query["date"] = iso_date
        
    coll = get_attendance_collection()
    leaves_coll = get_leaves_collection()
    
    cursor = coll.find(query).sort("date", -1)
    records = []
    
    leave_docs = await leaves_coll.find({"registerNo": reg_no}).to_list(length=100)
    leave_map = {l.get("date") or l.get("fromDate"): l for l in leave_docs}
    
    now = get_ist_now()
    today_str = now.strftime("%Y-%m-%d")
    decimal_time = now.hour + now.minute / 60.0 + now.second / 3600.0
    
    async for doc in cursor:
        d_date = doc.get("date", "")
        d_day = doc.get("day", "")
        
        # Exclude holidays
        if is_holiday_date(d_date, d_day):
            continue
            
        m_comp = d_date < today_str or (d_date == today_str and decimal_time >= 9.5)
        a_comp = d_date < today_str or (d_date == today_str and decimal_time >= 14.25)
        
        is_manual = bool(doc.get("modifiedManually") or doc.get("method") == "Manual Admin Correction")

        m_s = doc.get("morningSession", "---")
        a_s = doc.get("afternoonSession", "---")

        if not is_manual:
            if m_s != "Present":
                m_s = "Absent" if m_comp else "---"
            if a_s != "Present":
                a_s = "Absent" if a_comp else "---"
            
        is_leave = d_date in leave_map
        leave_reason = leave_map[d_date].get("reason") if is_leave else None
        
        if is_leave and leave_map[d_date].get("status") == "Approved":
            m_s = "Leave"
            a_s = "Leave"
            gen_status = "Leave"
        else:
            if is_manual and doc.get("status"):
                gen_status = doc.get("status")
            elif m_s == "Present" and a_s == "Present":
                gen_status = "Present"
            elif m_s == "Present" and a_s == "Absent":
                gen_status = "P/A"
            elif m_s == "Absent" and a_s == "Present":
                gen_status = "A/P"
            elif m_s == "Absent" and a_s == "Absent":
                gen_status = "Absent"
            elif m_s == "Present" or a_s == "Present":
                gen_status = "Present"
            elif m_s == "Absent" or a_s == "Absent":
                gen_status = "Absent"
            else:
                gen_status = "---"
                
        rec_time = doc.get("time") or doc.get("attendance_time") or "---"
        if gen_status == "Absent" and (not rec_time or rec_time == "---"):
            rec_time = "09:30 AM" if m_s == "Absent" else "02:15 PM"
            
        formatted_date = format_date_ddmmyyyy(d_date)
        
        record = {
            "id": str(doc["_id"]),
            "date": formatted_date,
            "rawDate": d_date,
            "day": d_day,
            "morningSession": m_s,
            "afternoonSession": a_s,
            "status": gen_status,
            "time": rec_time,
            "confidence": doc.get("confidence", 0.0),
            "method": doc.get("method", "System")
        }
        if leave_reason:
            record["leaveReason"] = leave_reason
            
        if status_filter and status_filter.lower() != "all":
            if status_filter.lower() != gen_status.lower():
                continue
                
        records.append(record)
        
    return records

def parse_submission_datetime(doc: dict) -> datetime:
    sub = doc.get("submittedAt") or doc.get("createdAtISO") or doc.get("submitted_at")
    if isinstance(sub, datetime):
        return sub
    if isinstance(sub, str) and sub:
        try:
            return datetime.fromisoformat(sub.replace("Z", "+00:00"))
        except Exception:
            pass

    cat = doc.get("created_at") or ""
    if isinstance(cat, datetime):
        return cat
    if isinstance(cat, str) and cat:
        for fmt in ("%Y-%m-%d %I:%M %p", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
            try:
                return datetime.strptime(cat.strip(), fmt)
            except Exception:
                pass

    obj_id = doc.get("_id") or doc.get("id")
    if isinstance(obj_id, ObjectId):
        return obj_id.generation_time
    elif isinstance(obj_id, str) and len(obj_id) == 24:
        try:
            return ObjectId(obj_id).generation_time
        except Exception:
            pass

    return datetime.min

@router.get("/leave")
async def get_student_leaves(current_student = Depends(auth.get_current_student)):
    reg_no = current_student.get("registerNo")
    leaves_coll = get_leaves_collection()
    
    cursor = leaves_coll.find({"registerNo": reg_no})
    leaves = []
    async for doc in cursor:
        d_date = doc.get("date") or doc.get("fromDate", "---")
        formatted_date = format_date_ddmmyyyy(d_date)
        leaves.append({
            "id": str(doc["_id"]),
            "date": formatted_date,
            "rawDate": d_date,
            "fromDate": format_date_ddmmyyyy(doc.get("fromDate", d_date)),
            "toDate": format_date_ddmmyyyy(doc.get("toDate", d_date)),
            "reason": doc.get("reason", "Personal"),
            "status": str(doc.get("status", "PENDING")).upper(),
            "created_at": doc.get("created_at", ""),
            "submittedAt": doc.get("submittedAt", "")
        })
    leaves.sort(key=parse_submission_datetime, reverse=True)
    return leaves

@router.post("/leave", status_code=status.HTTP_201_CREATED)
async def create_student_leave(
    leave_req: LeaveRequest,
    current_student = Depends(auth.get_current_student)
):
    reg_no = current_student.get("registerNo")
    leaves_coll = get_leaves_collection()
    
    # 1. Calculate student's REAL current attendance percentage from MongoDB
    att_pct = await calculate_student_attendance_percentage(reg_no)
    is_low_att = (att_pct < 75.0)
    
    # 2. If attendance < 75% and student has not confirmed yet, ask for confirmation
    if is_low_att and not leave_req.confirmLowAttendance:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "requiresConfirmation": True,
                "attendancePercentage": att_pct,
                "message": f"Your attendance percentage is below 75%.\nCurrent Attendance: {att_pct:.2f}%\n\nDo you still want to apply for leave?"
            }
        )
        
    date_val = leave_req.date
    if "/" in date_val:
        parts = date_val.split("/")
        if len(parts) == 3 and len(parts[2]) == 4:
            date_val = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
            
    st_name = current_student.get("name") or "Student"
    st_year = current_student.get("year") or current_student.get("academicYear") or current_student.get("yearOfStudy") or ""
    st_sec = current_student.get("section") or current_student.get("class") or current_student.get("className") or ""

    now_dt = get_ist_now()
    now_str = now_dt.strftime("%Y-%m-%d %I:%M %p")
    now_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%S")

    leave_doc = {
        "registerNo": reg_no,
        "name": st_name,
        "department": current_student.get("department") or "Computer Science & Engineering",
        "year": st_year,
        "section": st_sec,
        "date": date_val,
        "fromDate": date_val,
        "toDate": date_val,
        "reason": leave_req.reason,
        "status": "PENDING",
        "attendancePercentage": att_pct,
        "isLowAttendance": is_low_att,
        "created_at": now_str,
        "submittedAt": now_iso
    }
    
    result = await leaves_coll.insert_one(leave_doc)
    inserted_id_str = str(result.inserted_id)
    leave_doc["id"] = inserted_id_str
    leave_doc["_id"] = inserted_id_str
    leave_doc["date"] = format_date_ddmmyyyy(date_val)
    leave_doc["requiresConfirmation"] = False
    
    # 3. Create Admin Notification
    notif_coll = get_notifications_collection()
    now_str = get_ist_now().strftime("%Y-%m-%d %I:%M %p")
    formatted_d = format_date_ddmmyyyy(date_val)
    
    matching_advisor = await auth.find_matching_class_advisor(st_year, st_sec)
    advisor_email = matching_advisor.get("email") if matching_advisor else None
    
    if is_low_att:
        await notif_coll.insert_one({
            "recipient": "admin",
            "target_advisor_email": advisor_email,
            "type": "low_attendance_leave",
            "title": "Low Attendance Leave Request",
            "message": f"Student {st_name} ({reg_no}) has applied for leave while having low attendance of {att_pct:.2f}%.",
            "read": False,
            "created_at": now_str,
            "time": "Just now",
            "studentRegisterNo": reg_no,
            "studentName": st_name,
            "year": st_year,
            "section": st_sec,
            "attendancePercentage": att_pct,
            "leaveDate": formatted_d,
            "reason": leave_req.reason,
            "leaveId": inserted_id_str,
            "isLowAttendance": True
        })
    else:
        await notif_coll.insert_one({
            "recipient": "admin",
            "target_advisor_email": advisor_email,
            "type": "leave_application",
            "title": "New Leave Application",
            "message": f"Student {st_name} ({reg_no}) has applied for leave on {formatted_d}.",
            "read": False,
            "created_at": now_str,
            "time": "Just now",
            "studentRegisterNo": reg_no,
            "studentName": st_name,
            "year": st_year,
            "section": st_sec,
            "attendancePercentage": att_pct,
            "leaveDate": formatted_d,
            "reason": leave_req.reason,
            "leaveId": inserted_id_str,
            "isLowAttendance": False
        })

    return leave_doc

@router.put("/change-password")
async def change_student_password(
    data: PasswordChangeRequest,
    current_student = Depends(auth.get_current_student)
):
    if not data.oldPassword or not data.newPassword:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password and new password are required."
        )
    if data.newPassword != data.confirmPassword:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirm password do not match."
        )
    if len(data.newPassword) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 3 characters long."
        )

    student_coll = get_students_collection()
    
    # Try finding by ObjectId or registerNo
    student_doc = None
    if current_student.get("id"):
        try:
            student_doc = await student_coll.find_one({"_id": ObjectId(current_student.get("id"))})
        except Exception:
            pass
    if not student_doc:
        student_doc = await student_coll.find_one({"registerNo": current_student.get("registerNo")})

    if not student_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student record not found."
        )

    current_hashed = student_doc.get("password")
    is_custom = student_doc.get("has_custom_password", False)
    
    is_valid = False
    if is_custom and current_hashed:
        is_valid = auth.verify_password(data.oldPassword, current_hashed)
    else:
        default_pwd = auth.get_default_student_password(student_doc.get("registerNo"))
        is_valid = (data.oldPassword == default_pwd) or (current_hashed and auth.verify_password(data.oldPassword, current_hashed))

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password."
        )

    hashed_new = auth.hash_password(data.newPassword)
    await student_coll.update_one(
        {"_id": student_doc["_id"]},
        {"$set": {"password": hashed_new, "has_custom_password": True}}
    )

    return {
        "success": True,
        "message": "Password updated successfully. Please use your new password for future logins."
    }

def format_date_ddmmyyyy_full(date_str: Optional[str]) -> str:
    if not date_str or date_str == "---":
        return "---"
    date_str = str(date_str).strip()
    if "-" in date_str:
        parts = date_str.split("T")[0].split(" ")[0].split("-")
        if len(parts) == 3 and len(parts[0]) == 4:
            return f"{int(parts[2]):02d}/{int(parts[1]):02d}/{int(parts[0]):04d}"
    elif "/" in date_str:
        parts = date_str.split("/")
        if len(parts) == 3:
            if len(parts[2]) == 4:
                return f"{int(parts[0]):02d}/{int(parts[1]):02d}/{int(parts[2]):04d}"
            elif len(parts[0]) == 4:
                return f"{int(parts[2]):02d}/{int(parts[1]):02d}/{int(parts[0]):04d}"
    return date_str

@router.put("/leave/{leave_id}/cancel")
async def cancel_student_leave(
    leave_id: str,
    current_student = Depends(auth.get_current_student)
):
    reg_no = current_student.get("registerNo")
    leaves_coll = get_leaves_collection()
    letters_coll = get_leave_letters_collection()
    
    leave_doc = None
    is_letter = False
    
    # 1. Check standard leaves collection
    try:
        leave_doc = await leaves_coll.find_one({"_id": ObjectId(leave_id), "registerNo": reg_no})
    except Exception:
        pass
    if not leave_doc:
        leave_doc = await leaves_coll.find_one({"_id": leave_id, "registerNo": reg_no})
    if not leave_doc:
        leave_doc = await leaves_coll.find_one({"id": leave_id, "registerNo": reg_no})
        
    # 2. Check formal leave letters collection if not found in standard leaves
    if not leave_doc:
        try:
            leave_doc = await letters_coll.find_one({"_id": ObjectId(leave_id), "registerNo": reg_no})
            if leave_doc:
                is_letter = True
        except Exception:
            pass
        if not leave_doc:
            leave_doc = await letters_coll.find_one({"_id": leave_id, "registerNo": reg_no})
            if leave_doc:
                is_letter = True
        if not leave_doc:
            leave_doc = await letters_coll.find_one({"id": leave_id, "registerNo": reg_no})
            if leave_doc:
                is_letter = True

    if not leave_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found or you are not authorized to cancel it."
        )
        
    status_upper = str(leave_doc.get("status", "")).upper()
    if status_upper == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This leave request has already been cancelled."
        )
    if status_upper == "REJECTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel a rejected leave request."
        )
        
    target_id = leave_doc["_id"]
    prev_status = leave_doc.get("status", "Pending")
    cancel_time = get_ist_now().strftime("%Y-%m-%d %I:%M %p")

    target_coll = letters_coll if is_letter else leaves_coll
    await target_coll.update_one(
        {"_id": target_id},
        {"$set": {"status": "CANCELLED", "cancelled_at": cancel_time}}
    )
    
    # Notify Admin with complete student details & dates
    notif_coll = get_notifications_collection()
    raw_date = leave_doc.get("leaveDate") or leave_doc.get("date") or leave_doc.get("fromDate", "")
    formatted_d = format_date_ddmmyyyy(raw_date)
    st_name = current_student.get("name") or leave_doc.get("name") or "Student"
    st_year = current_student.get("year") or leave_doc.get("year") or current_student.get("academicYear") or ""
    st_sec = current_student.get("section") or leave_doc.get("section") or current_student.get("class") or ""
    req_type = "Leave Letter" if is_letter else "Leave Application"
    
    matching_advisor = await auth.find_matching_class_advisor(st_year, st_sec)
    advisor_email = matching_advisor.get("email") if matching_advisor else None

    await notif_coll.insert_one({
        "recipient": "admin",
        "target_advisor_email": advisor_email,
        "type": "cancelled_leave",
        "title": f"{req_type} Cancelled",
        "message": f"Student {st_name} ({reg_no}) cancelled {req_type.lower()} for {formatted_d}. (Previous Status: {prev_status})",
        "read": False,
        "created_at": cancel_time,
        "time": "Just now",
        "studentRegisterNo": reg_no,
        "studentName": st_name,
        "year": st_year,
        "section": st_sec,
        "leaveDate": formatted_d,
        "previousStatus": prev_status,
        "newStatus": "CANCELLED",
        "cancelled_at": cancel_time
    })
    
    return {
        "success": True,
        "message": f"{req_type} cancelled successfully.",
        "status": "CANCELLED",
        "cancelled_at": cancel_time
    }

@router.post("/leave-letter", status_code=status.HTTP_201_CREATED)
async def create_student_leave_letter(
    req: LeaveLetterRequest,
    current_student = Depends(auth.get_current_student)
):
    reg_no = current_student.get("registerNo")
    letters_coll = get_leave_letters_collection()
    att_pct = await calculate_student_attendance_percentage(reg_no)
    is_low_att = (att_pct < 75.0)

    if is_low_att and not req.confirmLowAttendance:
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "requiresConfirmation": True,
                "attendancePercentage": att_pct,
                "message": f"Your attendance percentage is below 75%.\nCurrent Attendance: {att_pct:.2f}%\n\nDo you still want to apply for leave?"
            }
        )

    leave_date = req.leaveDate
    if "/" in leave_date:
        parts = leave_date.split("/")
        if len(parts) == 3 and len(parts[2]) == 4:
            leave_date = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
            
    from_date = req.fromDate or leave_date
    if "/" in from_date:
        parts = from_date.split("/")
        if len(parts) == 3 and len(parts[2]) == 4:
            from_date = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
            
    to_date = req.toDate or leave_date
    if "/" in to_date:
        parts = to_date.split("/")
        if len(parts) == 3 and len(parts[2]) == 4:
            to_date = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"

    existing_pending = await letters_coll.find_one({
        "registerNo": reg_no,
        "leaveDate": leave_date,
        "status": "PENDING"
    })
    if existing_pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already have a pending Leave Letter for this date."
        )

    st_name = current_student.get("name") or "Student"
    st_year = current_student.get("year") or current_student.get("academicYear") or current_student.get("yearOfStudy") or ""
    st_sec = current_student.get("section") or current_student.get("class") or current_student.get("className") or ""

    now_dt = get_ist_now()
    now_str = now_dt.strftime("%Y-%m-%d %I:%M %p")
    now_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%S")

    doc = {
        "studentId": str(current_student.get("_id") or current_student.get("id")),
        "name": st_name,
        "registerNo": reg_no,
        "rollNo": current_student.get("rollNo") or current_student.get("roll_no") or "---",
        "department": current_student.get("department") or "Computer Science & Engineering",
        "year": st_year,
        "section": st_sec,
        "leaveDate": leave_date,
        "fromDate": from_date,
        "toDate": to_date,
        "reason": req.reason,
        "letterContent": req.letterContent,
        "status": "PENDING",
        "attendancePercentage": att_pct,
        "isLowAttendance": is_low_att,
        "adminResponse": "",
        "created_at": now_str,
        "submittedAt": now_iso
    }
    
    result = await letters_coll.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc["_id"] = str(result.inserted_id)
    doc["formattedLeaveDate"] = format_date_ddmmyyyy_full(leave_date)
    doc["formattedFromDate"] = format_date_ddmmyyyy_full(from_date)
    doc["formattedToDate"] = format_date_ddmmyyyy_full(to_date)

    notif_coll = get_notifications_collection()
    matching_advisor = await auth.find_matching_class_advisor(st_year, st_sec)
    advisor_email = matching_advisor.get("email") if matching_advisor else None

    if is_low_att:
        await notif_coll.insert_one({
            "recipient": "admin",
            "target_advisor_email": advisor_email,
            "type": "low_attendance_leave",
            "title": "Low Attendance Leave Request",
            "message": f"Student {st_name} ({reg_no}) has applied for leave while having low attendance of {att_pct:.2f}%.",
            "read": False,
            "created_at": get_ist_now().strftime("%Y-%m-%d %I:%M %p"),
            "time": "Just now",
            "studentRegisterNo": reg_no,
            "studentName": st_name,
            "year": st_year,
            "section": st_sec,
            "attendancePercentage": att_pct,
            "leaveDate": format_date_ddmmyyyy_full(leave_date),
            "reason": req.reason,
            "letterId": str(result.inserted_id),
            "isLowAttendance": True
        })
    else:
        await notif_coll.insert_one({
            "recipient": "admin",
            "target_advisor_email": advisor_email,
            "type": "leave_letter",
            "title": "New Leave Letter Request",
            "message": f"New Leave Letter request from {st_name}",
            "read": False,
            "created_at": get_ist_now().strftime("%Y-%m-%d %I:%M %p"),
            "time": "Just now",
            "studentRegisterNo": reg_no,
            "studentName": st_name,
            "year": st_year,
            "section": st_sec,
            "attendancePercentage": att_pct,
            "leaveDate": format_date_ddmmyyyy_full(leave_date),
            "letterId": str(result.inserted_id),
            "isLowAttendance": False
        })

    return doc

@router.get("/leave-letter")
async def get_student_leave_letters(current_student = Depends(auth.get_current_student)):
    reg_no = current_student.get("registerNo")
    letters_coll = get_leave_letters_collection()
    
    cursor = letters_coll.find({"registerNo": reg_no})
    result = []
    async for doc in cursor:
        result.append({
            "id": str(doc["_id"]),
            "leaveDate": format_date_ddmmyyyy_full(doc.get("leaveDate")),
            "fromDate": format_date_ddmmyyyy_full(doc.get("fromDate")),
            "toDate": format_date_ddmmyyyy_full(doc.get("toDate")),
            "rawLeaveDate": doc.get("leaveDate"),
            "reason": doc.get("reason"),
            "letterContent": doc.get("letterContent"),
            "status": str(doc.get("status", "PENDING")).upper(),
            "adminResponse": doc.get("adminResponse", ""),
            "created_at": doc.get("created_at", ""),
            "submittedAt": doc.get("submittedAt", "")
        })
    result.sort(key=parse_submission_datetime, reverse=True)
    return result

@router.get("/notifications")
async def get_student_notifications(current_student = Depends(auth.get_current_student)):
    reg_no = current_student.get("registerNo")
    notif_coll = get_notifications_collection()
    
    cursor = notif_coll.find({
        "$or": [
            {"recipient": reg_no},
            {"studentRegisterNo": reg_no, "recipient": "student"}
        ]
    })
    
    result = []
    async for doc in cursor:
        result.append({
            "id": str(doc["_id"]),
            "title": doc.get("title", "Notification"),
            "message": doc.get("message", ""),
            "type": doc.get("type", "general"),
            "created_at": doc.get("created_at", ""),
            "submittedAt": doc.get("submittedAt", ""),
            "time": doc.get("time", "Just now")
        })
    result.sort(key=parse_submission_datetime, reverse=True)
    return result

@router.put("/notifications/read-all")
async def mark_student_notifications_read(current_student = Depends(auth.get_current_student)):
    reg_no = current_student.get("registerNo")
    notif_coll = get_notifications_collection()
    await notif_coll.update_many(
        {"$or": [{"recipient": reg_no}, {"studentRegisterNo": reg_no, "recipient": "student"}]},
        {"$set": {"read": True}}
    )
    return {"success": True, "message": "All notifications marked as read."}



