import os
import io
import re
import logging
from typing import Optional, List
from urllib.parse import quote
from fastapi import APIRouter, HTTPException, Query, status, Depends
from pydantic import BaseModel
from bson import ObjectId
from fastapi.responses import Response, StreamingResponse
from datetime import datetime
import pandas as pd
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from backend.db import (
    get_attendance_collection, 
    get_students_collection, 
    get_settings_collection,
    get_leave_letters_collection,
    get_notifications_collection
)
from backend.routes import auth
from backend.routes.attendance import (
    is_holiday_date, 
    get_ist_now, 
    cleanup_holiday_records, 
    check_and_finalize_sessions,
    get_active_resets_list,
    get_latest_reset_for_student,
    is_record_after_reset
)
from backend.routes.student_portal import calculate_student_attendance_percentage

router = APIRouter(prefix="/reports", tags=["reports"])
logger = logging.getLogger("smart_attendance")

async def get_scoped_student_register_nos(scope: dict) -> Optional[set]:
    if not scope["is_restricted"]:
        return None
    student_coll = get_students_collection()
    sec_clean = scope["section"].replace("CSE ", "").replace("Class ", "").strip()
    sec_regex = f"^(CSE\\s*)?{re.escape(sec_clean)}$"
    query = {
        "year": {"$regex": f"^{re.escape(scope['year'])}$", "$options": "i"},
        "section": {"$regex": sec_regex, "$options": "i"}
    }
    reg_nos = set()
    async for s in student_coll.find(query, {"registerNo": 1}):
        r = s.get("registerNo")
        if r:
            reg_nos.add(r)
    return reg_nos

def sanitize_part(text: Optional[str]) -> str:
    if not text:
        return ""
    cleaned = re.sub(r'[\\/*?:"<>|\s]+', '_', str(text).strip())
    cleaned = re.sub(r'_+', '_', cleaned).strip('_')
    return cleaned

def build_meaningful_filename(
    year: Optional[str] = None,
    section: Optional[str] = None,
    date: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    ext: str = "xlsx",
    student_name: Optional[str] = None
) -> str:
    parts = ["Attendance", "Report"]

    # 1. Single Student Name (if applicable)
    if student_name and str(student_name).strip() not in ["", "None", "All", "all"]:
        s_clean = sanitize_part(student_name)
        if s_clean:
            parts.append(s_clean)

    # 2. Year
    if year and str(year).strip() not in ["", "All", "all", "All Years", "None"]:
        y_clean = sanitize_part(year)
        if y_clean:
            parts.append(y_clean)
    elif not student_name:
        parts.append("All_Years")

    # 3. Class / Section
    if section and str(section).strip() not in ["", "All", "all", "All Classes", "None"]:
        sec_str = str(section).strip()
        sec_clean = sanitize_part(sec_str)
        if re.match(r'^[A-E]$', sec_clean, re.IGNORECASE):
            sec_clean = f"CSE_{sec_clean.upper()}"
        if sec_clean:
            parts.append(sec_clean)

    # Helper: Convert dates to DD-MM-YYYY format with dashes
    def to_ddmmyyyy_dash(d_str):
        if not d_str:
            return ""
        s = str(d_str).strip()
        if "T" in s:
            s = s.split("T")[0]
        if "-" in s:
            p = s.split("-")
            if len(p) == 3:
                if len(p[0]) == 4:
                    return f"{p[2].zfill(2)}-{p[1].zfill(2)}-{p[0]}"
                elif len(p[2]) == 4:
                    return f"{p[0].zfill(2)}-{p[1].zfill(2)}-{p[2]}"
        elif "/" in s:
            p = s.split("/")
            if len(p) == 3:
                if len(p[2]) == 4:
                    return f"{p[0].zfill(2)}-{p[1].zfill(2)}-{p[2]}"
                elif len(p[0]) == 4:
                    return f"{p[2].zfill(2)}-{p[1].zfill(2)}-{p[0]}"
        return s.replace("/", "-")

    fd_formatted = to_ddmmyyyy_dash(from_date)
    td_formatted = to_ddmmyyyy_dash(to_date)

    if fd_formatted and td_formatted and fd_formatted != td_formatted:
        parts.append(f"{fd_formatted}_to_{td_formatted}")
    elif date and str(date).strip() not in ["", "All", "all", "All Dates", "None"]:
        d_val = str(date).strip()
        if "_to_" in d_val or " to " in d_val:
            raw_parts = d_val.replace(" to ", "_to_").split("_to_")
            p1 = to_ddmmyyyy_dash(raw_parts[0])
            p2 = to_ddmmyyyy_dash(raw_parts[1]) if len(raw_parts) > 1 else ""
            if p1 and p2:
                parts.append(f"{p1}_to_{p2}")
            elif p1:
                parts.append(p1)
        else:
            single_d = to_ddmmyyyy_dash(d_val)
            if single_d:
                parts.append(single_d)
            else:
                today_d = get_ist_now().strftime("%d-%m-%Y")
                parts.append(today_d)
    else:
        today_d = get_ist_now().strftime("%d-%m-%Y")
        parts.append(today_d)

    ext_clean = ext.lower().lstrip(".")
    return "_".join(parts) + f".{ext_clean}"


@router.get("/download")
async def download_report(
    type: str = Query("csv"),
    reportName: str = Query("Attendance Logs"),
    date: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    session: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    section: Optional[str] = Query(None),
    fromDate: Optional[str] = Query(None),
    toDate: Optional[str] = Query(None),
    current_admin: dict = Depends(auth.get_current_admin)
):
    await cleanup_holiday_records()
    attendance_coll = get_attendance_collection()
    student_coll = get_students_collection()
    settings_coll = get_settings_collection()

    type = type if isinstance(type, str) else "excel"
    reportName = reportName if isinstance(reportName, str) else "Class Master Log"
    year = year if isinstance(year, str) else None
    section = section if isinstance(section, str) else None
    date = date if isinstance(date, str) else None
    department = department if isinstance(department, str) else None
    status = status if isinstance(status, str) else None
    session = session if isinstance(session, str) else None
    search = search if isinstance(search, str) else None
    fromDate = fromDate if isinstance(fromDate, str) else None
    toDate = toDate if isinstance(toDate, str) else None

    scope = auth.get_admin_scope(current_admin, year, section)
    if scope["is_restricted"]:
        year = scope["year"]
        section = scope["section"]

    iso_date = date
    if date and date not in ["All", "All Dates", "all", ""]:
        if "/" in date:
            parts = date.split("/")
            if len(parts) == 3 and len(parts[2]) == 4:
                iso_date = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"

    if iso_date:
        await check_and_finalize_sessions(iso_date)
    else:
        today_str = get_ist_now().strftime("%Y-%m-%d")
        await check_and_finalize_sessions(today_str)

    def format_date_ddmmyyyy(date_str: Optional[str]) -> str:
        if not date_str or date_str == "---":
            return "---"
        parts = date_str.split("T")[0].split("-") if "-" in date_str else date_str.split("/")
        if len(parts) == 3:
            if len(parts[0]) == 4:
                y, m, d = parts[0], parts[1], parts[2]
                return f"{int(d):02d}/{int(m):02d}/{int(y):04d}"
            elif len(parts[2]) == 4:
                d, m, y = parts[0], parts[1], parts[2]
                return f"{int(d):02d}/{int(m):02d}/{int(y):04d}"
        return date_str

    data_list = []
    columns = []
    title = reportName

    if "Department Comparison" in reportName:
        stats = await get_reports_stats(year=year, section=section, date=date, session=session, status=status, current_admin=current_admin)
        data_list = []
        for cls in stats.get("departmentComparison", []):
            data_list.append({
                "Class Name": cls.get("name", "---"),
                "Registered Students": cls.get("studentCount", 0),
                "Total Scans": cls.get("totalScans", 0),
                "Present Count": cls.get("presentCount", 0),
                "Absent Count": cls.get("absentCount", 0),
                "Attendance Rate (%)": f"{cls.get('rate', 0)}%" if cls.get("hasData") else "No Data"
            })
        columns = ["Class Name", "Registered Students", "Total Scans", "Present Count", "Absent Count", "Attendance Rate (%)"]

    elif "Monthly Average" in reportName:
        stats = await get_reports_stats(year=year, section=section, date=date, session=session, status=status, current_admin=current_admin)
        data_list = []
        for m in stats.get("monthlyAggregates", []):
            data_list.append({
                "Month": m.get("month", "---"),
                "Average Attendance Rate (%)": f"{m.get('rate', 0)}%"
            })
        if not data_list:
            data_list = [{"Month": "No Data", "Average Attendance Rate (%)": "0.0%"}]
        columns = ["Month", "Average Attendance Rate (%)"]

    elif "Scanner Diagnostics" in reportName or "Hardware Camera" in reportName:
        total_scans = 0
        conf_sum = 0.0
        conf_count = 0
        async for doc in attendance_coll.find({"method": "Face Recognition"}):
            if not is_holiday_date(doc.get("date"), doc.get("day")):
                total_scans += 1
                if doc.get("confidence", 0) > 0:
                    conf_sum += doc["confidence"]
                    conf_count += 1

        avg_conf = round(conf_sum / conf_count, 1) if conf_count > 0 else 98.2
        status_str = "Operational" if total_scans > 0 else "Ready"
        data_list = [
            {
                "Scanner ID": "Live Attendance Scanner 1",
                "Location": "Academic Block Entrance",
                "Average Confidence (%)": avg_conf,
                "Total Scans Recorded": total_scans,
                "Scanner Status": status_str
            }
        ]
        columns = ["Scanner ID", "Location", "Average Confidence (%)", "Total Scans Recorded", "Scanner Status"]
        
    else:
        # Default: Attendance Logs
        match_stage = {}
        if iso_date and iso_date not in ["All", "All Dates", "all", ""]:
            match_stage["date"] = iso_date
        if department and department not in ["All", "all", ""]:
            match_stage["department"] = department
        if session and session not in ["All", "all", ""]:
            match_stage["session"] = session
        if search:
            match_stage["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"registerNo": {"$regex": search, "$options": "i"}}
            ]
            
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
        
        if year and year not in ["All", "all", "All Years", ""]:
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
            
        if section and section not in ["All", "all", "All Classes", ""]:
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
            
        pipeline.append({
            "$sort": {"date": -1}
        })

        now = get_ist_now()
        today_str = now.strftime("%Y-%m-%d")
        decimal_time = now.hour + now.minute / 60.0 + now.second / 3600.0

        async for doc in attendance_coll.aggregate(pipeline):
            student_info = doc.get("student_info") or {}
            student_year = student_info.get("year", "---")
            raw_date = doc.get("date", "---")
            day_name = doc.get("day")

            if is_holiday_date(raw_date, day_name):
                continue

            if (not day_name or day_name == "---") and raw_date and raw_date != "---":
                try:
                    dt = datetime.strptime(raw_date, "%Y-%m-%d")
                    day_name = dt.strftime("%A")
                except Exception:
                    day_name = "---"

            m_sess = doc.get("morningSession")
            a_sess = doc.get("afternoonSession")
            st = doc.get("status", "---")

            if raw_date == today_str and st == "---":
                if decimal_time < 9.5 and not m_sess:
                    m_sess = "---"
                if decimal_time < 14.25 and not a_sess:
                    a_sess = "---"

            m_disp = m_sess or ("Present" if st == "Present" else "Absent")
            a_disp = a_sess or ("Present" if st == "Present" else "Absent")

            if m_disp == "Present" and a_disp == "Present":
                gen_status = "Present"
            elif m_disp == "Present" and a_disp == "Absent":
                gen_status = "P/A"
            elif m_disp == "Absent" and a_disp == "Present":
                gen_status = "A/P"
            elif m_disp == "Absent" and a_disp == "Absent":
                gen_status = "Absent"
            else:
                gen_status = st if st not in ["---", ""] else "Absent"

            if status and status not in ["All", "all", ""]:
                if status.lower() == "present" and gen_status != "Present":
                    continue
                elif status.lower() == "absent" and gen_status != "Absent":
                    continue

            data_list.append({
                "Date": format_date_ddmmyyyy(raw_date),
                "Day": day_name or "---",
                "Register No": doc.get("registerNo", "---"),
                "Student Name": doc.get("name", "---"),
                "Year": student_year,
                "Section": doc.get("section", "A"),
                "Department": doc.get("department", "Computer Science & Engineering"),
                "Morning Session": m_disp,
                "Afternoon Session": a_disp,
                "General Status": gen_status,
                "Time": doc.get("time", "---")
            })

        columns = [
            "Date", "Day", "Register No", "Student Name", "Year", "Section",
            "Department", "Morning Session", "Afternoon Session", "General Status", "Time"
        ]

    target_student_name = None
    if search and search.strip():
        s_clean = search.strip()
        single_student = await student_coll.find_one({
            "$or": [
                {"name": {"$regex": f"^{re.escape(s_clean)}$", "$options": "i"}},
                {"registerNo": s_clean},
                {"rollNo": s_clean}
            ]
        })
        if single_student:
            target_student_name = single_student.get("name")
            if not year or year in ["All", "all", "All Years", ""]:
                year = single_student.get("year")
            if not section or section in ["All", "all", "All Classes", ""]:
                section = single_student.get("section") or single_student.get("class")

    if not target_student_name and data_list:
        unique_regs = set(r.get("Register No") for r in data_list if r.get("Register No") and r.get("Register No") != "---")
        if len(unique_regs) == 1:
            first_row = data_list[0]
            target_student_name = first_row.get("Student Name")
            if (not year or year in ["All", "all", "All Years", ""]) and first_row.get("Year") != "---":
                year = first_row.get("Year")
            if (not section or section in ["All", "all", "All Classes", ""]) and first_row.get("Section") != "---":
                section = first_row.get("Section")

    df = pd.DataFrame(data_list)
    if df.empty:
        df = pd.DataFrame(columns=columns)

    filename = build_meaningful_filename(
        year=year,
        section=section,
        date=date,
        from_date=fromDate,
        to_date=toDate,
        ext="csv" if type == "csv" else ("pdf" if type == "pdf" else "xlsx"),
        student_name=target_student_name
    )

    response_headers = {
        "Content-Disposition": f'attachment; filename="{filename}"; filename*=UTF-8\'\'{quote(filename)}',
        "Access-Control-Expose-Headers": "Content-Disposition, content-disposition"
    }

    try:
        if type == "csv":
            csv_data = df.to_csv(index=False).encode('utf-8')
            return Response(
                content=csv_data,
                media_type="text/csv",
                headers=response_headers
            )

        elif type == "excel":
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name="Attendance")
            excel_bytes = output.getvalue()
            return Response(
                content=excel_bytes,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers=response_headers
            )

        elif type == "pdf":
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                buffer,
                pagesize=landscape(letter),
                rightMargin=20, leftMargin=20, topMargin=20, bottomMargin=20
            )
            elements = []

            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                'TitleStyle',
                parent=styles['Heading1'],
                fontSize=16,
                leading=20,
                textColor=colors.HexColor('#1e293b'),
                alignment=1,
                spaceAfter=15
            )
            elements.append(Paragraph(title, title_style))

            meta_parts = [f"Export Date: {get_ist_now().strftime('%Y-%m-%d %H:%M:%S')}"]
            if target_student_name:
                meta_parts.append(f"Student: {target_student_name}")
            if year and year not in ["All", "All Years", "all"]:
                meta_parts.append(f"Year: {year}")
            if section and section not in ["All", "All Classes", "all"]:
                meta_parts.append(f"Class: {section}")

            meta_text = " | ".join(meta_parts)

            meta_style = ParagraphStyle(
                'MetaStyle',
                parent=styles['Normal'],
                fontSize=9,
                textColor=colors.HexColor('#64748b'),
                alignment=1,
                spaceAfter=15
            )
            elements.append(Paragraph(meta_text, meta_style))

            if not df.empty:
                table_data = [df.columns.tolist()] + df.values.tolist()
                cell_style = ParagraphStyle('Cell', fontSize=8, leading=10, textColor=colors.HexColor('#334155'))
                header_style = ParagraphStyle('Header', fontSize=8, leading=10, fontName='Helvetica-Bold', textColor=colors.white)

                formatted_table_data = []
                for row_idx, row in enumerate(table_data):
                    formatted_row = []
                    for cell in row:
                        cell_str = str(cell)
                        if row_idx == 0:
                            formatted_row.append(Paragraph(cell_str, header_style))
                        else:
                            formatted_row.append(Paragraph(cell_str, cell_style))
                    formatted_table_data.append(formatted_row)

                t = Table(formatted_table_data, repeatRows=1)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3b82f6')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
                    ('TOPPADDING', (0, 0), (-1, 0), 6),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')])
                ]))
                elements.append(t)
            else:
                no_data_style = ParagraphStyle(
                    'NoDataStyle',
                    parent=styles['Normal'],
                    fontSize=11,
                    textColor=colors.HexColor('#64748b'),
                    alignment=1,
                    spaceBefore=20
                )
                elements.append(Paragraph("No attendance records found matching the selected filters.", no_data_style))

            doc.build(elements)
            pdf_bytes = buffer.getvalue()
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers=response_headers
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {type}")
    except Exception as err:
        logger.error(f"Error generating report file: {err}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Report generation error: {str(err)}")


@router.get("/stats")
async def get_reports_stats(
    year: Optional[str] = Query("All"),
    section: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    session: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_admin: dict = Depends(auth.get_current_admin)
):
    await cleanup_holiday_records()
    student_coll = get_students_collection()
    attendance_coll = get_attendance_collection()
    
    year = year if isinstance(year, str) else None
    section = section if isinstance(section, str) else None
    date = date if isinstance(date, str) else None
    session = session if isinstance(session, str) else None
    status = status if isinstance(status, str) else None

    scope = auth.get_admin_scope(current_admin, year, section)
    if scope["is_restricted"]:
        year = scope["year"]
        section = scope["section"]

    selected_year = year if year and year not in ["All", "all", "All Years", ""] else "All"
    selected_section = section if section and section not in ["All", "all", "All Classes", ""] else "All"
    
    iso_date = date
    if date and date not in ["All", "All Dates", "all", ""]:
        if "/" in date:
            parts = date.split("/")
            if len(parts) == 3 and len(parts[2]) == 4:
                iso_date = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
                
    if iso_date:
        await check_and_finalize_sessions(iso_date)
    else:
        today_str = get_ist_now().strftime("%Y-%m-%d")
        await check_and_finalize_sessions(today_str)

    scoped_reg_nos = await get_scoped_student_register_nos(scope)

    students_cursor = student_coll.find({})
    student_list = []
    async for st in students_cursor:
        student_list.append(st)

    active_resets = await get_active_resets_list()
    student_reset_map = {}
    for st in student_list:
        reg = st.get("registerNo")
        if reg:
            latest_reset = get_latest_reset_for_student(st, active_resets)
            student_reset_map[reg] = latest_reset

    def student_matches_year(st, yr_target):
        if yr_target == "All":
            return True
        st_yr = str(st.get("year") or st.get("academicYear") or "").strip().lower()
        target_yr = str(yr_target).strip().lower()
        if st_yr == target_yr:
            return True
        s_num = re.search(r'\d+', st_yr)
        t_num = re.search(r'\d+', target_yr)
        if s_num and t_num and s_num.group(0) == t_num.group(0):
            return True
        return False

    def section_matches_class(sec_str, cls_name):
        if not sec_str or not cls_name:
            return False
        sec = str(sec_str).strip().upper()
        cls = str(cls_name).strip().upper()
        if sec == cls:
            return True
        sec_clean = sec.replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()
        cls_clean = cls.replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()
        return sec_clean == cls_clean

    def student_matches_filters(st):
        if scope["is_restricted"]:
            return bool(scoped_reg_nos is not None and st.get("registerNo") in scoped_reg_nos)
        else:
            if selected_year != "All" and not student_matches_year(st, selected_year):
                return False
            if selected_section != "All":
                st_sec = st.get("section") or st.get("class") or st.get("className") or ""
                if not section_matches_class(st_sec, selected_section):
                    return False
            return True

    filtered_students = [s for s in student_list if student_matches_filters(s)]
    filtered_reg_nos = set(s.get("registerNo") for s in filtered_students if s.get("registerNo"))

    query_match = {}
    if iso_date and iso_date not in ["All", "All Dates", "all", ""]:
        query_match["date"] = iso_date
    if session and session not in ["All", "All Sessions", "all", ""]:
        query_match["session"] = session

    attendance_cursor = attendance_coll.find(query_match)
    valid_attendance_docs = []

    async for doc in attendance_cursor:
        if is_holiday_date(doc.get("date"), doc.get("day")):
            continue

        doc_reg = doc.get("registerNo")
        if not doc_reg:
            continue

        reset_doc = student_reset_map.get(doc_reg)
        if not is_record_after_reset(doc, reset_doc):
            continue

        doc_reg = doc.get("registerNo")
        doc_sec = (doc.get("section") or doc.get("class") or "").strip()
        doc_year = (doc.get("year") or "").strip()

        if scope["is_restricted"]:
            if doc_reg not in scoped_reg_nos:
                continue
        else:
            if selected_year != "All":
                if doc_reg and doc_reg not in filtered_reg_nos:
                    if not student_matches_year({"year": doc_year}, selected_year):
                        continue
            if selected_section != "All":
                if not section_matches_class(doc_sec, selected_section):
                    continue

        doc_status = doc.get("status", "")
        m_sess = doc.get("morningSession")
        a_sess = doc.get("afternoonSession")

        if doc_status in ["Present", "P/A", "A/P"] or m_sess == "Present" or a_sess == "Present":
            is_present = True
        elif doc_status == "Absent":
            is_present = False
        else:
            is_present = False

        if status and status not in ["All", "All Statuses", "all", ""]:
            stat_norm = status.strip().lower()
            if stat_norm == "present" and not is_present:
                continue
            elif stat_norm == "absent" and is_present:
                continue

        valid_attendance_docs.append({
            "id": str(doc["_id"]),
            "name": doc.get("name"),
            "registerNo": doc_reg,
            "section": doc_sec,
            "year": doc_year,
            "date": doc.get("date"),
            "day": doc.get("day"),
            "session": doc.get("session"),
            "status": doc_status,
            "isPresent": is_present
        })

    total_students_count = len(filtered_students)
    unique_dates = set(d["date"] for d in valid_attendance_docs if d.get("date"))
    num_dates = max(1, len(unique_dates))
    unique_present_pairs = set((d["registerNo"], d["date"]) for d in valid_attendance_docs if d.get("isPresent") and d.get("registerNo") and d.get("date"))
    present_scans = len(unique_present_pairs)
    total_attendance_scans = len(valid_attendance_docs)
    total_expected = total_students_count * num_dates
    absent_scans = max(0, total_expected - present_scans)

    has_attendance_data = (total_attendance_scans > 0)
    overall_rate = round((present_scans / total_expected) * 100, 2) if (has_attendance_data and total_expected > 0) else 0.0

    cse_classes_map = {
        "1st Year": ["CSE A", "CSE B", "CSE C", "CSE D", "CSE E"],
        "2nd Year": ["CSE A", "CSE B", "CSE C", "CSE D", "CSE E"],
        "3rd Year": ["CSE A", "CSE B", "CSE C", "CSE D"],
        "4th Year": ["CSE A", "CSE B", "CSE C"]
    }

    colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']
    class_stats = []

    if scope["is_restricted"]:
        # Only show stats for the single assigned class
        cls_students = filtered_students
        cls_att = valid_attendance_docs
        cls_scans = len(cls_att)
        cls_present_regs = set(d["registerNo"] for d in cls_att if d["isPresent"])
        cls_presents = len(cls_present_regs)
        cls_student_count = len(cls_students)
        cls_absents = max(0, cls_student_count - cls_presents)
        cls_has_data = (cls_scans > 0)
        cls_rate = round((cls_presents / cls_student_count) * 100, 1) if (cls_has_data and cls_student_count > 0) else 0.0

        class_stats.append({
            "name": f"{scope['year']} {scope['section']}",
            "rate": cls_rate,
            "hasData": cls_has_data,
            "studentCount": cls_student_count,
            "totalScans": cls_scans,
            "presentCount": cls_presents,
            "absentCount": cls_absents,
            "color": colors[0]
        })
    elif selected_year in cse_classes_map:
        target_classes = cse_classes_map[selected_year]
        if selected_section != "All":
            target_classes = [c for c in target_classes if section_matches_class(c, selected_section)]

        for idx, cls in enumerate(target_classes):
            cls_students = [s for s in filtered_students if section_matches_class(s.get("section") or s.get("class"), cls)]
            cls_att = [d for d in valid_attendance_docs if section_matches_class(d.get("section"), cls)]
            
            cls_scans = len(cls_att)
            cls_present_regs = set(d["registerNo"] for d in cls_att if d["isPresent"])
            cls_presents = len(cls_present_regs)
            cls_student_count = len(cls_students)
            cls_absents = max(0, cls_student_count - cls_presents)
            cls_has_data = (cls_scans > 0)
            cls_rate = round((cls_presents / cls_student_count) * 100, 1) if (cls_has_data and cls_student_count > 0) else 0.0

            class_stats.append({
                "name": cls,
                "rate": cls_rate,
                "hasData": cls_has_data,
                "studentCount": len(cls_students),
                "totalScans": cls_scans,
                "presentCount": cls_presents,
                "absentCount": cls_absents,
                "color": colors[idx % len(colors)]
            })
    else:
        # All Years
        color_idx = 0
        for yr, classes in cse_classes_map.items():
            yr_students = [s for s in student_list if student_matches_year(s, yr)]
            yr_reg_nos = set(s.get("registerNo") for s in yr_students if s.get("registerNo"))
            
            target_cls = classes
            if selected_section != "All":
                target_cls = [c for c in classes if section_matches_class(c, selected_section)]

            for cls in target_cls:
                cls_students = [s for s in yr_students if section_matches_class(s.get("section") or s.get("class"), cls)]
                cls_att = [
                    d for d in valid_attendance_docs 
                    if section_matches_class(d.get("section"), cls) and (d.get("registerNo") in yr_reg_nos or student_matches_year({"year": d.get("year")}, yr))
                ]
                
                cls_scans = len(cls_att)
                cls_present_regs = set(d["registerNo"] for d in cls_att if d["isPresent"])
                cls_presents = len(cls_present_regs)
                cls_student_count = len(cls_students)
                cls_absents = max(0, cls_student_count - cls_presents)
                cls_has_data = (cls_scans > 0)
                cls_rate = round((cls_presents / cls_student_count) * 100, 1) if (cls_has_data and cls_student_count > 0) else 0.0

                label_name = f"{yr.split()[0]} {cls}"
                class_stats.append({
                    "name": label_name,
                    "rate": cls_rate,
                    "hasData": cls_has_data,
                    "studentCount": len(cls_students),
                    "totalScans": cls_scans,
                    "presentCount": cls_presents,
                    "absentCount": cls_absents,
                    "color": colors[color_idx % len(colors)]
                })
                color_idx += 1

    scanned_classes = [c for c in class_stats if c["hasData"]]
    if scanned_classes:
        top_cls_obj = max(scanned_classes, key=lambda x: x["rate"])
        low_cls_obj = min(scanned_classes, key=lambda x: x["rate"])
        top_dept = {"name": top_cls_obj["name"], "rate": top_cls_obj["rate"], "hasData": True}
        low_dept = {"name": low_cls_obj["name"], "rate": low_cls_obj["rate"], "hasData": True}
    else:
        top_dept = {"name": "No Data Yet", "rate": 0.0, "hasData": False}
        low_dept = {"name": "No Data Yet", "rate": 0.0, "hasData": False}

    month_groups = {}
    month_names = {
        "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun",
        "07": "Jul", "08": "Aug", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec"
    }

    for d in valid_attendance_docs:
        d_date = d.get("date", "")
        if d_date and len(d_date) >= 7 and d_date[4] == "-":
            ym = d_date[:7]
            if ym not in month_groups:
                month_groups[ym] = {"total": 0, "present": 0}
            month_groups[ym]["total"] += 1
            if d["isPresent"]:
                month_groups[ym]["present"] += 1

    monthly_aggregates = []
    for ym in sorted(month_groups.keys()):
        month_code = ym[5:7]
        m_name = month_names.get(month_code, ym)
        tot = month_groups[ym]["total"]
        pres = month_groups[ym]["present"]
        rate = round((pres / tot) * 100, 1) if tot > 0 else 0.0
        monthly_aggregates.append({"month": m_name, "rate": rate})

    m_tot = sum(1 for d in valid_attendance_docs if d.get("session") == "Morning")
    m_pres = sum(1 for d in valid_attendance_docs if d.get("session") == "Morning" and d["isPresent"])
    a_tot = sum(1 for d in valid_attendance_docs if d.get("session") == "Afternoon")
    a_pres = sum(1 for d in valid_attendance_docs if d.get("session") == "Afternoon" and d["isPresent"])

    m_rate = round((m_pres / m_tot) * 100, 1) if m_tot > 0 else 0.0
    a_rate = round((a_pres / a_tot) * 100, 1) if a_tot > 0 else 0.0

    return {
        "overallRate": overall_rate,
        "totalStudents": total_students_count,
        "totalAttendanceScans": total_attendance_scans,
        "presentScans": present_scans,
        "absentScans": absent_scans,
        "hasAttendanceData": has_attendance_data,
        "topDepartment": top_dept,
        "lowDepartment": low_dept,
        "monthlyAggregates": monthly_aggregates,
        "departmentComparison": class_stats,
        "morningStats": {
            "total": m_tot,
            "present": m_pres,
            "rate": m_rate
        },
        "afternoonStats": {
            "total": a_tot,
            "present": a_pres,
            "rate": a_rate
        }
    }


class LeaveLetterStatusUpdate(BaseModel):
    status: str
    adminResponse: Optional[str] = ""

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

def format_date_ddmmyyyy_full_rep(date_str: Optional[str]) -> str:
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

async def get_scoped_student_register_nos(scope: dict) -> Optional[set]:
    if not scope["is_restricted"]:
        return None
    student_coll = get_students_collection()
    sec_raw = str(scope.get("section") or scope.get("class") or "").strip()
    yr_raw = str(scope.get("year") or "").strip()
    sec_clean = sec_raw.replace("CSE ", "").replace("Class ", "").strip()
    sec_regex = f"^(CSE\\s*)?{re.escape(sec_clean)}$" if sec_clean else ".*"
    query = {
        "year": {"$regex": f"^{re.escape(yr_raw)}$", "$options": "i"},
        "section": {"$regex": sec_regex, "$options": "i"}
    }
    reg_nos = set()
    async for s in student_coll.find(query, {"registerNo": 1}):
        r = s.get("registerNo")
        if r:
            reg_nos.add(r)
    return reg_nos


@router.get("/leave-letters")
async def get_admin_leave_letters(current_admin = Depends(auth.get_current_admin)):
    scope = auth.get_admin_scope(current_admin)
    if not scope["is_restricted"]:
        return []

    scoped_reg_nos = await get_scoped_student_register_nos(scope)

    letters_coll = get_leave_letters_collection()
    cursor = letters_coll.find({})
    result = []
    async for doc in cursor:
        reg_no = doc.get("registerNo", "")
        doc_yr = doc.get("year", "")
        doc_sec = doc.get("section", "")
        
        if scoped_reg_nos is not None:
            in_reg = reg_no in scoped_reg_nos
            sec_clean = str(scope.get("section") or scope.get("class") or "").replace("CSE ", "").replace("Class ", "").strip().upper()
            doc_sec_clean = str(doc_sec or "").replace("CSE ", "").replace("Class ", "").strip().upper()
            y_scope_num = "".join(filter(str.isdigit, str(scope.get("year") or "")))
            y_doc_num = "".join(filter(str.isdigit, str(doc_yr or "")))
            in_class = bool((y_scope_num and y_doc_num and y_scope_num == y_doc_num) and (sec_clean and doc_sec_clean and sec_clean == doc_sec_clean))
            if not (in_reg or in_class):
                continue

        raw_ld = doc.get("leaveDate") or doc.get("fromDate", "---")
        att_pct = doc.get("attendancePercentage")
        if att_pct is None and reg_no and reg_no != "---":
            try:
                att_pct = await calculate_student_attendance_percentage(reg_no)
            except Exception:
                att_pct = None
        elif att_pct is not None:
            try:
                att_pct = round(float(att_pct), 2)
            except Exception:
                pass

        is_low_att = doc.get("isLowAttendance")
        if is_low_att is None and att_pct is not None:
            is_low_att = (att_pct < 75.0)

        result.append({
            "_id": doc.get("_id"),
            "id": str(doc["_id"]),
            "studentId": doc.get("studentId", ""),
            "name": doc.get("name", "---"),
            "registerNo": doc.get("registerNo", "---"),
            "rollNo": doc.get("rollNo", "---"),
            "department": doc.get("department", "---"),
            "year": doc.get("year", "---"),
            "section": doc.get("section", "---"),
            "leaveDate": format_date_ddmmyyyy_full_rep(raw_ld),
            "fromDate": format_date_ddmmyyyy_full_rep(doc.get("fromDate", raw_ld)),
            "toDate": format_date_ddmmyyyy_full_rep(doc.get("toDate", raw_ld)),
            "rawLeaveDate": raw_ld,
            "reason": doc.get("reason", "---"),
            "letterContent": doc.get("letterContent", "---"),
            "status": doc.get("status", "PENDING"),
            "attendancePercentage": att_pct,
            "isLowAttendance": is_low_att,
            "adminResponse": doc.get("adminResponse", ""),
            "created_at": doc.get("created_at", ""),
            "submittedAt": doc.get("submittedAt", "")
        })

    result.sort(key=parse_submission_datetime, reverse=True)
    return result

@router.post("/leave-letters/{letter_id}/status")
async def update_leave_letter_status(
    letter_id: str,
    payload: LeaveLetterStatusUpdate,
    current_admin = Depends(auth.get_current_admin)
):
    scope = auth.get_admin_scope(current_admin)
    if not scope["is_restricted"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Main Admin cannot approve or reject leave letters. Only assigned Class Teachers can process leave letters."
        )

    scoped_reg_nos = await get_scoped_student_register_nos(scope)

    letters_coll = get_leave_letters_collection()
    
    doc = None
    try:
        doc = await letters_coll.find_one({"_id": ObjectId(letter_id)})
    except Exception:
        pass
    if not doc:
        doc = await letters_coll.find_one({"_id": letter_id})
        
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave letter record not found."
        )

    if scoped_reg_nos is not None:
        reg_no = doc.get("registerNo", "")
        doc_yr = doc.get("year", "")
        doc_sec = doc.get("section", "")
        in_reg = reg_no in scoped_reg_nos
        sec_clean = str(scope.get("section") or scope.get("class") or "").replace("CSE ", "").replace("Class ", "").strip().upper()
        doc_sec_clean = str(doc_sec or "").replace("CSE ", "").replace("Class ", "").strip().upper()
        y_scope_num = "".join(filter(str.isdigit, str(scope.get("year") or "")))
        y_doc_num = "".join(filter(str.isdigit, str(doc_yr or "")))
        in_class = bool((y_scope_num and y_doc_num and y_scope_num == y_doc_num) and (sec_clean and doc_sec_clean and sec_clean == doc_sec_clean))
        if not (in_reg or in_class):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not have permission to manage leave letters outside your assigned class."
            )

    new_status = payload.status.upper()
    if new_status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be APPROVED or REJECTED."
        )

    admin_resp = (payload.adminResponse or "").strip()
    if new_status == "REJECTED" and not admin_resp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rejection reason is required when rejecting a leave letter."
        )

    await letters_coll.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "status": new_status,
                "adminResponse": admin_resp,
                "rejectionReason": admin_resp,
                "processed_at": get_ist_now().strftime("%Y-%m-%d %I:%M %p")
            }
        }
    )

    notif_coll = get_notifications_collection()
    formatted_d = format_date_ddmmyyyy_full_rep(doc.get("leaveDate"))
    reg_no = doc.get("registerNo")
    
    if new_status == "REJECTED":
        msg = f"Your Leave Letter was rejected. Reason: {admin_resp}"
    else:
        msg = f"Your Leave Letter for {formatted_d} has been approved."

    await notif_coll.insert_one({
        "recipient": reg_no,
        "type": "leave_letter_update",
        "title": f"Leave Letter {new_status.capitalize()}",
        "message": msg,
        "read": False,
        "created_at": get_ist_now().strftime("%Y-%m-%d %I:%M %p"),
        "time": "Just now",
        "studentRegisterNo": reg_no
    })

    return {
        "success": True,
        "message": f"Leave letter status updated to {new_status}.",
        "status": new_status,
        "adminResponse": admin_resp
    }

@router.get("/admin-notifications")
async def get_admin_notifications(current_admin = Depends(auth.get_current_admin)):
    scope = auth.get_admin_scope(current_admin)
    is_hod = not scope["is_restricted"]

    notif_coll = get_notifications_collection()
    cursor = notif_coll.find({"recipient": "admin"}).sort("created_at", -1)
    result = []
    
    admin_email = (current_admin.get("email") or "").lower().strip()
    admin_year = current_admin.get("year", "")
    admin_sec = current_admin.get("section") or current_admin.get("class") or ""

    async for doc in cursor:
        notif_type = str(doc.get("type", "")).lower()
        title_lower = str(doc.get("title", "")).lower()
        is_leave_notif = notif_type in ["leave_application", "leave_letter", "low_attendance_leave", "cancelled_leave"] or "leave" in notif_type or "leave" in title_lower
        
        if is_hod:
            # Main Admin / HOD MUST NOT receive ANY Leave Request, Leave Letter, or Low Attendance notification
            if is_leave_notif:
                continue
        else:
            # Class Advisor receives notification ONLY if it matches their exact Year + Class
            target_em = (doc.get("target_advisor_email") or "").lower().strip()
            if target_em and target_em != admin_email:
                continue

            doc_yr = doc.get("year", "")
            doc_sec = doc.get("section") or doc.get("class") or ""
            
            if not auth.match_year_and_class(doc_yr, doc_sec, admin_year, admin_sec):
                continue

        result.append({
            "id": str(doc["_id"]),
            "type": doc.get("type", "leave_letter"),
            "title": doc.get("title", "Notification"),
            "message": doc.get("message", ""),
            "read": doc.get("read", False),
            "created_at": doc.get("created_at", ""),
            "submittedAt": doc.get("submittedAt", ""),
            "time": doc.get("time", "Just now"),
            "studentRegisterNo": doc.get("studentRegisterNo", "")
        })
    result.sort(key=parse_submission_datetime, reverse=True)
    return result

@router.put("/admin-notifications/read-all")
async def mark_admin_notifications_read(current_admin = Depends(auth.get_current_admin)):
    scope = auth.get_admin_scope(current_admin)
    is_hod = not scope["is_restricted"]
    notif_coll = get_notifications_collection()

    if is_hod:
        # Mark non-leave notifications as read for Main Admin
        await notif_coll.update_many(
            {
                "recipient": "admin",
                "type": {"$nin": ["leave_application", "leave_letter", "low_attendance_leave", "cancelled_leave"]}
            },
            {"$set": {"read": True}}
        )
    else:
        admin_email = (current_admin.get("email") or "").lower().strip()
        admin_year = current_admin.get("year", "")
        admin_sec = current_admin.get("section") or current_admin.get("class") or ""

        async for doc in notif_coll.find({"recipient": "admin", "read": False}):
            target_em = (doc.get("target_advisor_email") or "").lower().strip()
            if target_em and target_em != admin_email:
                continue
            doc_yr = doc.get("year", "")
            doc_sec = doc.get("section") or doc.get("class") or ""
            if auth.match_year_and_class(doc_yr, doc_sec, admin_year, admin_sec):
                await notif_coll.update_one({"_id": doc["_id"]}, {"$set": {"read": True}})

    return {"success": True, "message": "All admin notifications marked as read."}

@router.get("/all-leaves")
async def get_admin_all_leaves(current_admin = Depends(auth.get_current_admin)):
    scope = auth.get_admin_scope(current_admin)
    if not scope["is_restricted"]:
        # Main Admin sees 0 Leave Applications in their request list
        return []

    scoped_reg_nos = await get_scoped_student_register_nos(scope)

    from backend.db import get_leaves_collection
    leaves_coll = get_leaves_collection()
    cursor = leaves_coll.find({}).sort("created_at", -1)
    result = []
    async for doc in cursor:
        reg_no = doc.get("registerNo", "")
        doc_yr = doc.get("year", "")
        doc_sec = doc.get("section", "")

        if scoped_reg_nos is not None:
            in_reg = reg_no in scoped_reg_nos
            sec_clean = scope["section"].replace("CSE ", "").replace("Class ", "").strip().upper()
            doc_sec_clean = doc_sec.replace("CSE ", "").replace("Class ", "").strip().upper()
            y_scope_num = "".join(filter(str.isdigit, scope["year"]))
            y_doc_num = "".join(filter(str.isdigit, doc_yr))
            in_class = (y_scope_num and y_doc_num and y_scope_num == y_doc_num) and (sec_clean and doc_sec_clean and sec_clean == doc_sec_clean)
            if not (in_reg or in_class):
                continue

        d_date = doc.get("date") or doc.get("fromDate", "---")
        att_pct = doc.get("attendancePercentage")
        if att_pct is None and reg_no and reg_no != "---":
            try:
                att_pct = await calculate_student_attendance_percentage(reg_no)
            except Exception:
                att_pct = None
        elif att_pct is not None:
            try:
                att_pct = round(float(att_pct), 2)
            except Exception:
                pass

        is_low_att = doc.get("isLowAttendance")
        if is_low_att is None and att_pct is not None:
            is_low_att = (att_pct < 75.0)

        result.append({
            "id": str(doc["_id"]),
            "registerNo": doc.get("registerNo", "---"),
            "name": doc.get("name", "---"),
            "department": doc.get("department", "---"),
            "year": doc.get("year", "---"),
            "section": doc.get("section", "---"),
            "date": format_date_ddmmyyyy_full_rep(d_date),
            "fromDate": format_date_ddmmyyyy_full_rep(doc.get("fromDate", d_date)),
            "toDate": format_date_ddmmyyyy_full_rep(doc.get("toDate", d_date)),
            "rawDate": d_date,
            "reason": doc.get("reason", "---"),
            "status": str(doc.get("status", "PENDING")).upper(),
            "attendancePercentage": att_pct,
            "isLowAttendance": is_low_att,
            "created_at": doc.get("created_at", ""),
            "submittedAt": doc.get("submittedAt", ""),
            "cancelled_at": doc.get("cancelled_at", "")
        })
    result.sort(key=parse_submission_datetime, reverse=True)
    return result

@router.post("/leaves/{leave_id}/status")
async def update_admin_leave_status(
    leave_id: str,
    payload: LeaveLetterStatusUpdate,
    current_admin = Depends(auth.get_current_admin)
):
    scope = auth.get_admin_scope(current_admin)
    if not scope["is_restricted"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Main Admin cannot approve or reject leave requests. Only assigned Class Teachers can process leave requests."
        )

    scoped_reg_nos = await get_scoped_student_register_nos(scope)

    from backend.db import get_leaves_collection
    leaves_coll = get_leaves_collection()
    
    doc = None
    try:
        doc = await leaves_coll.find_one({"_id": ObjectId(leave_id)})
    except Exception:
        pass
    if not doc:
        doc = await leaves_coll.find_one({"_id": leave_id})
        
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request record not found."
        )

    if scoped_reg_nos is not None:
        reg_no = doc.get("registerNo", "")
        doc_yr = doc.get("year", "")
        doc_sec = doc.get("section", "")
        in_reg = reg_no in scoped_reg_nos
        sec_clean = str(scope.get("section") or scope.get("class") or "").replace("CSE ", "").replace("Class ", "").strip().upper()
        doc_sec_clean = str(doc_sec or "").replace("CSE ", "").replace("Class ", "").strip().upper()
        y_scope_num = "".join(filter(str.isdigit, str(scope.get("year") or "")))
        y_doc_num = "".join(filter(str.isdigit, str(doc_yr or "")))
        in_class = bool((y_scope_num and y_doc_num and y_scope_num == y_doc_num) and (sec_clean and doc_sec_clean and sec_clean == doc_sec_clean))
        if not (in_reg or in_class):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not have permission to modify leave requests outside your assigned class."
            )

    new_status = payload.status.upper()
    if new_status not in ["APPROVED", "REJECTED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be APPROVED or REJECTED."
        )

    admin_resp = (payload.adminResponse or "").strip()
    if new_status == "REJECTED" and not admin_resp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rejection reason is required when rejecting a leave request."
        )

    await leaves_coll.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "status": new_status,
                "adminResponse": admin_resp,
                "rejectionReason": admin_resp,
                "processed_at": get_ist_now().strftime("%Y-%m-%d %I:%M %p")
            }
        }
    )

    notif_coll = get_notifications_collection()
    formatted_d = format_date_ddmmyyyy_full_rep(doc.get("date") or doc.get("fromDate"))
    reg_no = doc.get("registerNo")
    
    if new_status == "REJECTED":
        msg = f"Your Leave Request was rejected. Reason: {admin_resp}"
    else:
        msg = f"Your Leave Application for {formatted_d} has been approved."

    await notif_coll.insert_one({
        "recipient": reg_no,
        "type": "leave_update",
        "title": f"Leave Request {new_status.capitalize()}",
        "message": msg,
        "read": False,
        "created_at": get_ist_now().strftime("%Y-%m-%d %I:%M %p"),
        "time": "Just now",
        "studentRegisterNo": reg_no
    })

    return {
        "success": True,
        "message": f"Leave application status updated to {new_status}.",
        "status": new_status,
        "adminResponse": admin_resp
    }
