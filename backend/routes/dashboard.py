from fastapi import APIRouter, Depends
from datetime import datetime, timedelta
import logging
import re

from backend.db import get_students_collection, get_attendance_collection
from backend.routes.attendance import (
    ensure_absent_records_for_date,
    cleanup_holiday_records,
    recalculate_all_student_stats,
    get_ist_now,
    is_holiday_date,
    get_active_resets_list,
    get_latest_reset_for_student,
    is_record_after_reset
)
from backend.routes.auth import get_current_admin, get_admin_scope

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
logger = logging.getLogger("smart_attendance")

@router.get("")
async def get_dashboard_data(current_admin: dict = Depends(get_current_admin)):
    await cleanup_holiday_records()
    await recalculate_all_student_stats()
    student_coll = get_students_collection()
    attendance_coll = get_attendance_collection()

    scope = get_admin_scope(current_admin)
    
    # Construct student matching query based on scope
    student_query = {}
    if scope["is_restricted"]:
        sec_raw = str(scope.get("section") or scope.get("class") or "").strip()
        yr_raw = str(scope.get("year") or "").strip()
        sec_clean = sec_raw.replace("CSE ", "").replace("Class ", "").strip()
        sec_regex = f"^(CSE\\s*)?{re.escape(sec_clean)}$" if sec_clean else ".*"
        student_query = {
            "year": {"$regex": f"^{re.escape(yr_raw)}$", "$options": "i"},
            "$or": [
                {"section": {"$regex": sec_regex, "$options": "i"}},
                {"class": {"$regex": sec_regex, "$options": "i"}}
            ]
        }

    total_students = await student_coll.count_documents(student_query)

    # Low attendance count (< 75%)
    low_att_query = {"attendanceRate": {"$lt": 75.0}}
    if student_query:
        low_att_query = {"$and": [student_query, low_att_query]}
    low_attendance_count = await student_coll.count_documents(low_att_query)

    total_att_docs = await attendance_coll.count_documents({})
    has_attendance_data = (total_att_docs > 0)

    # Class-wise Low Attendance breakdown
    cse_classes_structure = [
        ("1st Year", ["CSE A", "CSE B", "CSE C", "CSE D", "CSE E"]),
        ("2nd Year", ["CSE A", "CSE B", "CSE C", "CSE D", "CSE E"]),
        ("3rd Year", ["CSE A", "CSE B", "CSE C", "CSE D"]),
        ("4th Year", ["CSE A", "CSE B", "CSE C"])
    ]

    def student_matches_year_and_class(st, target_year, target_cls):
        st_yr = str(st.get("year") or st.get("academicYear") or "").strip().lower()
        t_yr = str(target_year).strip().lower()
        
        yr_match = (st_yr == t_yr)
        if not yr_match:
            s_num = re.search(r'\d+', st_yr)
            t_num = re.search(r'\d+', t_yr)
            if s_num and t_num and s_num.group(0) == t_num.group(0):
                yr_match = True
        if not yr_match:
            return False

        st_sec = str(st.get("section") or st.get("class") or st.get("className") or "").strip().upper()
        t_cls = str(target_cls).strip().upper()
        if st_sec == t_cls:
            return True
        st_clean = st_sec.replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()
        t_clean = t_cls.replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()
        return st_clean == t_clean

    all_students_cursor = student_coll.find(student_query)
    all_students = [s async for s in all_students_cursor]

    low_attendance_by_class = []

    for yr_name, classes in cse_classes_structure:
        for cls_name in classes:
            class_students = [s for s in all_students if student_matches_year_and_class(s, yr_name, cls_name)]
            if not class_students:
                continue

            low_att_students = []
            for s in class_students:
                rate = float(s.get("attendanceRate", 100.0))
                tot_cls = int(s.get("totalClasses", 0))
                if has_attendance_data and tot_cls > 0 and rate < 75.0:
                    low_att_students.append(s)

            low_count = len(low_att_students)
            if low_count > 0:
                low_attendance_by_class.append({
                    "year": yr_name,
                    "className": cls_name,
                    "displayName": f"{yr_name} — {cls_name}",
                    "count": low_count,
                    "studentCount": len(class_students)
                })

    # Get set of register numbers for scoped students
    scoped_register_nos = set()
    async for s in student_coll.find(student_query, {"registerNo": 1}):
        reg = s.get("registerNo")
        if reg:
            scoped_register_nos.add(reg)

    att_base_query = {}
    if scope["is_restricted"]:
        att_base_query["registerNo"] = {"$in": list(scoped_register_nos)}

    now = get_ist_now()
    today_str = now.strftime("%Y-%m-%d")
    is_today_holiday = is_holiday_date(today_str, now.strftime("%A"))

    if not is_today_holiday:
        await ensure_absent_records_for_date(today_str)
    
    # Unique Registered Students attendance today
    active_resets = await get_active_resets_list()

    student_reset_map = {}
    async for s in student_coll.find(student_query):
        reg = s.get("registerNo")
        if reg:
            latest_reset = get_latest_reset_for_student(s, active_resets)
            student_reset_map[reg] = {
                "student_doc": s,
                "reset": latest_reset
            }

    if not is_today_holiday:
        query_today = {"date": today_str, **att_base_query}
        today_present_set = set()

        async for d in attendance_coll.find(query_today):
            if is_holiday_date(d.get("date"), d.get("day")):
                continue
            reg = d.get("registerNo")
            if not reg:
                continue

            if reg in student_reset_map:
                reset_doc = student_reset_map[reg]["reset"]
            else:
                if scope["is_restricted"]:
                    continue
                st_doc = await student_coll.find_one({"registerNo": reg})
                if not st_doc:
                    continue
                reset_doc = get_latest_reset_for_student(st_doc, active_resets)

            if is_record_after_reset(d, reset_doc):
                if d.get("status") == "Present" or d.get("morningSession") == "Present" or d.get("afternoonSession") == "Present":
                    today_present_set.add(reg)

        today_present = len(today_present_set)
        today_total_records = total_students
        today_attendance_rate = round((today_present / total_students) * 100, 1) if total_students > 0 else 0.0
    else:
        today_total_records = total_students
        today_present = 0
        today_attendance_rate = 0.0

    # Low attendance count (students with attendance rate < 75%)
    low_attendance_count = 0
    async for s in student_coll.find(student_query):
        rate = s.get("attendanceRate", 100.0)
        if rate < 75.0:
            low_attendance_count += 1

    # Department Averages
    # Denominator = total registered students in department
    # Numerator = average attendanceRate of students in department
    dept_pipeline = []
    if scope["is_restricted"]:
        sec_clean = scope["section"].replace("CSE ", "").replace("Class ", "").strip()
        sec_regex = f"^(CSE\\s*)?{re.escape(sec_clean)}$"
        dept_pipeline.append({
            "$match": {
                "year": {"$regex": f"^{re.escape(scope['year'])}$", "$options": "i"},
                "$or": [
                    {"section": {"$regex": sec_regex, "$options": "i"}},
                    {"class": {"$regex": sec_regex, "$options": "i"}}
                ]
            }
        })
    dept_pipeline.extend([
        {
            "$group": {
                "_id": "$department",
                "avgRate": {"$avg": "$attendanceRate"}
            }
        }
    ])
    
    dept_colors = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899"]
    dept_averages = []
    idx = 0
    async for group in student_coll.aggregate(dept_pipeline):
        dept_name = group["_id"] or "Computer Science"
        avg_val = round(group["avgRate"] or 100.0, 1)
        dept_averages.append({
            "name": dept_name,
            "rate": avg_val,
            "color": dept_colors[idx % len(dept_colors)]
        })
        idx += 1

    if not dept_averages:
        async for s in student_coll.find(student_query):
            dept_name = s.get("department") or "Computer Science & Engineering"
            rate = float(s.get("attendanceRate", 100.0) or 100.0)
            dept_averages.append({
                "name": dept_name,
                "rate": round(rate, 1),
                "color": "#3b82f6"
            })
            break

    # Weekly attendance trends (Current week working days Mon-Sat, real MongoDB data, reset-aware)
    monday_dt = now - timedelta(days=now.weekday())
    weekly_trend = []

    for idx in range(6):
        day_dt = monday_dt + timedelta(days=idx)
        day_str = day_dt.strftime("%Y-%m-%d")
        day_name = day_dt.strftime("%a")
        full_day_name = day_dt.strftime("%A")

        if is_holiday_date(day_str, full_day_name):
            continue

        is_future_day = (day_dt.date() > now.date())

        if is_future_day:
            weekly_trend.append({
                "day": day_name,
                "date": day_str,
                "rate": None,
                "Present": None,
                "Absent": None
            })
            continue

        q_day = {"date": day_str}
        if scope["is_restricted"]:
            q_day["registerNo"] = {"$in": list(student_reset_map.keys())}

        pres_students = set()
        absent_students = set()

        async for d in attendance_coll.find(q_day):
            if is_holiday_date(d.get("date"), d.get("day")):
                continue
            reg = d.get("registerNo")
            if not reg:
                continue

            if reg in student_reset_map:
                reset_doc = student_reset_map[reg]["reset"]
            else:
                if scope["is_restricted"]:
                    continue
                st_doc = await student_coll.find_one({"registerNo": reg})
                if not st_doc:
                    continue
                reset_doc = get_latest_reset_for_student(st_doc, active_resets)

            if is_record_after_reset(d, reset_doc):
                if d.get("status") == "Present" or d.get("morningSession") == "Present" or d.get("afternoonSession") == "Present":
                    pres_students.add(reg)
                elif d.get("status") == "Absent":
                    absent_students.add(reg)

        absent_students = absent_students - pres_students
        unique_present = len(pres_students)

        denom = total_students if total_students > 0 else (unique_present + len(absent_students))

        if denom > 0 and (unique_present > 0 or len(absent_students) > 0):
            present_pct = round((unique_present / denom) * 100, 1)
            absent_pct = round(100.0 - present_pct, 1)
            weekly_trend.append({
                "day": day_name,
                "date": day_str,
                "rate": present_pct,
                "Present": present_pct,
                "Absent": absent_pct
            })
        else:
            weekly_trend.append({
                "day": day_name,
                "date": day_str,
                "rate": None,
                "Present": None,
                "Absent": None
            })

    # Recent activities (excluding Holidays)
    activities = []
    cursor = student_coll.find(student_query).sort([("createdDate", -1), ("createdTime", -1)]).limit(5)
    async for s in cursor:
        activities.append({
            "id": f"reg-{str(s['_id'])}",
            "type": "registration",
            "text": f"New student registered: {s['name']} ({s['registerNo']})",
            "time": f"{s.get('createdDate')} at {s.get('createdTime')}"
        })
        
    cursor = attendance_coll.find(att_base_query).sort([("date", -1), ("time", -1)])
    async for a in cursor:
        if is_holiday_date(a.get("date"), a.get("day")):
            continue
        activities.append({
            "id": f"att-{str(a['_id'])}",
            "type": "attendance",
            "text": f"Attendance recorded: {a['name']} ({a['status']})",
            "time": f"{a.get('date')} at {a.get('time')}"
        })
        if len(activities) >= 5:
            break

    activities = activities[:5]
    if not activities:
        activities = [
            {"id": "act-1", "type": "settings", "text": "System operational and connected to PostgreSQL database", "time": "Just now"}
        ]

    return {
        "totalStudents": total_students,
        "todayAttendanceRate": today_attendance_rate,
        "todayPresent": today_present,
        "todayTotal": today_total_records,
        "lowAttendanceCount": low_attendance_count,
        "lowAttendanceByClass": low_attendance_by_class,
        "hasAttendanceData": has_attendance_data,
        "departmentStats": dept_averages,
        "weeklyTrends": weekly_trend,
        "recentActivities": activities
    }
