# 🚀 Stock Data Intelligence Dashboard

A modern, high-performance financial data platform built for the **Jarnox Internship Assignment**. It features real-time stock data fetching, a custom machine learning price prediction model, an auto-documenting REST API, and a beautiful premium Glassmorphism Vanilla UI.

---

## ✨ Key Features & Insights

### 1. Robust Data Engine (Backend)
- **Real-Time Data**: Directly queries the `Yahoo Finance v8 API` using `requests` to ensure anti-fragility against User-Agent blockades.
- **Data Transformation**: Leverages `pandas` to clean data, fill missing gaps, and dynamically calculate insights:
  - **7-Day Moving Average**
  - **Daily Return** `(Close - Open) / Open`
  - **52-Week High & Low**
- **Custom Metric (Volatility)**: Calculates the rolling 30-day standard deviation of daily returns to evaluate market instability.
- **Machine Learning**: Uses `scikit-learn`'s Linear Regression models trained on the last 30 days of data to independently forecast the next 5 days of closing prices.

### 2. High-Performance APIs (FastAPI)
The backend is structured efficiently using Python's `FastAPI`, providing built-in Swagger UI documentation schemas. 
- `/api/companies`: Resolves top Indian listings.
- `/api/data/{symbol}`: Full DataFrame records.
- `/api/summary/{symbol}`: Returns condensed metrics.
- `/api/compare`: Compares dual assets.
- `/api/search`: Dynamic live search functionality strictly filtered to BSE and NSE global entities.

### 3. Visual Excellence UI (Frontend)
- **Zero-Boilerplate**: A 100% Vanilla HTML/JS/CSS web application that focuses purely on structural aesthetics and speed. 
- **Design Specifications**: Utilizes modern *Glassmorphism* layered transparencies, neon dynamic highlighting for positive/negative states, and CSS variables for a strict dark-mode color composition.
- **Dynamic Charting**: Multi-axis charting using `Chart.js` rendering the real-time stock trends superimposed identically against our custom AI trajectory logic.

---

## ⚙️ Technology Stack
* **Language:** Python 3.11+, JavaScript
* **Backend:** FastAPI, Uvicorn
* **Data Science:** Pandas, NumPy, Scikit-learn
* **Frontend:** HTML5, CSS3, Vanilla JS, Chart.js
* **DevOps:** Docker

---

## 📦 Setup & Deployment Instructions

### Option 1: Run Natively (Virtual Environment)
1. **Clone & Setup Environment**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
2. **Start the API Server**
   ```bash
   uvicorn backend.main:app --host 127.0.0.1 --port 8000
   ```
3. **Enjoy the Application**
   - Open your browser to `http://127.0.0.1:8000/` to access the dashboard.
   - Navigate to `http://127.0.0.1:8000/docs` to view the comprehensive API REST documentation.

### Option 2: Run via Docker
To isolate the application, standard containerization has been fully incorporated.
1. **Build the container**
   ```bash
   docker build -t stock-dashboard .
   ```
2. **Run the container**
   ```bash
   docker run -d -p 8000:8000 stock-dashboard
   ```
   *Dashboard available on `http://localhost:8000/`*
