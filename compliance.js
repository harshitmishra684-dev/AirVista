/**
 * Compliance Module
 * Generates environmental compliance information, 
 * health recommendations, and best practices based on air quality data
 */

const Compliance = (() => {

    // WHO Air Quality Guidelines (2021 update)
    const WHO_GUIDELINES = {
        pm25: { annual: 5, daily: 15, unit: 'µg/m³', name: 'PM₂.₅' },
        pm10: { annual: 15, daily: 45, unit: 'µg/m³', name: 'PM₁₀' },
        no2: { annual: 10, daily: 25, unit: 'µg/m³', name: 'NO₂' },
        so2: { daily: 40, unit: 'µg/m³', name: 'SO₂' },
        o3: { daily: 100, unit: 'µg/m³', name: 'O₃' },
        co: { daily: 4, unit: 'mg/m³', name: 'CO' }
    };

    // National standards reference (US EPA NAAQS)
    const EPA_STANDARDS = {
        pm25: { annual: 12, daily: 35, unit: 'µg/m³', name: 'PM₂.₅' },
        pm10: { daily: 150, unit: 'µg/m³', name: 'PM₁₀' },
        no2: { annual: 53, hourly: 100, unit: 'ppb', name: 'NO₂' },
        so2: { hourly: 75, unit: 'ppb', name: 'SO₂' },
        o3: { daily: 70, unit: 'ppb', name: 'O₃' },
        co: { hourly: 35, daily: 9, unit: 'ppm', name: 'CO' }
    };

    /**
     * Generate WHO compliance table HTML
     */
    function generateWHOTable(pollutants) {
        const rows = [];

        for (const [key, guideline] of Object.entries(WHO_GUIDELINES)) {
            const currentVal = pollutants[key];
            if (currentVal === null || currentVal === undefined) continue;

            const threshold = guideline.daily || guideline.annual;
            const ratio = currentVal / threshold;
            let status, statusClass;

            if (ratio <= 1) {
                status = 'Compliant';
                statusClass = 'good';
            } else if (ratio <= 2) {
                status = 'Exceeding';
                statusClass = 'warning';
            } else {
                status = 'Critical';
                statusClass = 'danger';
            }

            rows.push(`
                <tr>
                    <td>${guideline.name}</td>
                    <td>${threshold} ${guideline.unit}</td>
                    <td style="color: ${ratio <= 1 ? '#10b981' : ratio <= 2 ? '#f59e0b' : '#ef4444'}">${currentVal} ${guideline.unit}</td>
                    <td><span class="status-badge ${statusClass}">${status}</span></td>
                </tr>
            `);
        }

        return rows.length > 0 ? rows.join('') : '<tr><td colspan="4" class="empty-cell">No pollutant data available</td></tr>';
    }

    /**
     * Generate compliance status
     */
    function generateComplianceStatus(data) {
        const aqi = data.aqi;
        const category = DataService.getAQICategory(aqi);
        const pollutants = data.pollutants;

        // Check violations
        const violations = [];
        for (const [key, val] of Object.entries(pollutants)) {
            if (val === null) continue;
            const whoGuide = WHO_GUIDELINES[key];
            if (whoGuide) {
                const threshold = whoGuide.daily || whoGuide.annual;
                if (val > threshold) {
                    violations.push({
                        pollutant: whoGuide.name,
                        current: val,
                        limit: threshold,
                        unit: whoGuide.unit,
                        exceedance: ((val / threshold - 1) * 100).toFixed(0)
                    });
                }
            }
        }

        let html = '';

        // Overall status
        html += `
            <div class="compliance-item">
                <div class="compliance-item-header">
                    <h4>Overall Air Quality Status</h4>
                    <span class="status-badge ${aqi <= 50 ? 'good' : aqi <= 150 ? 'warning' : 'danger'}">${category.level}</span>
                </div>
                <p>${category.description}</p>
            </div>
        `;

        // AQI Compliance
        html += `
            <div class="compliance-item">
                <div class="compliance-item-header">
                    <h4>AQI Level: ${aqi}</h4>
                    <span class="status-badge ${aqi <= 100 ? 'good' : 'danger'}">${aqi <= 100 ? 'Within Safe Limits' : 'Above Safe Limits'}</span>
                </div>
                <p>The current AQI of ${aqi} falls in the "${category.level}" category. ${category.healthImplications}</p>
            </div>
        `;

        // Violations
        if (violations.length > 0) {
            html += `
                <div class="compliance-item">
                    <div class="compliance-item-header">
                        <h4>⚠️ WHO Guideline Violations (${violations.length})</h4>
                        <span class="status-badge danger">Action Required</span>
                    </div>
                    <ul style="list-style: none; padding: 0; margin-top: 8px;">
                        ${violations.map(v => `
                            <li style="padding: 6px 0; font-size: 0.85rem; color: var(--text-secondary); border-bottom: 1px solid var(--border-subtle);">
                                <strong style="color: var(--accent-red);">${v.pollutant}</strong>: 
                                Current ${v.current} ${v.unit} exceeds WHO limit of ${v.limit} ${v.unit} 
                                by <strong>${v.exceedance}%</strong>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        } else {
            html += `
                <div class="compliance-item">
                    <div class="compliance-item-header">
                        <h4>✅ WHO Guideline Compliance</h4>
                        <span class="status-badge good">All Clear</span>
                    </div>
                    <p>All measured pollutant levels are within WHO recommended guidelines.</p>
                </div>
            `;
        }

        return html;
    }

    /**
     * Generate health recommendations based on AQI and pollutant levels
     */
    function generateHealthRecommendations(data) {
        const aqi = data.aqi;
        const recommendations = [];

        // General recommendations based on AQI
        if (aqi <= 50) {
            recommendations.push({
                icon: '🏃',
                title: 'Outdoor Activities',
                text: 'Air quality is ideal for outdoor activities. Enjoy sports, walking, and exercise outdoors without any restrictions.'
            });
            recommendations.push({
                icon: '🪟',
                title: 'Ventilation',
                text: 'Open windows to allow fresh air circulation. Natural ventilation is encouraged.'
            });
        } else if (aqi <= 100) {
            recommendations.push({
                icon: '⚡',
                title: 'Moderate Outdoor Activity',
                text: 'Most people can be active outdoors. People who are unusually sensitive to air pollution should consider reducing prolonged exertion.'
            });
            recommendations.push({
                icon: '👶',
                title: 'Sensitive Groups',
                text: 'Children, elderly, and people with respiratory conditions should monitor symptoms during prolonged outdoor activity.'
            });
        } else if (aqi <= 150) {
            recommendations.push({
                icon: '🚫',
                title: 'Limit Outdoor Exertion',
                text: 'Sensitive groups should limit prolonged outdoor exertion. Everyone else should reduce heavy outdoor workouts.'
            });
            recommendations.push({
                icon: '😷',
                title: 'Use Protection',
                text: 'Consider wearing N95/KN95 masks if you must spend extended time outdoors. Keep indoor air purifiers running.'
            });
        } else if (aqi <= 200) {
            recommendations.push({
                icon: '🏠',
                title: 'Stay Indoors',
                text: 'Everyone should reduce outdoor exposure. Keep windows and doors closed. Use air purifiers with HEPA filters indoors.'
            });
            recommendations.push({
                icon: '🏥',
                title: 'Medical Alert',
                text: 'People with heart or lung conditions, children, and elderly should avoid all outdoor activity. Seek medical attention if symptoms worsen.'
            });
        } else {
            recommendations.push({
                icon: '🚨',
                title: 'Emergency Level',
                text: 'Avoid ALL outdoor activity. Stay indoors with air purification running. Seal windows and doors. This is a serious health emergency.'
            });
            recommendations.push({
                icon: '🏥',
                title: 'Seek Medical Help',
                text: 'If you experience difficulty breathing, chest pain, or severe coughing, seek immediate medical attention.'
            });
        }

        // Pollutant-specific recommendations
        const pollutants = data.pollutants;

        if (pollutants.pm25 && pollutants.pm25 > 35) {
            recommendations.push({
                icon: '🫁',
                title: 'High PM₂.₅ Alert',
                text: `PM₂.₅ level (${pollutants.pm25} µg/m³) is elevated. Fine particles can penetrate deep into lungs. Use N95 masks outdoors and HEPA air purifiers indoors.`
            });
        }

        if (pollutants.o3 && pollutants.o3 > 100) {
            recommendations.push({
                icon: '☀️',
                title: 'Ozone Warning',
                text: `Ground-level ozone (${pollutants.o3} ppb) is high. Avoid outdoor exercise during afternoon hours (12-6 PM) when ozone peaks.`
            });
        }

        if (pollutants.no2 && pollutants.no2 > 40) {
            recommendations.push({
                icon: '🚗',
                title: 'NO₂ Elevated',
                text: `Nitrogen dioxide (${pollutants.no2} ppb) is high, likely from vehicle emissions. Avoid exercising near busy roads and highways.`
            });
        }

        if (pollutants.so2 && pollutants.so2 > 40) {
            recommendations.push({
                icon: '🏭',
                title: 'SO₂ Alert',
                text: `Sulfur dioxide (${pollutants.so2} ppb) is elevated. This may indicate industrial emissions nearby. People with asthma should take extra precautions.`
            });
        }

        // Always-show recommendations
        recommendations.push({
            icon: '💧',
            title: 'Stay Hydrated',
            text: 'Drink plenty of water to help your body flush out inhaled pollutants. Aim for at least 8 glasses per day.'
        });

        recommendations.push({
            icon: '📱',
            title: 'Monitor Continuously',
            text: 'Air quality can change rapidly. Check conditions regularly, especially before outdoor activities or if you have respiratory conditions.'
        });

        let html = '<ul class="recommendation-list">';
        for (const rec of recommendations) {
            html += `
                <li class="recommendation-item">
                    <span class="rec-icon">${rec.icon}</span>
                    <div class="rec-content">
                        <h4>${rec.title}</h4>
                        <p>${rec.text}</p>
                    </div>
                </li>
            `;
        }
        html += '</ul>';

        return html;
    }

    /**
     * Generate best practices for reducing pollution exposure
     */
    function generateBestPractices(data) {
        const aqi = data.aqi;
        const practices = [];

        // Indoor air quality
        practices.push({
            icon: '🏠',
            title: 'Indoor Air Quality Management',
            text: 'Use HEPA air purifiers in bedrooms and living areas. Keep indoor plants like Snake Plant, Peace Lily, and Spider Plant that help filter air naturally. Avoid burning candles, incense, or using harsh cleaning chemicals that worsen indoor air quality.',
            borderColor: '#3b82f6'
        });

        // Transportation
        practices.push({
            icon: '🚲',
            title: 'Sustainable Transportation',
            text: 'Reduce vehicle emissions by using public transport, carpooling, cycling, or walking for short distances. If driving, keep windows closed on high-pollution days and use recirculation mode for car AC. Plan routes to avoid congested areas.',
            borderColor: '#10b981'
        });

        // Energy & Home
        practices.push({
            icon: '⚡',
            title: 'Energy Conservation',
            text: 'Reduce electricity consumption to lower power plant emissions. Use energy-efficient appliances, LED bulbs, and smart thermostats. Consider renewable energy sources like solar panels. Avoid using generators that emit harmful pollutants.',
            borderColor: '#f59e0b'
        });

        // Waste Management
        practices.push({
            icon: '♻️',
            title: 'Waste Reduction & Recycling',
            text: 'Never burn trash or agricultural waste — this is a major source of PM₂.₅. Compost organic waste, recycle plastics, paper, and metals. Support and follow local waste management programs.',
            borderColor: '#a855f7'
        });

        // Community Action
        practices.push({
            icon: '🤝',
            title: 'Community Engagement',
            text: 'Participate in tree planting initiatives — trees naturally filter pollutants. Report illegal burning, visible emissions, or industrial violations to local environmental authorities. Join community air quality monitoring networks.',
            borderColor: '#ec4899'
        });

        // Personal Protection
        if (aqi > 100) {
            practices.push({
                icon: '🛡️',
                title: 'Personal Protection Strategies',
                text: 'On high pollution days: exercise early morning when AQI is usually lower, wear N95/KN95 masks outdoors, create a "clean room" at home with sealed windows and air purifier running, take Vitamin C and antioxidant-rich foods to combat oxidative stress from pollution.',
                borderColor: '#ef4444'
            });
        }

        // Diet and health
        practices.push({
            icon: '🥗',
            title: 'Anti-Pollution Diet',
            text: 'Consume foods rich in antioxidants: berries, leafy greens, turmeric, green tea. Omega-3 fatty acids (fish, flaxseed) help reduce inflammation caused by air pollution. Vitamin E and Vitamin C supplements may provide additional protection.',
            borderColor: '#00d4ff'
        });

        let html = '<ul class="recommendation-list">';
        for (const practice of practices) {
            html += `
                <li class="recommendation-item" style="border-left-color: ${practice.borderColor};">
                    <span class="rec-icon">${practice.icon}</span>
                    <div class="rec-content">
                        <h4>${practice.title}</h4>
                        <p>${practice.text}</p>
                    </div>
                </li>
            `;
        }
        html += '</ul>';

        return html;
    }

    /**
     * Generate regional environmental issues based on location and data
     */
    function generateEnvironmentalIssues(data) {
        const lat = data.lat;
        const lng = data.lng;
        const aqi = data.aqi;
        const city = data.city;

        const issues = [];

        // Determine region-based issues
        const region = determineRegion(lat, lng);

        // Common environmental issues by region
        const regionalIssues = {
            'South Asia': [
                { title: 'Crop Residue Burning', desc: 'Seasonal agricultural burning is a major source of PM₂.₅ pollution, especially during October-November. Government policies on stubble management and alternatives to burning are being implemented.' },
                { title: 'Vehicular Emissions', desc: 'Rapid urbanization and increasing vehicle count contribute significantly to NO₂ and CO levels. BS-VI emission norms and electric vehicle adoption programs are underway.' },
                { title: 'Industrial Pollution', desc: 'Thermal power plants and industrial clusters contribute to SO₂ and particulate matter emissions. Environmental compliance monitoring is enforced by pollution control boards.' },
                { title: 'Construction Dust', desc: 'Ongoing infrastructure development generates significant dust pollution. Regulations require dust suppression measures at construction sites.' }
            ],
            'East Asia': [
                { title: 'Industrial Emissions', desc: 'Heavy manufacturing and coal-burning power plants are major pollution sources. Strict emission standards and coal-reduction policies are being implemented.' },
                { title: 'Sandstorms', desc: 'Seasonal sandstorms from desert regions can significantly elevate PM₁₀ levels, particularly in spring months.' },
                { title: 'Urban Air Quality', desc: 'Dense urban areas face challenges from traffic congestion and industrial activities. Clean air action plans include emission controls and green transportation initiatives.' }
            ],
            'Europe': [
                { title: 'Traffic Emissions', desc: 'Road transport remains a primary source of urban air pollution, particularly NO₂. Low-emission zones and diesel bans are being implemented in major cities.' },
                { title: 'Agricultural Ammonia', desc: 'Farming activities contribute to secondary particulate matter formation. EU regulations under the NEC Directive set emission ceilings.' },
                { title: 'Transboundary Pollution', desc: 'Air pollution crosses national borders, requiring coordinated European policy response through the CLRTAP and EU Air Quality Directive.' }
            ],
            'North America': [
                { title: 'Wildfire Smoke', desc: 'Increasing wildfire frequency due to climate change causes periodic severe PM₂.₅ episodes across wide regions.' },
                { title: 'Ozone Pollution', desc: 'Ground-level ozone remains a concern in many urban areas, especially during summer. EPA NAAQS regulations govern compliance.' },
                { title: 'Industrial Point Sources', desc: 'Power plants and refineries are monitored under the Clean Air Act. EPA manages permits and emission limits through NESHAP and NSPS programs.' }
            ],
            'Africa': [
                { title: 'Biomass Burning', desc: 'Use of solid fuels for cooking and heating is a major source of indoor and outdoor air pollution. Clean cooking initiatives are being promoted.' },
                { title: 'Dust Storms', desc: 'Saharan and sub-Saharan dust events significantly impact air quality across wide areas, particularly PM₁₀ levels.' },
                { title: 'Rapid Urbanization', desc: 'Fast-growing cities face challenges in managing vehicle emissions and industrial pollution. Air quality monitoring networks are being expanded.' }
            ],
            'South America': [
                { title: 'Deforestation Fires', desc: 'Amazon and other forest fires contribute massively to regional and global air pollution during dry season.' },
                { title: 'Mining Activities', desc: 'Mining operations contribute to particulate matter and heavy metal air pollution in certain regions.' },
                { title: 'Urban Transport', desc: 'Major cities face high pollution from aging vehicle fleets. BRT systems and vehicle emission inspections are being expanded.' }
            ],
            'Oceania': [
                { title: 'Bushfire Events', desc: 'Periodic bushfires can cause extreme air quality events. Climate change is increasing fire frequency and severity.' },
                { title: 'Mining Dust', desc: 'Large-scale mining operations contribute to localized particulate matter pollution.' }
            ],
            'Default': [
                { title: 'Air Quality Monitoring', desc: 'This region may have limited air quality monitoring infrastructure. Expanding monitoring networks and data availability is a priority.' },
                { title: 'Climate Change Impact', desc: 'Changing climate patterns can influence local air quality through altered weather patterns, increased wildfire risk, and changing emission patterns.' }
            ]
        };

        const cityStr = (city || '').toLowerCase();
        let regionIssues = [];

        // India Specifics
        if (cityStr.includes('india') || cityStr.includes('delhi') || cityStr.includes('ncr') || cityStr.includes('mumbai') || cityStr.includes('chennai')) {
            if (cityStr.includes('delhi') || cityStr.includes('ncr') || cityStr.includes('haryana') || cityStr.includes('punjab')) {
                regionIssues.push({ title: 'NCR Stubble Burning & GRAP', desc: 'Heavily impacted by seasonal stubble burning. The Graded Response Action Plan (GRAP) is strictly enforced during winter, triggering automatic bans on construction and diesel generators.' });
            }
            if (cityStr.includes('mumbai') || cityStr.includes('maharashtra')) {
                regionIssues.push({ title: 'Coastal Construction & Traffic', desc: 'Rapid coastal infrastructure projects significantly contribute to localized PM10 spikes. BMC enforces strict dust mitigation guidelines for all builders.' });
            }
            regionIssues.push({ title: 'National Clean Air Programme (NCAP)', desc: 'Nationwide initiative aiming to reduce particulate matter concentration by 20-30%. Mandates strict monitoring of industrial clusters and transition to BS-VI vehicular emissions.' });
        }
        // US Specifics
        else if (cityStr.includes('usa') || cityStr.includes('united states') || cityStr.includes('california') || cityStr.includes('new york')) {
            if (cityStr.includes('california') || cityStr.includes('los angeles') || cityStr.includes('san francisco')) {
                regionIssues.push({ title: 'CARB Regulations & Wildfires', desc: 'Extremely strict emission standards enforced by the California Air Resources Board (CARB). The region also requires emergency wildfire smoke mitigation plans for outdoor workers.' });
            }
            regionIssues.push({ title: 'EPA Clean Air Act Compliance', desc: 'Subject to stringent federal NAAQS standards. Point sources like refineries and power plants must maintain Continuous Emissions Monitoring Systems (CEMS).' });
        }
        // China Specifics
        else if (cityStr.includes('china') || cityStr.includes('beijing') || cityStr.includes('shanghai')) {
            regionIssues.push({ title: 'Blue Sky Protection Campaign', desc: 'Aggressive national policy to reduce coal consumption and heavy industry emissions. Includes strict winter heating emission controls in northern provinces.' });
        }
        // Europe / UK Specifics
        else if (region === 'Europe' || cityStr.includes('uk') || cityStr.includes('united kingdom') || cityStr.includes('london')) {
            if (cityStr.includes('london') || cityStr.includes('uk')) {
                regionIssues.push({ title: 'Ultra Low Emission Zone (ULEZ)', desc: 'Strict enforcement of ULEZ across Greater London requires older, more polluting vehicles to pay heavy daily charges to reduce urban NO2.' });
            }
            regionIssues.push({ title: 'EU Air Quality Directives', desc: 'Strict enforcement of European Green Deal targets. Cities are increasingly implementing Low Emission Zones (LEZs) and outright banning diesel vehicles in city centers.' });
        }
        // Australia / Oceania
        else if (region === 'Oceania' || cityStr.includes('australia') || cityStr.includes('sydney')) {
            regionIssues.push({ title: 'NEPM Standards & Bushfires', desc: 'Monitored under National Environment Protection Measures. High focus on public health alerts during the severe summer bushfire seasons.' });
        }
        // Fallback to generic region if no specific country rules matched
        else {
            regionIssues = regionalIssues[region] || regionalIssues['Default'];
        }

        // Add pollutant-specific compliance rules
        if (data.dominantPollutant === 'pm25') {
            regionIssues.push({ title: 'PM2.5 Micro-Particulate Hazards', desc: 'Dominant fine particulate matter requires compliance with strict residential filtration codes and outright limitations on open biomass burning.' });
        } else if (data.dominantPollutant === 'o3') {
            regionIssues.push({ title: 'Photochemical Smog & VOC Controls', desc: 'High ground-level ozone usually triggers specific VOC (Volatile Organic Compounds) emission restrictions from local chemical and manufacturing plants during daytime.' });
        } else if (data.dominantPollutant === 'no2') {
            regionIssues.push({ title: 'NO2 Heavy Traffic Corridors', desc: 'Nitrogen Dioxide dominance typically triggers automatic traffic-calming measures, congestion pricing, or temporary bans on heavy diesel trucks in city limits.' });
        }

        // Current condition-based issues
        if (aqi > 150) {
            issues.push({
                title: '🔴 Active Emergency Air Quality Protocol',
                desc: `Current AQI of ${aqi} triggers mandatory industrial slowdowns and outdoor work restrictions in the ${city} area. Local health authorities may have issued shelter-in-place advisories.`,
                urgent: true
            });
        }

        // Add regional issues
        for (const issue of regionIssues) {
            issues.push({
                title: `📋 ${issue.title}`,
                desc: issue.desc,
                urgent: false
            });
        }

        // Compliance history note
        issues.push({
            title: '📊 Compliance Monitoring',
            desc: `Air quality monitoring at ${city} is provided through the World Air Quality Index project. Data is sourced from government monitoring stations and verified sources. Historical compliance data and environmental impact assessments may be available through local environmental protection agencies.`,
            urgent: false
        });

        let html = '';
        for (const issue of issues) {
            html += `
                <div class="env-issue" style="${issue.urgent ? 'border-left-color: var(--accent-red);' : ''}">
                    <h4>${issue.title}</h4>
                    <p>${issue.desc}</p>
                </div>
            `;
        }

        return html;
    }

    /**
     * Determine geographic region from lat/lng
     */
    function determineRegion(lat, lng) {
        if (lat >= 5 && lat <= 40 && lng >= 60 && lng <= 100) return 'South Asia';
        if (lat >= 15 && lat <= 55 && lng >= 100 && lng <= 150) return 'East Asia';
        if (lat >= 35 && lat <= 72 && lng >= -12 && lng <= 60) return 'Europe';
        if (lat >= 15 && lat <= 72 && lng >= -170 && lng <= -50) return 'North America';
        if (lat >= -40 && lat <= 38 && lng >= -20 && lng <= 55) return 'Africa';
        if (lat >= -60 && lat <= 15 && lng >= -82 && lng <= -34) return 'South America';
        if (lat >= -50 && lat <= -10 && lng >= 110 && lng <= 180) return 'Oceania';
        return 'Default';
    }

    /**
     * Update all compliance sections with data
     */
    function updateAll(data) {
        // WHO Guidelines Table
        const whoTableBody = document.getElementById('who-table-body');
        if (whoTableBody) {
            whoTableBody.innerHTML = generateWHOTable(data.pollutants);
        }

        // Compliance Status
        const complianceStatus = document.getElementById('compliance-status');
        if (complianceStatus) {
            complianceStatus.innerHTML = generateComplianceStatus(data);
        }

        // Health Recommendations
        const healthRec = document.getElementById('health-recommendations');
        if (healthRec) {
            healthRec.innerHTML = generateHealthRecommendations(data);
        }

        // Best Practices
        const bestPractices = document.getElementById('best-practices');
        if (bestPractices) {
            bestPractices.innerHTML = generateBestPractices(data);
        }

        // Environmental Issues
        const envIssues = document.getElementById('env-issues');
        if (envIssues) {
            envIssues.innerHTML = generateEnvironmentalIssues(data);
        }

        // Update location display
        const complianceLocation = document.getElementById('compliance-location');
        if (complianceLocation) {
            complianceLocation.textContent = `${data.city} — AQI: ${data.aqi}`;
        }
    }

    return {
        generateWHOTable,
        generateComplianceStatus,
        generateHealthRecommendations,
        generateBestPractices,
        generateEnvironmentalIssues,
        updateAll
    };
})();
