"""Image utilities for Nano Banana generation and GCS image handling.

Uses raw bytes for image data to avoid PIL dependency issues.
PIL is only used optionally for advanced operations.
"""

import io
import logging
import base64

from mcp_server.helpers.gcs_helpers import _get_client, GCS_BUCKET_NAME, GCS_PREFIX

logger = logging.getLogger("mimesis.tools")


def download_image_bytes(gcs_uri: str) -> bytes:
    """Download an image from GCS and return raw bytes.

    Args:
        gcs_uri: Full gs:// URI (e.g. gs://bucket/path/to/image.jpg)

    Returns:
        Raw image bytes.
    """
    if not gcs_uri.startswith("gs://"):
        raise ValueError(f"Invalid GCS URI: {gcs_uri}")

    parts = gcs_uri[5:].split("/", 1)
    bucket_name = parts[0]
    blob_path = parts[1]

    client = _get_client()
    bucket = client.bucket(bucket_name)
    blob = bucket.blob(blob_path)

    image_bytes = blob.download_as_bytes()

    logger.info(f"📸 Downloaded image from GCS: {gcs_uri} ({len(image_bytes)} bytes)")
    return image_bytes


def upload_image_bytes(
    session_id: str,
    image_name: str,
    image_bytes: bytes,
    content_type: str = "image/png",
) -> str:
    """Upload image bytes to GCS and return the gs:// URI.

    Images are stored under: gs://{BUCKET}/mimesis/sessions/{session_id}/generated/{image_name}

    Args:
        session_id: Current session ID.
        image_name: Filename for the image (e.g. 'anchor_image.png').
        image_bytes: Raw image bytes to upload.
        content_type: MIME type of the image.

    Returns:
        GCS URI of the uploaded image.
    """
    blob_path = f"{GCS_PREFIX}/{session_id}/generated/{image_name}"

    client = _get_client()
    bucket = client.bucket(GCS_BUCKET_NAME)
    blob = bucket.blob(blob_path)
    blob.upload_from_string(image_bytes, content_type=content_type)

    gcs_uri = f"gs://{GCS_BUCKET_NAME}/{blob_path}"
    logger.info(f"📸 Generated image uploaded: {gcs_uri} ({len(image_bytes)} bytes)")

    return gcs_uri


def extract_image_bytes(response) -> bytes | None:
    """Extract the first image's raw bytes from a Nano Banana response.

    Args:
        response: The response from client.models.generate_content()

    Returns:
        Raw image bytes if found, None otherwise.
    """
    for part in response.parts:
        if part.inline_data is not None:
            data = part.inline_data.data
            # Handle both raw bytes and base64 strings
            if isinstance(data, str):
                return base64.b64decode(data)
            return data
    return None


def extract_text_from_response(response) -> str:
    """Extract all text parts from a Nano Banana response.

    Args:
        response: The response from client.models.generate_content()

    Returns:
        Concatenated text from all text parts.
    """
    texts = []
    for part in response.parts:
        if part.text is not None:
            texts.append(part.text)
    return "\n".join(texts)


def build_image_part(image_bytes: bytes, mime_type: str = "image/png"):
    """Build an inline_data part for passing an image as reference to Nano Banana.

    Args:
        image_bytes: Raw image bytes.
        mime_type: MIME type of the image.

    Returns:
        A Part object for the generate_content API.
    """
    from google.genai import types

    return types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
