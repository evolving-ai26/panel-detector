"""
Generates a SYNTHETIC placeholder image dataset of car panels, since the
real dataset (archive.zip) could not be provided/extracted.

These are procedurally drawn images, NOT real car photos:
  - "safe"   (1000 images): plain painted panel, subtle color/lighting noise
  - "dent"   (500 images):  panel with a dark curved dent-like shadow
  - "scratch"(500 images):  panel with thin bright/dark scratch lines

dent + scratch together = "broken" (1000), safe = "safe" (1000).
Folder layout written for Keras' image_dataset_from_directory:

  image_dataset/
    broken/   (1000 images: dents + scratches)
    safe/     (1000 images)

NOTE: A CNN trained on this will only prove the training/serving pipeline
works. It will NOT reliably detect damage in real car panel photos.
Replace this folder with a real dataset later without changing any other
code, then rerun train_image_model.py.
"""

import os
import random
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = "image_dataset"
IMG_SIZE = 160

random.seed(42)


def base_panel():
    """A plain-ish painted panel: soft gradient + light noise."""
    base_color = random.choice([
        (180, 185, 195), (150, 40, 40), (30, 60, 120),
        (200, 200, 200), (40, 40, 45), (120, 20, 20)
    ])
    img = Image.new("RGB", (IMG_SIZE, IMG_SIZE), base_color)
    draw = ImageDraw.Draw(img)

    # soft diagonal lighting gradient
    for i in range(IMG_SIZE):
        shade = int(20 * (i / IMG_SIZE) - 10)
        draw.line([(0, i), (IMG_SIZE, i)],
                   fill=tuple(max(0, min(255, c + shade)) for c in base_color))

    # light speckle noise
    for _ in range(300):
        x, y = random.randint(0, IMG_SIZE - 1), random.randint(0, IMG_SIZE - 1)
        n = random.randint(-15, 15)
        px = img.getpixel((x, y))
        img.putpixel((x, y), tuple(max(0, min(255, c + n)) for c in px))

    return img.filter(ImageFilter.GaussianBlur(0.6))


def add_dent(img):
    draw = ImageDraw.Draw(img)
    cx, cy = random.randint(40, IMG_SIZE - 40), random.randint(40, IMG_SIZE - 40)
    r = random.randint(18, 35)
    # dark shadow crescent + lighter highlight edge = "dent" look
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(0, 0, 0, 0))
    for dr in range(r, 0, -2):
        shade = int(60 * (1 - dr / r))
        draw.ellipse([cx - dr, cy - dr, cx + dr, cy + dr], outline=(shade, shade, shade))
    draw.ellipse([cx - r - 2, cy - r - 2, cx + r - 2, cy + r - 2],
                 outline=(255, 255, 255), width=1)
    return img.filter(ImageFilter.GaussianBlur(1.2))


def add_scratch(img):
    draw = ImageDraw.Draw(img)
    n_lines = random.randint(1, 3)
    for _ in range(n_lines):
        x1, y1 = random.randint(0, IMG_SIZE), random.randint(0, IMG_SIZE)
        length = random.randint(50, 120)
        angle = random.uniform(0, 3.14)
        x2 = int(x1 + length * random.choice([-1, 1]))
        y2 = int(y1 + length * random.uniform(-0.4, 0.4))
        color = random.choice([(230, 230, 230), (20, 20, 20)])
        draw.line([(x1, y1), (x2, y2)], fill=color, width=random.randint(1, 2))
    return img


def make_dataset():
    for cls in ["broken", "safe"]:
        os.makedirs(os.path.join(OUT_DIR, cls), exist_ok=True)

    count = 0
    for i in range(500):
        img = add_dent(base_panel())
        img.save(os.path.join(OUT_DIR, "broken", f"dent_{i:04d}.jpg"), quality=85)
        count += 1

    for i in range(500):
        img = add_scratch(base_panel())
        img.save(os.path.join(OUT_DIR, "broken", f"scratch_{i:04d}.jpg"), quality=85)
        count += 1

    for i in range(1000):
        img = base_panel()
        img.save(os.path.join(OUT_DIR, "safe", f"safe_{i:04d}.jpg"), quality=85)
        count += 1

    print(f"Generated {count} synthetic images in '{OUT_DIR}/broken' and '{OUT_DIR}/safe'.")


if __name__ == "__main__":
    make_dataset()
