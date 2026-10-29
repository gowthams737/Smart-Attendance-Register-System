from fastapi import APIRouter, HTTPException, status, Header, Depends, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import hashlib
import os
import secrets
import re
from backend.db import get_admins_collection, get_sessions_collection, get_students_collection

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    email: str
    password: str

class ProfileUpdate(BaseModel):
    name: str
    email: str
    phone: str
    title: str
    avatar: Optional[str] = None

class PasswordChange(BaseModel):
    oldPassword: str
    newPassword: str

# Password hashing utilities
def generate_salt():
    return os.urandom(16).hex()

def hash_password(password: str, salt: str = None) -> str:
    if not salt:
        salt = generate_salt()
    pwd_bytes = password.encode('utf-8')
    salt_bytes = bytes.fromhex(salt)
    hashed = hashlib.pbkdf2_hmac('sha256', pwd_bytes, salt_bytes, 100000)
    return f"{salt}:{hashed.hex()}"

def verify_password(password: str, hashed_with_salt: str) -> bool:
    try:
        if not hashed_with_salt:
            return False
        if ":" not in hashed_with_salt:
            # Fallback to plain text for legacy passwords (e.g. seeded admin123)
            return password == hashed_with_salt
        salt, hashed = hashed_with_salt.split(":")
        computed = hash_password(password, salt)
        return computed == hashed_with_salt
    except Exception:
        return False

def normalize_year(yr: Optional[str]) -> str:
    if not yr:
        return ""
    digits = "".join(filter(str.isdigit, str(yr)))
    if digits:
        if digits == "1":
            return "1st Year"
        elif digits == "2":
            return "2nd Year"
        elif digits == "3":
            return "3rd Year"
        elif digits == "4":
            return "4th Year"
        return f"{digits}th Year"
    return str(yr).strip().title()

def normalize_section(sec: Optional[str]) -> str:
    if not sec:
        return ""
    s = str(sec).strip().upper()
    s = s.replace("SECTION", "").replace("CLASS", "").replace("CSE", "").strip()
    return s

def match_year_and_class(st_year: Optional[str], st_sec: Optional[str], adv_year: Optional[str], adv_sec: Optional[str]) -> bool:
    norm_st_y = normalize_year(st_year)
    norm_adv_y = normalize_year(adv_year)
    if not norm_st_y or not norm_adv_y or norm_st_y != norm_adv_y:
        return False
        
    norm_st_s = normalize_section(st_sec)
    norm_adv_s = normalize_section(adv_sec)
    if not norm_st_s or not norm_adv_s or norm_st_s != norm_adv_s:
        return False
        
    return True

async def find_matching_class_advisor(st_year: Optional[str], st_section: Optional[str]) -> Optional[dict]:
    admins_coll = get_admins_collection()
    cursor = admins_coll.find({})
    async for admin in cursor:
        r = str(admin.get("role", "")).lower()
        em = str(admin.get("email", "")).lower()
        is_hod = (r in ["admin", "hod", "main admin / hod", "main admin"]) or (em == "sgowtham731@gmail.com")
        if is_hod:
            continue
        
        adv_yr = admin.get("year")
        adv_sec = admin.get("section") or admin.get("class")
        if match_year_and_class(st_year, st_section, adv_yr, adv_sec):
            return admin
    return None

async def get_current_admin(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
):
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split(" ")[1]
    elif authorization:
        auth_token = authorization
    elif token:
        auth_token = token

    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided."
        )
    sessions_coll = get_sessions_collection()
    session_doc = await sessions_coll.find_one({"token": auth_token})
    if not session_doc or session_doc.get("role") == "student":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin session has expired or is invalid. Please log in again."
        )
    if session_doc.get("email"):
        admins_coll = get_admins_collection()
        admin_doc = await admins_coll.find_one({"email": {"$regex": f"^{re.escape(session_doc['email'])}$", "$options": "i"}})
        if admin_doc:
            r = str(admin_doc.get("role", "")).lower()
            is_hod = (r in ["admin", "hod", "main admin / hod", "main admin"]) or (admin_doc.get("email", "").lower() == "sgowtham731@gmail.com")
            session_doc["is_hod"] = is_hod
            session_doc["role"] = "admin" if is_hod else "class_teacher"
            if admin_doc.get("year"):
                session_doc["year"] = admin_doc.get("year")
            if admin_doc.get("section") or admin_doc.get("class"):
                sec = admin_doc.get("section") or admin_doc.get("class")
                session_doc["section"] = sec
                session_doc["class"] = sec
    return session_doc

def get_admin_scope(current_admin: dict, requested_year: Optional[str] = None, requested_section: Optional[str] = None) -> dict:
    """
    Evaluates logged-in admin permissions and returns active MongoDB data scope.
    For Main Admin / HOD (is_hod is True):
      - Keeps requested year & section filters if provided (unless 'All'/'all').
      - is_restricted = False
    For Class Teacher (is_hod is False):
      - FORCES year = current_admin["year"]
      - FORCES section = current_admin["section"] or current_admin["class"]
      - Ignores any requested_year or requested_section passed by frontend/URL!
      - is_restricted = True
    """
    if not current_admin:
        return {"is_restricted": False, "is_hod": True, "year": None, "section": None, "class": None}

    is_hod = bool(
        current_admin.get("is_hod", False) or 
        current_admin.get("role") in ["admin", "hod", "Main Admin / HOD"] or 
        (current_admin.get("email", "").lower() == "sgowtham731@gmail.com")
    )
    
    if not is_hod:
        assigned_year = current_admin.get("year") or "3rd Year"
        assigned_section = current_admin.get("section") or current_admin.get("class") or "CSE A"
        return {
            "is_restricted": True,
            "is_hod": False,
            "year": assigned_year,
            "section": assigned_section,
            "class": assigned_section
        }
    else:
        y = None
        if requested_year and str(requested_year).strip().lower() not in ["all", "all years", "all dates", "none", ""]:
            y = str(requested_year).strip()
        s = None
        if requested_section and str(requested_section).strip().lower() not in ["all", "all classes", "all sections", "none", ""]:
            s = str(requested_section).strip()
        return {
            "is_restricted": False,
            "is_hod": True,
            "year": y,
            "section": s,
            "class": s
        }

async def get_current_student(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
):
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split(" ")[1]
    elif token:
        auth_token = token

    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided."
        )
    sessions_coll = get_sessions_collection()
    session_doc = await sessions_coll.find_one({"token": auth_token})
    if not session_doc or session_doc.get("role") != "student":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Student session has expired or is invalid. Please log in again."
        )
    
    student_coll = get_students_collection()
    student = await student_coll.find_one({
        "$or": [
            {"registerNo": session_doc.get("registerNo")},
            {"email": session_doc.get("email")}
        ]
    })
    if not student:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Student record not found."
        )
    student["id"] = str(student["_id"])
    return student

async def get_or_create_default_admin():
    coll = get_admins_collection()
    admin = await coll.find_one({"email": "sgowtham731@gmail.com"})
    if not admin:
        admin = await coll.find_one({})
        if admin:
            await coll.update_one(
                {"_id": admin["_id"]},
                {"$set": {"email": "sgowtham731@gmail.com", "password": hash_password("101974"), "name": "Gowtham S", "avatar": "/dataset/714024104065/image4.jpg"}}
            )
            admin["email"] = "sgowtham731@gmail.com"
            admin["password"] = hash_password("101974")
            admin["name"] = "Gowtham S"
            admin["avatar"] = "/dataset/714024104065/image4.jpg"
        else:
            default_admin = {
                "name": "Gowtham S",
                "email": "sgowtham731@gmail.com",
                "phone": "+91 99999 99999",
                "title": "Dean of Technology",
                "avatar": "/dataset/714024104065/image4.jpg",
                "password": hash_password("101974")
            }
            await coll.insert_one(default_admin)
            admin = default_admin
    return admin

def get_default_student_password(register_no: str) -> str:
    clean_reg = str(register_no or "").strip()
    digits = "".join(filter(str.isdigit, clean_reg))
    if len(digits) >= 3:
        last3 = digits[-3:]
    elif len(clean_reg) >= 3:
        last3 = clean_reg[-3:].zfill(3)
    else:
        last3 = clean_reg.zfill(3)
    return f"24CS{last3}"

class CreateAdminRequest(BaseModel):
    email: str
    password: str
    role: str
    year: Optional[str] = None
    section: Optional[str] = None
    roll: Optional[str] = None
    name: Optional[str] = None

VALID_YEAR_CLASSES = {
    "1st Year": ["CSE A", "CSE B", "CSE C", "CSE D", "CSE E"],
    "2nd Year": ["CSE A", "CSE B", "CSE C", "CSE D", "CSE E"],
    "3rd Year": ["CSE A", "CSE B", "CSE C", "CSE D"],
    "4th Year": ["CSE A", "CSE B", "CSE C"]
}

@router.post("/login")
async def login(credentials: LoginRequest):
    if not credentials.email or not credentials.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password cannot be empty."
        )
    
    clean_identifier = credentials.email.strip()

    # 1. Check Admin login in admins collection
    await get_or_create_default_admin()
    admins_coll = get_admins_collection()
    admin_doc = await admins_coll.find_one({"email": {"$regex": f"^{re.escape(clean_identifier)}$", "$options": "i"}})
    
    if admin_doc:
        if not verify_password(credentials.password, admin_doc.get("password")):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password."
            )
            
        role_val = str(admin_doc.get("role", "admin")).lower()
        is_hod = (role_val in ["admin", "hod", "main admin / hod", "main admin"]) or (admin_doc.get("email", "").lower() == "sgowtham731@gmail.com")
        
        token = secrets.token_hex(32)
        sessions_coll = get_sessions_collection()
        await sessions_coll.insert_one({
            "token": token,
            "email": admin_doc.get("email"),
            "role": "admin" if is_hod else "class_teacher",
            "is_hod": is_hod,
            "year": admin_doc.get("year"),
            "section": admin_doc.get("section") or admin_doc.get("class"),
            "class": admin_doc.get("section") or admin_doc.get("class"),
            "created_at": datetime.now(timezone.utc)
        })
        
        assigned_year = admin_doc.get("year", "")
        assigned_section = admin_doc.get("section") or admin_doc.get("class") or ""
        
        display_name = admin_doc.get("name") or ("Gowtham S" if is_hod else f"Class Advisor ({assigned_year} {assigned_section})".strip())
        display_title = admin_doc.get("title") or ("Head of Department (HOD)" if is_hod else f"Class Advisor - {assigned_year} {assigned_section}".strip())
        display_roll = admin_doc.get("roll") or (f"Class Advisor - {assigned_year} {assigned_section}".strip() if not is_hod else "Head of Department (HOD)")

        return {
            "success": True,
            "message": "Login successful",
            "user": {
                "email": admin_doc.get("email"),
                "role": "admin" if is_hod else "class_teacher",
                "is_hod": is_hod,
                "name": display_name,
                "title": display_title,
                "avatar": admin_doc.get("avatar") or "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100",
                "year": assigned_year,
                "class": assigned_section,
                "section": assigned_section,
                "roll": display_roll,
                "token": token
            }
        }
        
    # 2. Check Student login (by Email or Register Number)
    student_coll = get_students_collection()
    student = await student_coll.find_one({
        "$or": [
            {"email": {"$regex": f"^{re.escape(clean_identifier)}$", "$options": "i"}},
            {"registerNo": {"$regex": f"^{re.escape(clean_identifier)}$", "$options": "i"}}
        ]
    })
    
    if student:
        current_pwd_hash = student.get("password")
        is_custom = student.get("has_custom_password", False)
        
        is_valid = False
        if is_custom and current_pwd_hash:
            is_valid = verify_password(credentials.password, current_pwd_hash)
        else:
            default_pwd = get_default_student_password(student.get("registerNo"))
            default_hash = hash_password(default_pwd)
            is_valid = (credentials.password == default_pwd) or (current_pwd_hash and verify_password(credentials.password, current_pwd_hash))
            
            # Save default hash if not present
            if not current_pwd_hash:
                await student_coll.update_one({"_id": student["_id"]}, {"$set": {"password": default_hash, "has_custom_password": False}})
                student["password"] = default_hash

        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect Register Number or Password."
            )
            
        token = secrets.token_hex(32)
        sessions_coll = get_sessions_collection()
        await sessions_coll.insert_one({
            "token": token,
            "email": student.get("email"),
            "registerNo": student.get("registerNo"),
            "studentId": str(student["_id"]),
            "role": "student",
            "created_at": datetime.now(timezone.utc)
        })
        
        return {
            "success": True,
            "message": "Login successful",
            "user": {
                "email": student.get("email"),
                "registerNo": student.get("registerNo"),
                "role": "student",
                "name": student.get("name"),
                "department": student.get("department"),
                "year": student.get("year"),
                "section": student.get("section"),
                "avatar": student.get("avatar"),
                "token": token
            }
        }

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email/register number or password."
    )

@router.get("/admins")
async def get_all_admins(current_admin = Depends(get_current_admin)):
    admins_coll = get_admins_collection()
    cursor = admins_coll.find({}).sort("created_at", -1)
    
    caller_email = current_admin.get("email", "").lower()
    caller_is_hod = current_admin.get("is_hod", False) or (caller_email == "sgowtham731@gmail.com")
    
    admins = []
    async for doc in cursor:
        e = doc.get("email", "")
        r = str(doc.get("role", "admin")).lower()
        is_main = (r in ["admin", "hod", "main admin / hod", "main admin"]) or (e.lower() == "sgowtham731@gmail.com")
        
        year_val = doc.get("year", "N/A")
        sec_val = doc.get("section") or doc.get("class", "N/A")
        
        admins.append({
            "id": str(doc["_id"]),
            "email": e,
            "name": doc.get("name") or ("Gowtham S" if is_main else f"Class Advisor ({year_val} {sec_val})"),
            "role": "admin" if is_main else "class_teacher",
            "roleDisplay": "Main Admin / HOD" if is_main else "Class Advisor",
            "title": doc.get("title") or ("Head of Department (HOD)" if is_main else f"Class Advisor - {year_val} {sec_val}"),
            "year": year_val if not is_main else "N/A",
            "section": sec_val if not is_main else "N/A",
            "class": sec_val if not is_main else "N/A",
            "roll": doc.get("roll") or (f"Class Advisor - {year_val} {sec_val}" if not is_main else "Head of Department (HOD)"),
            "created_at": doc.get("created_at", "N/A"),
            "isMainAdmin": is_main
        })
        
    return {
        "isCallerHod": caller_is_hod,
        "admins": admins
    }

@router.post("/admins", status_code=status.HTTP_201_CREATED)
async def create_admin(data: CreateAdminRequest, current_admin = Depends(get_current_admin)):
    caller_email = current_admin.get("email", "").lower()
    caller_is_hod = current_admin.get("is_hod", False) or (caller_email == "sgowtham731@gmail.com")
    
    if not caller_is_hod:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Main Admin / HOD can create or manage admin accounts."
        )
        
    clean_email = data.email.strip().lower()
    if not clean_email or "@" not in clean_email or "." not in clean_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Valid admin email address is required."
        )
        
    if not data.password or len(data.password.strip()) < 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required (minimum 4 characters)."
        )
        
    role_raw = (data.role or "").strip()
    if not role_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin role is required."
        )
        
    is_class_teacher = ("class teacher" in role_raw.lower())
    
    year_val = (data.year or "").strip()
    sec_val = (data.section or "").strip()
    
    if is_class_teacher:
        if not year_val or year_val not in VALID_YEAR_CLASSES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Please select a valid Year ({', '.join(VALID_YEAR_CLASSES.keys())})."
            )
            
        allowed_classes = VALID_YEAR_CLASSES[year_val]
        if not sec_val or sec_val not in allowed_classes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"For {year_val}, valid Class / Section options are: {', '.join(allowed_classes)}."
            )
            
    admins_coll = get_admins_collection()
    existing = await admins_coll.find_one({"email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An admin with this email address already exists."
        )
        
    role_code = "class_teacher" if is_class_teacher else "admin"
    roll_text = data.roll or (f"Class Advisor - {year_val} {sec_val}" if is_class_teacher else "Head of Department (HOD)")
    name_text = data.name or (f"Class Advisor ({year_val} - {sec_val})" if is_class_teacher else "Admin User")
    title_text = f"Class Advisor - {year_val} {sec_val}" if is_class_teacher else "Main Admin / HOD"
    
    new_doc = {
        "email": clean_email,
        "password": hash_password(data.password),
        "role": role_code,
        "name": name_text,
        "title": title_text,
        "year": year_val if is_class_teacher else None,
        "section": sec_val if is_class_teacher else None,
        "class": sec_val if is_class_teacher else None,
        "roll": roll_text,
        "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %I:%M %p")
    }
    
    res = await admins_coll.insert_one(new_doc)
    new_doc["id"] = str(res.inserted_id)
    new_doc["_id"] = str(res.inserted_id)
    del new_doc["password"]
    
    return {
        "success": True,
        "message": f"Admin account '{clean_email}' created successfully.",
        "admin": new_doc
    }

@router.delete("/admins/{admin_id}")
async def delete_admin(admin_id: str, current_admin = Depends(get_current_admin)):
    caller_email = current_admin.get("email", "").lower()
    caller_is_hod = current_admin.get("is_hod", False) or (caller_email == "sgowtham731@gmail.com")
    
    if not caller_is_hod:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Main Admin / HOD can delete admin accounts."
        )
        
    admins_coll = get_admins_collection()
    
    doc = None
    try:
        from bson import ObjectId
        doc = await admins_coll.find_one({"_id": ObjectId(admin_id)})
    except Exception:
        pass
    if not doc:
        doc = await admins_coll.find_one({"_id": admin_id})
        
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin account not found."
        )
        
    target_email = doc.get("email", "").lower()
    if target_email == "sgowtham731@gmail.com" or doc.get("role") in ["admin", "hod"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Main Admin / HOD account cannot be deleted."
        )
        
    target_id = doc["_id"]
    await admins_coll.delete_one({"_id": target_id})
    
    # Revoke sessions for deleted admin
    sessions_coll = get_sessions_collection()
    await sessions_coll.delete_many({"email": target_email})
    
    return {
        "success": True,
        "message": f"Admin account '{target_email}' removed successfully."
    }

@router.post("/logout")
async def logout(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None)
):
    auth_token = None
    if authorization and authorization.startswith("Bearer "):
        auth_token = authorization.split(" ")[1]
    elif token:
        auth_token = token

    if auth_token:
        sessions_coll = get_sessions_collection()
        await sessions_coll.delete_one({"token": auth_token})
    return {
        "success": True,
        "message": "Logout successful"
    }


@router.get("/profile")
async def get_profile(current_admin = Depends(get_current_admin)):
    admins_coll = get_admins_collection()
    email = current_admin.get("email")
    admin_doc = None
    if email:
        admin_doc = await admins_coll.find_one({"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}})
    if not admin_doc:
        admin_doc = await get_or_create_default_admin()

    is_hod = bool(
        current_admin.get("is_hod", False) or 
        current_admin.get("role") in ["admin", "hod", "Main Admin / HOD"] or 
        (email and email.lower() == "sgowtham731@gmail.com")
    )
    assigned_year = admin_doc.get("year", "")
    assigned_section = admin_doc.get("section") or admin_doc.get("class") or ""

    display_name = admin_doc.get("name") or ("Gowtham S" if is_hod else f"Class Teacher ({assigned_year} {assigned_section})".strip())
    display_title = admin_doc.get("title") or ("Head of Department (HOD)" if is_hod else f"Class Teacher - {assigned_year} {assigned_section}".strip())

    return {
        "name": display_name,
        "email": admin_doc.get("email") or email,
        "phone": admin_doc.get("phone") or "",
        "title": display_title,
        "avatar": admin_doc.get("avatar") or "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100",
        "role": "admin" if is_hod else "class_teacher",
        "is_hod": is_hod,
        "year": assigned_year,
        "section": assigned_section
    }

@router.put("/profile")
async def update_profile(profile: ProfileUpdate, current_admin = Depends(get_current_admin)):
    admins_coll = get_admins_collection()
    email = current_admin.get("email")
    if email:
        await admins_coll.update_one(
            {"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}},
            {"$set": profile.model_dump(exclude_unset=True)}
        )
    return {
        "success": True,
        "message": "Profile updated successfully",
        "profile": profile.model_dump()
    }

@router.put("/change-password")
async def change_password(data: PasswordChange, current_admin = Depends(get_current_admin)):
    coll = get_admins_collection()
    admin = await get_or_create_default_admin()
    
    if not verify_password(data.oldPassword, admin.get("password")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect old password."
        )
        
    hashed_new = hash_password(data.newPassword)
    await coll.update_one({}, {"$set": {"password": hashed_new}})
    
    # Revoke sessions for this admin upon password change
    sessions_coll = get_sessions_collection()
    await sessions_coll.delete_many({"email": admin.get("email")})
    
    return {
        "success": True,
        "message": "Password changed successfully"
    }
