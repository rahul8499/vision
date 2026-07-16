"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗄️ AWS S3 Presigned URL Service — AARX Platform
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Centralized service for generating presigned PUT (upload)
and GET (download) URLs for the AARX S3 bucket.

Usage:
    from core.services.s3_service import generate_presigned_upload_url, generate_presigned_download_url

    # For client-side direct upload
    url, key = generate_presigned_upload_url('prescriptions/', 'image/jpeg', '.jpg')

    # For secure download
    url = generate_presigned_download_url('prescriptions/abc123.jpg')
"""
import uuid
import logging
from django.conf import settings

logger = logging.getLogger(__name__)


def _get_s3_client():
    """Create and return a boto3 S3 client using Django settings."""
    import boto3

    return boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION_NAME,
        config=boto3.session.Config(signature_version='s3v4'),
    )


def is_s3_enabled():
    """Check if S3 storage is configured and enabled."""
    return bool(
        getattr(settings, 'AWS_ACCESS_KEY_ID', '') and
        getattr(settings, 'AWS_SECRET_ACCESS_KEY', '')
    )


def generate_presigned_upload_url(folder, content_type='application/octet-stream', extension='.bin'):
    """
    Generate a presigned PUT URL for direct client-side upload to S3.

    Args:
        folder: S3 prefix/folder path (e.g. 'prescriptions/', 'chat_images/')
        content_type: MIME type of the file being uploaded
        extension: File extension including dot (e.g. '.jpg', '.pdf')

    Returns:
        dict: {
            'upload_url': presigned PUT URL,
            'key': S3 object key (to save in DB),
            'bucket': bucket name,
            'expires_in': seconds until URL expires
        }
    """
    if not is_s3_enabled():
        raise RuntimeError("AWS S3 is not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env")

    # Ensure folder ends with /
    folder = folder.rstrip('/') + '/'

    # Generate unique filename
    unique_filename = f"{uuid.uuid4().hex}{extension}"
    object_key = f"{folder}{unique_filename}"

    expiry = getattr(settings, 'AWS_S3_PRESIGNED_URL_EXPIRY', 3600)
    bucket = settings.AWS_STORAGE_BUCKET_NAME

    try:
        client = _get_s3_client()
        presigned_url = client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket,
                'Key': object_key,
                'ContentType': content_type,
            },
            ExpiresIn=expiry,
        )

        return {
            'upload_url': presigned_url,
            'key': object_key,
            'bucket': bucket,
            'content_type': content_type,
            'expires_in': expiry,
        }
    except Exception as e:
        logger.exception("Failed to generate presigned upload URL for folder=%s", folder)
        raise


def generate_presigned_download_url(object_key, expiry=None):
    """
    Generate a presigned GET URL for downloading/viewing a file from S3.

    Args:
        object_key: The S3 object key (e.g. 'prescriptions/abc123.jpg')
        expiry: URL expiry in seconds (default from settings)

    Returns:
        str: Presigned GET URL or None if key is empty
    """
    if not object_key:
        return None

    if not is_s3_enabled():
        return None

    if expiry is None:
        expiry = getattr(settings, 'AWS_S3_PRESIGNED_URL_EXPIRY', 3600)

    bucket = settings.AWS_STORAGE_BUCKET_NAME

    try:
        client = _get_s3_client()
        presigned_url = client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': bucket,
                'Key': object_key,
            },
            ExpiresIn=expiry,
        )
        return presigned_url
    except Exception as e:
        logger.exception("Failed to generate presigned download URL for key=%s", object_key)
        return None


def get_file_url(file_field, request=None):
    """
    Universal URL resolver for any FileField/ImageField.
    Works with both S3 (presigned URLs) and local storage.

    Args:
        file_field: Django FileField/ImageField instance
        request: HTTP request (for building local absolute URIs)

    Returns:
        str: URL to access the file, or None
    """
    if not file_field or not file_field.name:
        return None

    if is_s3_enabled():
        # S3 mode: django-storages already generates presigned URLs
        # when AWS_QUERYSTRING_AUTH = True
        try:
            return file_field.url
        except Exception:
            return None
    else:
        # Local mode: build absolute URI
        try:
            url = file_field.url
            if request:
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return None


def copy_s3_object(source_key, dest_folder, dest_filename=None):
    """
    Copy an S3 object to a new location (used when creating
    PrescriptionResponse image from Prescription image).

    Args:
        source_key: Source S3 object key
        dest_folder: Destination folder path
        dest_filename: Optional destination filename (auto-generated if None)

    Returns:
        str: New object key, or None on failure
    """
    if not is_s3_enabled() or not source_key:
        return None

    bucket = settings.AWS_STORAGE_BUCKET_NAME
    dest_folder = dest_folder.rstrip('/') + '/'

    if not dest_filename:
        import os
        ext = os.path.splitext(source_key)[1] or '.bin'
        dest_filename = f"{uuid.uuid4().hex}{ext}"

    dest_key = f"{dest_folder}{dest_filename}"

    try:
        client = _get_s3_client()
        client.copy_object(
            CopySource={'Bucket': bucket, 'Key': source_key},
            Bucket=bucket,
            Key=dest_key,
        )
        return dest_key
    except Exception as e:
        logger.exception("Failed to copy S3 object from %s to %s", source_key, dest_key)
        return None
"""
MIME type mapping for common file types used in the app.
"""

MIME_TYPE_MAP = {
    # Images
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.heif': 'image/heif',

    # Documents
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

    # Audio
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.webm': 'audio/webm',

    # Video
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
}


def get_content_type(filename):
    """Get MIME type from filename extension."""
    import os
    ext = os.path.splitext(filename)[1].lower()
    return MIME_TYPE_MAP.get(ext, 'application/octet-stream')


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Allowed upload folders — whitelist for security
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALLOWED_UPLOAD_FOLDERS = {
    'prescriptions',
    'response_images',
    'store_images',
    'store_documents',
    'chat_images',
    'chat_audio',
    'chat_videos',
    'complaints',
    'platform_support',
    'pharmacist_consultations',
    'documents/licenses',
    'documents/id_proof',
}


def validate_upload_folder(folder):
    """Validate that the requested folder is in the whitelist."""
    clean = folder.strip('/')
    if clean not in ALLOWED_UPLOAD_FOLDERS:
        raise ValueError(f"Upload folder '{clean}' is not allowed. Allowed: {ALLOWED_UPLOAD_FOLDERS}")
    return clean
