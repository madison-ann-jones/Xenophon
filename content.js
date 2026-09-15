// Listens for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "get_asset") {
        let ticker = null;
        let type = 'Unknown';
        const url = window.location.href;

        // Platform-specific logic to scrape the ticker symbol
        if (url.includes('binance.com')) {
            // Example Binance URL: https://www.binance.com/en/trade/BTC_USDT
            const match = url.match(/trade\/([A-Z0-9]+)_/);
            if (match) {
                ticker = match[1];
                type = 'Crypto';
            }
        } else if (url.includes('robinhood.com')) {
            // Example Robinhood URL: https://robinhood.com/stocks/AAPL
            const match = url.match(/(?:stocks|crypto)\/([A-Z]+)/);
            if (match) {
                ticker = match[1];
                type = url.includes('crypto') ? 'Crypto' : 'Stock/ETF';
            }
        } else if (url.includes('coinbase.com')) {
             const match = url.match(/price\/([a-z0-9-]+)/i);
             if (match) {
                 ticker = match[1].toUpperCase();
                 type = 'Crypto';
             }
        }

        // Fallback: Check the page title
        if (!ticker) {
            const titleMatch = document.title.match(/([A-Z]{2,5}) [P|p]rice/);
            if (titleMatch) ticker = titleMatch[1];
        }

        sendResponse({ ticker: ticker, type: type });
    }
    return true;
});