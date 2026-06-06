# Jacob Craig

import os
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Query, UploadFile, File, Form
from pydantic import BaseModel
from db import get_db_connection

router = APIRouter()


class CreateResourceRequest(BaseModel):
    title: str
    url: str
    filetype: str
    description: Optional[str] = None
    uploader_id: Optional[int] = None

# Basic whitelist for uploads
ALLOWED_RESOURCE_EXTENSIONS = {
    "pdf",
    "mp4", "mov", "mkv", "webm", "avi",
    "png", "jpg", "jpeg", "gif",
    "txt", "md", "csv",
    "doc", "docx", "ppt", "pptx", "xls", "xlsx",
    "zip",
}


def _allowed_resource_file(filename: str) -> bool:
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in ALLOWED_RESOURCE_EXTENSIONS


# ============= LIST RESOURCES =============
@router.get("", response_model=list[dict])
def list_resources(limit: int = Query(None)):
    """List resources for the main resources page."""
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    try:
        if not limit or limit <= 0:
            cur.execute(
                """
                SELECT resource_id, title, description, filetype, source, upload_date
                FROM Resource
                ORDER BY resource_id ASC
                """
            )
            rows = cur.fetchall()
        else:
            cur.callproc("GetLatestResources", [limit])
            rows = []
            for result in cur.stored_results():
                rows.extend(result.fetchall())

        return rows

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch resources",
        )
    finally:
        cur.close()
        conn.close()


# ============= CREATE RESOURCE =============
@router.post("", status_code=status.HTTP_201_CREATED, response_model=dict)
def create_resource(payload: CreateResourceRequest):
    """Create a new resource that points at a URL."""
    title = (payload.title or "").strip()
    url = (payload.url or "").strip()
    filetype = (payload.filetype or "").strip()

    if not title or not url or not filetype:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="title, url, and filetype are required",
        )

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    try:
        cur.execute(
            """
            INSERT INTO Resource (uploader_id, title, description, filetype, source, upload_date)
            VALUES (%s, %s, %s, %s, %s, NOW())
            """,
            (
                payload.uploader_id,
                title,
                payload.description or None,
                filetype.upper(),
                url,
            ),
        )
        resource_id = cur.lastrowid

        cur.execute(
            """
            SELECT resource_id, title, description, filetype, source, upload_date
            FROM Resource
            WHERE resource_id = %s
            """,
            (resource_id,),
        )
        resource = cur.fetchone()

        conn.commit()

        return resource

    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        cur.close()
        conn.close()


# ============= GET SINGLE RESOURCE =============
@router.get("/{resource_id}", response_model=dict)
def get_resource(resource_id: int):
    """Get a single resource by ID."""
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    try:
        cur.execute(
            """
            SELECT resource_id, title, description, filetype, source, upload_date
            FROM Resource
            WHERE resource_id = %s
            """,
            (resource_id,),
        )
        resource = cur.fetchone()

        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found",
            )

        return resource

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        cur.close()
        conn.close()


# ============= DELETE RESOURCE =============
@router.delete("/{resource_id}", status_code=status.HTTP_200_OK, response_model=dict)
def delete_resource(resource_id: int, uploader_id: int = Query(...)):
    """Delete a resource (owner only)."""
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    try:
        # Verify ownership
        cur.execute(
            "SELECT uploader_id FROM Resource WHERE resource_id = %s",
            (resource_id,),
        )
        resource = cur.fetchone()

        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found",
            )

        if resource["uploader_id"] != uploader_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own resources",
            )

        cur.execute("DELETE FROM Resource WHERE resource_id = %s", (resource_id,))
        conn.commit()

        return {"message": "Resource deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )

    finally:
        cur.close()
        conn.close()


@router.post("/upload-file", status_code=status.HTTP_201_CREATED, response_model=dict)
async def upload_resource_file(
    title: str = Form(...),
    filetype: str = Form(...),
    description: Optional[str] = Form(None),
    uploader_id: Optional[int] = Form(None),
    file: UploadFile = File(...),
):
    """Upload a file and create a resource record pointing to it."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty filename",
        )

    if not _allowed_resource_file(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type",
        )

    _, ext = os.path.splitext(file.filename)
    new_name = f"{os.urandom(12).hex()}{ext.lower()}"

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    resources_dir = os.path.join(base_dir, "uploads", "resources")
    os.makedirs(resources_dir, exist_ok=True)

    full_path = os.path.join(resources_dir, new_name)
    contents = await file.read()
    with open(full_path, "wb") as out:
        out.write(contents)

    url = f"/uploads/resources/{new_name}"

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    try:
        cur.execute(
            """
            INSERT INTO Resource (uploader_id, title, description, filetype, source, upload_date)
            VALUES (%s, %s, %s, %s, %s, NOW())
            """,
            (uploader_id, title.strip(), description, filetype.upper(), url),
        )
        resource_id = cur.lastrowid

        cur.execute(
            """
            SELECT resource_id, title, description, filetype, source, upload_date
            FROM Resource
            WHERE resource_id = %s
            """,
            (resource_id,),
        )
        row = cur.fetchone()

        conn.commit()
        return row

    except Exception as e:
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )
    finally:
        cur.close()
        conn.close()
