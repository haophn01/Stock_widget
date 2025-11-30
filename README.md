📈 Stock Monitor  
A real-time stock monitoring dashboard with WebSocket live data, alert rules, WebEx notifications, caching, containerization, and full CI/CD automation.



🚀 Overview  
Stock Monitor is a modern live stock analytics dashboard that streams stock prices, renders real-time charts, evaluates alert rules, and delivers notifications through a WebEx bot.  
It includes Docker-based deployment, Redis caching, and GitHub Actions CI/CD powered by a self-hosted runner.

Built as a DevOps automation project integrating **7+ different technologies** across backend, frontend, alerts, and deployment.



Features:

->  Real-Time Stock Prices  
    - FastAPI WebSocket stream (`/ws/prices`)  
    - Live market data updates every few seconds  
    - Interactive price trend chart (Chart.js)

->  Stock Alert Rules  
    - Example rules:  
      - AAPL > 200  
      - TSLA > 180  
      - NVDA > 1000  
    - Alerts sent to:
      - WebEx bot room  
      - Dashboard “Recent Alerts” section  
    - Configurable with cooldown logic  
    
->  Intelligent Backend  
    - FastAPI microservice  
    - Redis price caching  
    - Finnhub REST API integration  
    - WebSocket live update engine  
    - WebEx bot message API  
    
->  Beautiful Frontend  
    - Modern UI (Netflix + Apple hybrid theme)  
    - Light / Dark mode toggle  
    - Animated glow-hover cards  
    - Shimmer loading rows  
    - Chart.js real-time line chart  
    - Minimal, responsive HTML/CSS/JS (no frameworks)
    
->  Docker Architecture  
    - Backend container  
    - Frontend (Nginx) container  
    - Redis cache container  
    - `docker-compose` orchestration  
    - `.env`-driven config
    
->  CI/CD with GitHub Actions  
    - Automated tests  
    - Build & push Docker image  
    - Deploy to lab VM using a **self-hosted runner**  
    - SSH-based deployment pipeline  


 Architecture Diagram  

             ┌──────────────────────────────┐
             │         Frontend UI          │
             │   (HTML/CSS/JS + Chart.js)   │
             │         Nginx server         │
             └──────────────┬───────────────┘
                            │ WebSocket + REST
                            ▼
             ┌──────────────────────────────┐
             │          FastAPI API          │
             │ /ws/prices | /alerts | /api   │
             └──────────────┬───────────────┘
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
     ┌──────────────────┐      ┌──────────────────┐
     │   Redis Cache    │      │    Finnhub API   │
     └──────────────────┘      └──────────────────┘

                           Alerts
                             ▼
                 ┌────────────────────────┐
                 │    WebEx Bot Notify    │
                 └────────────────────────┘



->  Project Structure:

Stock_widget/
│
├── backend/
│ ├── main.py
│ ├── models.py
│ ├── cache_service.py
│ ├── alert_service.py
│ ├── stocks_service.py
│ ├── webex_service.py
│ ├── requirements.txt
│ └── Dockerfile
│
├── frontend/
│ ├── index.html
│ ├── styles.css
│ ├── app.js
│ └── Dockerfile (optional)
│
├── docker-compose.yml
├── .github/workflows/ci-cd.yml
├── .gitignore
└── README.md
