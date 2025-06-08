import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score
from bson import ObjectId
import logging

class RecommendationModel:
    def __init__(self):
        self.model = LogisticRegression(random_state=42, max_iter=1000)
        self.mlb_user = MultiLabelBinarizer()
        self.mlb_post = MultiLabelBinarizer()
        self.trained = False
        self.training_metrics = {}

    def train(self, interactions):
        """
        interactions: list of dicts like:
        {
            "user_id": "123",
            "post_id": "abc",
            "label": 1  # liked or not
        }
        """
        if not interactions or len(interactions) < 10:
            logging.warning("Insufficient training data provided")
            return False
            
        try:
            user_ids = [i["user_id"] for i in interactions]
            post_ids = [i["post_id"] for i in interactions]
            labels = [i["label"] for i in interactions]

            # Ensure we have both positive and negative samples
            if len(set(labels)) < 2:
                logging.warning("Need both positive and negative samples for training")
                return False

            X_user = self.mlb_user.fit_transform([[uid] for uid in user_ids])
            X_post = self.mlb_post.fit_transform([[pid] for pid in post_ids])

            X = np.hstack([X_user, X_post])
            y = np.array(labels)

            # Split data for validation
            if len(interactions) > 20:
                X_train, X_test, y_train, y_test = train_test_split(
                    X, y, test_size=0.2, random_state=42, stratify=y
                )
                
                self.model.fit(X_train, y_train)
                
                # Calculate metrics
                y_pred = self.model.predict(X_test)
                self.training_metrics = {
                    "accuracy": accuracy_score(y_test, y_pred),
                    "precision": precision_score(y_test, y_pred, average='weighted'),
                    "recall": recall_score(y_test, y_pred, average='weighted'),
                    "training_samples": len(interactions)
                }
            else:
                # Not enough data for validation split
                self.model.fit(X, y)
                self.training_metrics = {
                    "training_samples": len(interactions)
                }

            self.trained = True
            return True
            
        except Exception as e:
            logging.error(f"Training failed: {str(e)}")
            return False

    def predict(self, user_id, post_ids):
        if not self.trained or not post_ids:
            return [0.1] * len(post_ids)  # Return low default scores

        try:
            # Handle unknown users/posts gracefully
            X_user = self.mlb_user.transform([[user_id]] * len(post_ids))
            X_post = self.mlb_post.transform([[pid] for pid in post_ids])
            X = np.hstack([X_user, X_post])

            # Check if user or posts are unknown (all zeros in transformed features)
            if X_user.sum() == 0:  # Unknown user
                # Return random scores between 0.1 and 0.3 for unknown users
                return np.random.uniform(0.1, 0.3, len(post_ids))
            
            probabilities = self.model.predict_proba(X)
            if probabilities.shape[1] > 1:
                return probabilities[:, 1]  # probability of like
            else:
                # Handle case where model only learned one class
                return [0.5] * len(post_ids)
                
        except Exception as e:
            logging.error(f"Prediction failed: {str(e)}")
            # Return default scores on error
            return [0.2] * len(post_ids)
    
    def get_training_metrics(self):
        """Return training metrics if available."""
        return self.training_metrics
