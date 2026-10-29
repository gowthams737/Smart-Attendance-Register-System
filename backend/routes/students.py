import os
import shutil
import logging
import re
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, File, UploadFile, Form, HTTPException, status, Query, Depends
from bson import ObjectId

from backend.db import get_students_collection
from backend.models import StudentCreate, StudentUpdate, StudentResponse
from backend.config import DATASET_DIR
from backend.routes.auth import get_current_admin, get_admin_scope

router = APIRouter(prefix="/students", tags=["students"])
logger = logging.getLogger("smart_attendance")

def serialize_student(doc) -> dict:
    if not doc:
        return {}
    doc["id"] = str(doc.get("_id", ""))
    if "_id" in doc:
        del doc["_id"]

    # Field Normalization for MongoDB documents with variant key names
    if not doc.get("registerNo"):
        doc["registerNo"] = str(doc.get("registerNumber") or doc.get("register_no") or doc.get("regNo") or "")
    if not doc.get("rollNo"):
        doc["rollNo"] = str(doc.get("roll_no") or doc.get("rollNumber") or "")
    if not doc.get("name"):
        doc["name"] = str(doc.get("studentName") or doc.get("full_name") or "")
    if not doc.get("section"):
        doc["section"] = str(doc.get("class") or doc.get("className") or doc.get("sectionName") or "A")
    if not doc.get("year"):
        doc["year"] = str(doc.get("academicYear") or "3rd Year")
    if not doc.get("department"):
        doc["department"] = str(doc.get("dept") or "Computer Science & Engineering")
    if not doc.get("gender"):
        doc["gender"] = str(doc.get("sex") or "Not Specified")
    if not doc.get("createdDate"):
        doc["createdDate"] = "---"
    if not doc.get("createdTime"):
        doc["createdTime"] = "---"

    return doc

def check_student_scope_permission(student_doc: dict, scope: dict):
    if not scope["is_restricted"]:
        return
    s_year = student_doc.get("year") or ""
    s_sec = student_doc.get("section") or student_doc.get("class") or ""
    
    sec_clean = scope["section"].replace("CSE ", "").replace("Class ", "").strip().upper()
    s_sec_clean = s_sec.replace("CSE ", "").replace("Class ", "").strip().upper()

    y_num_scope = "".join(filter(str.isdigit, scope["year"]))
    y_num_student = "".join(filter(str.isdigit, s_year))

    if (y_num_scope and y_num_student and y_num_scope != y_num_student) or (sec_clean and s_sec_clean and sec_clean != s_sec_clean):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Forbidden: Access restricted to your assigned class ({scope['year']} {scope['section']})."
        )

@router.get("", response_model=List[StudentResponse])
async def get_students(
    search: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    year: Optional[str] = Query(None),
    section: Optional[str] = Query(None),
    current_admin: dict = Depends(get_current_admin)
):
    scope = get_admin_scope(current_admin, year, section)

    query_parts = []
    
    if search:
        search_clean = search.strip()
        query_parts.append({
            "$or": [
                {"name": {"$regex": search_clean, "$options": "i"}},
                {"registerNo": {"$regex": search_clean, "$options": "i"}},
                {"rollNo": {"$regex": search_clean, "$options": "i"}},
                {"email": {"$regex": search_clean, "$options": "i"}}
            ]
        })
        
    if department and department not in ["All", "all", "All Departments", ""] and not scope["is_restricted"]:
        query_parts.append({"department": department})

    if scope["is_restricted"]:
        # Class Teacher: FORCE assigned year & section
        y_num = "".join(filter(str.isdigit, scope["year"]))
        if y_num:
            year_regex = f"^{y_num}(st|nd|rd|th)?(\\s*Year)?$"
            query_parts.append({
                "$or": [
                    {"year": scope["year"]},
                    {"year": {"$regex": year_regex, "$options": "i"}}
                ]
            })
        else:
            query_parts.append({"year": scope["year"]})

        sec_clean = re.sub(r"^(CSE[\s\-]*|Class[\s\-]*|Section[\s\-]*)", "", scope["section"], flags=re.IGNORECASE).strip()
        sec_regex = f"^(CSE\\s*[-]?\\s*|Section\\s*)?{re.escape(sec_clean)}$"
        query_parts.append({
            "section": {"$regex": sec_regex, "$options": "i"}
        })
    elif year and year not in ["All", "all", "All Years", "All Classes", ""]:
        y_num = "".join(filter(str.isdigit, year))
        if y_num:
            year_regex = f"^{y_num}(st|nd|rd|th)?(\\s*Year)?$"
            query_parts.append({
                "$or": [
                    {"year": year},
                    {"year": {"$regex": year_regex, "$options": "i"}}
                ]
            })
        else:
            query_parts.append({"year": year})

    if not scope["is_restricted"] and section and section not in ["All", "all", "All Classes", "All Sections", ""]:
        sec_clean = re.sub(r"^(CSE[\s\-]*|Class[\s\-]*|Section[\s\-]*)", "", section, flags=re.IGNORECASE).strip()
        sec_regex = f"^(CSE\\s*[-]?\\s*|Section\\s*)?{re.escape(sec_clean)}$"
        query_parts.append({
            "section": {"$regex": sec_regex, "$options": "i"}
        })

    final_query = {}
    if len(query_parts) == 1:
        final_query = query_parts[0]
    elif len(query_parts) > 1:
        final_query = {"$and": query_parts}

    coll = get_students_collection()
    cursor = coll.find(final_query)
    students = []
    async for doc in cursor:
        students.append(serialize_student(doc))
    return students

@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(student_id: str, current_admin: dict = Depends(get_current_admin)):
    scope = get_admin_scope(current_admin)
    coll = get_students_collection()
    try:
        query = {"_id": ObjectId(student_id)}
    except Exception:
        query = {"registerNo": student_id}
        
    doc = await coll.find_one(query)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with id/registerNo {student_id} not found"
        )
    check_student_scope_permission(doc, scope)
    return serialize_student(doc)

@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def create_student(student: StudentCreate, current_admin: dict = Depends(get_current_admin)):
    scope = get_admin_scope(current_admin)
    if scope["is_restricted"]:
        # Verify student creation matches Class Teacher assigned year & class
        sec_clean = scope["section"].replace("CSE ", "").replace("Class ", "").strip().upper()
        s_sec_clean = (student.section or "").replace("CSE ", "").replace("Class ", "").strip().upper()
        y_num_scope = "".join(filter(str.isdigit, scope["year"]))
        y_num_student = "".join(filter(str.isdigit, student.year or ""))
        if y_num_scope != y_num_student or sec_clean != s_sec_clean:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: You can only create students for your assigned class ({scope['year']} {scope['section']})."
            )

    coll = get_students_collection()
    existing = await coll.find_one({
        "$or": [
            {"registerNo": student.registerNo},
            {"email": student.email}
        ]
    })
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Student with this Register Number or Email already exists."
        )

    now = datetime.now()
    doc = student.model_dump()
    from backend.routes.auth import get_default_student_password, hash_password
    default_pwd = doc.get("rollNo") or get_default_student_password(doc.get("registerNo"))
    doc["password"] = hash_password(default_pwd)
    doc["has_custom_password"] = False
    doc["uploadedImages"] = []
    doc["createdDate"] = now.strftime("%Y-%m-%d")
    doc["createdTime"] = now.strftime("%I:%M %p")
    doc["attendanceRate"] = 100.0
    doc["totalClasses"] = 0
    doc["presentClasses"] = 0

    result = await coll.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_student(doc)

@router.put("/{student_id}", response_model=StudentResponse)
async def update_student(student_id: str, student_update: StudentUpdate, current_admin: dict = Depends(get_current_admin)):
    scope = get_admin_scope(current_admin)
    coll = get_students_collection()
    try:
        query = {"_id": ObjectId(student_id)}
    except Exception:
        query = {"registerNo": student_id}

    existing = await coll.find_one(query)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    check_student_scope_permission(existing, scope)

    update_data = {k: v for k, v in student_update.model_dump(exclude_unset=True).items() if v is not None}
    
    if update_data:
        total = update_data.get("totalClasses", existing.get("totalClasses", 0))
        present = update_data.get("presentClasses", existing.get("presentClasses", 0))
        if total > 0:
            update_data["attendanceRate"] = round((present / total) * 100, 1)
        elif "totalClasses" in update_data or "presentClasses" in update_data:
            update_data["attendanceRate"] = 100.0

        await coll.update_one(query, {"$set": update_data})

    updated_doc = await coll.find_one(query)
    return serialize_student(updated_doc)

@router.delete("/{student_id}")
async def delete_student(student_id: str, current_admin: dict = Depends(get_current_admin)):
    scope = get_admin_scope(current_admin)
    coll = get_students_collection()
    try:
        query = {"_id": ObjectId(student_id)}
    except Exception:
        query = {"registerNo": student_id}

    existing = await coll.find_one(query)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    check_student_scope_permission(existing, scope)

    reg_no = existing.get("registerNo")
    if reg_no:
        student_dir = os.path.join(DATASET_DIR, reg_no)
        if os.path.exists(student_dir):
            try:
                shutil.rmtree(student_dir)
                logger.info(f"Deleted dataset directory for {reg_no}")
            except Exception as e:
                logger.error(f"Error deleting dataset directory for {reg_no}: {e}")

    await coll.delete_one(query)
    return {"success": True, "message": f"Deleted student {existing.get('name')}"}

@router.post("/upload")
async def upload_student_images(
    registerNo: str = Form(...),
    files: List[UploadFile] = File(...),
    current_admin: dict = Depends(get_current_admin)
):
    scope = get_admin_scope(current_admin)
    coll = get_students_collection()
    student = await coll.find_one({"registerNo": registerNo})
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Student with Register Number {registerNo} not found. Please create the student profile first."
        )
    check_student_scope_permission(student, scope)

    student_dir = os.path.join(DATASET_DIR, registerNo)
    os.makedirs(student_dir, exist_ok=True)

    saved_filenames = []
    saved_file_paths = []
    existing_files_count = len([f for f in os.listdir(student_dir) if os.path.isfile(os.path.join(student_dir, f))])

    for i, file in enumerate(files):
        ext = os.path.splitext(file.filename)[1] or ".jpg"
        img_name = f"image{existing_files_count + i + 1}{ext}"
        file_path = os.path.join(student_dir, img_name)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        saved_filenames.append(f"/dataset/{registerNo}/{img_name}")
        saved_file_paths.append(file_path)

    new_encodings = []
    for fp in saved_file_paths:
        try:
            import face_recognition
            img = face_recognition.load_image_file(fp)
            encs = face_recognition.face_encodings(img)
            if encs:
                new_encodings.append(encs[0].tolist())
        except Exception as e:
            logger.error(f"Error extracting face encoding for {fp}: {e}")

    update_data = {
        "$push": {"uploadedImages": {"$each": saved_filenames}}
    }
    if new_encodings:
        update_data["$push"]["faceEncodings"] = {"$each": new_encodings}

    if saved_filenames:
        current_avatar = student.get("avatar")
        if not current_avatar or "unsplash.com" in current_avatar or current_avatar.startswith("http"):
            update_data["$set"] = {"avatar": saved_filenames[0]}

    await coll.update_one(
        {"registerNo": registerNo},
        update_data
    )

    try:
        from backend.routes.scanner import load_student_encodings
        await load_student_encodings()
    except Exception as e:
        logger.error(f"Failed to reload scanner encodings: {e}")

    return {
        "success": True,
        "message": f"Successfully uploaded {len(files)} images for register number {registerNo}",
        "images": saved_filenames
    }

@router.delete("/{register_no}/images")
async def delete_student_image(
    register_no: str, 
    imagePath: str,
    current_admin: dict = Depends(get_current_admin)
):
    scope = get_admin_scope(current_admin)
    coll = get_students_collection()
    student = await coll.find_one({"registerNo": register_no})
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    check_student_scope_permission(student, scope)
        
    target_path = imagePath
    if "://" in imagePath:
        from urllib.parse import urlparse
        target_path = urlparse(imagePath).path
        
    if target_path in student.get("uploadedImages", []) or imagePath in student.get("uploadedImages", []):
        matched_path = target_path if target_path in student.get("uploadedImages", []) else imagePath
        await coll.update_one(
            {"registerNo": register_no},
            {"$pull": {"uploadedImages": matched_path}}
        )
        
        if student.get("avatar") in (matched_path, imagePath, target_path):
            remaining_images = [img for img in student.get("uploadedImages", []) if img not in (matched_path, imagePath, target_path)]
            new_avatar = remaining_images[0] if remaining_images else "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150"
            await coll.update_one(
                {"registerNo": register_no},
                {"$set": {"avatar": new_avatar}}
            )

        filename = os.path.basename(matched_path)
        file_path = os.path.join(DATASET_DIR, register_no, filename)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.info(f"Deleted file {file_path}")
            except Exception as e:
                logger.error(f"Error deleting file {file_path}: {e}")
                
        return {"success": True, "message": "Image deleted successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image not found in student profile"
        )
