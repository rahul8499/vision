from django.urls import path
from core.views.s3_views import PresignedUploadURLView, PresignedDownloadURLView

urlpatterns = [
    path('presigned-upload/', PresignedUploadURLView.as_view(), name='s3_presigned_upload'),
    path('presigned-download/', PresignedDownloadURLView.as_view(), name='s3_presigned_download'),
]
