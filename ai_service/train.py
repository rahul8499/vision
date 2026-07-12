"""
AARX MobileNetV3-Small Trainer
================================
Usage:
  1. Add images to:
       dataset/prescription/   ← doctor's prescription photos
       dataset/medicine/       ← medicine box / strip photos
       dataset/other/          ← random photos (selfies, etc.)

  2. Run:
       python3 train.py

  3. This saves  model.onnx  which classifier.py loads automatically.

Minimum recommended images: 100 per class (500+ is better).
"""

import os, sys, shutil, time, json
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
from torchvision import datasets, transforms, models
from PIL import Image

# ── Config ────────────────────────────────────────────────────────────────────
DATASET_DIR  = Path(__file__).parent / "dataset"
OUTPUT_ONNX  = Path(__file__).parent / "model.onnx"
OUTPUT_META  = Path(__file__).parent / "model_meta.json"

CLASSES      = ["medicine", "other", "prescription"]   # alphabetical = folder order
IMG_SIZE     = 224
BATCH_SIZE   = 16
EPOCHS       = 20
LR           = 3e-3
VAL_SPLIT    = 0.2
DEVICE       = "cuda" if torch.cuda.is_available() else "cpu"

# ── Transforms ────────────────────────────────────────────────────────────────
train_tf = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(10),
    transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2),
    transforms.RandomGrayscale(p=0.05),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

val_tf = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


class SplitDataset(torch.utils.data.Dataset):
    """Wrapper that applies a different transform to a Subset."""
    def __init__(self, subset, transform):
        self.subset = subset
        self.transform = transform
        self.classes = subset.dataset.classes

    def __len__(self):
        return len(self.subset)

    def __getitem__(self, idx):
        img, label = self.subset[idx]
        # img is already a PIL Image from ImageFolder
        return self.transform(img), label


class PILImageFolder(datasets.ImageFolder):
    """Like ImageFolder but always returns PIL images (no default transform)."""
    def __getitem__(self, index):
        path, target = self.samples[index]
        img = self.loader(path)
        return img, target


# ── Helpers ───────────────────────────────────────────────────────────────────

def check_dataset():
    total = 0
    print("\n📂 Dataset summary:")
    for cls in CLASSES:
        folder = DATASET_DIR / cls
        if not folder.exists():
            print(f"   ⚠  {cls}/  — MISSING (create and add images)")
            continue
        n = len(list(folder.glob("*.*")))
        total += n
        status = "✅" if n >= 50 else ("⚠ " if n >= 10 else "❌")
        print(f"   {status} {cls}/  — {n} images")
    print(f"   Total: {total} images\n")
    return total


def build_model(num_classes: int):
    model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.IMAGENET1K_V1)
    
    # Freeze feature extractor
    for param in model.parameters():
        param.requires_grad = False
        
    # Replace classifier head (will be trainable by default)
    in_features = model.classifier[-1].in_features
    model.classifier[-1] = nn.Linear(in_features, num_classes)
    return model


def train():
    total = check_dataset()
    if total < 3:
        print("❌ No training images found. Add images to dataset/prescription/, dataset/medicine/, dataset/other/")
        print("   Minimum: 10 images per class (100+ recommended).")
        sys.exit(1)

    print(f"🖥  Device: {DEVICE}")

    # Load all images without transform first
    full_ds = PILImageFolder(str(DATASET_DIR))
    actual_classes = full_ds.classes
    print(f"🏷  Classes detected: {actual_classes}")

    # Train / val split
    n_val   = max(1, int(len(full_ds) * VAL_SPLIT))
    n_train = len(full_ds) - n_val
    train_sub, val_sub = random_split(full_ds, [n_train, n_val],
                                      generator=torch.Generator().manual_seed(42))

    train_ds = SplitDataset(train_sub, train_tf)
    val_ds   = SplitDataset(val_sub,   val_tf)

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,  num_workers=2)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False, num_workers=2)

    model = build_model(len(actual_classes)).to(DEVICE)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(model.classifier[-1].parameters(), lr=LR, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

    best_val_acc = 0.0

    print(f"\n🚀 Training for {EPOCHS} epochs…\n")
    for epoch in range(1, EPOCHS + 1):
        t0 = time.time()
        # ─ Train ─
        model.eval() # Keep batch norm stats frozen
        model.classifier[-1].train() # Only train the head
        train_loss, train_correct, train_total = 0, 0, 0
        for imgs, labels in train_loader:
            imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
            optimizer.zero_grad()
            out  = model(imgs)
            loss = criterion(out, labels)
            loss.backward()
            optimizer.step()
            train_loss    += loss.item() * imgs.size(0)
            train_correct += (out.argmax(1) == labels).sum().item()
            train_total   += imgs.size(0)

        # ─ Val ─
        model.eval()
        val_correct, val_total = 0, 0
        with torch.no_grad():
            for imgs, labels in val_loader:
                imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
                out = model(imgs)
                val_correct += (out.argmax(1) == labels).sum().item()
                val_total   += imgs.size(0)

        scheduler.step()

        t_loss  = train_loss / train_total
        t_acc   = train_correct / train_total * 100
        v_acc   = val_correct   / val_total   * 100
        elapsed = time.time() - t0

        print(f"  Epoch {epoch:2d}/{EPOCHS} | "
              f"loss={t_loss:.4f} | train_acc={t_acc:.1f}% | "
              f"val_acc={v_acc:.1f}% | {elapsed:.1f}s")

    # ── Export to ONNX ────────────────────────────────────────────────────────
    dummy = torch.randn(1, 3, IMG_SIZE, IMG_SIZE).to(DEVICE)
    torch.onnx.export(
        model, dummy, str(OUTPUT_ONNX),
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
        opset_version=12,
    )
    print(f"📦 ONNX model saved → {OUTPUT_ONNX}")

    # ── Save metadata (class order) ───────────────────────────────────────────
    meta = {"classes": actual_classes, "img_size": IMG_SIZE}
    with open(OUTPUT_META, "w") as f:
        json.dump(meta, f)
    print(f"📋 Metadata saved   → {OUTPUT_META}")
    print("\n🎉 Done! Restart ai_service to use the new model.\n")


if __name__ == "__main__":
    train()
