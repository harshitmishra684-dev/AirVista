/**
 * Main Application Controller
 * Orchestrates the 3D Globe, Data Service, ML Model, and Compliance modules
 */

(function () {
    'use strict';

    // Application State
    const state = {
        currentData: null,
        historicalData: null,
        predictions: null,
        selectedLat: null,
        selectedLng: null,
        charts: {},
        isLoading: false,
        mapVisible: true, // Default to 2D Map
        leafletMap: null,
        mapMarker: null
    };

    // DOM Elements
    const elements = {};

    /**
     * Initialize the application
     */
    function init() {
        cacheElements();
        initGlobe();
        initMap();
        setupNavigation();
        setupEventListeners();
        setupMapToggle();
        hideLoadingScreen();
    }

    /**
     * Cache frequently-used DOM elements
     */
    function cacheElements() {
        elements.loadingScreen = document.getElementById('loading-screen');
        elements.dataPanel = document.getElementById('data-panel');
        elements.panelClose = document.getElementById('panel-close');
        elements.searchInput = document.getElementById('search-input');
        elements.searchBtn = document.getElementById('search-btn');
        elements.coordsDisplay = document.getElementById('coords-display');
        elements.coordsValue = document.getElementById('coords-value');
        elements.panelCity = document.getElementById('panel-city');
        elements.panelCoords = document.getElementById('panel-coords');
        elements.aqiBadge = document.getElementById('aqi-badge');
        elements.aqiValue = document.getElementById('aqi-value');
        elements.aqiStatusBar = document.getElementById('aqi-status-bar');
        elements.aqiStatusText = document.getElementById('aqi-status-text');
        elements.aqiStatusDesc = document.getElementById('aqi-status-desc');
        elements.pollutantsGrid = document.getElementById('pollutants-grid');
        elements.weatherGrid = document.getElementById('weather-grid');
        elements.stationName = document.getElementById('station-name');
        elements.stationTime = document.getElementById('station-time');
        elements.globeInstructions = document.getElementById('globe-instructions');
    }

    /**
     * Initialize the 3D Globe
     */
    function initGlobe() {
        const container = document.getElementById('globe-container');
        Globe.init(container, onLocationSelected);

        // Globe controls
        document.getElementById('btn-zoom-in')?.addEventListener('click', Globe.zoomIn);
        document.getElementById('btn-zoom-out')?.addEventListener('click', Globe.zoomOut);
        document.getElementById('btn-reset')?.addEventListener('click', Globe.resetView);
        document.getElementById('btn-auto-rotate')?.addEventListener('click', () => {
            const isRotating = Globe.toggleAutoRotate();
            showToast(isRotating ? 'Auto-rotation enabled' : 'Auto-rotation disabled', 'info');
        });
    }

    /**
     * Initialize the Leaflet 2D Map (lazy — created on first toggle)
     */
    function initMap() {
        // Map is now the default view, so we initialize it immediately
        createLeafletMap();
        
        const mapOverlay = document.getElementById('map-overlay');
        const globeContainer = document.getElementById('globe-container');
        const labelsContainer = document.getElementById('labels-container');
        const globeControls = document.querySelector('.globe-controls');
        const btn = document.getElementById('btn-toggle-map');
        
        if (mapOverlay) mapOverlay.style.display = 'block';
        if (globeContainer) globeContainer.style.visibility = 'hidden';
        if (labelsContainer) labelsContainer.style.display = 'none';
        if (globeControls) globeControls.style.display = 'none';
        
        if (btn) {
            btn.classList.add('active');
            const span = btn.querySelector('span');
            if (span) span.textContent = 'GLOBE';
            const icon = btn.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-map-location-dot');
                icon.classList.add('fa-earth-americas');
            }
        }
        
        setTimeout(() => state.leafletMap.invalidateSize(), 100);
    }

    /**
     * Create the Leaflet map instance
     */
    function createLeafletMap() {
        if (state.leafletMap) return; // already created

        const map = L.map('leaflet-map', {
            center: [20, 0],
            zoom: 3,
            minZoom: 2,
            maxZoom: 18,
            zoomControl: true,
            attributionControl: true
        });

        // Free OpenStreetMap tiles (dark appearance via CSS filter)
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);

        // Click handler — same flow as globe click
        map.on('click', async (e) => {
            const { lat, lng } = e.latlng;
            
            // Remove old marker
            if (state.mapMarker) {
                map.removeLayer(state.mapMarker);
            }

            // Add pulsing marker
            const pulseIcon = L.divIcon({
                className: 'map-marker-pulse',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            state.mapMarker = L.marker([lat, lng], { icon: pulseIcon }).addTo(map);

            // Show popup with loading state
            showMapMarkerAndPopup(lat, lng, null, true);

            // Trigger the same data flow as the globe
            try {
                const data = await DataService.fetchByCoords(lat, lng);
                state.currentData = data;
                state.selectedLat = lat;
                state.selectedLng = lng;

                showMapMarkerAndPopup(lat, lng, data, false);

                // Also open the side panel with full details
                openDataPanel();
                updateDataPanel(data);

                state.historicalData = DataService.generateHistoricalData(data, 365);
                Compliance.updateAll(data);

                showToast(`Data loaded: ${data.city}`, 'success');
            } catch (error) {
                showMapMarkerAndPopup(lat, lng, { error: true }, false);
                showToast('Failed to fetch data', 'error');
            }
        });

        state.leafletMap = map;
    }

    /**
     * Shared logic to display the marker and popup on the 2D map
     * Used by both map click and search functionality
     */
    function showMapMarkerAndPopup(lat, lng, data, isLoading) {
        if (!state.leafletMap) return;

        // Ensure marker exists
        if (!state.mapMarker) {
            const pulseIcon = L.divIcon({ className: 'map-marker-pulse', iconSize: [20, 20], iconAnchor: [10, 10] });
            state.mapMarker = L.marker([lat, lng], { icon: pulseIcon }).addTo(state.leafletMap);
        } else {
            state.mapMarker.setLatLng([lat, lng]);
        }

        // Close/Remove logic bound to popup
        const onPopupClose = () => {
            if (state.mapMarker) {
                state.leafletMap.removeLayer(state.mapMarker);
                state.mapMarker = null;
            }
            closeDataPanel();
        };

        if (isLoading) {
            const popup = L.popup({ closeOnClick: false, autoClose: false })
                .setContent(`
                    <div class="map-popup-title">Loading Air Quality...</div>
                    <div class="map-popup-coords">${lat.toFixed(4)}°, ${lng.toFixed(4)}°</div>
                    <div class="map-popup-loading">Fetching data</div>
                `);
            
            state.mapMarker.bindPopup(popup).openPopup();
            // Need to wait for it to be added to DOM to bind the event
            state.mapMarker.off('popupclose');
            state.mapMarker.on('popupclose', onPopupClose);
            return;
        }

        if (data && data.error) {
            const popup = L.popup({ closeOnClick: false, autoClose: false })
                .setContent(`
                    <div class="map-popup-title">Error</div>
                    <div class="map-popup-coords">${lat.toFixed(4)}°, ${lng.toFixed(4)}°</div>
                    <div style="color: #ef4444; font-size: 12px;">Could not load data for this location</div>
                `);
            state.mapMarker.bindPopup(popup).openPopup();
            return;
        }

        if (data) {
            const category = DataService.getAQICategory(data.aqi);
            const sourceLabel = data.source === 'openaq' ? ' (OpenAQ)' : data.source === 'synthetic' ? ' (Estimated)' : '';

            const popup = L.popup({ closeOnClick: false, autoClose: false })
                .setContent(`
                    <div class="map-popup-title">${data.city}${sourceLabel}</div>
                    <div class="map-popup-coords">${lat.toFixed(4)}°, ${lng.toFixed(4)}°</div>
                    <div style="margin: 8px 0; display: flex; align-items: center; gap: 8px;">
                        <span style="display: inline-block; background: ${category.color}; color: #fff; padding: 3px 10px; border-radius: 8px; font-weight: 700; font-size: 16px;">${data.aqi}</span>
                        <span style="color: ${category.color}; font-weight: 600; font-size: 13px;">${category.level}</span>
                    </div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${category.description.substring(0, 100)}...</div>
                `);
            
            state.mapMarker.bindPopup(popup).openPopup();
            state.mapMarker.off('popupclose');
            state.mapMarker.on('popupclose', onPopupClose);
        }
    }

    /**
     * Center the 2D map on a location, offset by the sidebar width if open
     */
    function centerMapOn(lat, lng, zoom = 10) {
        if (!state.leafletMap) return;
        
        // Center normally first
        state.leafletMap.setView([lat, lng], zoom, { animate: true });
        
        // If the sidebar is open (or about to open), offset the map by half the sidebar width
        // Sidebar is ~400px wide. Panning camera right by 200px moves the marker left by 200px.
        setTimeout(() => {
            if (elements.dataPanel && elements.dataPanel.classList.contains('open')) {
                state.leafletMap.panBy([200, 0], { animate: true });
            }
        }, 300); // slight delay to allow setView animation to start
    }

    /**
     * Setup the Map toggle button
     */
    function setupMapToggle() {
        const btn = document.getElementById('btn-toggle-map');
        const mapOverlay = document.getElementById('map-overlay');
        const globeContainer = document.getElementById('globe-container');
        const labelsContainer = document.getElementById('labels-container');
        const globeControls = document.querySelector('.globe-controls');

        if (!btn || !mapOverlay) return;

        btn.addEventListener('click', () => {
            state.mapVisible = !state.mapVisible;

            if (state.mapVisible) {
                // Show map, hide globe
                mapOverlay.style.display = 'block';
                if (globeContainer) globeContainer.style.visibility = 'hidden';
                if (labelsContainer) labelsContainer.style.display = 'none';
                if (globeControls) globeControls.style.display = 'none';
                btn.classList.add('active');
                btn.querySelector('span').textContent = 'GLOBE';
                btn.querySelector('i').classList.remove('fa-map-location-dot');
                btn.querySelector('i').classList.add('fa-earth-americas');

                // Create map on first open
                createLeafletMap();
                setTimeout(() => state.leafletMap.invalidateSize(), 100);

                // If we have a selected location, fly to it
                if (state.selectedLat && state.selectedLng) {
                    centerMapOn(state.selectedLat, state.selectedLng, 8);
                }

                showToast('Switched to 2D Map view — click anywhere to check air quality', 'info');
            } else {
                // Show globe, hide map
                mapOverlay.style.display = 'none';
                if (globeContainer) globeContainer.style.visibility = 'visible';
                if (labelsContainer) labelsContainer.style.display = '';
                if (globeControls) globeControls.style.display = '';
                btn.classList.remove('active');
                btn.querySelector('span').textContent = 'MAP';
                btn.querySelector('i').classList.remove('fa-earth-americas');
                btn.querySelector('i').classList.add('fa-map-location-dot');

                showToast('Switched to 3D Globe view', 'info');
            }
        });
    }

    /**
     * Setup section navigation
     */
    function setupNavigation() {
        const tabs = document.querySelectorAll('.nav-tab');
        const sections = document.querySelectorAll('.app-section');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetId = tab.dataset.section;

                // Deactivate all
                tabs.forEach(t => t.classList.remove('active'));
                sections.forEach(s => s.classList.remove('active'));

                // Activate target
                tab.classList.add('active');
                document.getElementById(targetId)?.classList.add('active');
            });
        });
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Panel close
        elements.panelClose?.addEventListener('click', closeDataPanel);

        // Search
        elements.searchBtn?.addEventListener('click', handleSearch);
        elements.searchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });

        // Analyze button
        document.getElementById('btn-analyze')?.addEventListener('click', () => {
            switchToSection('analysis-section');
            runAnalysis();
        });

        // Compliance button
        document.getElementById('btn-compliance')?.addEventListener('click', () => {
            switchToSection('compliance-section');
        });

        // Run prediction button
        document.getElementById('btn-run-prediction')?.addEventListener('click', runAnalysis);

        // My Location button
        document.getElementById('btn-my-location')?.addEventListener('click', locateUser);
    }

    /**
     * Get user's current location and fetch data
     */
    function locateUser() {
        const btn = document.getElementById('btn-my-location');
        if (!navigator.geolocation) {
            showToast('Geolocation is not supported by your browser', 'error');
            return;
        }

        if (btn) btn.classList.add('locating');
        showToast('Locating you...', 'info');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (btn) {
                    btn.classList.remove('locating');
                    btn.classList.add('located');
                    setTimeout(() => btn.classList.remove('located'), 3000);
                }

                const lat = position.coords.latitude;
                const lng = position.coords.longitude;

                // Focus the active view
                if (state.mapVisible && state.leafletMap) {
                    centerMapOn(lat, lng, 10);
                    // Simulate a click on the map to trigger its native popup/data flow
                    state.leafletMap.fire('click', { latlng: L.latLng(lat, lng) });
                } else {
                    Globe.focusOnLocation(lat, lng);
                    // Add slight delay for globe rotation animation before fetching data
                    setTimeout(() => onLocationSelected(lat, lng), 1200);
                }
            },
            (error) => {
                if (btn) btn.classList.remove('locating');
                let msg = 'Could not get your location.';
                if (error.code === 1) msg = 'Location access denied. Please enable permissions.';
                else if (error.code === 2) msg = 'Location unavailable.';
                else if (error.code === 3) msg = 'Location request timed out.';
                showToast(msg, 'error');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }

    /**
     * Handle location selection from globe or map click
     */
    async function onLocationSelected(lat, lng) {
        state.selectedLat = lat;
        state.selectedLng = lng;

        // Always sync the marker to the globe silently so it's there when switching back
        Globe.addMarker(null, lat, lng);

        // Show coordinates
        if (elements.coordsDisplay) {
            elements.coordsDisplay.style.display = 'flex';
        }
        if (elements.coordsValue) {
            elements.coordsValue.textContent = `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
        }

        // Hide instructions
        if (elements.globeInstructions) {
            elements.globeInstructions.style.display = 'none';
        }

        // Open data panel
        openDataPanel();

        // Show loading state
        elements.panelCity.textContent = 'Fetching data...';
        elements.panelCoords.textContent = `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
        elements.aqiValue.textContent = '...';
        elements.aqiStatusText.textContent = 'Connecting to station...';
        elements.aqiStatusDesc.textContent = '';
        elements.pollutantsGrid.innerHTML = '<div class="spinner" style="margin: 20px auto;"></div>';
        elements.weatherGrid.innerHTML = '';

        try {
            const data = await DataService.fetchByCoords(lat, lng);
            state.currentData = data;
            updateDataPanel(data);
            
            // Generate historical data for ML
            state.historicalData = DataService.generateHistoricalData(data, 365);

            // Update compliance section
            Compliance.updateAll(data);

            showToast(`Data loaded: ${data.city}`, 'success');
        } catch (error) {
            elements.panelCity.textContent = 'No Data Available';
            elements.aqiStatusText.textContent = 'No monitoring station found nearby';
            elements.aqiStatusDesc.textContent = 'Try clicking on a different location or searching for a city.';
            elements.pollutantsGrid.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 20px;">No data available for this location</p>';
            showToast('No data found for this location', 'warning');
        }
    }

    /**
     * Handle search
     */
    async function handleSearch() {
        const query = elements.searchInput.value.trim();
        if (!query) return;

        // Check if it's coordinates (e.g., "28.6, 77.2")
        const coordMatch = query.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);

        if (coordMatch) {
            const lat = parseFloat(coordMatch[1]);
            const lng = parseFloat(coordMatch[2]);
            if (state.mapVisible && state.leafletMap) {
                state.leafletMap.setView([lat, lng], 10, { animate: true });
                state.leafletMap.fire('click', { latlng: L.latLng(lat, lng) });
            } else {
                Globe.focusOnLocation(lat, lng);
                setTimeout(() => onLocationSelected(lat, lng), 1200);
            }
        } else {
            // Search by city name or specific area
            try {
                showToast(`Searching for "${query}"...`, 'info');
                
                // 1. Always use Nominatim as the primary geocoder. 
                // WAQI's database incorrectly groups distinct adjacent cities (e.g. Noida) under their larger neighbor (Delhi).
                // Nominatim ensures we get the EXACT mathematical coordinates of the city you typed.
                const coords = await DataService.geocodeCity(query);

                if (!coords) {
                    throw new Error("Location not found. Please check your spelling (e.g., 'Bangalore' instead of 'Banglore').");
                }

                // 2. Fetch air quality data for the exact resolved coordinates
                const data = await DataService.fetchByCoords(coords.lat, coords.lng);
                
                state.currentData = data;

                if (data.lat && data.lng) {
                    if (state.mapVisible && state.leafletMap) {
                        centerMapOn(data.lat, data.lng, 10);
                        showMapMarkerAndPopup(data.lat, data.lng, data, false);
                        // Also mark the globe silently so it's ready when switching back
                        Globe.addMarker(null, data.lat, data.lng);
                    } else {
                        Globe.focusOnLocation(data.lat, data.lng);
                    }
                    
                    state.selectedLat = data.lat;
                    state.selectedLng = data.lng;

                    if (elements.coordsDisplay) {
                        elements.coordsDisplay.style.display = 'flex';
                    }
                    if (elements.coordsValue) {
                        elements.coordsValue.textContent = `${data.lat.toFixed(4)}°, ${data.lng.toFixed(4)}°`;
                    }

                    if (elements.globeInstructions) {
                        elements.globeInstructions.style.display = 'none';
                    }
                }

                openDataPanel();
                updateDataPanel(data);

                state.historicalData = DataService.generateHistoricalData(data, 365);
                Compliance.updateAll(data);

                showToast(`Found: ${data.city}`, 'success');
            } catch (error) {
                showToast(`Could not find "${query}". Try another location.`, 'error');
            }
        }

        elements.searchInput.value = '';
    }

    /**
     * Update the data panel with fetched data
     */
    function updateDataPanel(data) {
        const category = DataService.getAQICategory(data.aqi);

        // City name
        elements.panelCity.textContent = data.city.split(',')[0] || data.city;
        elements.panelCoords.textContent = `${data.lat.toFixed(4)}°, ${data.lng.toFixed(4)}°`;

        // AQI Badge
        elements.aqiValue.textContent = data.aqi;
        elements.aqiBadge.style.background = `linear-gradient(135deg, ${category.color}, ${category.color}dd)`;

        // Status bar
        elements.aqiStatusBar.className = `aqi-status-bar ${category.bgClass}`;
        elements.aqiStatusText.textContent = category.level;
        elements.aqiStatusText.style.color = category.color;
        elements.aqiStatusDesc.textContent = category.description;

        // Pollutants
        let pollutantsHTML = '';
        const pollutantOrder = ['pm25', 'pm10', 'o3', 'no2', 'so2', 'co'];

        for (const key of pollutantOrder) {
            const val = data.pollutants[key];
            if (val === null || val === undefined) continue;

            const info = DataService.getPollutantInfo(key);
            pollutantsHTML += `
                <div class="pollutant-item" style="border-left-color: ${info.color};">
                    <div class="pollutant-name">${info.name}</div>
                    <div class="pollutant-value">
                        ${val}<span class="pollutant-unit">${info.unit}</span>
                    </div>
                </div>
            `;
        }

        elements.pollutantsGrid.innerHTML = pollutantsHTML || '<p style="color: var(--text-muted); padding: 10px;">No pollutant data available</p>';

        // Weather
        let weatherHTML = '';
        const weatherItems = [
            { key: 'temperature', icon: '🌡️', label: 'Temp', unit: '°C' },
            { key: 'humidity', icon: '💧', label: 'Humidity', unit: '%' },
            { key: 'pressure', icon: '🔵', label: 'Pressure', unit: 'hPa' },
            { key: 'wind', icon: '💨', label: 'Wind', unit: 'm/s' }
        ];

        for (const item of weatherItems) {
            const val = data.weather[item.key];
            if (val === null || val === undefined) continue;

            weatherHTML += `
                <div class="weather-item">
                    <div class="weather-icon">${item.icon}</div>
                    <div class="weather-label">${item.label}</div>
                    <div class="weather-value">${val}${item.unit}</div>
                </div>
            `;
        }

        elements.weatherGrid.innerHTML = weatherHTML || '<p style="color: var(--text-muted); padding: 10px;">No weather data</p>';

        // Station info
        elements.stationName.textContent = data.city;
        elements.stationTime.textContent = `Updated: ${new Date(data.time).toLocaleString()}`;

        // Update analysis section header
        const analysisLocation = document.getElementById('analysis-location');
        if (analysisLocation) {
            analysisLocation.textContent = `${data.city} — AQI: ${data.aqi}`;
        }

        // Update summary cards
        document.getElementById('summary-aqi').textContent = data.aqi;
        document.getElementById('summary-dominant').textContent = DataService.getPollutantInfo(data.dominantPollutant).name;
    }

    /**
     * Run ML analysis and prediction
     */
    function runAnalysis() {
        if (!state.currentData) {
            showToast('Please select a location first', 'warning');
            return;
        }

        const analysisBtn = document.getElementById('btn-run-prediction');
        if (analysisBtn) {
            analysisBtn.disabled = true;
            analysisBtn.innerHTML = '<span class="spinner"></span> Running Model...';
        }

        // Get user-selected parameters
        const timeRange = parseInt(document.getElementById('time-range')?.value || 30);
        const predictRange = parseInt(document.getElementById('predict-range')?.value || 180);

        // Generate historical data for the selected time range
        state.historicalData = DataService.generateHistoricalData(state.currentData, timeRange);

        setTimeout(() => {
            try {
                // Run ML prediction
                const results = MLModel.predict(state.historicalData, predictRange);
                state.predictions = results;

                // Update charts
                updateMainChart(results);
                updateRadarChart();
                updateDistributionChart();

                // Update ML metrics
                document.getElementById('ml-r2').textContent = results.model.r2.toFixed(4);
                document.getElementById('ml-mae').textContent = results.model.mae.toFixed(2);
                document.getElementById('ml-datapoints').textContent = results.model.dataPoints;

                // Update summary cards
                const trendEmoji = results.trend === 'increasing' ? '📈' : results.trend === 'decreasing' ? '📉' : '➡️';
                const trendLabel = results.trend.charAt(0).toUpperCase() + results.trend.slice(1);
                document.getElementById('summary-trend').textContent = `${trendEmoji} ${trendLabel}`;

                // Predicted AQI (30-day average)
                const next30 = results.predictions.slice(0, 30);
                const avgPredicted = Math.round(next30.reduce((s, p) => s + p.aqi, 0) / next30.length);
                document.getElementById('summary-predicted').textContent = avgPredicted;

                showToast('ML prediction completed successfully', 'success');
            } catch (error) {
                console.error('ML prediction error:', error);
                showToast('Prediction failed: ' + error.message, 'error');
            }

            if (analysisBtn) {
                analysisBtn.disabled = false;
                analysisBtn.innerHTML = '<span>🤖</span> Run ML Prediction';
            }
        }, 500); // Small delay for UX
    }

    /**
     * Update the main trend chart
     */
    function updateMainChart(results) {
        const ctx = document.getElementById('main-trend-chart');
        if (!ctx) return;

        // Destroy existing chart
        if (state.charts.mainTrend) {
            state.charts.mainTrend.destroy();
        }

        // Historical data
        const historicalLabels = results.fittedValues.map(v => v.date);
        const actualValues = results.fittedValues.map(v => v.actual);
        const fittedValues = results.fittedValues.map(v => v.fitted);

        // Prediction data
        const predictionLabels = results.predictions.map(p => p.date);
        const predictedValues = results.predictions.map(p => p.aqi);
        const upperBound = results.predictions.map(p => p.upper);
        const lowerBound = results.predictions.map(p => p.lower);

        // Combine labels
        const allLabels = [...historicalLabels, ...predictionLabels];

        // Pad arrays
        const paddedActual = [...actualValues, ...new Array(predictionLabels.length).fill(null)];
        const paddedFitted = [...fittedValues, ...new Array(predictionLabels.length).fill(null)];
        const paddedPredicted = [...new Array(historicalLabels.length - 1).fill(null), fittedValues[fittedValues.length - 1], ...predictedValues];
        const paddedUpper = [...new Array(historicalLabels.length - 1).fill(null), fittedValues[fittedValues.length - 1], ...upperBound];
        const paddedLower = [...new Array(historicalLabels.length - 1).fill(null), fittedValues[fittedValues.length - 1], ...lowerBound];

        state.charts.mainTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: allLabels,
                datasets: [
                    {
                        label: 'Actual AQI',
                        data: paddedActual,
                        borderColor: '#00d4ff',
                        backgroundColor: 'rgba(0, 212, 255, 0.1)',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Model Fit',
                        data: paddedFitted,
                        borderColor: '#7c3aed',
                        borderWidth: 2,
                        pointRadius: 0,
                        borderDash: [5, 3],
                        tension: 0.4
                    },
                    {
                        label: 'ML Prediction',
                        data: paddedPredicted,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2.5,
                        pointRadius: 0,
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: 'Upper Bound (95% CI)',
                        data: paddedUpper,
                        borderColor: 'rgba(16, 185, 129, 0.3)',
                        backgroundColor: 'rgba(16, 185, 129, 0.05)',
                        borderWidth: 1,
                        pointRadius: 0,
                        fill: '+1',
                        tension: 0.4
                    },
                    {
                        label: 'Lower Bound (95% CI)',
                        data: paddedLower,
                        borderColor: 'rgba(16, 185, 129, 0.3)',
                        borderWidth: 1,
                        pointRadius: 0,
                        fill: false,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#94a3b8',
                            font: { family: 'Inter', size: 11 },
                            usePointStyle: true,
                            pointStyle: 'line'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        titleColor: '#f1f5f9',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(148, 163, 184, 0.2)',
                        borderWidth: 1,
                        titleFont: { family: 'Inter', weight: '600' },
                        bodyFont: { family: 'JetBrains Mono', size: 12 }
                    }
                },
                scales: {
                    x: {
                        type: 'category',
                        ticks: {
                            color: '#64748b',
                            font: { family: 'JetBrains Mono', size: 10 },
                            maxRotation: 45,
                            maxTicksLimit: 12
                        },
                        grid: { color: 'rgba(148, 163, 184, 0.08)' }
                    },
                    y: {
                        ticks: {
                            color: '#64748b',
                            font: { family: 'JetBrains Mono', size: 11 }
                        },
                        grid: { color: 'rgba(148, 163, 184, 0.08)' },
                        title: {
                            display: true,
                            text: 'AQI',
                            color: '#64748b',
                            font: { family: 'Inter', size: 12 }
                        }
                    }
                },
                // Add annotation line for "today"
                annotation: {
                    annotations: {
                        todayLine: {
                            type: 'line',
                            xMin: historicalLabels.length - 1,
                            xMax: historicalLabels.length - 1,
                            borderColor: '#f59e0b',
                            borderWidth: 2,
                            borderDash: [6, 4]
                        }
                    }
                }
            }
        });
    }

    /**
     * Update the radar chart for pollutant breakdown
     */
    function updateRadarChart() {
        if (!state.currentData) return;

        const ctx = document.getElementById('pollutant-radar-chart');
        if (!ctx) return;

        if (state.charts.radar) {
            state.charts.radar.destroy();
        }

        const pollutants = state.currentData.pollutants;
        const labels = [];
        const values = [];
        const colors = [];

        const order = ['pm25', 'pm10', 'o3', 'no2', 'so2', 'co'];
        for (const key of order) {
            if (pollutants[key] !== null && pollutants[key] !== undefined) {
                const info = DataService.getPollutantInfo(key);
                labels.push(info.name);
                values.push(pollutants[key]);
                colors.push(info.color);
            }
        }

        if (labels.length === 0) return;

        state.charts.radar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Current Levels',
                    data: values,
                    backgroundColor: 'rgba(0, 212, 255, 0.15)',
                    borderColor: '#00d4ff',
                    borderWidth: 2,
                    pointBackgroundColor: colors,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1,
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#94a3b8',
                            font: { family: 'Inter', size: 11 }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        titleColor: '#f1f5f9',
                        bodyColor: '#94a3b8',
                        bodyFont: { family: 'JetBrains Mono', size: 12 }
                    }
                },
                scales: {
                    r: {
                        angleLines: { color: 'rgba(148, 163, 184, 0.15)' },
                        grid: { color: 'rgba(148, 163, 184, 0.1)' },
                        pointLabels: {
                            color: '#94a3b8',
                            font: { family: 'Inter', size: 12, weight: '600' }
                        },
                        ticks: {
                            color: '#64748b',
                            font: { family: 'JetBrains Mono', size: 9 },
                            backdropColor: 'transparent'
                        }
                    }
                }
            }
        });
    }

    /**
     * Update AQI distribution doughnut chart
     */
    function updateDistributionChart() {
        if (!state.historicalData) return;

        const ctx = document.getElementById('aqi-distribution-chart');
        if (!ctx) return;

        if (state.charts.distribution) {
            state.charts.distribution.destroy();
        }

        // Count days in each AQI category
        const counts = { Good: 0, Moderate: 0, 'Unhealthy SG': 0, Unhealthy: 0, 'Very Unhealthy': 0, Hazardous: 0 };
        const categoryColors = ['#10b981', '#f59e0b', '#f97316', '#ef4444', '#a855f7', '#7f1d1d'];

        for (const day of state.historicalData) {
            const aqi = day.aqi;
            if (aqi <= 50) counts['Good']++;
            else if (aqi <= 100) counts['Moderate']++;
            else if (aqi <= 150) counts['Unhealthy SG']++;
            else if (aqi <= 200) counts['Unhealthy']++;
            else if (aqi <= 300) counts['Very Unhealthy']++;
            else counts['Hazardous']++;
        }

        const filteredLabels = [];
        const filteredValues = [];
        const filteredColors = [];

        Object.entries(counts).forEach(([label, count], i) => {
            if (count > 0) {
                filteredLabels.push(label);
                filteredValues.push(count);
                filteredColors.push(categoryColors[i]);
            }
        });

        state.charts.distribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: filteredLabels,
                datasets: [{
                    data: filteredValues,
                    backgroundColor: filteredColors,
                    borderColor: '#1a1f35',
                    borderWidth: 3,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            font: { family: 'Inter', size: 11 },
                            padding: 12,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        titleColor: '#f1f5f9',
                        bodyColor: '#94a3b8',
                        bodyFont: { family: 'JetBrains Mono', size: 12 },
                        callbacks: {
                            label: function (context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.raw / total) * 100).toFixed(1);
                                return `${context.label}: ${context.raw} days (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Switch to a specific section
     */
    function switchToSection(sectionId) {
        const tabs = document.querySelectorAll('.nav-tab');
        const sections = document.querySelectorAll('.app-section');

        tabs.forEach(t => t.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));

        const targetTab = document.querySelector(`[data-section="${sectionId}"]`);
        if (targetTab) targetTab.classList.add('active');
        document.getElementById(sectionId)?.classList.add('active');
    }

    /**
     * Open the data panel
     */
    function openDataPanel() {
        elements.dataPanel?.classList.add('open');
    }

    /**
     * Close the data panel
     */
    function closeDataPanel() {
        elements.dataPanel?.classList.remove('open');
    }

    /**
     * Hide loading screen
     */
    function hideLoadingScreen() {
        setTimeout(() => {
            elements.loadingScreen?.classList.add('hidden');
        }, 2200);
    }

    /**
     * Show toast notification
     */
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${message}`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
