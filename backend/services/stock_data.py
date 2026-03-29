import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Simple caching to avoid spamming the API
CACHE = {}
CACHE_TIMEOUT = timedelta(minutes=1)

def get_stock_data(symbol: str, period: str = "1y") -> pd.DataFrame:
    """Fetch and clean stock data, with fallback to mock data if API fails."""
    now = datetime.now()
    cache_key = f"{symbol}_{period}"
    
    if cache_key in CACHE:
        cached_time, df = CACHE[cache_key]
        if now - cached_time < CACHE_TIMEOUT:
            return df
            
    try:
        url = f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range={period}"
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        resp = requests.get(url, headers=headers)
        if resp.status_code != 200:
            raise ValueError(f"HTTP {resp.status_code}")
            
        data = resp.json()
        result = data['chart']['result'][0]
        timestamps = result['timestamp']
        quote = result['indicators']['quote'][0]
        
        dates = pd.to_datetime(timestamps, unit='s')
        df = pd.DataFrame({
            'Open': quote['open'],
            'High': quote['high'],
            'Low': quote['low'],
            'Close': quote['close'],
            'Volume': quote['volume']
        }, index=dates)
        df.index.name = 'Date'
        df.dropna(how='all', inplace=True)
        if df.empty:
            raise ValueError("Empty timeframe")

    except Exception as e:
        print(f"yfinance failed for {symbol}: {e}. Falling back to mock data.")
        # Fallback Mock Data generator
        np.random.seed(sum(ord(c) for c in symbol)) # Stable generation
        days = 365 if period == '1y' else (90 if period == '3mo' else 30)
        dates = pd.date_range(end=datetime.now(), periods=days, freq='B')
        start_price = np.random.randint(100, 3000)
        returns = np.random.normal(0.001, 0.02, days)
        price_series = start_price * np.exp(returns.cumsum())
        
        df = pd.DataFrame({
            'Open': price_series * np.random.uniform(0.99, 1.01, days),
            'High': price_series * np.random.uniform(1.0, 1.03, days),
            'Low': price_series * np.random.uniform(0.97, 1.0, days),
            'Close': price_series,
            'Volume': np.random.randint(100000, 5000000, days)
        }, index=dates)
        df.index.name = 'Date'
    # Clean and organize
    # Handle missing values
    df = df.ffill().bfill()
    
    # Calculate metrics
    df['Daily Return'] = (df['Close'] - df['Open']) / df['Open']
    df['7-day MA'] = df['Close'].rolling(window=7).mean()
    
    # Custom Metric: Volatility (30-day rolling standard deviation of daily returns)
    df['Volatility Score'] = df['Daily Return'].rolling(window=30).std()
    
    df = df.fillna(0) # Fill NaNs created by rolling windows
    
    CACHE[cache_key] = (now, df)
    return df

def get_summary(symbol: str) -> dict:
    """Calculate summary statistics for a symbol."""
    df = get_stock_data(symbol, period="1y")
    
    # 52-week high, low and average close
    fifty_two_week_high = df['High'].max()
    fifty_two_week_low = df['Low'].min()
    average_close = df['Close'].mean()
    
    latest = df.iloc[-1]
    
    return {
        "symbol": symbol,
        "latest_close": float(latest['Close']),
        "52_week_high": float(fifty_two_week_high),
        "52_week_low": float(fifty_two_week_low),
        "average_close": float(average_close),
        "current_volatility": float(latest['Volatility Score'])
    }
