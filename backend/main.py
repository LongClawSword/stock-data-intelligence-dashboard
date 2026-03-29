from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import requests

from backend.services.stock_data import get_stock_data, get_summary
from backend.services.ml_prediction import predict_future_prices

app = FastAPI(title="Stock Data Intelligence API", description="Provides stock market data, analysis, and ML predictions.")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# A predefined list of companies available for our dashboard (NSE/BSE focus)
COMPANIES = [
    {"symbol": "INFY.NS", "name": "Infosys"},
    {"symbol": "TCS.NS", "name": "Tata Consultancy Services"},
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries"},
    {"symbol": "HDFCBANK.NS", "name": "HDFC Bank"},
    {"symbol": "ICICIBANK.NS", "name": "ICICI Bank"},
    {"symbol": "SBIN.NS", "name": "State Bank of India"},
    {"symbol": "BHARTIARTL.NS", "name": "Bharti Airtel"},
]

@app.get("/api/companies", summary="Get a list of all available companies")
async def get_companies():
    """Returns a list of all predefined available companies."""
    return COMPANIES

@app.get("/api/data/{symbol}", summary="Get last 30 days of stock data")
async def get_data(symbol: str):
    """Returns the last 30 days of stock data including calculated metrics."""
    try:
        df = get_stock_data(symbol, period="3mo")
        # Extract last 30 days
        df = df.tail(30).reset_index()
        # Clean datetime
        df['Date'] = df['Date'].dt.strftime('%Y-%m-%d')
        
        records = df.to_dict(orient='records')
        return records
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/api/summary/{symbol}", summary="Get summary statistics")
async def get_stock_summary(symbol: str):
    """Returns 52-week high, low, average close, and volatility score."""
    try:
        return get_summary(symbol)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/api/compare", summary="Compare two stocks' performance")
async def compare_stocks(symbol1: str, symbol2: str):
    """Returns comparative data for two given symbols over the last 30 days."""
    try:
        df1 = get_stock_data(symbol1, period="1mo").reset_index()
        df2 = get_stock_data(symbol2, period="1mo").reset_index()
        
        df1['Date'] = df1['Date'].dt.strftime('%Y-%m-%d')
        df2['Date'] = df2['Date'].dt.strftime('%Y-%m-%d')
        
        return {
            symbol1: df1[['Date', 'Close', 'Daily Return']].to_dict(orient='records'),
            symbol2: df2[['Date', 'Close', 'Daily Return']].to_dict(orient='records')
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/search", summary="Search for company symbols")
async def search_symbols(q: str):
    """Returns a list of matching symbols using Yahoo Finance search."""
    url = f"https://query2.finance.yahoo.com/v1/finance/search?q={q}&quotesCount=5&newsCount=0"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        resp = requests.get(url, headers=headers)
        data = resp.json()
        quotes = data.get("quotes", [])
        results = [
            {"symbol": q["symbol"], "name": q.get("shortname", q.get("longname", q["symbol"]))} 
            for q in quotes 
            if q.get("quoteType") in ["EQUITY", "ETF", "MUTUALFUND"] and 
               (q["symbol"].endswith(".NS") or q["symbol"].endswith(".BO"))
        ]
        return results
    except Exception as e:
        print("Search API error:", e)
        return []

@app.get("/api/predict/{symbol}", summary="Predict next 5 days of closing prices")
async def predict_prices(symbol: str):
    """Uses a simple scikit-learn model to forecast the next 5 days closing price."""
    predictions = predict_future_prices(symbol, days=5)
    if not predictions:
        raise HTTPException(status_code=500, detail="Could not generate predictions.")
    return predictions

# Mount static files for the frontend
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

@app.get("/", summary="Serve Frontend Application", response_class=FileResponse)
async def serve_frontend():
    """Serves the main frontend dashboard index.html"""
    return os.path.join(frontend_dir, "index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
