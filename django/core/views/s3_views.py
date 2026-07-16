"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗄️ S3 Presigned URL API Views
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
API endpoints for generating presigned upload and download URLs.
Used by React Native frontend for direct S3 uploads.
"""
import os
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from prescription.authentication import StoreTokenAuthentication, UserTokenAuthentication
from core.services.s3_service import (
    generate_presigned_upload_url,
    generate_presigned_download_url,
    get_content_type,
    validate_upload_folder,
    is_s3_enabled,
)

logger = logging.getLogger(__name__)


class PresignedUploadURLView(APIView):
    """
    POST /api/s3/presigned-upload/
    
    Generate a presigned PUT URL for direct client-side upload to S3.
    
    Request body:
    {
        "folder": "prescriptions",         // Required: upload destination
        "filename": "photo.jpg",           // Required: original filename (for extension/mime)
        "content_type": "image/jpeg"       // Optional: override MIME type
    }
    
    Response:
    {
        "upload_url": "https://s3.amazonaws.com/...",  // PUT this URL with file body
        "key": "prescriptions/abc123.jpg",             // Save this key in DB
        "content_type": "image/jpeg",
        "expires_in": 3600
    }
    """
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not is_s3_enabled():
            return Response(
                {"error": "S3 storage is not configured on this server."},
                status=503,
            )

        folder = (request.data.get('folder') or '').strip()
        filename = (request.data.get('filename') or '').strip()

        if not folder or not filename:
            return Response(
                {"error": "Both 'folder' and 'filename' are required."},
                status=400,
            )

        # Security: validate folder is in whitelist
        try:
            folder = validate_upload_folder(folder)
        except ValueError as e:
            return Response({"error": str(e)}, status=400)

        # Determine content type from filename or explicit override
        content_type = request.data.get('content_type') or get_content_type(filename)
        extension = os.path.splitext(filename)[1].lower() or '.bin'

        try:
            result = generate_presigned_upload_url(
                folder=folder,
                content_type=content_type,
                extension=extension,
            )
            return Response(result, status=200)
        except Exception as e:
            logger.exception("Presigned upload URL generation failed")
            return Response(
                {"error": "Failed to generate upload URL. Please try again."},
                status=500,
            )


class PresignedDownloadURLView(APIView):
    """
    POST /api/s3/presigned-download/
    
    Generate a presigned GET URL to view/download a file from S3.
    
    Request body:
    {
        "key": "prescriptions/abc123.jpg"   // Required: S3 object key
    }
    
    Response:
    {
        "download_url": "https://s3.amazonaws.com/...",
        "expires_in": 3600
    }
    """
    authentication_classes = [StoreTokenAuthentication, UserTokenAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not is_s3_enabled():
            return Response(
                {"error": "S3 storage is not configured on this server."},
                status=503,
            )

        key = (request.data.get('key') or '').strip()
        if not key:
            return Response(
                {"error": "'key' is required."},
                status=400,
            )

        try:
            url = generate_presigned_download_url(key)
            if not url:
                return Response(
                    {"error": "Failed to generate download URL."},
                    status=500,
                )
            from django.conf import settings
            return Response({
                "download_url": url,
                "expires_in": getattr(settings, 'AWS_S3_PRESIGNED_URL_EXPIRY', 3600),
            }, status=200)
        except Exception as e:
            logger.exception("Presigned download URL generation failed")
            return Response(
                {"error": "Failed to generate download URL."},
                status=500,
            )
