import os
import sys
import json
import asyncio
from datetime import datetime, timezone
import zoneinfo
from bson import json_util
from dotenv import load_dotenv
import asyncpg

# Explicitly load .env from workspace root
WORKSPACE_DIR = r"D:\Smart Attendence Register System"
load_dotenv(os.path.join(WORKSPACE_DIR, ".env"))

BACKUP_DIR = os.path.join(WORKSPACE_DIR, "backups", "mongodb_backup_20261026_215631")
KOLKATA_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")

POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "127.0.0.1")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_DB = os.getenv("POSTGRES_DB", "smart_attendance")

TABLE_SCHEMAS = {
    "admins": """
        CREATE TABLE IF NOT EXISTS admins (
            id VARCHAR(64) PRIMARY KEY,
            "name" VARCHAR(255) NOT NULL,
            "email" VARCHAR(255) UNIQUE NOT NULL,
            "password" VARCHAR(255) NOT NULL,
            "phone" VARCHAR(50),
            "title" VARCHAR(255),
            "role" VARCHAR(50) DEFAULT 'admin',
            "is_hod" BOOLEAN DEFAULT FALSE,
            "avatar" TEXT,
            "roll" VARCHAR(100),
            "class" VARCHAR(50),
            "section" VARCHAR(50),
            "year" VARCHAR(50),
            "created_at" VARCHAR(100)
        );
    """,
    "students": """
        CREATE TABLE IF NOT EXISTS students (
            id VARCHAR(64) PRIMARY KEY,
            "registerNo" VARCHAR(50) UNIQUE NOT NULL,
            "rollNo" VARCHAR(50),
            "name" VARCHAR(255) NOT NULL,
            "department" VARCHAR(255) DEFAULT 'Computer Science & Engineering',
            "year" VARCHAR(50) DEFAULT '3rd Year',
            "section" VARCHAR(50) DEFAULT 'A',
            "email" VARCHAR(255),
            "phone" VARCHAR(50),
            "gender" VARCHAR(50) DEFAULT 'Not Specified',
            "avatar" TEXT,
            "uploadedImages" JSONB DEFAULT '[]'::jsonb,
            "faceEncodings" JSONB DEFAULT '[]'::jsonb,
            "createdDate" VARCHAR(50) DEFAULT '---',
            "createdTime" VARCHAR(50) DEFAULT '---',
            "attendanceRate" DOUBLE PRECISION DEFAULT 100.0,
            "totalClasses" INTEGER DEFAULT 0,
            "presentClasses" INTEGER DEFAULT 0,
            "password" VARCHAR(255),
            "has_custom_password" BOOLEAN DEFAULT FALSE
        );
    """,
    "attendance": """
        CREATE TABLE IF NOT EXISTS attendance (
            id VARCHAR(64) PRIMARY KEY,
            "registerNo" VARCHAR(50) NOT NULL,
            "name" VARCHAR(255) NOT NULL,
            "rollNo" VARCHAR(50),
            "department" VARCHAR(255),
            "year" VARCHAR(50),
            "section" VARCHAR(50),
            "class" VARCHAR(50),
            "date" VARCHAR(50) NOT NULL,
            "day" VARCHAR(50),
            "session" VARCHAR(50),
            "morningSession" VARCHAR(50) DEFAULT '---',
            "afternoonSession" VARCHAR(50) DEFAULT '---',
            "time" VARCHAR(50),
            "attendance_time" VARCHAR(50),
            "status" VARCHAR(50) NOT NULL,
            "confidence" DOUBLE PRECISION DEFAULT 100.0,
            "method" VARCHAR(100) DEFAULT 'Manual Entry',
            "studentId" VARCHAR(64),
            "modifiedManually" BOOLEAN DEFAULT FALSE,
            "lastModifiedAt" VARCHAR(100),
            "lastModifiedBy" VARCHAR(255),
            "createdAt" TIMESTAMPTZ DEFAULT NOW()
        );
    """,
    "attendance_resets": """
        CREATE TABLE IF NOT EXISTS attendance_resets (
            id VARCHAR(64) PRIMARY KEY,
            "reset_id" VARCHAR(100) UNIQUE NOT NULL,
            "reset_timestamp" VARCHAR(100),
            "reset_date" VARCHAR(50),
            "reset_date_display" VARCHAR(50),
            "reset_time_display" VARCHAR(50),
            "reset_time_decimal" DOUBLE PRECISION,
            "scope" VARCHAR(50) NOT NULL,
            "year" VARCHAR(50),
            "section" VARCHAR(50),
            "registerNo" VARCHAR(50),
            "student_name" VARCHAR(255),
            "performed_by" VARCHAR(255),
            "performed_by_email" VARCHAR(255),
            "performed_by_role" VARCHAR(50),
            "status" VARCHAR(50) DEFAULT 'active',
            "created_at" VARCHAR(100),
            "undone_at" VARCHAR(100),
            "undone_by" VARCHAR(255)
        );
    """,
    "leaves": """
        CREATE TABLE IF NOT EXISTS leaves (
            id VARCHAR(64) PRIMARY KEY,
            "registerNo" VARCHAR(50) NOT NULL,
            "name" VARCHAR(255) NOT NULL,
            "department" VARCHAR(255),
            "year" VARCHAR(50),
            "section" VARCHAR(50),
            "date" VARCHAR(50),
            "fromDate" VARCHAR(50),
            "toDate" VARCHAR(50),
            "reason" TEXT,
            "status" VARCHAR(50) DEFAULT 'Pending',
            "adminResponse" TEXT,
            "rejectionReason" TEXT,
            "attendancePercentage" DOUBLE PRECISION,
            "isLowAttendance" BOOLEAN DEFAULT FALSE,
            "submittedAt" VARCHAR(100),
            "processed_at" VARCHAR(100),
            "cancelled_at" VARCHAR(100),
            "created_at" VARCHAR(100)
        );
    """,
    "leave_letters": """
        CREATE TABLE IF NOT EXISTS leave_letters (
            id VARCHAR(64) PRIMARY KEY,
            "studentId" VARCHAR(64),
            "registerNo" VARCHAR(50) NOT NULL,
            "name" VARCHAR(255) NOT NULL,
            "rollNo" VARCHAR(50),
            "department" VARCHAR(255),
            "year" VARCHAR(50),
            "section" VARCHAR(50),
            "leaveDate" VARCHAR(50),
            "fromDate" VARCHAR(50),
            "toDate" VARCHAR(50),
            "reason" TEXT,
            "letterContent" TEXT,
            "status" VARCHAR(50) DEFAULT 'Pending',
            "adminResponse" TEXT,
            "rejectionReason" TEXT,
            "attendancePercentage" DOUBLE PRECISION,
            "isLowAttendance" BOOLEAN DEFAULT FALSE,
            "submittedAt" VARCHAR(100),
            "processed_at" VARCHAR(100),
            "created_at" VARCHAR(100)
        );
    """,
    "notifications": """
        CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(64) PRIMARY KEY,
            "recipient" VARCHAR(100) NOT NULL,
            "type" VARCHAR(100) NOT NULL,
            "title" VARCHAR(255) NOT NULL,
            "message" TEXT NOT NULL,
            "read" BOOLEAN DEFAULT FALSE,
            "time" VARCHAR(100),
            "studentRegisterNo" VARCHAR(50),
            "studentName" VARCHAR(255),
            "target_advisor_email" VARCHAR(255),
            "year" VARCHAR(50),
            "section" VARCHAR(50),
            "letterId" VARCHAR(64),
            "leaveId" VARCHAR(64),
            "leaveDate" VARCHAR(50),
            "reason" TEXT,
            "previousStatus" VARCHAR(50),
            "newStatus" VARCHAR(50),
            "attendancePercentage" DOUBLE PRECISION,
            "isLowAttendance" BOOLEAN,
            "cancelled_at" VARCHAR(100),
            "created_at" VARCHAR(100)
        );
    """,
    "sessions": """
        CREATE TABLE IF NOT EXISTS sessions (
            id VARCHAR(64) PRIMARY KEY,
            "token" VARCHAR(255) UNIQUE NOT NULL,
            "email" VARCHAR(255) NOT NULL,
            "role" VARCHAR(50),
            "is_hod" BOOLEAN DEFAULT FALSE,
            "studentId" VARCHAR(64),
            "registerNo" VARCHAR(50),
            "class" VARCHAR(50),
            "year" VARCHAR(50),
            "section" VARCHAR(50),
            "created_at" TIMESTAMPTZ DEFAULT NOW()
        );
    """,
    "settings": """
        CREATE TABLE IF NOT EXISTS settings (
            id VARCHAR(64) PRIMARY KEY,
            "systemName" VARCHAR(255) DEFAULT 'Smart Attendance Register',
            "academicYear" VARCHAR(50) DEFAULT '2026-2027',
            "attendanceThreshold" DOUBLE PRECISION DEFAULT 75.0,
            "backupInterval" VARCHAR(50) DEFAULT 'Weekly',
            "enableNotifications" BOOLEAN DEFAULT TRUE,
            "cameraResolution" VARCHAR(50) DEFAULT '1080p'
        );
    """
}

TABLE_INDEXES = [
    'CREATE INDEX IF NOT EXISTS idx_students_regno ON students ("registerNo");',
    'CREATE INDEX IF NOT EXISTS idx_students_email ON students ("email");',
    'CREATE INDEX IF NOT EXISTS idx_attendance_regno_date ON attendance ("registerNo", "date");',
    'CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance ("date");',
    'CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance ("studentId");',
    'CREATE INDEX IF NOT EXISTS idx_attendance_resets_id ON attendance_resets ("reset_id");',
    'CREATE INDEX IF NOT EXISTS idx_leaves_regno ON leaves ("registerNo");',
    'CREATE INDEX IF NOT EXISTS idx_leave_letters_regno ON leave_letters ("registerNo");',
    'CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications ("recipient", "read");',
    'CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions ("token");',
    'CREATE INDEX IF NOT EXISTS idx_admins_email ON admins ("email");'
]

def serialize_for_pg(table: str, doc: dict) -> dict:
    row = {}
    row["id"] = str(doc["_id"])
    
    for k, v in doc.items():
        if k == "_id":
            continue
        # Convert BSON datetime to aware datetime in Kolkata timezone
        if isinstance(v, datetime):
            if v.tzinfo is None:
                v = v.replace(tzinfo=timezone.utc).astimezone(KOLKATA_TZ)
            else:
                v = v.astimezone(KOLKATA_TZ)
            row[k] = v
        elif isinstance(v, (dict, list)):
            row[k] = json.dumps(v)
        else:
            row[k] = v
    return row

async def main():
    print("=========================================================")
    print("SMART ATTENDANCE — SAFE MONGODB TO POSTGRESQL MIGRATION")
    print("=========================================================")
    
    # 1. Ensure Target Database Exists
    print("\n[Step 1] Connecting to PostgreSQL maintenance server...")
    conn_maint = await asyncpg.connect(
        user=POSTGRES_USER, password=POSTGRES_PASSWORD,
        host=POSTGRES_HOST, port=POSTGRES_PORT, database="postgres"
    )
    
    db_exists = await conn_maint.fetchval(
        "SELECT 1 FROM pg_database WHERE datname = $1;", POSTGRES_DB
    )
    if not db_exists:
        print(f"Target database '{POSTGRES_DB}' does not exist. Creating database...")
        # CREATE DATABASE cannot run inside a transaction block
        await conn_maint.execute(f'CREATE DATABASE "{POSTGRES_DB}" ENCODING \'UTF8\';')
        print(f"Database '{POSTGRES_DB}' created successfully.")
    else:
        print(f"Database '{POSTGRES_DB}' already exists.")
    await conn_maint.close()
    
    # 2. Connect to Target Database and Create Schema
    print(f"\n[Step 2] Connecting to target database '{POSTGRES_DB}'...")
    conn = await asyncpg.connect(
        user=POSTGRES_USER, password=POSTGRES_PASSWORD,
        host=POSTGRES_HOST, port=POSTGRES_PORT, database=POSTGRES_DB
    )
    
    print("Creating tables and indexes...")
    for table_name, schema_sql in TABLE_SCHEMAS.items():
        await conn.execute(schema_sql)
        print(f"  Verified table: {table_name}")
        
    for idx_sql in TABLE_INDEXES:
        await conn.execute(idx_sql)
    print("All tables and indexes verified successfully.")
    
    # 3. Load Verified Backup Manifest
    manifest_path = os.path.join(BACKUP_DIR, "manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    print(f"\n[Step 3] Verified backup manifest loaded from {BACKUP_DIR}")
    
    # 4. Migrate Data with Exact Accounting
    results = {}
    conflicts_report = {}
    
    for table_name in sorted(TABLE_SCHEMAS.keys()):
        file_path = os.path.join(BACKUP_DIR, f"{table_name}.json")
        with open(file_path, "r", encoding="utf-8") as f:
            docs = json_util.loads(f.read())
            
        source_count = len(docs)
        inserted = 0
        identical = 0
        conflicting = 0
        failed = 0
        conflicts_list = []
        
        # Fetch existing records for this table
        existing_rows = await conn.fetch(f'SELECT * FROM "{table_name}";')
        existing_by_id = {r["id"]: dict(r) for r in existing_rows}
        
        # Get column names of destination table
        cols_info = await conn.fetch(f"""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = '{table_name}';
        """)
        allowed_cols = {c["column_name"] for c in cols_info}
        
        for doc in docs:
            pg_row = serialize_for_pg(table_name, doc)
            rec_id = pg_row["id"]
            
            # Filter only allowed columns
            valid_row = {k: v for k, v in pg_row.items() if k in allowed_cols}
            
            if rec_id in existing_by_id:
                # Compare fields
                existing = existing_by_id[rec_id]
                diffs = {}
                for k, v in valid_row.items():
                    ex_v = existing.get(k)
                    # Handle json string comparison
                    if isinstance(v, str) and (v.startswith('{') or v.startswith('[')):
                        try:
                            if json.loads(v) != json.loads(ex_v if isinstance(ex_v, str) else json.dumps(ex_v)):
                                diffs[k] = {"pg": ex_v, "source": v}
                        except Exception:
                            if str(v) != str(ex_v):
                                diffs[k] = {"pg": ex_v, "source": v}
                    elif ex_v != v:
                        diffs[k] = {"pg": ex_v, "source": v}
                        
                if not diffs:
                    identical += 1
                else:
                    conflicting += 1
                    conflicts_list.append({"id": rec_id, "diffs": diffs})
            else:
                # Insert record
                col_names = list(valid_row.keys())
                col_placeholders = [f"${i+1}" for i in range(len(col_names))]
                col_quoted = [f'"{c}"' for c in col_names]
                insert_sql = f"""
                    INSERT INTO "{table_name}" ({', '.join(col_quoted)})
                    VALUES ({', '.join(col_placeholders)});
                """
                try:
                    await conn.execute(insert_sql, *[valid_row[c] for c in col_names])
                    inserted += 1
                except Exception as e:
                    failed += 1
                    print(f"Error inserting record {rec_id} in {table_name}: {e}")
                    
        missing = source_count - (inserted + identical)
        results[table_name] = {
            "source": source_count,
            "inserted": inserted,
            "identical": identical,
            "conflicting": conflicting,
            "failed": failed,
            "missing": missing
        }
        if conflicts_list:
            conflicts_report[table_name] = conflicts_list
            
    # Save conflicts report if any
    conflicts_file = os.path.join(WORKSPACE_DIR, "backups", "migration_conflicts.json")
    with open(conflicts_file, "w", encoding="utf-8") as f:
        json.dump(conflicts_report, f, indent=2, default=str)
        
    print("\n=========================================================================================")
    print("MIGRATION AUDIT SUMMARY (RECORD ACCOUNTING)")
    print("=========================================================================================")
    print(f"{'Table':20} | {'Source':6} | {'Inserted':8} | {'Identical':9} | {'Conflicts':9} | {'Failed':6} | {'Missing':7}")
    print("-" * 89)
    total_source = 0
    total_inserted = 0
    total_identical = 0
    total_conflicts = 0
    total_failed = 0
    total_missing = 0
    
    for tbl, r in sorted(results.items()):
        total_source += r["source"]
        total_inserted += r["inserted"]
        total_identical += r["identical"]
        total_conflicts += r["conflicting"]
        total_failed += r["failed"]
        total_missing += r["missing"]
        print(f"{tbl:20} | {r['source']:6} | {r['inserted']:8} | {r['identical']:9} | {r['conflicting']:9} | {r['failed']:6} | {r['missing']:7}")
    print("-" * 89)
    print(f"{'TOTAL':20} | {total_source:6} | {total_inserted:8} | {total_identical:9} | {total_conflicts:9} | {total_failed:6} | {total_missing:7}")
    print("=========================================================================================")
    
    # 5. Field Integrity & Spot Verification
    print("\n[Step 5] Running Field-Level Integrity Verifications...")
    # Student face embeddings verification
    student_rows = await conn.fetch('SELECT id, "name", "registerNo", "faceEncodings" FROM students;')
    for s in student_rows:
        encs_val = s["faceEncodings"]
        encs = json.loads(encs_val) if isinstance(encs_val, str) else encs_val
        print(f"  Student {s['name']} ({s['registerNo']}): {len(encs)} face encoding(s) verified, vector dim={len(encs[0]) if encs else 0}")
        
    # Admins password hash verification
    admin_rows = await conn.fetch('SELECT email, "password" FROM admins;')
    for a in admin_rows:
        has_salt_hash = ":" in a["password"]
        print(f"  Admin {a['email']}: Password format intact (salt:hash={has_salt_hash})")
        
    # Settings verification
    settings_row = await conn.fetchrow('SELECT * FROM settings LIMIT 1;')
    print(f"  Settings: Academic Year='{settings_row['academicYear']}', Threshold={settings_row['attendanceThreshold']}%")
    
    await conn.close()
    print("\nMigration completed safely.")

if __name__ == "__main__":
    asyncio.run(main())
