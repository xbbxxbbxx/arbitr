const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Поддерживаемые биржи и их API endpoints
const EXCHANGES = {
  binance: {
    name: 'Binance',
    tickerUrl: 'https://api.binance.com/api/v3/ticker/price',
    orderBookUrl: 'https://api.binance.com/api/v3/depth'
  },
  coinbase: {
    name: 'Coinbase Pro',
    tickerUrl: 'https://api.exchange.coinbase.com/products',
    orderBookUrl: 'https://api.exchange.coinbase.com/products'
  },
  kraken: {
    name: 'Kraken',
    tickerUrl: 'https://api.kraken.com/0/public/Ticker',
    orderBookUrl: 'https://api.kraken.com/0/public/Depth'
  }
};

// Популярные торговые пары
const TRADING_PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT',
  'BTC/USD', 'ETH/USD', 'BTC/EUR', 'ETH/EUR'
];

// Функция для нормализации символа пары
function normalizeSymbol(symbol, exchange) {
  if (exchange === 'binance') {
    return symbol.replace('/', '');
  } else if (exchange === 'coinbase') {
    return symbol.replace('/', '-');
  } else if (exchange === 'kraken') {
    const [base, quote] = symbol.split('/');
    return `${base}${quote}`;
  }
  return symbol;
}

// Получение цены с Binance
async function getBinancePrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'binance');
    const response = await axios.get(`${EXCHANGES.binance.tickerUrl}?symbol=${normalized}`);
    return parseFloat(response.data.price);
  } catch (error) {
    return null;
  }
}

// Получение цены с Coinbase
async function getCoinbasePrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'coinbase');
    const response = await axios.get(`${EXCHANGES.coinbase.tickerUrl}/${normalized}/ticker`);
    return parseFloat(response.data.price);
  } catch (error) {
    return null;
  }
}

// Получение цены с Kraken
async function getKrakenPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'kraken');
    const response = await axios.get(`${EXCHANGES.kraken.tickerUrl}?pair=${normalized}`);
    const pairKey = Object.keys(response.data.result)[0];
    if (pairKey && response.data.result[pairKey].c) {
      return parseFloat(response.data.result[pairKey].c[0]);
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Получение всех цен для пары
async function getAllPrices(symbol) {
  const prices = {};
  
  const [binancePrice, coinbasePrice, krakenPrice] = await Promise.all([
    getBinancePrice(symbol),
    getCoinbasePrice(symbol),
    getKrakenPrice(symbol)
  ]);

  if (binancePrice) prices.binance = binancePrice;
  if (coinbasePrice) prices.coinbase = coinbasePrice;
  if (krakenPrice) prices.kraken = krakenPrice;

  return prices;
}

// Вычисление арбитражных возможностей
function calculateArbitrageOpportunities(prices, symbol) {
  const opportunities = [];
  const exchanges = Object.keys(prices);
  
  if (exchanges.length < 2) return opportunities;

  for (let i = 0; i < exchanges.length; i++) {
    for (let j = i + 1; j < exchanges.length; j++) {
      const exchange1 = exchanges[i];
      const exchange2 = exchanges[j];
      const price1 = prices[exchange1];
      const price2 = prices[exchange2];
      
      const diff = Math.abs(price1 - price2);
      const avgPrice = (price1 + price2) / 2;
      const profitPercent = (diff / avgPrice) * 100;
      
      if (profitPercent > 0.1) { // Минимальный процент прибыли 0.1%
        opportunities.push({
          symbol,
          buyExchange: price1 < price2 ? exchange1 : exchange2,
          sellExchange: price1 < price2 ? exchange2 : exchange1,
          buyPrice: price1 < price2 ? price1 : price2,
          sellPrice: price1 < price2 ? price2 : price1,
          profit: diff,
          profitPercent: profitPercent.toFixed(2),
          timestamp: new Date().toISOString()
        });
      }
    }
  }
  
  return opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
}

// API endpoint для получения всех арбитражных возможностей
app.get('/api/arbitrage', async (req, res) => {
  try {
    const allOpportunities = [];
    
    for (const pair of TRADING_PAIRS) {
      const prices = await getAllPrices(pair);
      const opportunities = calculateArbitrageOpportunities(prices, pair);
      allOpportunities.push(...opportunities);
    }
    
    res.json({
      success: true,
      opportunities: allOpportunities.sort((a, b) => b.profitPercent - a.profitPercent),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint для получения цен конкретной пары
app.get('/api/prices/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.replace('-', '/');
    const prices = await getAllPrices(symbol);
    
    res.json({
      success: true,
      symbol,
      prices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint для получения всех цен
app.get('/api/prices', async (req, res) => {
  try {
    const allPrices = {};
    
    for (const pair of TRADING_PAIRS) {
      const prices = await getAllPrices(pair);
      allPrices[pair] = prices;
    }
    
    res.json({
      success: true,
      prices: allPrices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Раздача статических файлов (должно быть ДО других маршрутов)
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath, {
  maxAge: '1d',
  etag: true
}));

// Явные маршруты для статических файлов (для Vercel)
app.get('/styles.css', (req, res) => {
  res.sendFile(path.join(publicPath, 'styles.css'), {
    headers: {
      'Content-Type': 'text/css'
    }
  });
});

app.get('/app.js', (req, res) => {
  res.sendFile(path.join(publicPath, 'app.js'), {
    headers: {
      'Content-Type': 'application/javascript'
    }
  });
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Экспорт для Vercel
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📊 Мониторинг арбитражных возможностей активен`);
  });
}

// Для Vercel serverless
module.exports = app;
