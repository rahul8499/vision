from fastapi import FastAPI, UploadFile, File, HTTPException, Form
import asyncio
import logging
import shutil
import os
import uuid
from classifier import classify_image

app = FastAPI(title="AARX AI Image Classifier")
logger = logging.getLogger(__name__)
AI_TIMEOUT_SECONDS = int(os.environ.get("AI_TIMEOUT_SECONDS", "12"))

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/classify-prescription-image")
async def classify_prescription_image(
    file: UploadFile = File(...),
    user_upload_type: str = Form("prescription")
):
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
        
    temp_file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
    
    try:
        # Save uploaded file temporarily
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Run fast classification
        try:
            result = await asyncio.wait_for(
                asyncio.to_thread(classify_image, temp_file_path, user_upload_type),
                timeout=AI_TIMEOUT_SECONDS,
            )
            return result
        except asyncio.TimeoutError:
            logger.warning("AI classification timed out after %s seconds", AI_TIMEOUT_SECONDS)
            return {
                "classification": "unknown",
                "score": 0.0,
                "reason": f"AI OCR timed out after {AI_TIMEOUT_SECONDS}s",
                "ocr_text": ""
            }
        
    except Exception as e:
        logger.exception("AI classification request failed")
        return {
            "classification": "unknown",
            "score": 0.0,
            "reason": f"AI service error: {str(e)}",
            "ocr_text": ""
        }
    finally:
        # Clean up
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8010, reload=True)
