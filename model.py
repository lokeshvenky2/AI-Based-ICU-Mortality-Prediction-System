import numpy as np
import random

class ICUPredictor:
    """
    Simulates a Clinical Risk Model for ICU Mortality Prediction.
    In a real-world scenario, this would load a pre-trained scikit-learn or PyTorch model.
    """
    def __init__(self):
        # Initializing weights (simulating a linear/logistic regression model coefficients)
        self.weights = {
            'age': 0.015,
            'heart_rate': 0.12,
            'blood_pressure': -0.08,  # Inverse relationship
            'temp': 0.05,
            'gcs': -0.5,  # Glasgow Coma Scale (inverse risk)
            'glucose': 0.02
        }

    def predict(self, data):
        """
        Calculates the mortality risk score and status.
        :param data: Dictionary containing patient clinical parameters
        """
        score = 40  # Baseline risk
        
        # Contribution Calculation
        score += (data.get('age', 40) - 40) * self.weights['age']
        score += (data.get('heart_rate', 80) - 80) * self.weights['heart_rate']
        score += (120 - data.get('blood_pressure', 120)) * abs(self.weights['blood_pressure'])
        score += (data.get('glucose', 100) - 100) * self.weights['glucose']
        
        # GCS (Coma Scale) is a strong inverse predictor (lower is worse)
        gcs = data.get('gcs', 15)
        score += (15 - gcs) * 5
        
        # Normalization (0 - 100%)
        risk_percentage = min(max(score, 5), 98)
        
        status = "Stable"
        if risk_percentage > 70:
            status = "Critical"
        elif risk_percentage > 40:
            status = "High Risk"
        elif risk_percentage > 20:
            status = "Guarded"
            
        # --- Explainable AI (XAI): Calculate Risk Factors ---
        contributions = {
            'Age': round(abs(data.get('age', 40) - 40) * self.weights['age'], 2),
            'Heart Rate': round(abs(data.get('heart_rate', 80) - 80) * self.weights['heart_rate'], 2),
            'Blood Pressure': round(abs(120 - data.get('blood_pressure', 120)) * abs(self.weights['blood_pressure']), 2),
            'Glucose': round(abs(data.get('glucose', 100) - 100) * self.weights['glucose'], 2),
            'Neurological (GCS)': round((15 - data.get('gcs', 15)) * 5, 2)
        }
        
        # Sort factors by impact
        sorted_factors = sorted(contributions.items(), key=lambda x: x[1], reverse=True)
        top_factors = dict(sorted_factors[:3]) # Top 3 contributors

        return {
            "risk_score": round(risk_percentage, 1),
            "status": status,
            "confidence": round(0.85 + (random.uniform(-0.05, 0.05)), 2),
            "xai_factors": contributions,
            "top_drivers": top_factors
        }

    def update_weights(self, node_weights):
        """
        Simulates Federated Learning Aggregation.
        Averages current global weights with the new weights from an institutional node.
        """
        print(f"Federated Learning: Aggregating new node weights...")
        for key in self.weights:
            if key in node_weights:
                # Weighted average simulation (Aggregator: 0.8 Global, 0.2 Local)
                self.weights[key] = (self.weights[key] * 0.8) + (node_weights[key] * 0.2)
        return True

# Global Instance
predictor = ICUPredictor()
