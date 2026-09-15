document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyze-btn');
    const tickerEl = document.getElementById('asset-ticker');
    const typeEl = document.getElementById('asset-type');
    const adviceContainer = document.getElementById('advice-container');
    const decisionEl = document.getElementById('decision');
    const metricsEl = document.getElementById('metrics-data');
    const loadingEl = document.getElementById('loading');

    function requestAnalysis() {
        loadingEl.style.display = 'block';
        adviceContainer.style.display = 'none';
        
        // Ask the active tab what asset is on the screen
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {action: "get_asset"}, (response) => {
                if (chrome.runtime.lastError || !response || !response.ticker) {
                    loadingEl.style.display = 'none';
                    tickerEl.innerText = "No Asset Detected";
                    typeEl.innerText = "Please open a chart on Binance, Robinhood, etc.";
                    return;
                }

                tickerEl.innerText = response.ticker;
                typeEl.innerText = `Asset Type: ${response.type}`;

                // Send the detected asset to the background script for financial analysis
                chrome.runtime.sendMessage({
                    action: "analyze_asset", 
                    ticker: response.ticker, 
                    type: response.type
                }, (analysisResult) => {
                    loadingEl.style.display = 'none';
                    adviceContainer.style.display = 'block';
                    
                    // Update UI with the algorithm's decision
                    decisionEl.className = `advice ${analysisResult.decision.toLowerCase()}`;
                    decisionEl.innerText = analysisResult.decision;
                    
                    metricsEl.innerHTML = `
                        RSI (14): ${analysisResult.metrics.rsi}<br>
                        Trend (SMA 50/200): ${analysisResult.metrics.trend}<br>
                        Confidence: ${analysisResult.confidence}%
                    `;
                });
            });
        });
    }

    analyzeBtn.addEventListener('click', requestAnalysis);
    
    // Auto-run on open
    requestAnalysis();
});