from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
import asyncio
import logging
import shutil
import os
import uuid
from classifier import classify_image
from ocr_extractor import extract_prescription_text
from gemini_extractor import extract_with_gemini

app = FastAPI(title="AARX AI Image Classifier")
logger = logging.getLogger(__name__)
AI_TIMEOUT_SECONDS = int(os.environ.get("AI_TIMEOUT_SECONDS", "40"))

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
            def analyze_image():
                result = classify_image(temp_file_path, user_upload_type)
                if user_upload_type == "prescription":
                    extraction = extract_with_gemini(temp_file_path)
                    
                    if extraction and extraction.get("extracted_medicines"):
                        result.update(extraction)
                    else:
                        result.update(extract_prescription_text(temp_file_path))
                else:
                    result.update({"extracted_medicines": [], "ocr_engine": "not_applicable"})
                return result

            result = await asyncio.wait_for(
                asyncio.to_thread(analyze_image),
                timeout=AI_TIMEOUT_SECONDS,
            )
            return result
        except asyncio.TimeoutError:
            logger.warning("AI classification timed out after %s seconds", AI_TIMEOUT_SECONDS)
            return {
                "classification": "unknown",
                "score": 0.0,
                "reason": f"AI OCR timed out after {AI_TIMEOUT_SECONDS}s",
                "ocr_text": "",
                "extracted_medicines": [],
                "ocr_engine": "timeout"
            }
        
    except Exception as e:
        logger.exception("AI classification request failed")
        return {
            "classification": "unknown",
            "score": 0.0,
            "reason": f"AI service error: {str(e)}",
            "ocr_text": "",
            "extracted_medicines": [],
            "ocr_engine": "failed"
        }
    finally:
        # Clean up
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8010, reload=True)
