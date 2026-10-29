import logging
import re
from uuid import uuid4
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Query, Depends, Header
from bson import ObjectId
from datetime import datetime, timezone, timedelta

from backend.db import get_attendance_collection, get_students_collection, get_resets_collection
from backend.models import AttendanceCreate, AttendanceResponse, AttendanceCorrectionRequest, AttendanceResetRequest
from backend.routes.auth import get_current_admin, get_admin_scope

router = APIRouter(prefix="/attendance", tags=["attendance"])
logger = logging.getLogger("smart_attendance")

async def get_active_resets_list():
    try:
        resets_coll = get_resets_collection()
        cursor = resets_coll.find({"status": "active"})
        resets = []
        async for r in cursor:
            resets.append(r)
        return resets
    except Exception as e:
        logger.error(f"Error fetching active resets: {e}")
        return []

def get_latest_reset_for_student(student_doc, resets):
    if not resets or not student_doc:
        return None
    
    st_yr = str(student_doc.get("year") or student_doc.get("academicYear") or "").strip().lower()
    st_sec = str(student_doc.get("section") or student_doc.get("class") or "").strip().upper()
    st_reg = str(student_doc.get("registerNo") or "").strip().lower()

    def year_match(y1, y2):
        if not y1 or not y2: return False
        if y1.lower() == y2.lower(): return True
        n1 = re.search(r'\d+', y1)
        n2 = re.search(r'\d+', y2)
        return bool(n1 and n2 and n1.group(0) == n2.group(0))

    def sec_match(s1, s2):
        if not s1 or not s2: return False
        c1 = s1.upper().replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()
        c2 = s2.upper().replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()
        return c1 == c2

    matching_resets = []
    for r in resets:
        scope = r.get("scope")
        if scope == "department":
            matching_resets.append(r)
        elif scope == "year" and year_match(st_yr, r.get("year")):
            matching_resets.append(r)
        elif scope == "class" and year_match(st_yr, r.get("year")) and sec_match(st_sec, r.get("section")):
            matching_resets.append(r)
        elif scope == "student" and st_reg and st_reg == str(r.get("registerNo") or "").strip().lower():
            matching_resets.append(r)

    if not matching_resets:
        return None

    matching_resets.sort(key=lambda x: str(x.get("reset_timestamp") or x.get("created_at") or ""), reverse=True)
    return matching_resets[0]

def is_record_after_reset(att_doc, reset_doc):
    if not reset_doc:
        return True
    
    r_date = reset_doc.get("reset_date", "1970-01-01")
    r_time = float(reset_doc.get("reset_time_decimal", 0.0))

    a_date = att_doc.get("date", "")
    if a_date > r_date:
        return True
    if a_date < r_date:
        return False
    
    a_sess = str(att_doc.get("session") or "").capitalize()
    a_time_str = att_doc.get("time") or att_doc.get("attendance_time")
    if a_time_str and ":" in a_time_str:
        try:
            parts = a_time_str.split(":")
            a_time_decimal = int(parts[0]) + int(parts[1]) / 60.0
            return a_time_decimal > r_time
        except Exception:
            pass

    a_time_decimal = 9.5 if a_sess == "Morning" else 14.25
    return a_time_decimal > r_time



def get_ist_now():
    """Get the current time in India Standard Time (IST)."""
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(timezone.utc).astimezone(ist_tz)

def is_holiday_date(date_val: Optional[str], day_name: Optional[str] = None) -> bool:
    """
    Check if a given date or day is a holiday.
    Holidays:
    - Every Sunday
    - 1st Saturday of the month
    - 3rd Saturday of the month
    
    Working Days:
    - Monday to Friday
    - 2nd Saturday of the month
    - 4th Saturday of the month
    - 5th Saturday of the month
    """
    if day_name == "Sunday":
        return True

    if not date_val or str(date_val).strip() in ["---", "All", "all", "All Dates", ""]:
        return False

    clean_date = str(date_val).strip()
    dt = None

    try:
        if "/" in clean_date:
            parts = clean_date.split("/")
            if len(parts) == 3:
                if len(parts[2]) == 4:
                    dt = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
                elif len(parts[0]) == 4:
                    dt = datetime(int(parts[0]), int(parts[1]), int(parts[2]))
        elif "-" in clean_date:
            parts = clean_date.split("T")[0].split("-")
            if len(parts) == 3 and len(parts[0]) == 4:
                dt = datetime(int(parts[0]), int(parts[1]), int(parts[2]))
    except Exception:
        pass

    if not dt:
        return False

    # Sunday check (weekday 6)
    if dt.weekday() == 6:
        return True

    # Saturday check (weekday 5)
    if dt.weekday() == 5:
        sat_index = (dt.day - 1) // 7 + 1
        if sat_index in [1, 3]:
            return True

    return False

def is_date_sunday(date_str: Optional[str]) -> bool:
    """Alias for is_holiday_date for backwards compatibility."""
    return is_holiday_date(date_str)

async def cleanup_duplicate_attendance_records():
    """
    Remove duplicate attendance records for (registerNo, date, session) from MongoDB.
    Keeps the record with status='Present' if any exists, or the primary document.
    """
    try:
        attendance_coll = get_attendance_collection()
        cursor = attendance_coll.find({})
        grouped = {}
        async for doc in cursor:
            reg = doc.get("registerNo")
            d_date = doc.get("date")
            d_sess = doc.get("session") or ("Morning" if doc.get("morningSession") == "Present" else "Afternoon")
            if not reg or not d_date:
                continue
            key = (reg, d_date, d_sess)
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(doc)

        ids_to_delete = []
        for key, docs in grouped.items():
            if len(docs) > 1:
                manual_docs = [d for d in docs if d.get("modifiedManually") or d.get("method") == "Manual Admin Correction"]
                if manual_docs:
                    keep_doc = manual_docs[-1]
                else:
                    present_docs = [d for d in docs if d.get("status") == "Present" or d.get("morningSession") == "Present" or d.get("afternoonSession") == "Present"]
                    keep_doc = present_docs[0] if present_docs else docs[0]
                for d in docs:
                    if d["_id"] != keep_doc["_id"]:
                        ids_to_delete.append(d["_id"])

        if ids_to_delete:
            logger.info(f"Removing {len(ids_to_delete)} duplicate attendance records.")
            await attendance_coll.delete_many({"_id": {"$in": ids_to_delete}})
    except Exception as e:
        logger.error(f"Error cleaning up duplicate attendance records: {e}")

async def recalculate_all_student_stats():
    """
    Recalculate student attendance rates considering ONLY valid working-day records
    (Monday-Friday, 2nd Saturday, 4th Saturday, 5th Saturday) and active attendance resets.
    Holidays (Sundays, 1st & 3rd Saturdays) and pre-reset records are strictly excluded.
    Enforces ONE UNIQUE REGISTERED STUDENT = ONE ATTENDANCE PER SESSION.
    """
    await cleanup_duplicate_attendance_records()
    student_coll = get_students_collection()
    attendance_coll = get_attendance_collection()
    resets = await get_active_resets_list()

    now = get_ist_now()
    today_str = now.strftime("%Y-%m-%d")
    decimal_time = now.hour + now.minute / 60.0 + now.second / 3600.0

    async for student in student_coll.find({}):
        reg_no = student.get("registerNo")
        if not reg_no:
            continue

        latest_reset = get_latest_reset_for_student(student, resets)

        cursor = attendance_coll.find({"registerNo": reg_no})

        date_records = {}
        async for doc in cursor:
            d_date = doc.get("date", "")
            d_day = doc.get("day", "")
            if is_holiday_date(d_date, d_day):
                continue
            
            if not is_record_after_reset(doc, latest_reset):
                continue

            if d_date not in date_records:
                date_records[d_date] = []
            date_records[d_date].append(doc)

        total_sessions = 0
        present_sessions = 0

        for d_date, docs in date_records.items():
            m_comp = d_date < today_str or (d_date == today_str and decimal_time >= 9.5)
            a_comp = d_date < today_str or (d_date == today_str and decimal_time >= 14.25)

            m_present = any(
                d.get("morningSession") == "Present" or (d.get("session") == "Morning" and d.get("status") == "Present")
                for d in docs
            )
            a_present = any(
                d.get("afternoonSession") == "Present" or (d.get("session") == "Afternoon" and d.get("status") == "Present")
                for d in docs
            )

            if m_comp or m_present:
                total_sessions += 1
                if m_present:
                    present_sessions += 1

            if a_comp or a_present:
                total_sessions += 1
                if a_present:
                    present_sessions += 1

        if total_sessions > 0:
            rate = round((present_sessions / total_sessions) * 100, 1)
        else:
            rate = 0.0 if latest_reset else 100.0

        await student_coll.update_one(
            {"_id": student["_id"]},
            {"$set": {
                "totalClasses": total_sessions,
                "presentClasses": present_sessions,
                "attendanceRate": rate
            }}
        )

async def cleanup_holiday_records():
    """
    Ensure holiday records (Sundays, 1st & 3rd Saturdays) are removed from MongoDB,
    and update student attendance statistics for valid working days.
    """
    attendance_coll = get_attendance_collection()

    cursor = attendance_coll.find({})
    holiday_ids = []
    async for doc in cursor:
        d_day = doc.get("day")
        d_date = doc.get("date")
        if is_holiday_date(d_date, d_day):
            holiday_ids.append(doc["_id"])

    if holiday_ids:
        logger.info(f"Holiday Clean Up: Removing {len(holiday_ids)} invalid holiday attendance records.")
        await attendance_coll.delete_many({"_id": {"$in": holiday_ids}})

    await recalculate_all_student_stats()

async def cleanup_sunday_records():
    """Alias for cleanup_holiday_records for backwards compatibility."""
    await cleanup_holiday_records()

from functools import cmp_to_key

def serialize_attendance(doc) -> dict:
    if not doc:
        return {}
    doc["id"] = str(doc["_id"])
    if "_id" in doc:
        del doc["_id"]
    return doc

def parse_year_rank(year_val: Optional[str]) -> int:
    if not year_val:
        return 99
    y = str(year_val).lower().strip()
    if "1" in y or "first" in y:
        return 1
    if "2" in y or "second" in y:
        return 2
    if "3" in y or "third" in y:
        return 3
    if "4" in y or "fourth" in y:
        return 4
    return 99

def parse_class_rank(sec_val: Optional[str]) -> str:
    if not sec_val:
        return "ZZZ"
    s = str(sec_val).upper().strip()
    s_clean = re.sub(r'^(CSE|SECTION|SEC)\s*', '', s).strip()
    return s_clean if s_clean else s

def parse_roll_rank(roll_val: Optional[str]) -> tuple:
    if not roll_val or roll_val == "---":
        return (999999, "")
    r = str(roll_val).strip()
    digits = re.findall(r'\d+', r)
    if digits:
        return (int(digits[-1]), r)
    return (999999, r)

def parse_session_rank(session_val: Optional[str]) -> int:
    s = str(session_val).capitalize().strip() if session_val else ""
    if s == "Morning":
        return 1
    elif s == "Afternoon":
        return 2
    return 3

def compare_attendance_records(a, b):
    # 1. Date descending (newest date first: 2026-09-29 > 2026-09-28)
    d_a = a.get("date", "")
    d_b = b.get("date", "")
    if d_a != d_b:
        return -1 if d_a > d_b else 1

    # 2. Session ascending (Morning=1 < Afternoon=2)
    s_a = parse_session_rank(a.get("session"))
    s_b = parse_session_rank(b.get("session"))
    if s_a != s_b:
        return -1 if s_a < s_b else 1

    # 3. Year ascending (1st Year=1 < 2nd Year=2 < 3rd Year=3 < 4th Year=4)
    y_a = parse_year_rank(a.get("year"))
    y_b = parse_year_rank(b.get("year"))
    if y_a != y_b:
        return -1 if y_a < y_b else 1

    # 4. Class/Section ascending (CSE A < CSE B < CSE C)
    c_a = parse_class_rank(a.get("section"))
    c_b = parse_class_rank(b.get("section"))
    if c_a != c_b:
        return -1 if c_a < c_b else 1

    # 5. Roll Number ascending (Roll 001 < Roll 002 < Roll 003)
    r_a = parse_roll_rank(a.get("rollNo"))
    r_b = parse_roll_rank(b.get("rollNo"))
    if r_a != r_b:
        return -1 if r_a < r_b else 1

    # 6. Student Name ascending (alphabetical tie-breaker)
    n_a = str(a.get("name") or "").lower()
    n_b = str(b.get("name") or "").lower()
    if n_a != n_b:
        return -1 if n_a < n_b else 1

    return 0

async def check_and_finalize_sessions(target_date: Optional[str] = None):
    """
    Finalizes attendance sessions (Morning after 9:30 AM, Afternoon after 2:15 PM)
    for target_date (or today in IST if target_date is None).
    Holidays (Sundays, 1st & 3rd Saturdays): NO finalization or attendance creation.
    Do NOT mark future sessions absent.
    """
    await cleanup_holiday_records()
    now = get_ist_now()
    today_str = now.strftime("%Y-%m-%d")
    date_to_process = target_date or today_str

    if is_holiday_date(date_to_process):
        return

    try:
        dt_obj = datetime.strptime(date_to_process, "%Y-%m-%d")
    except Exception:
        dt_obj = None

    decimal_time = now.hour + now.minute / 60.0 + now.second / 3600.0

    morning_completed = False
    afternoon_completed = False

    if date_to_process < today_str:
        morning_completed = True
        afternoon_completed = True
    elif date_to_process == today_str:
        if decimal_time >= 9.5:
            morning_completed = True
        if decimal_time >= 14.25:
            afternoon_completed = True

    if not morning_completed and not afternoon_completed:
        return

    student_coll = get_students_collection()
    attendance_coll = get_attendance_collection()

    students_cursor = student_coll.find({})
    async for student in students_cursor:
        reg_no = student.get("registerNo")
        if not reg_no:
            continue

        created_date = student.get("createdDate", "1970-01-01")
        if created_date > date_to_process:
            continue

        existing_doc = await attendance_coll.find_one({
            "registerNo": reg_no,
            "date": date_to_process
        })

        day_name = dt_obj.strftime("%A") if dt_obj else "Monday"

        if existing_doc:
            m_status = existing_doc.get("morningSession", "---")
            a_status = existing_doc.get("afternoonSession", "---")

            updated = False
            if morning_completed and m_status != "Present":
                if m_status != "Absent":
                    m_status = "Absent"
                    updated = True
            if afternoon_completed and a_status != "Present":
                if a_status != "Absent":
                    a_status = "Absent"
                    updated = True

            if updated:
                if morning_completed and afternoon_completed:
                    gen_status = "Present" if (m_status == "Present" or a_status == "Present") else "Absent"
                else:
                    gen_status = "Present" if m_status == "Present" else "Absent"

                rec_time = existing_doc.get("time")
                if not rec_time or rec_time == "---":
                    rec_time = "09:30 AM" if m_status == "Absent" else "02:15 PM"

                await attendance_coll.update_one(
                    {"_id": existing_doc["_id"]},
                    {"$set": {
                        "morningSession": m_status,
                        "afternoonSession": a_status,
                        "status": gen_status,
                        "time": rec_time,
                        "attendance_time": rec_time,
                        "rollNo": student.get("rollNo") or student.get("roll_no") or student.get("rollNumber") or "---"
                    }}
                )
        else:
            m_status = "Absent" if morning_completed else "---"
            a_status = "Absent" if afternoon_completed else "---"
            
            if morning_completed and afternoon_completed:
                gen_status = "Absent"
            elif morning_completed:
                gen_status = "Absent"
            else:
                gen_status = "Absent"

            rec_time = "09:30 AM" if morning_completed else "02:15 PM"

            doc = {
                "name": student.get("name"),
                "registerNo": reg_no,
                "rollNo": student.get("rollNo") or student.get("roll_no") or student.get("rollNumber") or "---",
                "department": student.get("department", "---"),
                "section": student.get("section", "---"),
                "year": student.get("year", "---"),
                "date": date_to_process,
                "day": day_name,
                "morningSession": m_status,
                "afternoonSession": a_status,
                "session": "Morning" if morning_completed else "Afternoon",
                "time": rec_time,
                "attendance_time": rec_time,
                "status": gen_status,
                "confidence": 0.0,
                "method": "System (Absent)",
                "studentId": str(student["_id"])
            }
            await attendance_coll.insert_one(doc)

    await recalculate_all_student_stats()

async def ensure_absent_records_for_date(date_str: str):
    """Alias for check_and_finalize_sessions for backwards compatibility."""
    await check_and_finalize_sessions(date_str)

def normalize_date_to_iso(date_str: Optional[str]) -> Optional[str]:
    if not isinstance(date_str, str) or not date_str or date_str in ["All", "All Dates", "all", ""]:
        return None
    date_str = date_str.strip()
    if "/" in date_str:
        parts = date_str.split("/")
        if len(parts) == 3:
            if len(parts[2]) == 4:  # DD/MM/YYYY
                day, month, year = parts[0], parts[1], parts[2]
                return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
            elif len(parts[0]) == 4:  # YYYY/MM/DD
                year, month, day = parts[0], parts[1], parts[2]
                return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
    return date_str

@router.get("", response_model=List[AttendanceResponse])
async def get_attendance_history(
    registerNo: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    department: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    session: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    section: Optional[str] = Query(None),
    current_admin: dict = Depends(get_current_admin)
):
    date = date if isinstance(date, str) else None
    year = year if isinstance(year, str) else None
    section = section if isinstance(section, str) else None
    status_filter = status_filter if isinstance(status_filter, str) else None
    department = department if isinstance(department, str) else None
    session = session if isinstance(session, str) else None
    search = search if isinstance(search, str) else None

    await cleanup_holiday_records()
    scope = get_admin_scope(current_admin, year, section)
    if scope["is_restricted"]:
        year = scope["year"]
        section = scope["section"]

    iso_date = normalize_date_to_iso(date)

    if iso_date:
        await check_and_finalize_sessions(iso_date)
    else:
        today_str = get_ist_now().strftime("%Y-%m-%d")
        await check_and_finalize_sessions(today_str)

    match_stage = {}
    if isinstance(registerNo, str) and registerNo:
        match_stage["registerNo"] = registerNo
    if iso_date:
        match_stage["date"] = iso_date
    if isinstance(status_filter, str) and status_filter and status_filter not in ["All", "all", ""]:
        match_stage["status"] = {"$regex": f"^{re.escape(status_filter)}$", "$options": "i"}
    if isinstance(session, str) and session and session not in ["All", "all", ""]:
        match_stage["session"] = session
    if isinstance(department, str) and department and department not in ["All", "all", ""]:
        match_stage["department"] = department
    if isinstance(search, str) and search.strip():
        s_clean = search.strip()
        or_list = [
            {"name": {"$regex": re.escape(s_clean), "$options": "i"}},
            {"registerNo": {"$regex": re.escape(s_clean), "$options": "i"}}
        ]
        if s_clean.isdigit():
            or_list.append({"registerNo": int(s_clean)})
        match_stage["$or"] = or_list

    coll = get_attendance_collection()
    pipeline = [{"$match": match_stage}]
    
    pipeline.append({
        "$lookup": {
            "from": "students",
            "localField": "registerNo",
            "foreignField": "registerNo",
            "as": "student_info"
        }
    })
    
    pipeline.append({
        "$unwind": {
            "path": "$student_info",
            "preserveNullAndEmptyArrays": True
        }
    })
    
    if isinstance(year, str) and year and year not in ["All", "all", "All Years", ""]:
        num_match = re.search(r'\d+', year)
        or_conds = [
            {"year": {"$regex": f"^{re.escape(year)}$", "$options": "i"}},
            {"student_info.year": {"$regex": f"^{re.escape(year)}$", "$options": "i"}}
        ]
        if num_match:
            num_str = num_match.group(0)
            or_conds.extend([
                {"year": {"$regex": f"^{num_str}", "$options": "i"}},
                {"student_info.year": {"$regex": f"^{num_str}", "$options": "i"}}
            ])
        pipeline.append({
            "$match": {
                "$or": or_conds
            }
        })

    if isinstance(section, str) and section and section not in ["All", "all", "All Classes", ""]:
        sec_clean = section.replace("CSE ", "").replace("Class ", "").strip().upper()
        sec_conds = [
            {"section": {"$regex": f"^{re.escape(section)}$", "$options": "i"}},
            {"section": {"$regex": f"^{re.escape(sec_clean)}$", "$options": "i"}},
            {"section": {"$regex": f"CSE\\s*{re.escape(sec_clean)}$", "$options": "i"}},
            {"student_info.section": {"$regex": f"^{re.escape(section)}$", "$options": "i"}},
            {"student_info.section": {"$regex": f"^{re.escape(sec_clean)}$", "$options": "i"}},
            {"student_info.section": {"$regex": f"CSE\\s*{re.escape(sec_clean)}$", "$options": "i"}}
        ]
        pipeline.append({
            "$match": {
                "$or": sec_conds
            }
        })

    now = get_ist_now()
    today_str = now.strftime("%Y-%m-%d")
    decimal_time = now.hour + now.minute / 60.0 + now.second / 3600.0

    history = []
    async for doc in coll.aggregate(pipeline):
        d_date = doc.get("date", "")
        d_day = doc.get("day", "")
        if is_holiday_date(d_date, d_day):
            continue

        serialized = serialize_attendance(doc)
        student_info = doc.get("student_info") or {}
        if not serialized.get("rollNo") or serialized.get("rollNo") == "---":
            serialized["rollNo"] = student_info.get("rollNo") or student_info.get("roll_no") or student_info.get("rollNumber") or "---"
        if not serialized.get("year") or serialized.get("year") == "---":
            serialized["year"] = student_info.get("year") or student_info.get("academicYear") or "---"
        if not serialized.get("section") or serialized.get("section") == "---":
            serialized["section"] = student_info.get("section") or student_info.get("class") or "---"
        if "student_info" in serialized:
            del serialized["student_info"]

        is_manual = bool(serialized.get("modifiedManually") or serialized.get("method") == "Manual Admin Correction")

        if not is_manual:
            # Ensure completed working-day sessions NEVER show "---" for non-manual records
            m_comp = d_date < today_str or (d_date == today_str and decimal_time >= 9.5)
            a_comp = d_date < today_str or (d_date == today_str and decimal_time >= 14.25)

            m_val = serialized.get("morningSession")
            if m_val != "Present":
                serialized["morningSession"] = "Absent" if m_comp else "---"

            a_val = serialized.get("afternoonSession")
            if a_val != "Present":
                serialized["afternoonSession"] = "Absent" if a_comp else "---"

            sess_name = serialized.get("session")
            if sess_name == "Morning":
                serialized["status"] = "Present" if serialized.get("morningSession") == "Present" else ("Absent" if m_comp else "---")
            elif sess_name == "Afternoon":
                serialized["status"] = "Present" if serialized.get("afternoonSession") == "Present" else ("Absent" if a_comp else "---")
            else:
                if m_comp and a_comp:
                    serialized["status"] = "Present" if (serialized["morningSession"] == "Present" or serialized["afternoonSession"] == "Present") else "Absent"

        history.append(serialized)

    # Deduplicate history records strictly by (registerNo, date, session)
    unique_history = {}
    for item in history:
        reg_key = str(item.get("registerNo")).strip()
        date_key = str(item.get("date")).strip()
        sess_key = str(item.get("session") or ("Morning" if item.get("morningSession") == "Present" else "Afternoon")).strip()
        key = (reg_key, date_key, sess_key)
        if key not in unique_history:
            unique_history[key] = item
        else:
            if item.get("modifiedManually") or (not unique_history[key].get("modifiedManually") and unique_history[key].get("status") != "Present" and item.get("status") == "Present"):
                unique_history[key] = item

    deduped_history = list(unique_history.values())
    deduped_history.sort(key=cmp_to_key(compare_attendance_records))

    return deduped_history

@router.post("", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
async def create_attendance_record(
    record: AttendanceCreate,
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
):
    current_admin = None
    try:
        current_admin = await get_current_admin(authorization=authorization, token=token)
    except Exception:
        pass

    scope = get_admin_scope(current_admin)
    if scope["is_restricted"]:
        s_year = (record.year or "").strip()
        s_sec = (record.section or "").strip().upper()
        s_sec_clean = s_sec.replace("CSE", "").replace("SECTION", "").replace("SEC", "").strip()
        scope_sec_clean = (scope.get("section") or "").replace("CSE", "").replace("SECTION", "").replace("SEC", "").strip().upper()

        if s_year.lower() != str(scope["year"]).strip().lower() or (s_sec_clean != scope_sec_clean and s_sec != str(scope["section"]).strip().upper()):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: You can only record attendance for students in your assigned class ({scope['year']} {scope['section']})."
            )

    if is_holiday_date(record.date, record.day):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Holiday! Attendance is not recorded today (Sundays, 1st & 3rd Saturdays are holidays)."
        )

    coll = get_attendance_collection()
    student_coll = get_students_collection()
    
    student = await student_coll.find_one({"registerNo": record.registerNo})
    student_id_str = str(student["_id"]) if student else "unknown"
    
    session_name = record.session
    if not session_name or session_name == "None":
        if record.morningSession == "Present":
            session_name = "Morning"
        elif record.afternoonSession == "Present":
            session_name = "Afternoon"
        else:
            time_val = record.time or get_ist_now().strftime("%I:%M %p")
            if "AM" in time_val:
                session_name = "Morning"
            else:
                session_name = "Afternoon"
                
    reg_str = str(record.registerNo).strip()
    reg_query = {"$or": [{"registerNo": reg_str}, {"registerNo": int(reg_str)}]} if reg_str.isdigit() else {"registerNo": reg_str}

    existing = await coll.find_one({
        **reg_query,
        "date": record.date
    })
    
    m_sess = record.morningSession
    a_sess = record.afternoonSession

    if session_name == "Morning" and m_sess == "---":
        m_sess = record.status
    if session_name == "Afternoon" and a_sess == "---":
        a_sess = record.status

    if existing:
        is_manual = bool(existing.get("modifiedManually") or existing.get("method") == "Manual Admin Correction")

        # Morning session status logic
        if session_name == "Morning" and (record.morningSession in ["Present", "Absent"] or record.status in ["Present", "Absent"]):
            m_sess = record.morningSession if record.morningSession in ["Present", "Absent"] else record.status
        elif existing.get("morningSession") in ["Present", "Absent"]:
            m_sess = existing.get("morningSession")
        else:
            m_sess = existing.get("morningSession", "---")

        # Afternoon session status logic
        if session_name == "Afternoon" and (record.afternoonSession in ["Present", "Absent"] or record.status in ["Present", "Absent"]):
            a_sess = record.afternoonSession if record.afternoonSession in ["Present", "Absent"] else record.status
        elif existing.get("afternoonSession") in ["Present", "Absent"]:
            a_sess = existing.get("afternoonSession")
        else:
            a_sess = existing.get("afternoonSession", "---")

        if m_sess == "Present" and a_sess == "Present":
            gen_status = "Present"
        elif m_sess == "Absent" and a_sess == "Absent":
            gen_status = "Absent"
        elif m_sess == "Present" and a_sess == "Absent":
            gen_status = "P/A"
        elif m_sess == "Absent" and a_sess == "Present":
            gen_status = "A/P"
        else:
            gen_status = existing.get("status") or ("Present" if (m_sess == "Present" or a_sess == "Present") else "Absent")

        doc = record.model_dump()
        doc["studentId"] = student_id_str
        doc["session"] = session_name
        doc["morningSession"] = m_sess
        doc["afternoonSession"] = a_sess
        doc["status"] = gen_status
        if is_manual:
            doc["modifiedManually"] = True
            doc["method"] = existing.get("method", "Manual Admin Correction")
            if existing.get("lastModifiedBy"):
                doc["lastModifiedBy"] = existing.get("lastModifiedBy")
            if existing.get("lastModifiedAt"):
                doc["lastModifiedAt"] = existing.get("lastModifiedAt")
        doc["time"] = existing.get("time") or record.time or get_ist_now().strftime("%I:%M %p")
        doc["attendance_time"] = doc["time"]
        if student and (not doc.get("year") or doc.get("year") == "---"):
            doc["year"] = student.get("year", "---")
        if student and (not doc.get("rollNo") or doc.get("rollNo") == "---"):
            doc["rollNo"] = student.get("rollNo") or student.get("roll_no") or student.get("rollNumber") or "---"

        await coll.update_one({"_id": existing["_id"]}, {"$set": doc})
        doc["_id"] = existing["_id"]
        await recalculate_all_student_stats()
        return serialize_attendance(doc)
        
    else:
        gen_status = "Present" if (m_sess == "Present" or a_sess == "Present") else "Absent"
        doc = record.model_dump()
        doc["studentId"] = student_id_str
        doc["session"] = session_name
        doc["morningSession"] = m_sess
        doc["afternoonSession"] = a_sess
        doc["status"] = gen_status
        doc["time"] = record.time or get_ist_now().strftime("%I:%M %p")
        doc["attendance_time"] = doc["time"]
        if student and (not doc.get("year") or doc.get("year") == "---"):
            doc["year"] = student.get("year", "---")
        if student and (not doc.get("rollNo") or doc.get("rollNo") == "---"):
            doc["rollNo"] = student.get("rollNo") or student.get("roll_no") or student.get("rollNumber") or "---"
        
        result = await coll.insert_one(doc)
        doc["_id"] = result.inserted_id
        await recalculate_all_student_stats()
        return serialize_attendance(doc)

@router.delete("/{attendance_id}")
async def delete_attendance_record(
    attendance_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    scope = get_admin_scope(current_admin)
    coll = get_attendance_collection()
    try:
        query = {"_id": ObjectId(attendance_id)}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid attendance ID format"
        )
        
    existing = await coll.find_one(query)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attendance record not found"
        )

    if scope["is_restricted"]:
        student_coll = get_students_collection()
        student = await student_coll.find_one({"registerNo": existing.get("registerNo")})
        if student:
            from backend.routes.students import check_student_scope_permission
            check_student_scope_permission(student, scope)
        
    await coll.delete_one(query)
    await recalculate_all_student_stats()
    return {"success": True, "message": "Attendance record deleted successfully"}


@router.put("/correct", response_model=AttendanceResponse)
@router.post("/correct", response_model=AttendanceResponse)
async def correct_attendance_record(
    request: AttendanceCorrectionRequest,
    current_admin: dict = Depends(get_current_admin)
):
    """
    Manually override/correct an attendance record for a student on a given date and session.
    Requirements:
    1. Must verify student exists in DB.
    2. Must respect Scope Permission for Class Advisor admins.
    3. Update or Insert record into 'attendance' collection.
    4. Automatically trigger recalculation of student overall attendance % (Requirement #16).
    """
    if not current_admin or current_admin.get("role") == "student":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Students are not permitted to modify attendance records."
        )

    reg_no = str(request.registerNo).strip()
    raw_date = request.date.strip()
    session_input = request.session.strip().capitalize()
    status_input = request.newStatus.strip().upper()

    if session_input not in ["Morning", "Afternoon"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session. Session must be 'Morning' or 'Afternoon'."
        )

    if status_input not in ["PRESENT", "ABSENT"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status. Status must be 'PRESENT' or 'ABSENT'."
        )

    target_status = "Present" if status_input == "PRESENT" else "Absent"

    # Normalize date
    norm_date = raw_date
    if "/" in raw_date:
        parts = raw_date.split("/")
        if len(parts) == 3:
            if len(parts[2]) == 4:
                norm_date = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
            elif len(parts[0]) == 4:
                norm_date = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"

    # Check holiday
    if is_holiday_date(norm_date):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attendance correction is not allowed on holidays (Sundays, 1st & 3rd Saturdays)."
        )

    # Validate student existence and admin scope permission
    student_coll = get_students_collection()
    reg_query_s = {"$or": [{"registerNo": reg_no}, {"registerNo": int(reg_no)}]} if reg_no.isdigit() else {"registerNo": reg_no}
    student = await student_coll.find_one(reg_query_s)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with Register Number '{reg_no}' not found."
        )

    admin_scope = get_admin_scope(current_admin)
    if admin_scope["is_restricted"]:
        from backend.routes.students import check_student_scope_permission
        check_student_scope_permission(student, admin_scope)

    try:
        dt_obj = datetime.strptime(norm_date, "%Y-%m-%d")
        day_name = dt_obj.strftime("%A")
    except Exception:
        day_name = "Monday"

    coll = get_attendance_collection()
    reg_cond = {"$or": [{"registerNo": reg_no}, {"registerNo": int(reg_no)}]} if reg_no.isdigit() else {"registerNo": reg_no}
    date_cond = {"$or": [{"date": norm_date}, {"date": raw_date}]} if norm_date != raw_date else {"date": norm_date}

    # Search existing record for student & date
    existing_doc = await coll.find_one({"$and": [reg_cond, date_cond]})

    admin_name = current_admin.get("name") or current_admin.get("email") or "Admin"
    now_ist = get_ist_now().strftime("%Y-%m-%d %I:%M %p")

    if existing_doc:
        m_sess = existing_doc.get("morningSession", "---")
        a_sess = existing_doc.get("afternoonSession", "---")

        if session_input == "Morning":
            m_sess = target_status
        elif session_input == "Afternoon":
            a_sess = target_status

        if m_sess == "Present" and a_sess == "Present":
            gen_status = "Present"
        elif m_sess == "Absent" and a_sess == "Absent":
            gen_status = "Absent"
        elif m_sess == "Present" and a_sess == "Absent":
            gen_status = "P/A"
        elif m_sess == "Absent" and a_sess == "Present":
            gen_status = "A/P"
        elif session_input == "Morning":
            gen_status = "Present" if m_sess == "Present" else "Absent"
        elif session_input == "Afternoon":
            gen_status = "Present" if a_sess == "Present" else "Absent"
        else:
            gen_status = "Present" if (m_sess == "Present" or a_sess == "Present") else "Absent"

        update_fields = {
            "session": session_input,
            "morningSession": m_sess,
            "afternoonSession": a_sess,
            "status": gen_status,
            "method": "Manual Admin Correction",
            "lastModifiedBy": admin_name,
            "lastModifiedAt": now_ist,
            "modifiedManually": True,
            "rollNo": student.get("rollNo") or student.get("roll_no") or student.get("rollNumber") or "---"
        }

        await coll.update_one({"_id": existing_doc["_id"]}, {"$set": update_fields})
        existing_doc.update(update_fields)
        record_to_return = existing_doc
    else:
        m_sess = target_status if session_input == "Morning" else "---"
        a_sess = target_status if session_input == "Afternoon" else "---"
        gen_status = target_status

        new_record = {
            "name": student.get("name"),
            "registerNo": reg_no,
            "rollNo": student.get("rollNo") or student.get("roll_no") or student.get("rollNumber") or "---",
            "department": student.get("department", "CSE"),
            "section": student.get("section", "A"),
            "year": student.get("year", "3rd Year"),
            "date": norm_date,
            "day": day_name,
            "time": get_ist_now().strftime("%I:%M %p"),
            "attendance_time": get_ist_now().strftime("%I:%M %p"),
            "session": session_input,
            "morningSession": m_sess,
            "afternoonSession": a_sess,
            "status": gen_status,
            "confidence": 100.0,
            "method": "Manual Admin Correction",
            "studentId": str(student["_id"]),
            "lastModifiedBy": admin_name,
            "lastModifiedAt": now_ist,
            "modifiedManually": True
        }

        result = await coll.insert_one(new_record)
        new_record["_id"] = result.inserted_id
        record_to_return = new_record

    await recalculate_all_student_stats()

    return serialize_attendance(record_to_return)

def serialize_reset(r: dict) -> dict:
    if not r:
        return {}
    return {
        "id": str(r.get("_id")) if r.get("_id") else None,
        "reset_id": r.get("reset_id"),
        "scope": r.get("scope"),
        "year": r.get("year"),
        "section": r.get("section"),
        "registerNo": r.get("registerNo"),
        "student_name": r.get("student_name"),
        "reset_timestamp": r.get("reset_timestamp"),
        "reset_date": r.get("reset_date_display") or r.get("reset_date"),
        "reset_time": r.get("reset_time_display") or r.get("reset_time"),
        "performed_by": r.get("performed_by"),
        "performed_by_email": r.get("performed_by_email"),
        "performed_by_role": r.get("performed_by_role"),
        "status": r.get("status", "active"),
        "created_at": r.get("created_at"),
        "undone_at": r.get("undone_at"),
        "undone_by": r.get("undone_by")
    }

@router.get("/resets")
async def get_reset_history(
    current_admin: dict = Depends(get_current_admin)
):
    scope_info = get_admin_scope(current_admin)
    resets_coll = get_resets_collection()
    student_coll = get_students_collection()
    
    cursor = resets_coll.find({}).sort("reset_timestamp", -1)
    all_resets = []
    async for r in cursor:
        all_resets.append(r)
        
    if not scope_info["is_restricted"]:
        # HOD sees all reset records
        return [serialize_reset(r) for r in all_resets]

    # Class Advisor: Filter to only resets relevant to advisor's assigned class / students
    advisor_year = str(scope_info.get("year") or "").strip().lower()
    advisor_sec = str(scope_info.get("section") or scope_info.get("class") or "").strip().upper()
    advisor_sec_clean = advisor_sec.replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()

    def year_match(y1, y2):
        if not y1 or not y2: return False
        if y1.lower() == y2.lower(): return True
        n1 = re.search(r'\d+', y1)
        n2 = re.search(r'\d+', y2)
        return bool(n1 and n2 and n1.group(0) == n2.group(0))

    def sec_match(s1, s2):
        if not s1 or not s2: return False
        c1 = s1.upper().replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()
        c2 = s2.upper().replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()
        return c1 == c2

    # Fetch students in advisor's class
    class_students = await student_coll.find({}).to_list(1000)
    advisor_student_regs = set()
    for st in class_students:
        st_yr = str(st.get("year") or st.get("academicYear") or "").strip().lower()
        st_sec = str(st.get("section") or st.get("class") or "").strip().upper()
        st_sec_clean = st_sec.replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()
        if year_match(st_yr, advisor_year) and sec_match(st_sec_clean, advisor_sec_clean):
            reg_val = str(st.get("registerNo") or st.get("register_no") or "").strip().lower()
            if reg_val:
                advisor_student_regs.add(reg_val)

    filtered_resets = []
    for r in all_resets:
        scope = r.get("scope")
        r_yr = str(r.get("year") or "").strip().lower()
        r_sec = str(r.get("section") or "").strip().upper()
        r_sec_clean = r_sec.replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()
        r_reg = str(r.get("registerNo") or "").strip().lower()

        if scope == "department":
            filtered_resets.append(r)
        elif scope == "year" and year_match(r_yr, advisor_year):
            filtered_resets.append(r)
        elif scope == "class" and year_match(r_yr, advisor_year) and sec_match(r_sec_clean, advisor_sec_clean):
            filtered_resets.append(r)
        elif scope == "student" and r_reg in advisor_student_regs:
            filtered_resets.append(r)

    return [serialize_reset(r) for r in filtered_resets]

@router.post("/reset")
async def reset_attendance(
    body: AttendanceResetRequest,
    current_admin: dict = Depends(get_current_admin)
):
    scope_info = get_admin_scope(current_admin)
    resets_coll = get_resets_collection()
    student_coll = get_students_collection()

    req_scope = str(body.scope).lower().strip()
    if req_scope not in ["department", "year", "class", "student"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset scope. Must be 'department', 'year', 'class', or 'student'."
        )

    target_year = body.year
    target_section = body.section
    target_reg = body.registerNo
    student_name = None

    # BACKEND SECURITY PERMISSION ENFORCEMENT
    if scope_info["is_restricted"]:
        # Class Advisor
        if req_scope in ["department", "year"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Class Advisors are only permitted to reset attendance for their assigned class or individual students in their class."
            )
        
        target_year = scope_info.get("year")
        target_section = scope_info.get("section") or scope_info.get("class")

        if req_scope == "student":
            if not target_reg:
                raise HTTPException(status_code=400, detail="Register number required for student reset.")
            student = await student_coll.find_one({"registerNo": target_reg})
            if not student:
                raise HTTPException(status_code=404, detail="Student not found.")
            
            student_name = student.get("name") or student.get("studentName")
            s_yr = str(student.get("year") or student.get("academicYear") or "").strip().lower()
            a_yr = str(target_year or "").strip().lower()
            s_sec = str(student.get("section") or student.get("class") or "").strip().upper()
            a_sec = str(target_section or "").strip().upper()
            
            s_sec_clean = s_sec.replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()
            a_sec_clean = a_sec.replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()

            s_yr_num = re.search(r'\d+', s_yr)
            a_yr_num = re.search(r'\d+', a_yr)

            yr_match = (s_yr == a_yr) or (s_yr_num and a_yr_num and s_yr_num.group(0) == a_yr_num.group(0))
            sec_match = (s_sec_clean == a_sec_clean)

            if not (yr_match and sec_match):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not authorized to reset attendance for a student outside your assigned class."
                )

    if req_scope == "student" and target_reg and not student_name:
        st_doc = await student_coll.find_one({"registerNo": target_reg})
        if st_doc:
            student_name = st_doc.get("name") or st_doc.get("studentName")

    now = get_ist_now()
    performed_role = "hod" if not scope_info["is_restricted"] else "class_teacher"
    admin_email = current_admin.get("email") or "Admin"
    performed_label = f"HOD ({admin_email})" if not scope_info["is_restricted"] else f"Class Advisor ({admin_email})"

    reset_doc = {
        "reset_id": f"rst_{uuid4().hex[:10]}",
        "reset_timestamp": now.isoformat(),
        "reset_date": now.strftime("%Y-%m-%d"),
        "reset_date_display": now.strftime("%d/%m/%Y"),
        "reset_time_display": now.strftime("%I:%M %p"),
        "reset_time_decimal": round(now.hour + now.minute / 60.0 + now.second / 3600.0, 4),
        "scope": req_scope,
        "year": target_year,
        "section": target_section,
        "registerNo": target_reg,
        "student_name": student_name,
        "performed_by": performed_label,
        "performed_by_email": admin_email,
        "performed_by_role": performed_role,
        "status": "active",
        "created_at": now.isoformat()
    }

    await resets_coll.insert_one(reset_doc)
    await recalculate_all_student_stats()

    return {
        "message": "Attendance reset successfully",
        "reset": serialize_reset(reset_doc)
    }

@router.post("/reset/{reset_id}/undo")
async def undo_attendance_reset(
    reset_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    scope_info = get_admin_scope(current_admin)
    resets_coll = get_resets_collection()
    student_coll = get_students_collection()

    reset_doc = await resets_coll.find_one({"$or": [
        {"reset_id": reset_id},
        {"_id": ObjectId(reset_id) if ObjectId.is_valid(reset_id) else None}
    ]})
    if not reset_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reset record not found.")

    if reset_doc.get("status") == "undone":
        return {
            "message": "Reset is already undone.",
            "reset": serialize_reset(reset_doc)
        }

    # BACKEND SECURITY PERMISSION ENFORCEMENT FOR UNDO
    if scope_info["is_restricted"]:
        # Class Advisor
        advisor_year = str(scope_info.get("year") or "").strip().lower()
        advisor_sec = str(scope_info.get("section") or scope_info.get("class") or "").strip().upper()
        advisor_sec_clean = advisor_sec.replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()

        def year_match(y1, y2):
            if not y1 or not y2: return False
            if y1.lower() == y2.lower(): return True
            n1 = re.search(r'\d+', y1)
            n2 = re.search(r'\d+', y2)
            return bool(n1 and n2 and n1.group(0) == n2.group(0))

        def sec_match(s1, s2):
            if not s1 or not s2: return False
            c1 = s1.upper().replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()
            c2 = s2.upper().replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()
            return c1 == c2

        r_scope = reset_doc.get("scope")
        r_yr = str(reset_doc.get("year") or "").strip().lower()
        r_sec = str(reset_doc.get("section") or "").strip().upper()
        r_sec_clean = r_sec.replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()

        is_authorized = False

        if r_scope == "class" and year_match(r_yr, advisor_year) and sec_match(r_sec_clean, advisor_sec_clean):
            is_authorized = True
        elif r_scope == "student":
            st_reg = str(reset_doc.get("registerNo") or "").strip()
            if st_reg:
                student = await student_coll.find_one({"registerNo": st_reg})
                if student:
                    st_yr = str(student.get("year") or student.get("academicYear") or "").strip().lower()
                    st_sec = str(student.get("section") or student.get("class") or "").strip().upper()
                    st_sec_clean = st_sec.replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()
                    if year_match(st_yr, advisor_year) and sec_match(st_sec_clean, advisor_sec_clean):
                        is_authorized = True

        if not is_authorized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to undo this reset. Class Advisors can only undo resets for their assigned class or students in their class."
            )

    now = get_ist_now()
    now_iso = now.isoformat()
    admin_email = current_admin.get("email") or "Admin"

    await resets_coll.update_one(
        {"_id": reset_doc["_id"]},
        {"$set": {
            "status": "undone",
            "undone_at": now_iso,
            "undone_by": admin_email
        }}
    )

    await recalculate_all_student_stats()

    updated_doc = await resets_coll.find_one({"_id": reset_doc["_id"]})
    return {
        "message": "Attendance reset undone successfully",
        "reset": serialize_reset(updated_doc)
    }




