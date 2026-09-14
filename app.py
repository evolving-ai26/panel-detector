"""
Panel Detector backend.
Trains the RandomForest model on startup, then serves predictions over HTTP
at POST /predict, so the website (index.html/script.js) can fetch() results.
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

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


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
