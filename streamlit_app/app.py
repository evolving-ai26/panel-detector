"""
Panel Detector — Streamlit version.
Standalone experiment, independent of the Netlify/Render deployment.
One file does UI + model, no separate frontend/backend/JSON wiring needed.
"""

import streamlit as st
import pandas as pd
import numpy as np
from PIL import Image
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from ai_edge_litert.interpreter import Interpreter

st.set_page_config(page_title="Panel Detector", page_icon="🚘", layout="centered")

# ---------- Train the RandomForest once, cached ----------
@st.cache_resource
def load_data_model():
    data = pd.read_csv("panel_dataset.csv")
    X = data[['stress', 'strain', 'yield_strength']]
    y = data['label']
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    return model

@st.cache_resource
def load_image_model():
    interpreter = Interpreter(model_path="image_model.tflite")
    interpreter.allocate_tensors()
    return interpreter

data_model = load_data_model()
image_interpreter = load_image_model()
IMG_SIZE = 160


def predict_image(pil_image):
    img = pil_image.convert("RGB").resize((IMG_SIZE, IMG_SIZE))
    arr = np.expand_dims(np.array(img, dtype="float32"), axis=0)

    input_details = image_interpreter.get_input_details()
    output_details = image_interpreter.get_output_details()

    image_interpreter.set_tensor(input_details[0]['index'], arr)
    image_interpreter.invoke()
    prob_safe = float(image_interpreter.get_tensor(output_details[0]['index'])[0][0])

    label = "Pass" if prob_safe >= 0.5 else "Broken"
    confidence = prob_safe if label == "Pass" else 1 - prob_safe
    return label, confidence


# ---------- UI ----------
st.title("🚘 Panel Detector")
st.caption("Streamlit experiment — separate from the main deployed site.")

tab_data, tab_image = st.tabs(["📊 Enter Measurements", "🖼️ Upload Image"])

with tab_data:
    st.subheader("Panel Measurements")
    col1, col2, col3 = st.columns(3)
    stress = col1.number_input("Stress (MPa)", value=188.0)
    strain = col2.number_input("Strain (mm/mm)", value=0.38, format="%.3f")
    yield_strength = col3.number_input("Yield Strength (MPa)", value=191.0)

    if st.button("Analyze Panel", key="analyze_data"):
        prediction = data_model.predict([[stress, strain, yield_strength]])[0]
        physics_check = "Pass" if stress < yield_strength else "Broken"

        if prediction == "Pass":
            st.success(f"✓ PASS — Model prediction: {prediction}")
        else:
            st.error(f"⚠ DEFECT DETECTED — Model prediction: {prediction}")
        st.caption(f"Physics check (stress < yield strength): {physics_check}")

with tab_image:
    st.subheader("Upload Car Panel Image")
    st.info("This model is trained on a synthetic placeholder dataset (procedurally generated scratch/dent/safe images), not real photos — treat results as a pipeline demo, not real damage detection.")

    uploaded = st.file_uploader("Choose an image", type=["jpg", "jpeg", "png"])

    if uploaded:
        image = Image.open(uploaded)
        st.image(image, caption="Uploaded panel", width=250)

        if st.button("Analyze Panel", key="analyze_image"):
            label, confidence = predict_image(image)
            if label == "Pass":
                st.success(f"✓ PASS — Confidence: {confidence * 100:.2f}%")
            else:
                st.error(f"⚠ DEFECT DETECTED — Confidence: {confidence * 100:.2f}%")
