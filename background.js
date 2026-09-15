// Replace "demo" with your free Alpha Vantage API Key
const ALPHA_VANTAGE_API_KEY = "demo"; 

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyze_asset") {
        analyzeAsset(request.ticker, request.type).then(sendResponse);
        return true; // Keeps the message channel open for the async API response
    }
});

async function analyzeAsset(ticker, type) {
    try {
        let closes = type === 'Crypto' ? await fetchCryptoData(ticker) : await fetchStockData(ticker);

        if (!closes || closes.length < 50) throw new Error("Not enough historical data.");

        // 1. Calculate Technical Indicators
        const rsi = calculateRSI(closes, 14);
        const sma20 = calculateSMA(closes, 20);
        const sma50 = calculateSMA(closes, 50);
        const macd = calculateMACD(closes);
        
        const isUptrend = sma20 > sma50; 
        
        let decision = "HOLD";
        let confidence = 50;

        // 2. Advanced Algorithmic Logic
        if (rsi < 45 && macd.isBullishCross) {
            decision = "BUY";
            confidence = 95; // High confidence: Not overbought AND upward momentum shift
        } else if (rsi > 60 && macd.isBearishCross) {
            decision = "SELL";
            confidence = 95; // High confidence: Overbought AND downward momentum shift
        } else if (rsi < 30 && isUptrend) {
            decision = "BUY";
            confidence = 80; // Oversold in a macro uptrend
        } else if (rsi > 70) {
            decision = "SELL";
            confidence = 80; // Standard overbought
        } else if (macd.isBullishCross) {
            decision = "BUY";
            confidence = 70; // MACD momentum is good, but RSI isn't ideal yet
        } else if (macd.isBearishCross) {
            decision = "SELL";
            confidence = 70; 
        } else {
            decision = "HOLD";
            // Confidence grows the closer RSI gets to perfectly neutral (50)
            confidence = Math.floor(Math.max(50, 100 - Math.abs(rsi - 50) * 2)); 
        }

        return {
            decision: decision,
            metrics: {
                rsi: rsi.toFixed(2),
                trend: isUptrend ? "Bullish (SMA20 > SMA50)" : "Bearish (SMA20 < SMA50)",
                macdStatus: macd.isBullishCross ? "Bullish Crossover" : macd.isBearishCross ? "Bearish Crossover" : (macd.histogram > 0 ? "Positive Momentum" : "Negative Momentum")
            },
            confidence: confidence
        };
    } catch (error) {
        console.error("Analysis Error:", error);
        return { decision: "ERROR", metrics: { rsi: "N/A", trend: "N/A", macdStatus: "N/A" }, confidence: 0 };
    }
}

// --- API FETCH FUNCTIONS ---

async function fetchCryptoData(ticker) {
    // Binance public API: expects pairs like BTCUSDT
    const symbol = ticker.toUpperCase() + "USDT";
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&limit=100`);
    if (!res.ok) throw new Error("Binance API error");
    
    const data = await res.json();
    // Binance returns an array of arrays. Index 4 is the closing price.
    return data.map(candle => parseFloat(candle[4]));
}

async function fetchStockData(ticker) {
    // Alpha Vantage API for traditional markets
    const res = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&apikey=${ALPHA_VANTAGE_API_KEY}`);
    const data = await res.json();
    
    if (data["Note"] || data["Information"]) throw new Error("API Rate Limit Exceeded");
    if (!data["Time Series (Daily)"]) throw new Error("Invalid Stock Ticker");
    
    const timeSeries = data["Time Series (Daily)"];
    
    // API returns newest date first; we sort so oldest is first for proper math
    const dates = Object.keys(timeSeries).sort((a, b) => new Date(a) - new Date(b)); 
    
    // Extract closing prices
    return dates.map(date => parseFloat(timeSeries[date]["4. close"]));
}

// --- MATH HELPERS ---

function calculateRSI(closes, period) {
    if (closes.length <= period) return 50;
    
    let gains = 0, losses = 0;
    
    // Calculate initial average gain/loss
    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }
    
    let avgGain = gains / period;
    let avgLoss = losses / period;
    
    // Smooth the averages over the rest of the dataset
    for (let i = period + 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;
        
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

function calculateSMA(closes, period) {
    if (closes.length < period) return null;
    const slice = closes.slice(-period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
}
function calculateEMA(closes, period) {
    if (closes.length < period) return null;
    
    const k = 2 / (period + 1);
    const emaArray = [];
    
    // The first EMA is a Simple Moving Average (SMA) of the initial period
    let sum = 0;
    for (let i = 0; i < period; i++) sum += closes[i];
    let initialSMA = sum / period;
    
    // Pad the beginning of the array with nulls to align indices with the price array
    for (let i = 0; i < period - 1; i++) emaArray.push(null);
    emaArray.push(initialSMA);
    
    // Calculate the EMA for the rest of the dataset
    let currentEMA = initialSMA;
    for (let i = period; i < closes.length; i++) {
        currentEMA = (closes[i] - currentEMA) * k + currentEMA;
        emaArray.push(currentEMA);
    }
    
    return emaArray;
}

function calculateMACD(closes, fast = 12, slow = 26, signalPeriod = 9) {
    const emaFast = calculateEMA(closes, fast);
    const emaSlow = calculateEMA(closes, slow);
    
    if (!emaFast || !emaSlow) return null;
    
    const macdLine = [];
    
    // 1. Calculate MACD Line (Fast EMA - Slow EMA)
    for (let i = 0; i < closes.length; i++) {
        if (emaFast[i] !== null && emaSlow[i] !== null) {
            macdLine.push(emaFast[i] - emaSlow[i]);
        } else {
            macdLine.push(null);
        }
    }
    
    // 2. Calculate Signal Line (9-period EMA of the MACD Line)
    const validMacd = macdLine.filter(val => val !== null);
    const signalEma = calculateEMA(validMacd, signalPeriod);
    
    const signalLine = [];
    for (let i = 0; i < closes.length - validMacd.length; i++) signalLine.push(null);
    signalLine.push(...signalEma);

    // 3. Extract the most recent data points to detect crossovers
    const currentMacd = macdLine[macdLine.length - 1];
    const currentSignal = signalLine[signalLine.length - 1];
    const prevMacd = macdLine[macdLine.length - 2];
    const prevSignal = signalLine[signalLine.length - 2];

    return {
        histogram: currentMacd - currentSignal,
        // Bullish cross: MACD crosses ABOVE the Signal Line
        isBullishCross: prevMacd <= prevSignal && currentMacd > currentSignal,
        // Bearish cross: MACD crosses BELOW the Signal Line
        isBearishCross: prevMacd >= prevSignal && currentMacd < currentSignal
    };
}
