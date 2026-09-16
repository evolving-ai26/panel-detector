"""
Trains a small CNN to classify car panel images as 'broken' or 'safe'.
Reads images from image_dataset/broken and image_dataset/safe
(see generate_dataset.py for how that folder was built), and saves the
trained model to image_model.h5 for app.py to load at prediction time.
"""

import tensorflow as tf
from tensorflow.keras import layers, models

IMG_SIZE = 160
BATCH_SIZE = 32
DATA_DIR = "image_dataset"

train_ds = tf.keras.utils.image_dataset_from_directory(
    DATA_DIR,
    validation_split=0.2,
    subset="training",
    seed=42,
    image_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    label_mode="binary",
)

val_ds = tf.keras.utils.image_dataset_from_directory(
    DATA_DIR,
    validation_split=0.2,
    subset="validation",
    seed=42,
    image_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    label_mode="binary",
)

class_names = train_ds.class_names  # ['broken', 'safe'] (alphabetical)
print("Class order:", class_names)

# normalize pixel values to 0-1
normalization = layers.Rescaling(1.0 / 255)

model = models.Sequential([
    layers.Input(shape=(IMG_SIZE, IMG_SIZE, 3)),
    normalization,
    layers.Conv2D(16, 3, activation="relu"),
    layers.MaxPooling2D(),
    layers.Conv2D(32, 3, activation="relu"),
    layers.MaxPooling2D(),
    layers.Conv2D(64, 3, activation="relu"),
    layers.MaxPooling2D(),
    layers.Flatten(),
    layers.Dense(64, activation="relu"),
    layers.Dropout(0.3),
    layers.Dense(1, activation="sigmoid"),  # 0 = broken, 1 = safe (alphabetical order)
])

model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
model.summary()

model.fit(train_ds, validation_data=val_ds, epochs=8)

loss, accuracy = model.evaluate(val_ds)
print(f"Validation accuracy: {accuracy * 100:.2f}%")

model.save("image_model.h5")
print("Saved trained model to image_model.h5")
