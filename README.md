# AirVista - 3D Air Quality & Environmental Analysis Platform

AirVista is an advanced, interactive web application that provides real-time air quality monitoring, 3D/2D geographic visualization, hyper-local environmental compliance tracking, and machine learning-powered predictive analytics.

## 🌟 Key Features

### 1. Dual-View Geographic Visualization
* **Interactive 3D Globe**: Built with Three.js, featuring a beautifully rendered Earth with custom starfields, atmospheric glow, and interactive glowing markers for major global cities.
* **2D Tactical Map**: Seamlessly toggle to a 2D Leaflet-powered map utilizing CartoDB/OpenStreetMap tiles, customized with a dark glassmorphism aesthetic. 
* **Synchronized State**: Searching for or clicking a location on either view perfectly syncs markers across both the Globe and the Map so you never lose track of your selected area.

### 2. Robust Real-Time Data Pipeline
* **WAQI Integration**: Fetches highly accurate, real-time Air Quality Index (AQI) and pollutant data (PM2.5, PM10, O3, NO2, etc.) from the World Air Quality Index API.
* **Multi-Tier Fallbacks**: Ensures the app never breaks. If WAQI lacks a specific station, the app cascades to OpenAQ, and finally to a highly sophisticated synthetic nearest-neighbor geocoding fallback.
* **Smart Search**: Uses OpenStreetMap's Nominatim API for both forward and reverse geocoding, allowing you to search for hyper-specific neighborhoods or simply click on the map to get accurate location names.

### 3. Machine Learning Forecasting
* **Browser-Native Time-Series Engine**: A custom JavaScript-based forecasting model utilizing Ordinary Least Squares (OLS) regression combined with Fourier transformations to predict air quality trends.
* **Geographically Aware Scenarios**: The historical data engine is context-aware. For example, it automatically mathematically injects realistic, massive AQI spikes (700-800+) during winter months for North India (Delhi) to accurately mimic the real-world effects of stubble burning and smog.
* **Deep Analysis**: Analyze historical trends ranging from the last 7 days up to the last 5 years, and predict up to 1 year into the future with dynamic confidence intervals.

### 4. Hyper-Local Compliance Engine
Provides actionable, location-specific environmental policies and regulations rather than generic advice


##  Getting Started

### Prerequisites
* A modern web browser (Chrome, Firefox, Safari, Edge).
* A local web server (e.g., Node.js `serve`, Python `http.server`, or VS Code Live Server).

### Installation
1. Clone the repository to your local machine.
2. Navigate to the project directory:
   ```bash
   cd "clone air 3d"
   ```
3. **Add your API Key**:
   * Get a free API token from [WAQI (World Air Quality Index)](https://aqicn.org/data-platform/token/).
   * Open `data-service.js` and replace `'YOUR_WAQI_API_KEY_HERE'` with your actual token.
4. Start a local development server. For example, using Node.js:
   ```bash
   npx serve .
   ```
5. Open your browser and navigate to `http://localhost:3000`.

## 🛠️ Technology Stack
* **Core**: HTML5, CSS3 (Glassmorphism UI), Vanilla JavaScript (ES6+).
* **3D Rendering**: [Three.js](https://threejs.org/)
* **2D Mapping**: [Leaflet.js](https://leafletjs.com/)
* **Charting**: [Chart.js](https://www.chartjs.org/)
* **Data Sources**: [WAQI (World Air Quality Index)](https://aqicn.org/), OpenStreetMap Nominatim.

## 📂 Project Structure
* `index.html`: The main entry point containing the UI layout.
* `style.css`: All application styling, animations, and responsive design.
* `app.js`: The central orchestrator that handles UI state, map/globe toggling, and search.
* `globe.js`: Handles all Three.js 3D rendering, starfields, and globe interactions.
* `data-service.js`: Manages API calls, fallback logic, geocoding, and the synthetic historical data generator.
* `ml-model.js`: The statistical time-series forecasting engine.
* `compliance.js`: The hyper-local environmental policy and regulation engine.

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page or submit a Pull Request.

## 📝 License
This project is open-source .
