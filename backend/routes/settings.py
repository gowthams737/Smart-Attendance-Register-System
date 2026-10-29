from fastapi import APIRouter, HTTPException, status
import logging

from backend.db import get_settings_collection
from backend.models import SettingsBase, SettingsResponse

router = APIRouter(prefix="/settings", tags=["settings"])
logger = logging.getLogger("smart_attendance")

@router.get("", response_model=SettingsResponse)
async def get_settings():
    coll = get_settings_collection()
    doc = await coll.find_one({})
    if not doc:
        # Return default settings
        default_settings = SettingsBase()
        return default_settings
    
    # Map _id to id or remove it
    if "_id" in doc:
        del doc["_id"]
    return doc

@router.put("", response_model=SettingsResponse)
async def update_settings(settings: SettingsBase):
    coll = get_settings_collection()
    doc = settings.model_dump()
    
    # Upsert the settings
    await coll.replace_one({}, doc, upsert=True)
    return doc
