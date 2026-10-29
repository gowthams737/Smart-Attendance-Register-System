from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime

class StudentBase(BaseModel):
    name: str = Field(..., min_length=1)
    registerNo: str = Field(..., min_length=1)
    rollNo: Optional[str] = None
    department: Optional[str] = "Computer Science & Engineering"
    year: Optional[str] = "3rd Year"
    section: Optional[str] = "A"
    email: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = "Not Specified"
    avatar: Optional[str] = None

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    registerNo: Optional[str] = None
    rollNo: Optional[str] = None
    department: Optional[str] = None
    year: Optional[str] = None
    section: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    avatar: Optional[str] = None
    attendanceRate: Optional[float] = None
    totalClasses: Optional[int] = None
    presentClasses: Optional[int] = None

class StudentResponse(StudentBase):
    id: str
    uploadedImages: List[str] = []
    createdDate: Optional[str] = "---"
    createdTime: Optional[str] = "---"
    attendanceRate: Optional[float] = 100.0
    totalClasses: Optional[int] = 0
    presentClasses: Optional[int] = 0


    class Config:
        populate_by_name = True

class AttendanceBase(BaseModel):
    name: str
    registerNo: str
    rollNo: Optional[str] = "---"
    department: str
    section: str
    date: str
    day: str
    morningSession: Optional[str] = "---"
    afternoonSession: Optional[str] = "---"
    time: str
    status: str
    confidence: Optional[float] = 100.0
    method: Optional[str] = "Manual Entry"
    session: Optional[str] = None
    attendance_time: Optional[str] = None
    year: Optional[str] = None

class AttendanceCreate(AttendanceBase):
    pass

class AttendanceResponse(AttendanceBase):
    id: str

class AttendanceCorrectionRequest(BaseModel):
    registerNo: str
    date: str
    session: str
    newStatus: str

class AttendanceResetRequest(BaseModel):
    scope: str
    year: Optional[str] = None
    section: Optional[str] = None
    registerNo: Optional[str] = None


class SettingsBase(BaseModel):
    systemName: str = "Smart Attendance Register"
    academicYear: str = "2026-2027"
    attendanceThreshold: float = 75.0
    backupInterval: str = "Weekly"
    enableNotifications: bool = True
    cameraResolution: str = "1080p"

class SettingsResponse(SettingsBase):
    pass
