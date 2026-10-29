import logging
import json
import asyncio
import re
import uuid
from datetime import datetime, timezone
import zoneinfo
from typing import Optional, List, Dict, Any
import asyncpg

from backend.config import (
    DATABASE_URL,
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_DB
)

logger = logging.getLogger("smart_attendance")
KOLKATA_TZ = zoneinfo.ZoneInfo("Asia/Kolkata")

class InsertOneResult:
    def __init__(self, inserted_id):
        self.inserted_id = str(inserted_id)

class InsertManyResult:
    def __init__(self, inserted_ids):
        self.inserted_ids = [str(i) for i in inserted_ids]

class UpdateResult:
    def __init__(self, matched_count, modified_count, upserted_id=None):
        self.matched_count = matched_count
        self.modified_count = modified_count
        self.upserted_id = str(upserted_id) if upserted_id else None

class DeleteResult:
    def __init__(self, deleted_count):
        self.deleted_count = deleted_count

class AsyncCursor:
    def __init__(self, fetch_func, sort=None, limit=None, skip=None):
        self._fetch_func = fetch_func
        self._sort = sort
        self._limit = limit
        self._skip = skip
        self._docs = None
        self._idx = 0

    def sort(self, key_or_list, direction=None):
        if direction is not None:
            self._sort = [(key_or_list, direction)]
        elif isinstance(key_or_list, list):
            self._sort = key_or_list
        elif isinstance(key_or_list, dict):
            self._sort = list(key_or_list.items())
        else:
            self._sort = [(key_or_list, 1)]
        return self

    def limit(self, n: int):
        self._limit = n
        return self

    def skip(self, n: int):
        self._skip = n
        return self

    async def _load(self):
        if self._docs is None:
            self._docs = await self._fetch_func(self._sort, self._limit, self._skip)

    def __aiter__(self):
        return self

    async def __anext__(self):
        await self._load()
        if self._idx < len(self._docs):
            doc = self._docs[self._idx]
            self._idx += 1
            return doc
        raise StopAsyncIteration

    async def to_list(self, length=None):
        await self._load()
        if length is None:
            return list(self._docs)
        return list(self._docs[:length])

class AsyncPostgresCollection:
    def __init__(self, pool: asyncpg.Pool, table_name: str):
        self.pool = pool
        self.table_name = table_name

    def _row_to_doc(self, row) -> Optional[Dict[str, Any]]:
        if not row:
            return None
        d = dict(row)
        rec_id = str(d.get("id") or "")
        d["id"] = rec_id
        d["_id"] = rec_id
        
        # Parse JSON fields
        for k in ["faceEncodings", "uploadedImages"]:
            if k in d and isinstance(d[k], str):
                try:
                    d[k] = json.loads(d[k])
                except Exception:
                    pass
        return d

    def _build_where(self, filter_dict: Optional[Dict[str, Any]], start_idx: int = 1, table_alias: Optional[str] = None):
        if not filter_dict:
            return "", [], start_idx

        clauses = []
        params = []
        param_idx = start_idx

        for key, val in filter_dict.items():
            if key == "$or":
                sub_clauses = []
                for sub in val:
                    sub_c, sub_p, param_idx = self._build_where(sub, param_idx, table_alias=table_alias)
                    if sub_c:
                        sub_clauses.append(f"({sub_c})")
                        params.extend(sub_p)
                if sub_clauses:
                    clauses.append(f"({' OR '.join(sub_clauses)})")
                continue

            if key == "$and":
                sub_clauses = []
                for sub in val:
                    sub_c, sub_p, param_idx = self._build_where(sub, param_idx, table_alias=table_alias)
                    if sub_c:
                        sub_clauses.append(f"({sub_c})")
                        params.extend(sub_p)
                if sub_clauses:
                    clauses.append(f"({' AND '.join(sub_clauses)})")
                continue

            if key.startswith("student_info."):
                raw_col = key.split(".", 1)[1]
                quoted_col = f's."{raw_col}"'
                col_name = raw_col
            elif table_alias:
                col_name = "id" if key == "_id" else key
                quoted_col = f'{table_alias}."{col_name}"' if col_name != "id" else f'{table_alias}.id'
            else:
                col_name = "id" if key == "_id" else key
                quoted_col = f'"{col_name}"' if col_name != "id" else "id"

            if hasattr(val, "__class__") and val.__class__.__name__ == "ObjectId":
                val = str(val)

            numeric_cols = ("attendanceRate", "confidence", "reset_time_decimal", "attendanceThreshold", "totalClasses", "presentClasses", "attendancePercentage")
            if isinstance(val, (int, float)) and col_name not in numeric_cols:
                val = str(val)

            if isinstance(val, dict):
                for op, op_val in val.items():
                    if hasattr(op_val, "__class__") and op_val.__class__.__name__ == "ObjectId":
                        op_val = str(op_val)
                    if op == "$regex":
                        flags = val.get("$options", "")
                        regex_op = "~*" if "i" in flags else "~"
                        clauses.append(f"{quoted_col} {regex_op} ${param_idx}")
                        params.append(str(op_val))
                        param_idx += 1
                    elif op == "$options":
                        continue
                    elif op == "$in":
                        in_list = [str(x) if hasattr(x, "__class__") and x.__class__.__name__ == "ObjectId" else x for x in op_val]
                        clauses.append(f"{quoted_col} = ANY(${param_idx})")
                        params.append(list(in_list))
                        param_idx += 1
                    elif op == "$ne":
                        clauses.append(f"({quoted_col} != ${param_idx} OR {quoted_col} IS NULL)")
                        params.append(op_val)
                        param_idx += 1
                    elif op == "$gte":
                        clauses.append(f"{quoted_col} >= ${param_idx}")
                        params.append(op_val)
                        param_idx += 1
                    elif op == "$lte":
                        clauses.append(f"{quoted_col} <= ${param_idx}")
                        params.append(op_val)
                        param_idx += 1
                    elif op == "$gt":
                        clauses.append(f"{quoted_col} > ${param_idx}")
                        params.append(op_val)
                        param_idx += 1
                    elif op == "$lt":
                        clauses.append(f"{quoted_col} < ${param_idx}")
                        params.append(op_val)
                        param_idx += 1
            elif val is None:
                clauses.append(f"{quoted_col} IS NULL")
            else:
                clauses.append(f"{quoted_col} = ${param_idx}")
                params.append(val)
                param_idx += 1

        where_str = " AND ".join(clauses)
        return where_str, params, param_idx

    async def find_one(self, filter_dict=None, sort=None):
        where_str, params, _ = self._build_where(filter_dict)
        where_clause = f"WHERE {where_str}" if where_str else ""
        order_clause = ""
        if sort:
            sort_items = sort if isinstance(sort, list) else list(sort.items())
            orders = [f'"{k}" {"DESC" if v in (-1, "desc") else "ASC"}' for k, v in sort_items]
            order_clause = f"ORDER BY {', '.join(orders)}"

        query = f'SELECT * FROM "{self.table_name}" {where_clause} {order_clause} LIMIT 1;'
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, *params)
            return self._row_to_doc(row)

    def find(self, filter_dict=None, sort=None, limit=None, skip=None):
        async def fetcher(c_sort, c_limit, c_skip):
            act_sort = c_sort if c_sort is not None else sort
            act_limit = c_limit if c_limit is not None else limit
            act_skip = c_skip if c_skip is not None else skip

            where_str, params, _ = self._build_where(filter_dict)
            where_clause = f"WHERE {where_str}" if where_str else ""
            order_clause = ""
            if act_sort:
                sort_items = act_sort if isinstance(act_sort, list) else list(act_sort.items())
                orders = [f'"{k}" {"DESC" if v in (-1, "desc", "DESC") else "ASC"}' for k, v in sort_items]
                order_clause = f"ORDER BY {', '.join(orders)}"
            limit_clause = f"LIMIT {act_limit}" if act_limit is not None else ""
            offset_clause = f"OFFSET {act_skip}" if act_skip is not None else ""

            query = f'SELECT * FROM "{self.table_name}" {where_clause} {order_clause} {limit_clause} {offset_clause};'
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(query, *params)
                return [self._row_to_doc(r) for r in rows]

        return AsyncCursor(fetcher, sort=sort, limit=limit, skip=skip)

    async def insert_one(self, doc):
        doc_copy = dict(doc)
        rec_id = str(doc_copy.pop("id", None) or doc_copy.pop("_id", None) or uuid.uuid4().hex[:24])
        
        cols = ["id"]
        vals = [rec_id]
        
        async with self.pool.acquire() as conn:
            table_cols = {r["column_name"] for r in await conn.fetch(
                f"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='{self.table_name}';"
            )}
            
            for k, v in doc_copy.items():
                if k in table_cols:
                    cols.append(f'"{k}"')
                    if isinstance(v, (dict, list)):
                        vals.append(json.dumps(v))
                    elif isinstance(v, datetime) and v.tzinfo is None:
                        vals.append(v.replace(tzinfo=timezone.utc).astimezone(KOLKATA_TZ))
                    else:
                        vals.append(v)
                        
            placeholders = [f"${i+1}" for i in range(len(cols))]
            query = f'INSERT INTO "{self.table_name}" ({", ".join(cols)}) VALUES ({", ".join(placeholders)}) RETURNING id;'
            await conn.execute(query, *vals)
            return InsertOneResult(rec_id)

    async def insert_many(self, docs):
        inserted_ids = []
        for d in docs:
            res = await self.insert_one(d)
            inserted_ids.append(res.inserted_id)
        return InsertManyResult(inserted_ids)

    async def update_one(self, filter_dict, update_dict, upsert=False):
        where_str, params, _ = self._build_where(filter_dict)
        where_clause = f"WHERE {where_str}" if where_str else ""

        set_dict = {}
        if "$set" in update_dict:
            set_dict.update(update_dict["$set"])
        if "$unset" in update_dict:
            for k in update_dict["$unset"]:
                set_dict[k] = None
        if not any(k.startswith("$") for k in update_dict.keys()):
            set_dict.update(update_dict)

        async with self.pool.acquire() as conn:
            table_cols = {r["column_name"] for r in await conn.fetch(
                f"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='{self.table_name}';"
            )}

            existing = await conn.fetchrow(f'SELECT * FROM "{self.table_name}" {where_clause} LIMIT 1;', *params)
            if not existing:
                if upsert:
                    insert_doc = dict(filter_dict or {})
                    insert_doc.update(set_dict)
                    res = await self.insert_one(insert_doc)
                    return UpdateResult(0, 1, upserted_id=res.inserted_id)
                return UpdateResult(0, 0)

            if "$push" in update_dict:
                for col, push_val in update_dict["$push"].items():
                    raw_cur = existing[col] if col in existing else None
                    if isinstance(raw_cur, str):
                        try:
                            cur_list = json.loads(raw_cur)
                        except Exception:
                            cur_list = []
                    elif isinstance(raw_cur, list):
                        cur_list = list(raw_cur)
                    else:
                        cur_list = []

                    if isinstance(push_val, dict) and "$each" in push_val:
                        cur_list.extend(push_val["$each"])
                    else:
                        cur_list.append(push_val)
                    set_dict[col] = cur_list

            if "$pull" in update_dict:
                for col, pull_val in update_dict["$pull"].items():
                    raw_cur = existing[col] if col in existing else None
                    if isinstance(raw_cur, str):
                        try:
                            cur_list = json.loads(raw_cur)
                        except Exception:
                            cur_list = []
                    elif isinstance(raw_cur, list):
                        cur_list = list(raw_cur)
                    else:
                        cur_list = []
                    cur_list = [x for x in cur_list if x != pull_val]
                    set_dict[col] = cur_list

            rec_id = existing["id"]
            set_clauses = []
            update_vals = []
            param_idx = 1
            for k, v in set_dict.items():
                col_name = "id" if k in ("id", "_id") else k
                if col_name in table_cols:
                    set_clauses.append(f'"{col_name}" = ${param_idx}')
                    if isinstance(v, (dict, list)):
                        update_vals.append(json.dumps(v))
                    elif isinstance(v, datetime) and v.tzinfo is None:
                        update_vals.append(v.replace(tzinfo=timezone.utc).astimezone(KOLKATA_TZ))
                    else:
                        update_vals.append(v)
                    param_idx += 1

            if not set_clauses:
                return UpdateResult(1, 0)

            update_sql = f'UPDATE "{self.table_name}" SET {", ".join(set_clauses)} WHERE id = ${param_idx};'
            await conn.execute(update_sql, *(update_vals + [rec_id]))
            return UpdateResult(1, 1)

    async def update_many(self, filter_dict, update_dict, upsert=False):
        where_str, params, _ = self._build_where(filter_dict)
        where_clause = f"WHERE {where_str}" if where_str else ""

        set_dict = {}
        if "$set" in update_dict:
            set_dict.update(update_dict["$set"])
        if "$unset" in update_dict:
            for k in update_dict["$unset"]:
                set_dict[k] = None
        if not any(k.startswith("$") for k in update_dict.keys()):
            set_dict.update(update_dict)

        async with self.pool.acquire() as conn:
            table_cols = {r["column_name"] for r in await conn.fetch(
                f"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='{self.table_name}';"
            )}
            
            set_clauses = []
            update_vals = []
            param_idx = 1
            for k, v in set_dict.items():
                col_name = "id" if k in ("id", "_id") else k
                if col_name in table_cols:
                    set_clauses.append(f'"{col_name}" = ${param_idx}')
                    if isinstance(v, (dict, list)):
                        update_vals.append(json.dumps(v))
                    elif isinstance(v, datetime) and v.tzinfo is None:
                        update_vals.append(v.replace(tzinfo=timezone.utc).astimezone(KOLKATA_TZ))
                    else:
                        update_vals.append(v)
                    param_idx += 1

            if not set_clauses:
                return UpdateResult(0, 0)

            where_reindexed_str, reindexed_params, _ = self._build_where(filter_dict, start_idx=param_idx)
            where_reindexed_clause = f"WHERE {where_reindexed_str}" if where_reindexed_str else ""

            update_sql = f'UPDATE "{self.table_name}" SET {", ".join(set_clauses)} {where_reindexed_clause};'
            res = await conn.execute(update_sql, *(update_vals + reindexed_params))
            count = int(res.split(" ")[-1]) if "UPDATE" in res else 0
            return UpdateResult(count, count)

    async def replace_one(self, filter_dict, doc, upsert=False):
        return await self.update_one(filter_dict, doc, upsert=upsert)

    async def delete_one(self, filter_dict):
        where_str, params, _ = self._build_where(filter_dict)
        where_clause = f"WHERE {where_str}" if where_str else ""
        async with self.pool.acquire() as conn:
            existing = await conn.fetchrow(f'SELECT id FROM "{self.table_name}" {where_clause} LIMIT 1;', *params)
            if not existing:
                return DeleteResult(0)
            await conn.execute(f'DELETE FROM "{self.table_name}" WHERE id = $1;', existing["id"])
            return DeleteResult(1)

    async def delete_many(self, filter_dict):
        where_str, params, _ = self._build_where(filter_dict)
        where_clause = f"WHERE {where_str}" if where_str else ""
        async with self.pool.acquire() as conn:
            res = await conn.execute(f'DELETE FROM "{self.table_name}" {where_clause};', *params)
            count = int(res.split(" ")[-1]) if "DELETE" in res else 0
            return DeleteResult(count)

    async def count_documents(self, filter_dict=None):
        where_str, params, _ = self._build_where(filter_dict)
        where_clause = f"WHERE {where_str}" if where_str else ""
        query = f'SELECT COUNT(*) FROM "{self.table_name}" {where_clause};'
        async with self.pool.acquire() as conn:
            count = await conn.fetchval(query, *params)
            return count or 0

    async def distinct(self, key, filter_dict=None):
        where_str, params, _ = self._build_where(filter_dict)
        where_clause = f"WHERE {where_str}" if where_str else ""
        col = f'"{key}"'
        query = f'SELECT DISTINCT {col} FROM "{self.table_name}" {where_clause} WHERE {col} IS NOT NULL;'
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [r[0] for r in rows if r[0] is not None]

    def aggregate(self, pipeline):
        async def fetcher():
            matches = []
            lookup_stage = None
            unwind_stage = None
            group_stage = None
            sort_stage = None
            
            for stage in pipeline:
                if "$match" in stage:
                    matches.append(stage["$match"])
                elif "$lookup" in stage:
                    lookup_stage = stage["$lookup"]
                elif "$unwind" in stage:
                    unwind_stage = stage["$unwind"]
                elif "$group" in stage:
                    group_stage = stage["$group"]
                elif "$sort" in stage:
                    sort_stage = stage["$sort"]

            # Dashboard: group by department
            if group_stage and group_stage.get("_id") == "$department":
                match_combined = {"$and": matches} if len(matches) > 1 else (matches[0] if matches else None)
                where_str, params, _ = self._build_where(match_combined)
                where_clause = f"WHERE {where_str}" if where_str else ""
                query = f"""
                    SELECT "department" AS _id, AVG("attendanceRate") AS "avgRate"
                    FROM "{self.table_name}"
                    {where_clause}
                    GROUP BY "department";
                """
                async with self.pool.acquire() as conn:
                    rows = await conn.fetch(query, *params)
                    return [{"_id": r["_id"], "avgRate": float(r["avgRate"]) if r["avgRate"] is not None else 100.0} for r in rows]

            # Attendance & Reports: lookup students
            if lookup_stage and lookup_stage.get("from") == "students":
                match_combined = {"$and": matches} if len(matches) > 1 else (matches[0] if matches else None)
                where_str, params, _ = self._build_where(match_combined, table_alias="a")
                where_clause = f"WHERE {where_str}" if where_str else ""
                order_clause = ""
                if sort_stage:
                    sort_items = sort_stage if isinstance(sort_stage, list) else list(sort_stage.items())
                    orders = [f'a."{k}" {"DESC" if v in (-1, "desc") else "ASC"}' for k, v in sort_items]
                    order_clause = f"ORDER BY {', '.join(orders)}"
                    
                query = f"""
                    SELECT 
                        a.*,
                        row_to_json(s.*) AS student_info
                    FROM "{self.table_name}" a
                    LEFT JOIN students s ON a."registerNo" = s."registerNo"
                    {where_clause}
                    {order_clause};
                """
                async with self.pool.acquire() as conn:
                    rows = await conn.fetch(query, *params)
                    res = []
                    for r in rows:
                        d = self._row_to_doc(r)
                        s_info = r.get("student_info")
                        if s_info:
                            if isinstance(s_info, str):
                                s_info = json.loads(s_info)
                            d["student_info"] = s_info
                        else:
                            d["student_info"] = None
                        res.append(d)
                    return res

            match_combined = {"$and": matches} if len(matches) > 1 else (matches[0] if matches else None)
            cursor = self.find(match_combined, sort=sort_stage)
            return await cursor.to_list()

        return AsyncCursor(lambda s, l, sk: fetcher())

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

class Database:
    pool: Optional[asyncpg.Pool] = None

db_instance = Database()

async def connect_to_postgres():
    logger.info("Connecting to PostgreSQL connection pool...")
    try:
        if DATABASE_URL:
            db_instance.pool = await asyncpg.create_pool(
                dsn=DATABASE_URL,
                min_size=2,
                max_size=20
            )
            logger.info("Connected successfully to PostgreSQL database using DATABASE_URL.")
        else:
            db_instance.pool = await asyncpg.create_pool(
                user=POSTGRES_USER,
                password=POSTGRES_PASSWORD,
                host=POSTGRES_HOST,
                port=POSTGRES_PORT,
                database=POSTGRES_DB,
                min_size=2,
                max_size=20
            )
            logger.info(f"Connected successfully to PostgreSQL database: {POSTGRES_DB}")
    except Exception as e:
        logger.error(f"Failed to connect to PostgreSQL: {e}")
        raise e

async def init_postgres_schema():
    """Create missing PostgreSQL tables and indexes idempotently."""
    if db_instance.pool is None:
        raise RuntimeError("Database pool not initialized. Call connect_to_postgres first.")

    logger.info("Verifying and initializing PostgreSQL schema...")
    async with db_instance.pool.acquire() as conn:
        for table_name, create_sql in TABLE_SCHEMAS.items():
            await conn.execute(create_sql)
            logger.info(f"Verified/created PostgreSQL table: {table_name}")

        for index_sql in TABLE_INDEXES:
            await conn.execute(index_sql)
        logger.info("Verified/created all PostgreSQL table indexes successfully.")

async def close_postgres_connection():
    logger.info("Closing PostgreSQL connection pool...")
    if db_instance.pool:
        await db_instance.pool.close()
        logger.info("PostgreSQL connection pool closed.")

# Backward compatibility aliases
async def connect_to_mongo():
    await connect_to_postgres()

async def close_mongo_connection():
    await close_postgres_connection()

def get_collection(name: str) -> AsyncPostgresCollection:
    if db_instance.pool is None:
        raise RuntimeError("Database not initialized. Call connect_to_postgres first.")
    return AsyncPostgresCollection(db_instance.pool, name)

def get_students_collection() -> AsyncPostgresCollection:
    return get_collection("students")

def get_attendance_collection() -> AsyncPostgresCollection:
    return get_collection("attendance")

def get_admins_collection() -> AsyncPostgresCollection:
    return get_collection("admins")

def get_settings_collection() -> AsyncPostgresCollection:
    return get_collection("settings")

def get_sessions_collection() -> AsyncPostgresCollection:
    return get_collection("sessions")

def get_leaves_collection() -> AsyncPostgresCollection:
    return get_collection("leaves")

def get_leave_letters_collection() -> AsyncPostgresCollection:
    return get_collection("leave_letters")

def get_notifications_collection() -> AsyncPostgresCollection:
    return get_collection("notifications")

def get_resets_collection() -> AsyncPostgresCollection:
    return get_collection("attendance_resets")
