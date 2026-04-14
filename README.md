# AI-Based ICU Mortality Prediction System (ICU Predict)

![ICU Predict Banner](banner.png)

## 📋 Overview
The **AI-Based ICU Mortality Prediction System** is a mission-critical clinical platform designed to provide real-time patient monitoring and high-accuracy mortality risk assessment. By leveraging advanced Machine Learning algorithms and WebSocket-based telemetry, the platform empowers healthcare providers to make data-driven decisions in intensive care environments.

The system features a robust **4-Tier Role-Based Access Control (RBAC)** architecture, ensuring that every user—from platform administrators to patients—has a tailored, secure, and intuitive experience.

---

## 🚀 Key Features

### 1. Clinical Real-Time Monitoring
*   **Live Vitals Streaming**: Real-time tracking of Heart Rate, SpO2, and Respiratory Rate via WebSockets.
*   **Dynamic Simulation Engine**: Background engine that simulates physiological fluctuations for testing and training.
*   **Alert System**: Immediate visual indicators for critical patient statuses.

### 2. High-Accuracy AI Predictions
*   **Risk Scoring**: Automated mortality risk assessment based on key clinical biomarkers (GCS, Blood Pressure, Glucose, etc.).
*   **Driver Analysis**: Visibility into the top physiological factors driving a patient's risk score.
*   **Recalibratable Models**: Support for local node training to adapt models to specific institutional demographics.

### 3. Enterprise-Grade RBAC (4-Tier)
*   **Level 1: Platform Admin (Service Provider)**: Global network management, hospital onboarding, and cross-institutional analytics.
*   **Level 2: Hospital Admin (Instructional)**: Local staff management (Doctors), institutional resource tracking, and local model training.
*   **Level 3: Doctor (Clinical User)**: Patient census management, real-time prediction triggers, and clinical onboarding.
*   **Level 4: Patient (Personal)**: Secure access to personal vitals, recovery trajectory, and care team information.

---

## 🛠 Tech Stack

### Backend
*   **Framework**: FastAPI (Python 3.8+)
*   **Database**: SQLAlchemy with SQLite (ORM for efficient clinical data management)
*   **Authentication**: JWT (JSON Web Tokens) with OAuth2 Bearer scheme
*   **Real-time Capabilities**: WebSockets for low-latency vital streaming

### Frontend
*   **UI/UX**: Modern Dashboard Design (Glassmorphism, Dark Mode support)
*   **Technologies**: HTML5, CSS3 (Vanilla), JavaScript (ES6+)
*   **State Management**: Real-time DOM updates via WebSocket events

### Machine Learning
*   **Libraries**: Scikit-learn, Pandas, NumPy
*   **Algorithms**: Support for SVM, Random Forest, MLP, and SGD-based recalibration

---

## 📂 Project Structure

```text
icu-predict/
├── backend/                # FastAPI Application
│   ├── main.py             # Entry point & WebSocket logic
│   ├── auth.py             # JWT & Password security
│   ├── database.py         # SQLAlchemy models & session
│   ├── model.py            # AI Prediction Engine
│   └── requirements.txt    # Python dependencies
├── hospital-dash.html      # Hospital Admin Interface
├── doctor-dash.html        # Clinical User Interface
├── user-dash.html          # Patient Interface
├── platform-dash.html      # Global Admin Interface
├── style.css               # Premium CSS design system
└── script.js               # Frontend business logic
```

---

## ⚙️ Getting Started

### Prerequisites
*   Python 3.8 or higher
*   Pip (Python package manager)

### Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/your-repo/icu-predict.git
    cd icu-predict
    ```

2.  **Install Dependencies**:
    ```bash
    pip install -r backend/requirements.txt
    ```

3.  **Seed Initial Data (Optional)**:
    ```bash
    python backend/seed.py
    ```

### Running the Application

1.  **Start the Backend Server**:
    ```bash
    python -m backend.main
    ```
    The server will start at `http://localhost:8000`.

2.  **Access the Platform**:
    Open `index.html` (or the root URL) in your browser. The system will automatically serve the static frontend via FastAPI.

---

## 🔒 Security
This platform implements industry-standard security practices:
*   Hashed password storage using `bcrypt`.
*   Token-based authentication (JWT) for all clinical API endpoints.
*   Institutional isolation (Hospitals can only see their own data).

## 🤝 Contributing
Contributions are welcome! Please follow the standard fork-and-pull-request workflow. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
