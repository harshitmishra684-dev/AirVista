/**
 * Machine Learning Model Module
 * Implements Linear Regression with Fourier components for seasonal decomposition
 * Used to analyze historical air quality data and predict future trends up to 1 year
 */

const MLModel = (() => {

    /**
     * Main prediction function
     * Takes historical data and predicts future values
     * 
     * @param {Array} historicalData - Array of {date, aqi, pollutants}
     * @param {number} predictDays - Number of days to predict into the future
     * @returns {Object} - Prediction results with metrics
     */
    function predict(historicalData, predictDays = 365) {
        if (!historicalData || historicalData.length < 7) {
            throw new Error('Insufficient data for prediction. Need at least 7 data points.');
        }

        // Extract AQI time series
        const aqiSeries = historicalData.map((d, i) => ({
            x: i,
            y: d.aqi,
            date: d.date
        }));

        // Train the model using OLS with Fourier components
        const model = trainModel(aqiSeries);

        // Generate predictions
        const n = aqiSeries.length;
        const predictions = [];
        const lastDate = new Date(historicalData[historicalData.length - 1].date);

        for (let i = 1; i <= predictDays; i++) {
            const futureDate = new Date(lastDate);
            futureDate.setDate(futureDate.getDate() + i);

            const x = n + i - 1;
            const predictedAQI = predictValue(model, x, n);

            // Confidence interval widens with time
            const uncertainty = Math.sqrt(i) * model.residualStd * 1.2;

            predictions.push({
                date: futureDate.toISOString().split('T')[0],
                timestamp: futureDate.getTime(),
                aqi: Math.max(1, Math.round(predictedAQI)),
                lower: Math.max(1, Math.round(predictedAQI - uncertainty * 1.96)),
                upper: Math.round(predictedAQI + uncertainty * 1.96)
            });
        }

        // Generate fitted values for historical data
        const fittedValues = aqiSeries.map((point, i) => ({
            date: point.date,
            actual: point.y,
            fitted: Math.max(1, Math.round(predictValue(model, point.x, n)))
        }));

        // Calculate metrics
        const metrics = calculateMetrics(fittedValues);

        // Predict pollutants
        const pollutantPredictions = predictPollutants(historicalData, predictDays);

        return {
            predictions,
            fittedValues,
            metrics,
            model: {
                type: 'OLS + Fourier Seasonal Decomposition',
                components: model.coefficients.length,
                r2: metrics.r2,
                mae: metrics.mae,
                rmse: metrics.rmse,
                dataPoints: historicalData.length
            },
            pollutantPredictions,
            trend: determineTrend(predictions)
        };
    }

    /**
     * Train the linear regression model with Fourier seasonal components
     */
    function trainModel(series) {
        const n = series.length;

        // Build feature matrix X
        // Features: [1, t, sin(2πt/365), cos(2πt/365), sin(4πt/365), cos(4πt/365), sin(2πt/7), cos(2πt/7)]
        const featureCount = 8;
        const X = [];
        const y = [];

        for (let i = 0; i < n; i++) {
            const t = series[i].x;
            const features = [
                1,                                          // intercept
                t / n,                                      // linear trend (normalized)
                Math.sin(2 * Math.PI * t / 365),           // annual sin
                Math.cos(2 * Math.PI * t / 365),           // annual cos
                Math.sin(4 * Math.PI * t / 365),           // semi-annual sin
                Math.cos(4 * Math.PI * t / 365),           // semi-annual cos
                Math.sin(2 * Math.PI * t / 7),             // weekly sin
                Math.cos(2 * Math.PI * t / 7)              // weekly cos
            ];
            X.push(features);
            y.push(series[i].y);
        }

        // Solve using Normal Equations: β = (X^T X)^(-1) X^T y
        const coefficients = solveNormalEquations(X, y, featureCount);

        // Calculate residual standard deviation
        let residualSum = 0;
        for (let i = 0; i < n; i++) {
            const predicted = dotProduct(X[i], coefficients);
            residualSum += Math.pow(y[i] - predicted, 2);
        }
        const residualStd = Math.sqrt(residualSum / Math.max(1, n - featureCount));

        return { coefficients, residualStd, n };
    }

    /**
     * Predict a value using the trained model
     */
    function predictValue(model, x, n) {
        const features = [
            1,
            x / n,
            Math.sin(2 * Math.PI * x / 365),
            Math.cos(2 * Math.PI * x / 365),
            Math.sin(4 * Math.PI * x / 365),
            Math.cos(4 * Math.PI * x / 365),
            Math.sin(2 * Math.PI * x / 7),
            Math.cos(2 * Math.PI * x / 7)
        ];
        return dotProduct(features, model.coefficients);
    }

    /**
     * Solve normal equations using Gaussian elimination
     * (X^T X) β = X^T y
     */
    function solveNormalEquations(X, y, p) {
        // Compute X^T X (p x p)
        const XtX = Array.from({ length: p }, () => Array(p).fill(0));
        const Xty = Array(p).fill(0);
        const n = X.length;

        for (let i = 0; i < n; i++) {
            for (let j = 0; j < p; j++) {
                Xty[j] += X[i][j] * y[i];
                for (let k = 0; k < p; k++) {
                    XtX[j][k] += X[i][j] * X[i][k];
                }
            }
        }

        // Add ridge regularization (small lambda) for numerical stability
        const lambda = 0.001;
        for (let i = 0; i < p; i++) {
            XtX[i][i] += lambda;
        }

        // Gaussian elimination with partial pivoting
        const augmented = XtX.map((row, i) => [...row, Xty[i]]);

        for (let col = 0; col < p; col++) {
            // Find pivot
            let maxVal = Math.abs(augmented[col][col]);
            let maxRow = col;
            for (let row = col + 1; row < p; row++) {
                if (Math.abs(augmented[row][col]) > maxVal) {
                    maxVal = Math.abs(augmented[row][col]);
                    maxRow = row;
                }
            }

            // Swap rows
            if (maxRow !== col) {
                [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];
            }

            // Eliminate below
            const pivot = augmented[col][col];
            if (Math.abs(pivot) < 1e-10) continue;

            for (let row = col + 1; row < p; row++) {
                const factor = augmented[row][col] / pivot;
                for (let j = col; j <= p; j++) {
                    augmented[row][j] -= factor * augmented[col][j];
                }
            }
        }

        // Back substitution
        const beta = Array(p).fill(0);
        for (let i = p - 1; i >= 0; i--) {
            let sum = augmented[i][p];
            for (let j = i + 1; j < p; j++) {
                sum -= augmented[i][j] * beta[j];
            }
            beta[i] = Math.abs(augmented[i][i]) > 1e-10 ? sum / augmented[i][i] : 0;
        }

        return beta;
    }

    /**
     * Dot product of two vectors
     */
    function dotProduct(a, b) {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            sum += a[i] * b[i];
        }
        return sum;
    }

    /**
     * Calculate model performance metrics
     */
    function calculateMetrics(fittedValues) {
        const n = fittedValues.length;
        let ssRes = 0, ssTot = 0, maeSum = 0;
        const mean = fittedValues.reduce((s, v) => s + v.actual, 0) / n;

        for (const v of fittedValues) {
            const residual = v.actual - v.fitted;
            ssRes += residual * residual;
            ssTot += Math.pow(v.actual - mean, 2);
            maeSum += Math.abs(residual);
        }

        const r2 = Math.max(0, 1 - ssRes / Math.max(ssTot, 1e-10));
        const mae = maeSum / n;
        const rmse = Math.sqrt(ssRes / n);

        return {
            r2: parseFloat(r2.toFixed(4)),
            mae: parseFloat(mae.toFixed(2)),
            rmse: parseFloat(rmse.toFixed(2)),
            meanAQI: parseFloat(mean.toFixed(1))
        };
    }

    /**
     * Predict individual pollutant trends
     */
    function predictPollutants(historicalData, predictDays) {
        const pollutantKeys = ['pm25', 'pm10', 'no2', 'so2', 'o3', 'co'];
        const results = {};

        for (const key of pollutantKeys) {
            const series = historicalData
                .map((d, i) => ({ x: i, y: d.pollutants?.[key] }))
                .filter(d => d.y !== null && d.y !== undefined);

            if (series.length < 7) {
                results[key] = null;
                continue;
            }

            try {
                const model = trainModel(series);
                const n = series.length;
                const predictions = [];
                const lastDate = new Date(historicalData[historicalData.length - 1].date);

                for (let i = 1; i <= predictDays; i++) {
                    const futureDate = new Date(lastDate);
                    futureDate.setDate(futureDate.getDate() + i);
                    const x = n + i - 1;
                    const predicted = predictValue(model, x, n);
                    predictions.push({
                        date: futureDate.toISOString().split('T')[0],
                        value: Math.max(0, parseFloat(predicted.toFixed(1)))
                    });
                }

                results[key] = {
                    predictions,
                    currentAvg: (series.reduce((s, p) => s + p.y, 0) / series.length).toFixed(1),
                    predictedAvg: (predictions.reduce((s, p) => s + p.value, 0) / predictions.length).toFixed(1)
                };
            } catch (e) {
                results[key] = null;
            }
        }

        return results;
    }

    /**
     * Determine overall trend direction
     */
    function determineTrend(predictions) {
        if (predictions.length < 2) return 'stable';

        const firstQuarter = predictions.slice(0, Math.floor(predictions.length / 4));
        const lastQuarter = predictions.slice(-Math.floor(predictions.length / 4));

        const avgFirst = firstQuarter.reduce((s, p) => s + p.aqi, 0) / firstQuarter.length;
        const avgLast = lastQuarter.reduce((s, p) => s + p.aqi, 0) / lastQuarter.length;

        const change = ((avgLast - avgFirst) / avgFirst) * 100;

        if (change > 10) return 'increasing';
        if (change < -10) return 'decreasing';
        return 'stable';
    }

    /**
     * Simple moving average smoother
     */
    function movingAverage(data, window = 7) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
            const start = Math.max(0, i - Math.floor(window / 2));
            const end = Math.min(data.length, i + Math.ceil(window / 2));
            const slice = data.slice(start, end);
            const avg = slice.reduce((s, v) => s + v, 0) / slice.length;
            result.push(avg);
        }
        return result;
    }

    return {
        predict,
        movingAverage
    };
})();
