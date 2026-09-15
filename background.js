chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyze_asset") {
        
        // In a live production environment, you would fetch real data here:
        // fetch(`https://api.coingecko.com/api/v3/coins/${request.ticker.toLowerCase()}/market_chart?...`)
        // fetch(`https://www.alphavantage.co/query?function=RSI&symbol=${request.ticker}&apikey=YOUR_API_KEY`)
        
        // ==========================================
        // ALGORITHMIC ADVICE ENGINE (Simulated for this build)
        // ==========================================
        
        // Mocking real-time market data calculation
        const mockRSI = Math.floor(Math.random() * 100); 
        const isGoldenCross = Math.random() > 0.5; // Simulating 50 MA crossing above 200 MA
        
        let decision = "HOLD";
        let confidence = 50;

        // Basic trading strategy logic
        if (mockRSI < 30 && isGoldenCross) {
            decision = "BUY"; // Oversold + Uptrend
            confidence = 85;
        } else if (mockRSI > 70) {
            decision = "SELL"; // Overbought
            confidence = 75;
        } else if (mockRSI < 40) {
            decision = "BUY"; // Approaching oversold
            confidence = 60;
        } else {
            decision = "HOLD"; // Neutral territory
            confidence = 90;
        }

        // Return the decision to the popup
        setTimeout(() => { // Simulated API latency
            sendResponse({
                decision: decision,
                metrics: {
                    rsi: mockRSI,
                    trend: isGoldenCross ? "Bullish (Golden Cross)" : "Bearish / Neutral"
                },
                confidence: confidence
            });
        }, 800);

        return true; // Indicates we will send a response asynchronously
    }
});