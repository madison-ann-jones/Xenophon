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
        let closes = [];
        
        // 1. Fetch live historical data based on asset type
        if (type === 'Crypto') {
            closes = await fetchCryptoData(ticker);
        } else {
            closes = await fetchStockData(ticker);
        }

        if (!closes || closes.length < 50) {
            throw new Error("Not enough historical data.");
        }

        // 2. Calculate Technical Indicators
        const rsi = calculateRSI(closes, 14);
        const sma20 = calculateSMA(closes, 20);
        const sma50 = calculateSMA(closes, 50);
        
        const isUptrend = sma20 > sma50; // Short-term trend is higher than long-term
        
        let decision = "HOLD";
        let confidence = 50;

        // 3. Algorithmic Logic
        if (rsi < 30 && isUptrend) {
            decision = "BUY";
            confidence = 85;
        } else if (rsi > 70) {
            decision = "SELL";
            confidence = 80;
        } else if (rsi < 40) {
            decision = "BUY";
            confidence = 60;
        } else {
            decision = "HOLD";
            confidence = 90;
        }

        return {
            decision: decision,
            metrics: {
                rsi: rsi.toFixed(2),
                trend: isUptrend ? "Bullish (SMA20 > SMA50)" : "Bearish (SMA20 < SMA50)"
            },
            confidence: confidence
        };
    } catch (error) {
        console.error("Analysis Error:", error);
        return {
            decision: "ERROR",
            metrics: { rsi: "N/A", trend: "N/A" },
            confidence: 0
        };
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
