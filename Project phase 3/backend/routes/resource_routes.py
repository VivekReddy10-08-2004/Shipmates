# Jacob Craig

import os
from fastapi import APIRouter, HTTPException, status, Query, UploadFile, File
from db import get_db_connection

router = APIRouter()

# Basic whitelist for uploads
ALLOWED_RESOURCE_EXTENSIONS = {"pdf", "mp4", "mov", "mkv"}


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
def create_resource(
    title: str = Query(...),
    description: str = Query(None),
    url: str = Query(...),
    filetype: str = Query(...),
    uploader_id: int = Query(...),
):
    """Create a new resource that points at a URL."""
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
            (uploader_id, title, description or None, filetype.upper(), url),
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

                   title,
                   description,
                   filetype,
                   source,
                   upload_date
            FROM Resource
            WHERE resource_id = %s
            """,
            (resource_id,),
        )
        row = cur.fetchone()

        conn.commit()
        return jsonify(row), 201

    except Exception as e:
        print("Error in /resources POST:", e)
        conn.rollback()
        return jsonify({"error": "Failed to create resource"}), 500
    finally:
        cur.close()
        conn.close()


@bp.route("/resources/upload-file", methods=["POST"])
def upload_resource_file():
    """
    upload a file (pdf / video / other) and create a Resource row that points
    at /uploads/resources/<file>
    """
    user = session.get("user")
    if not user:
        return jsonify({"error": "Not logged in"}), 401

    user_id = user["user_id"]

    title = (request.form.get("title") or "").strip()
    description = (request.form.get("description") or "").strip()
    filetype = (request.form.get("filetype") or "").strip().upper()  # PDF / VIDEO / OTHER

    if not title or not filetype:
        return jsonify({"error": "title and filetype are required"}), 400

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    if not _allowed_resource_file(file.filename):
        return jsonify({"error": "Unsupported file type"}), 400

    filename = secure_filename(file.filename)

    # uploads/resources/<filename>
    base_upload = current_app.config["UPLOAD_FOLDER"]
    resources_dir = os.path.join(base_upload, "resources")
    os.makedirs(resources_dir, exist_ok=True)

    full_path = os.path.join(resources_dir, filename)
    file.save(full_path)

    relative_path = f"resources/{filename}"
    url = f"/uploads/{relative_path}"

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)

    try:
        cur.execute(
            """
            INSERT INTO Resource (uploader_id, title, description, filetype, source, upload_date)
            VALUES (%s, %s, %s, %s, %s, NOW())
            """,
            (user_id, title, description, filetype, url),
        )
        resource_id = cur.lastrowid

        cur.execute(
            """
            SELECT resource_id,
                   title,
                   description,
                   filetype,
                   source,
                   upload_date
            FROM Resource
            WHERE resource_id = %s
            """,
            (resource_id,),
        )
        row = cur.fetchone()

        conn.commit()
        return jsonify(row), 201

    except Exception as e:
        print("Error in /resources/upload-file POST:", e)
        conn.rollback()
        return jsonify({"error": "Failed to upload resource"}), 500
    finally:
        cur.close()
        conn.close()
