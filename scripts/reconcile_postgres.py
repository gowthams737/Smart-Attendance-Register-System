"""
Reconciliation Script for Smart Attendance Register System: MongoDB to PostgreSQL
==================================================================================

Safety Guarantees:
- DEFAULT MODE IS STRICTLY READ-ONLY PREFLIGHT AUDIT.
- Requires explicit CLI flag '--apply' to execute any database write.
- Atomic execution: all writes run inside a single database transaction.
- Complete rollback: any precondition, row count, or postcondition failure triggers a total ROLLBACK.
- Parameterized SQL for all query values; double-quoted camelCase PostgreSQL identifiers.
- Pre- and post-condition assertions enforce exact baseline ID sets and counts.
- Zero credential exposure: configuration is imported directly from backend.config.

Baseline Backup Reference:
  backups/mongodb_backup_20261026_215631/
"""

import os
import sys
import json
import argparse
import asyncio
from datetime import datetime
from typing import Dict, Any, List, Set, Tuple

# Ensure workspace root is in sys.path
WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if WORKSPACE_DIR not in sys.path:
    sys.path.insert(0, WORKSPACE_DIR)

import asyncpg
from backend.config import (
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_DB
)

BACKUP_DIR = os.path.join(WORKSPACE_DIR, "backups", "mongodb_backup_20261026_215631")

EXPECTED_BASELINE_COUNTS = {
    "admins": 3,
    "attendance": 74,
    "attendance_resets": 2,
    "leave_letters": 3,
    "leaves": 15,
    "notifications": 29,
    "sessions": 158,
    "settings": 1,
    "students": 7
}

EXPECTED_PRE_RECONCILE_COUNTS = {
    "admins": 3,
    "attendance": 84,
    "attendance_resets": 2,
    "leave_letters": 3,
    "leaves": 15,
    "notifications": 29,
    "sessions": 162,
    "settings": 1,
    "students": 7
}

EXTRA_ATTENDANCE_IDS = [
    "f2459262f2514f45b7fe0bba",
    "d7499cad0d3d4e678fa3d2ff",
    "dace713953574ad0a44ed425",
    "d3aafb029cb0496e84a48b13",
    "2e866c7786484f8a8e88ccfb",
    "3441a332b36d4bb1bc15f3fd",
    "29e1b8104ecd41a6b713d923",
    "4c78dd5c617d419693ac26ba",
    "9ad5c5eb1e064e97a959345c",
    "c0c0e76cf97e41d8858eed97",
    "4b55eee4bc894709b777fb96"
]

EXTRA_SESSION_IDS = [
    "7221a24721784147b26e9883",
    "d218f02c0a4f469eb202f2d4",
    "605cfdd587f34b80bcf0d753",
    "115382fb79974e069e3584e8"
]

MISSING_ATTENDANCE_ID = "6ac71544aeb867ebd5a02915"

EXPECTED_STUDENT_STATS = [
    {"id": "6a795529455bc63948ae61d6", "registerNo": "714024104125", "totalClasses": 8,  "presentClasses": 4, "attendanceRate": 50.0},
    {"id": "6a9255f58e35667db8cedae8", "registerNo": "714024104120", "totalClasses": 27, "presentClasses": 0, "attendanceRate": 0.0},
    {"id": "6ab204f42977fb7f5c1535f4", "registerNo": "714024104094", "totalClasses": 19, "presentClasses": 0, "attendanceRate": 0.0},
    {"id": "6ab2065e2977fb7f5c1535f5", "registerNo": "714024104104", "totalClasses": 19, "presentClasses": 0, "attendanceRate": 0.0},
    {"id": "6abbf5edff365f35eeef63a6", "registerNo": "714024104065", "totalClasses": 15, "presentClasses": 2, "attendanceRate": 13.3},
    {"id": "6abc974718e807bb9b2e366a", "registerNo": "714024104074", "totalClasses": 13, "presentClasses": 1, "attendanceRate": 7.7},
    {"id": "6abcb8e046d52e5d6f6b1f43", "registerNo": "714024104075", "totalClasses": 13, "presentClasses": 0, "attendanceRate": 0.0}
]

DIVERGENT_ATTENDANCE_UPDATES = [
    {
        "id": "6ac5c3c0dba6da98df03254b",
        "name": "Gowtham S (2026-10-07)",
        "fields": {
            "status": "Absent",
            "morningSession": "Absent",
            "method": "System (Absent)",
            "modifiedManually": False,
            "lastModifiedAt": None,
            "lastModifiedBy": None
        }
    },
    {
        "id": "6ac5c3c0dba6da98df032547",
        "name": "Manikandan K (2026-10-07)",
        "fields": {
            "rollNo": "24CS094",
            "section": "B",
            "confidence": 0.0,
            "lastModifiedAt": "2026-10-07 10:35 PM"
        }
    },
    {
        "id": "6ab1f7242977fb7f5c1535ed",
        "name": "Madhusuthanan P (2026-09-22)",
        "fields": {
            "afternoonSession": "---",
            "rollNo": None
        }
    },
    {
        "id": "6ac71544aeb867ebd5a02913",
        "name": "Madhusuthanan P (2026-10-08)",
        "fields": {
            "afternoonSession": "---"
        }
    },
    {
        "id": "6ac71544aeb867ebd5a02914",
        "name": "Kabilan R (2026-10-08)",
        "fields": {
            "afternoonSession": "---"
        }
    },
    {
        "id": "6ac70d44501db0351dd9fe90",
        "name": "Gowtham S (2026-10-08)",
        "fields": {
            "afternoonSession": "---"
        }
    },
    {
        "id": "6ac71544aeb867ebd5a02916",
        "name": "Harish D (2026-10-08)",
        "fields": {
            "afternoonSession": "---"
        }
    },
    {
        "id": "6ac71544aeb867ebd5a02917",
        "name": "Harish K (2026-10-08)",
        "fields": {
            "afternoonSession": "---"
        }
    },
    {
        "id": "6ac54d8bee301cb52f0144e7",
        "name": "Manikandan K (2026-10-06)",
        "fields": {
            "morningSession": None,
            "afternoonSession": None,
            "method": None
        }
    }
]


def load_baseline_json(filename: str) -> Any:
    filepath = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Required baseline file missing: {filepath}")
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def get_oid(val: Any) -> str:
    if isinstance(val, dict) and "$oid" in val:
        return val["$oid"]
    return str(val)


def verify_baseline_backup_counts():
    print("[1/5] Verifying MongoDB Baseline Backup counts...")
    manifest_path = os.path.join(BACKUP_DIR, "manifest.json")
    if not os.path.exists(manifest_path):
        raise FileNotFoundError(f"Manifest missing: {manifest_path}")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    manifest_counts = manifest.get("collections", {})
    for tbl, expected in EXPECTED_BASELINE_COUNTS.items():
        m_cnt = manifest_counts.get(tbl)
        if m_cnt != expected:
            raise ValueError(f"Manifest count mismatch for '{tbl}': manifest={m_cnt}, expected={expected}")

        data = load_baseline_json(f"{tbl}.json")
        f_cnt = len(data) if isinstance(data, list) else 0
        if f_cnt != expected:
            raise ValueError(f"JSON array length mismatch for '{tbl}.json': file={f_cnt}, expected={expected}")

    print("      -> Baseline backup counts 100% verified against manifest and source JSON files.")


async def verify_preconditions(conn: asyncpg.Connection) -> Dict[str, Any]:
    print("[2/5] Verifying live PostgreSQL pre-reconciliation conditions...")

    # Strict DB guard
    db_name = await conn.fetchval("SELECT current_database();")
    if db_name != "smart_attendance":
        raise ValueError(f"CRITICAL: Connected to database '{db_name}'. Must be 'smart_attendance'. Aborting.")

    # Table counts
    table_counts = {}
    for tbl, expected in EXPECTED_PRE_RECONCILE_COUNTS.items():
        cnt = await conn.fetchval(f'SELECT count(*) FROM "{tbl}";')
        table_counts[tbl] = cnt
        if cnt != expected:
            raise ValueError(f"Pre-condition failed: table '{tbl}' count is {cnt}, expected {expected}.")

    # Verify 11 extra attendance IDs exist in PG
    existing_extra_att = await conn.fetch(
        'SELECT id FROM attendance WHERE id = ANY($1::varchar[]);',
        EXTRA_ATTENDANCE_IDS
    )
    found_att_ids = {r["id"] for r in existing_extra_att}
    if len(found_att_ids) != 11:
        missing = set(EXTRA_ATTENDANCE_IDS) - found_att_ids
        raise ValueError(f"Pre-condition failed: extra attendance IDs missing in PG: {missing}")

    # Verify 4 extra session IDs exist in PG
    existing_extra_ses = await conn.fetch(
        'SELECT id FROM sessions WHERE id = ANY($1::varchar[]);',
        EXTRA_SESSION_IDS
    )
    found_ses_ids = {r["id"] for r in existing_extra_ses}
    if len(found_ses_ids) != 4:
        missing = set(EXTRA_SESSION_IDS) - found_ses_ids
        raise ValueError(f"Pre-condition failed: extra session IDs missing in PG: {missing}")

    # Verify missing attendance record 6ac71544aeb867ebd5a02915 is NOT in PG
    missing_in_pg = await conn.fetchval('SELECT count(*) FROM attendance WHERE id = $1;', MISSING_ATTENDANCE_ID)
    if missing_in_pg != 0:
        raise ValueError(f"Pre-condition failed: target record {MISSING_ATTENDANCE_ID} already exists in PG.")

    # Verify 9 divergent attendance records exist in PG
    div_ids = [d["id"] for d in DIVERGENT_ATTENDANCE_UPDATES]
    existing_div = await conn.fetch('SELECT id FROM attendance WHERE id = ANY($1::varchar[]);', div_ids)
    if len(existing_div) != 9:
        raise ValueError(f"Pre-condition failed: expected 9 divergent records in PG, found {len(existing_div)}")

    # Verify 7 students in PG match expected register numbers
    student_rows = await conn.fetch('SELECT id, "registerNo" FROM students ORDER BY "registerNo";')
    pg_students = {r["id"]: r["registerNo"] for r in student_rows}
    for s in EXPECTED_STUDENT_STATS:
        if s["id"] not in pg_students:
            raise ValueError(f"Pre-condition failed: student ID {s['id']} missing from PostgreSQL students table.")
        if pg_students[s["id"]] != s["registerNo"]:
            raise ValueError(f"Pre-condition failed: student {s['id']} registerNo mismatch: PG={pg_students[s['id']]}, expected={s['registerNo']}")

    print("      -> Live PostgreSQL pre-reconciliation checks 100% verified.")
    return table_counts


def prepare_missing_attendance_document() -> Dict[str, Any]:
    baseline_att = load_baseline_json("attendance.json")
    for doc in baseline_att:
        if get_oid(doc.get("_id")) == MISSING_ATTENDANCE_ID:
            # Validate studentId
            if doc.get("studentId") != "6ab2065e2977fb7f5c1535f5":
                raise ValueError(f"Missing doc studentId mismatch: {doc.get('studentId')}")
            if doc.get("registerNo") != "714024104104":
                raise ValueError(f"Missing doc registerNo mismatch: {doc.get('registerNo')}")
            return {
                "id": MISSING_ATTENDANCE_ID,
                "registerNo": doc.get("registerNo"),
                "name": doc.get("name"),
                "rollNo": doc.get("rollNo"),
                "department": doc.get("department"),
                "year": doc.get("year"),
                "section": doc.get("section"),
                "class": doc.get("class"),
                "date": doc.get("date"),
                "day": doc.get("day"),
                "session": doc.get("session"),
                "morningSession": doc.get("morningSession", "---"),
                "afternoonSession": doc.get("afternoonSession", "---"),
                "time": doc.get("time"),
                "attendance_time": doc.get("attendance_time"),
                "status": doc.get("status"),
                "confidence": float(doc.get("confidence", 0.0)),
                "method": doc.get("method", "System (Absent)"),
                "studentId": doc.get("studentId"),
                "modifiedManually": False,
                "lastModifiedAt": doc.get("lastModifiedAt"),
                "lastModifiedBy": doc.get("lastModifiedBy")
            }
    raise ValueError(f"Missing record {MISSING_ATTENDANCE_ID} not found in baseline JSON.")


async def execute_reconciliation(conn: asyncpg.Connection, dry_run: bool):
    print(f"\n[3/5] Starting reconciliation procedure (dry_run={dry_run})...")
    missing_doc = prepare_missing_attendance_document()

    if dry_run:
        print("      [DRY-RUN] Simulating actions without executing database writes:")
        print("      - ALTER TABLE students ADD COLUMN IF NOT EXISTS \"class\" VARCHAR(50);")
        print(f"      - DELETE FROM attendance WHERE id IN ({len(EXTRA_ATTENDANCE_IDS)} test IDs);")
        print(f"      - DELETE FROM sessions WHERE id IN ({len(EXTRA_SESSION_IDS)} test IDs);")
        print(f"      - UPDATE attendance for 9 divergent records with exact baseline values;")
        print(f"      - UPDATE students for 7 student statistics records;")
        print(f"      - INSERT INTO attendance missing record {missing_doc['id']} for {missing_doc['name']};")
        print("      [DRY-RUN] Preconditions passed. No database writes executed.")
        return

    # REAL EXECUTION INSIDE SINGLE TRANSACTION
    print("      [APPLY] Initiating atomic database transaction...")
    async with conn.transaction():
        # Step A: Schema compatibility column addition (non-destructive)
        print("      [Step A] Adding 'class' column to students if missing...")
        await conn.execute('ALTER TABLE students ADD COLUMN IF NOT EXISTS "class" VARCHAR(50);')

        # Step B: Delete 11 extra attendance test records
        print("      [Step B] Deleting 11 extra attendance test records...")
        del_att_res = await conn.execute(
            'DELETE FROM attendance WHERE id = ANY($1::varchar[]);',
            EXTRA_ATTENDANCE_IDS
        )
        del_att_count = int(del_att_res.split(" ")[-1])
        if del_att_count != 11:
            raise RuntimeError(f"Assertion failed: expected 11 deleted attendance rows, got {del_att_count}. Transaction will abort.")

        # Step C: Delete 4 extra session test records
        print("      [Step C] Deleting 4 extra session test records...")
        del_ses_res = await conn.execute(
            'DELETE FROM sessions WHERE id = ANY($1::varchar[]);',
            EXTRA_SESSION_IDS
        )
        del_ses_count = int(del_ses_res.split(" ")[-1])
        if del_ses_count != 4:
            raise RuntimeError(f"Assertion failed: expected 4 deleted session rows, got {del_ses_count}. Transaction will abort.")

        # Step D: Update 9 divergent attendance records
        print("      [Step D] Updating 9 divergent attendance records...")
        for item in DIVERGENT_ATTENDANCE_UPDATES:
            aid = item["id"]
            fields = item["fields"]
            set_clauses = []
            vals = []
            p_idx = 1
            for col, val in fields.items():
                set_clauses.append(f'"{col}" = ${p_idx}')
                vals.append(val)
                p_idx += 1

            vals.append(aid)
            update_sql = f'UPDATE attendance SET {", ".join(set_clauses)} WHERE id = ${p_idx};'
            res = await conn.execute(update_sql, *vals)
            affected = int(res.split(" ")[-1])
            if affected != 1:
                raise RuntimeError(f"Assertion failed: expected 1 row updated for {aid} ({item['name']}), got {affected}. Aborting.")

        # Step E: Update 7 student statistics records
        print("      [Step E] Restoring 7 student statistics records...")
        for s in EXPECTED_STUDENT_STATS:
            res = await conn.execute(
                """
                UPDATE students
                SET "totalClasses" = $1,
                    "presentClasses" = $2,
                    "attendanceRate" = $3
                WHERE id = $4 AND "registerNo" = $5;
                """,
                s["totalClasses"],
                s["presentClasses"],
                s["attendanceRate"],
                s["id"],
                s["registerNo"]
            )
            affected = int(res.split(" ")[-1])
            if affected != 1:
                raise RuntimeError(f"Assertion failed: student stat update for {s['id']} affected {affected} rows, expected 1. Aborting.")

        # Step F: Insert missing attendance record
        print(f"      [Step F] Inserting missing baseline attendance record {missing_doc['id']}...")
        cols = list(missing_doc.keys())
        quoted_cols = [f'"{c}"' for c in cols]
        placeholders = [f"${i+1}" for i in range(len(cols))]
        vals = [missing_doc[c] for c in cols]
        insert_sql = f'INSERT INTO attendance ({", ".join(quoted_cols)}) VALUES ({", ".join(placeholders)});'
        await conn.execute(insert_sql, *vals)

        # Step G: Rigorous postcondition assertions before commit
        print("[4/5] Executing post-reconciliation verification assertions...")

        # 1. Table counts must match baseline exactly
        for tbl, expected in EXPECTED_BASELINE_COUNTS.items():
            cnt = await conn.fetchval(f'SELECT count(*) FROM "{tbl}";')
            if cnt != expected:
                raise RuntimeError(f"Postcondition failed: table '{tbl}' count is {cnt}, expected {expected}. Aborting.")

        # 2. Attendance ID set must exactly match 74 baseline IDs
        baseline_att = load_baseline_json("attendance.json")
        baseline_att_ids = {get_oid(d["_id"]) for d in baseline_att}
        pg_att_rows = await conn.fetch('SELECT id FROM attendance;')
        pg_att_ids = {r["id"] for r in pg_att_rows}
        if pg_att_ids != baseline_att_ids:
            diff_extra = pg_att_ids - baseline_att_ids
            diff_missing = baseline_att_ids - pg_att_ids
            raise RuntimeError(f"Postcondition failed: Attendance ID set mismatch! Extra: {diff_extra}, Missing: {diff_missing}. Aborting.")

        # 3. Sessions ID set must exactly match 158 baseline IDs
        baseline_ses = load_baseline_json("sessions.json")
        baseline_ses_ids = {get_oid(d["_id"]) for d in baseline_ses}
        pg_ses_rows = await conn.fetch('SELECT id FROM sessions;')
        pg_ses_ids = {r["id"] for r in pg_ses_rows}
        if pg_ses_ids != baseline_ses_ids:
            diff_extra = pg_ses_ids - baseline_ses_ids
            diff_missing = baseline_ses_ids - pg_ses_ids
            raise RuntimeError(f"Postcondition failed: Sessions ID set mismatch! Extra: {diff_extra}, Missing: {diff_missing}. Aborting.")

        # 4. Verify 9 divergent records match expected fields
        for item in DIVERGENT_ATTENDANCE_UPDATES:
            aid = item["id"]
            row = await conn.fetchrow('SELECT * FROM attendance WHERE id = $1;', aid)
            for col, exp_val in item["fields"].items():
                actual_val = row[col]
                if actual_val != exp_val:
                    raise RuntimeError(f"Postcondition failed on {aid}: {col} is {actual_val}, expected {exp_val}. Aborting.")

        # 5. Verify 7 student statistics match baseline exactly
        for s in EXPECTED_STUDENT_STATS:
            row = await conn.fetchrow('SELECT "totalClasses", "presentClasses", "attendanceRate" FROM students WHERE id = $1;', s["id"])
            if row["totalClasses"] != s["totalClasses"] or row["presentClasses"] != s["presentClasses"] or abs(row["attendanceRate"] - s["attendanceRate"]) > 0.01:
                raise RuntimeError(f"Postcondition failed on student {s['id']}: actual={dict(row)}, expected={s}. Aborting.")

        print("      -> All postconditions satisfied 100%. Transaction committed successfully.")


async def main():
    parser = argparse.ArgumentParser(
        description="Reconciliation tool for Smart Attendance Register System (PostgreSQL vs MongoDB baseline)"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        default=False,
        help="Execute database writes inside an atomic transaction. Default is read-only preflight."
    )
    args = parser.parse_args()

    print("=" * 80)
    print(" Smart Attendance Register System — PostgreSQL Reconciliation Preflight")
    print("=" * 80)
    print(f" Execution Mode: {'APPLY (Transactional Writes)' if args.apply else 'DRY-RUN (Strictly Read-Only)'}")
    print(f" Target Host:    {POSTGRES_HOST}:{POSTGRES_PORT}")
    print(f" Database:       {POSTGRES_DB}")
    print(f" Baseline Dir:   {BACKUP_DIR}")
    print(" NOTE: Logical backup passed 'pg_restore --list' (archive valid), but has NOT passed isolated restore.")
    print("=" * 80)

    # Step 1: Verify baseline JSON files
    verify_baseline_backup_counts()

    # Step 2: Connect to PostgreSQL (read-only verification first)
    conn = await asyncpg.connect(
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        host=POSTGRES_HOST,
        port=POSTGRES_PORT,
        database=POSTGRES_DB
    )

    try:
        # Step 3: Verify preconditions
        await verify_preconditions(conn)

        # Step 4: Execute reconciliation (or simulate in dry-run)
        await execute_reconciliation(conn, dry_run=(not args.apply))

        print("\n[5/5] Reconciliation process finished successfully.")
        if not args.apply:
            print("      [SUMMARY] Preflight audit passed with zero errors. Run with '--apply' when approved.")
        else:
            print("      [SUMMARY] Full reconciliation completed and verified against baseline.")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
