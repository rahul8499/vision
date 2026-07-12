"""
Bootstrap dataset from existing app uploads.

Run this script to automatically populate the dataset/ folder using
the prescription images already uploaded through the AARX app.

Usage:
    python3 bootstrap_dataset.py

It will copy images from django/media/prescriptions/ into:
    dataset/prescription/   ← images where user_upload_type == 'prescription'
    dataset/medicine/       ← images where user_upload_type == 'medicine'

After running, manually move any wrongly-classified images, then run train.py.
"""

import os, sys, shutil, sqlite3
from pathlib import Path

DJANGO_MEDIA = Path(__file__).parent.parent / "django" / "media" / "prescriptions"
DATASET_DIR  = Path(__file__).parent / "dataset"
DB_PATH      = Path(__file__).parent.parent / "django" / "db.sqlite3"

def main():
    if not DJANGO_MEDIA.exists():
        print(f"❌ Media folder not found: {DJANGO_MEDIA}")
        sys.exit(1)

    # Try to read upload types from SQLite
    upload_types = {}
    if DB_PATH.exists():
        try:
            con = sqlite3.connect(str(DB_PATH))
            cur = con.execute(
                "SELECT image, user_upload_type FROM prescription_prescription "
                "WHERE image != '' AND image IS NOT NULL"
            )
            for row in cur.fetchall():
                img_field, utype = row
                # img_field is like "prescriptions/filename.jpg"
                fname = Path(img_field).name
                upload_types[fname] = utype or "prescription"
            con.close()
            print(f"📋 Loaded {len(upload_types)} records from DB")
        except Exception as e:
            print(f"⚠  Could not read DB ({e}). All images → prescription/")

    copied = {"prescription": 0, "medicine": 0, "other": 0}

    for img_path in DJANGO_MEDIA.glob("*.*"):
        if img_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        utype = upload_types.get(img_path.name, "prescription")
        if utype not in ("prescription", "medicine"):
            utype = "prescription"   # default

        dest_dir = DATASET_DIR / utype
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / img_path.name
        if not dest.exists():
            shutil.copy2(img_path, dest)
            copied[utype] += 1

    print(f"\n✅ Copied:")
    for cls, n in copied.items():
        print(f"   {cls}/  → {n} images")

    print("\nNext steps:")
    print("  1. Add more images manually if needed (100+ per class is ideal)")
    print("  2. python3 train.py")

if __name__ == "__main__":
    main()
