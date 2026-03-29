import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from backend.services.stock_data import get_stock_data
from datetime import timedelta

def predict_future_prices(symbol: str, days: int = 5) -> list[dict]:
    """
    Predicts the future closing prices using a simple Linear Regression model
    based on the last 30 days of data.
    """
    try:
        df = get_stock_data(symbol, period="3mo")
        df = df.tail(30) # Train on the last 30 days
        
        if len(df) < 5:
            return []
            
        # Prepare data for Scikit-Learn
        df = df.reset_index() # Get Date as a column
        
        # Ensure we have days as integers
        df['Days'] = (df['Date'] - df['Date'].min()).dt.days
        X = df[['Days']].values
        y = df['Close'].values
        
        # Train model
        model = LinearRegression()
        model.fit(X, y)
        
        # Predict future days
        last_date = df['Date'].max()
        last_day_int = df['Days'].max()
        
        future_predictions = []
        for i in range(1, days + 1):
            future_day_int = last_day_int + i
            future_date = last_date + timedelta(days=i)
            # Skip weekends (simplified approximation)
            if future_date.weekday() >= 5:
                future_date += timedelta(days=2)
                
            prediction = model.predict([[future_day_int]])[0]
            future_predictions.append({
                "date": future_date.strftime("%Y-%m-%d"),
                "predicted_close": float(prediction)
            })
            
        return future_predictions
    except Exception as e:
        print(f"Error predicting prices: {e}")
        return []
