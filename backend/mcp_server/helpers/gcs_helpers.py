"""Google Cloud Storage helpers for image uploads.

Images are stored under:
    gs://{BUCKET}/mimesis/sessions/{session_id}/{filename}

Each session gets its own folder automatically.
"""

import logging
import os
from datetime import timedelta

from google.cloud import storage

logger = logging.getLogger("mimesis.tools")

# ── Configuration ─────────────────────────────────────────────────────────────

GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "gemini-live-hack")
GCS_PREFIX = "mimesis/sessions"


def _get_client() -> storage.Client:
    """Return a GCS client (uses Application Default Credentials)."""
    project = os.getenv("GOOGLE_CLOUD_PROJECT", "gemini-live-488903")
    return storage.Client(project=project)


def upload_image(
    session_id: str,
    filename: str,
    file_bytes: bytes,
    content_type: str = "image/jpeg",
) -> str:
    """Upload an image to GCS under the session-specific folder.

    Args:
        session_id: Current session ID — used to create a per-session folder.
        filename: Original filename (will be sanitized).
        file_bytes: Raw image bytes.
        content_type: MIME type of the image.

    Returns:
        The GCS URI (gs://...) of the uploaded object.
    """
    client = _get_client()
    bucket = client.bucket(GCS_BUCKET_NAME)

    # Sanitize the filename (keep only safe characters)
    safe_name = "".join(c if (c.isalnum() or c in "._-") else "_" for c in filename)
    blob_path = f"{GCS_PREFIX}/{session_id}/{safe_name}"

    blob = bucket.blob(blob_path)
    blob.upload_from_string(file_bytes, content_type=content_type)

    gcs_uri = f"gs://{GCS_BUCKET_NAME}/{blob_path}"
    logger.info(f"📸 Image uploaded: {gcs_uri} ({len(file_bytes)} bytes)")

    return gcs_uri


def get_signed_url(gcs_uri: str, expiration_minutes: int = 60) -> str:
    """Generate a signed URL for a GCS object.

    Args:
        gcs_uri: Full gs:// URI of the object.
        expiration_minutes: How long the signed URL is valid.

    Returns:
        A publicly accessible signed URL.
    """
    client = _get_client()

    # Parse gs://bucket/path
    if not gcs_uri.startswith("gs://"):
        raise ValueError(f"Invalid GCS URI: {gcs_uri}")

    parts = gcs_uri[5:].split("/", 1)
    bucket_name = parts[0]
    blob_path = parts[1]

    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)

    url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=expiration_minutes),
        method="GET",
    )
    return url


def get_public_url(gcs_uri: str) -> str:
    """Convert a gs:// URI to a public HTTPS URL.

    Note: The bucket must have public access or the object must be public.
    For private buckets, use get_signed_url() instead.
    """
    if not gcs_uri.startswith("gs://"):
        raise ValueError(f"Invalid GCS URI: {gcs_uri}")
    path = gcs_uri[5:]  # Remove "gs://"
    return f"https://storage.googleapis.com/{path}"
