"""
Panel Detector backend.
Trains the RandomForest model on startup, then serves predictions over HTTP
at POST /predict, so the website (index.html/script.js) can fetch() results.
"""

import os
import io
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import numpy as np
from PIL import Image
from ai_edge_litert.interpreter import Interpreter

app = Flask(__name__)
CORS(app)  # allows index.html (opened as a file/page) to call this server

# --- Train the model once, when the server starts ---
data = pd.read_csv("panel_dataset.csv")
X = data[['stress', 'strain', 'yield_strength']]
y = data['label']

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

accuracy = accuracy_score(y_test, model.predict(X_test))
print(f"Model trained. Test accuracy: {accuracy * 100:.2f}%")

# --- Load the image CNN (trained by train_image_model.py, converted to TFLite) ---
IMG_SIZE = 160
image_interpreter = Interpreter(model_path="image_model.tflite")
image_interpreter.allocate_tensors()
IMAGE_INPUT_DETAILS = image_interpreter.get_input_details()
IMAGE_OUTPUT_DETAILS = image_interpreter.get_output_details()


def predict_image(file_bytes):
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB").resize((IMG_SIZE, IMG_SIZE))
    arr = np.array(img, dtype="float32")
    arr = np.expand_dims(arr, axis=0)  # model has its own Rescaling layer

    image_interpreter.set_tensor(IMAGE_INPUT_DETAILS[0]['index'], arr)
    image_interpreter.invoke()
    prob_safe = float(image_interpreter.get_tensor(IMAGE_OUTPUT_DETAILS[0]['index'])[0][0])

    label = "Pass" if prob_safe >= 0.5 else "Broken"
    confidence = prob_safe if label == "Pass" else 1 - prob_safe
    return label, confidence


@app.route('/predict', methods=['POST'])
def predict():
    payload = request.get_json()

    try:
        stress = float(payload['stress'])
        strain = float(payload['strain'])
        yield_strength = float(payload['yield_strength'])
    except (KeyError, TypeError, ValueError):
        return jsonify({'error': 'stress, strain and yield_strength must be numbers'}), 400

    prediction = model.predict([[stress, strain, yield_strength]])[0]
    physics_check = "Pass" if stress < yield_strength else "Broken"

    return jsonify({
        'status': prediction,
        'physics_check': physics_check
    })


@app.route('/predict_image', methods=['POST'])
def predict_image_route():
    if 'image' not in request.files:
        return jsonify({'error': 'No image file uploaded (expected field name "image")'}), 400

    file = request.files['image']

    try:
        label, confidence = predict_image(file.read())
    except Exception:
        return jsonify({'error': 'Could not read the uploaded file as an image'}), 400

    return jsonify({
        'status': label,
        'confidence': round(confidence * 100, 2)
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
