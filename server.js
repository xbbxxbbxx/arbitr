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
  },
  kucoin: {
    name: 'KuCoin',
    tickerUrl: 'https://api.kucoin.com/api/v1/market/allTickers',
    orderBookUrl: 'https://api.kucoin.com/api/v1/market/orderbook/level2_20'
  },
  bybit: {
    name: 'Bybit',
    tickerUrl: 'https://api.bybit.com/v2/public/tickers',
    orderBookUrl: 'https://api.bybit.com/v2/public/orderBook/L2'
  },
  okx: {
    name: 'OKX',
    tickerUrl: 'https://www.okx.com/api/v5/market/ticker',
    orderBookUrl: 'https://www.okx.com/api/v5/market/books'
  },
  gateio: {
    name: 'Gate.io',
    tickerUrl: 'https://api.gateio.ws/api/v4/spot/tickers',
    orderBookUrl: 'https://api.gateio.ws/api/v4/spot/order_book'
  },
  huobi: {
    name: 'Huobi',
    tickerUrl: 'https://api.huobi.pro/market/detail/merged',
    orderBookUrl: 'https://api.huobi.pro/market/depth'
  },
  bitfinex: {
    name: 'Bitfinex',
    tickerUrl: 'https://api-pub.bitfinex.com/v2/ticker',
    orderBookUrl: 'https://api-pub.bitfinex.com/v2/book'
  },
  bitstamp: {
    name: 'Bitstamp',
    tickerUrl: 'https://www.bitstamp.net/api/v2/ticker',
    orderBookUrl: 'https://www.bitstamp.net/api/v2/order_book'
  }
};

// Расширенный список популярных торговых пар
const TRADING_PAIRS = [
  // BTC пары
  'BTC/USDT', 'BTC/USD', 'BTC/EUR', 'BTC/GBP', 'BTC/BUSD', 'BTC/USDC',
  // ETH пары
  'ETH/USDT', 'ETH/USD', 'ETH/EUR', 'ETH/BTC', 'ETH/BUSD', 'ETH/USDC',
  // Популярные альткоины
  'BNB/USDT', 'BNB/BTC', 'BNB/USD',
  'SOL/USDT', 'SOL/BTC', 'SOL/USD',
  'ADA/USDT', 'ADA/BTC', 'ADA/USD',
  'XRP/USDT', 'XRP/BTC', 'XRP/USD',
  'DOT/USDT', 'DOT/BTC', 'DOT/USD',
  'DOGE/USDT', 'DOGE/BTC', 'DOGE/USD',
  'MATIC/USDT', 'MATIC/BTC', 'MATIC/USD',
  'AVAX/USDT', 'AVAX/BTC', 'AVAX/USD',
  'LINK/USDT', 'LINK/BTC', 'LINK/USD',
  'UNI/USDT', 'UNI/BTC', 'UNI/USD',
  'ATOM/USDT', 'ATOM/BTC', 'ATOM/USD',
  'LTC/USDT', 'LTC/BTC', 'LTC/USD',
  'BCH/USDT', 'BCH/BTC', 'BCH/USD',
  'XLM/USDT', 'XLM/BTC', 'XLM/USD',
  'ALGO/USDT', 'ALGO/BTC', 'ALGO/USD',
  'VET/USDT', 'VET/BTC', 'VET/USD',
  'ICP/USDT', 'ICP/BTC', 'ICP/USD',
  'FIL/USDT', 'FIL/BTC', 'FIL/USD',
  'TRX/USDT', 'TRX/BTC', 'TRX/USD',
  'ETC/USDT', 'ETC/BTC', 'ETC/USD',
  'EOS/USDT', 'EOS/BTC', 'EOS/USD',
  'AAVE/USDT', 'AAVE/BTC', 'AAVE/USD',
  'MKR/USDT', 'MKR/BTC', 'MKR/USD',
  'COMP/USDT', 'COMP/BTC', 'COMP/USD',
  'SUSHI/USDT', 'SUSHI/BTC', 'SUSHI/USD',
  'SNX/USDT', 'SNX/BTC', 'SNX/USD',
  'YFI/USDT', 'YFI/BTC', 'YFI/USD',
  'CRV/USDT', 'CRV/BTC', 'CRV/USD',
  '1INCH/USDT', '1INCH/BTC', '1INCH/USD',
  'GRT/USDT', 'GRT/BTC', 'GRT/USD',
  'NEAR/USDT', 'NEAR/BTC', 'NEAR/USD',
  'FTM/USDT', 'FTM/BTC', 'FTM/USD',
  'SAND/USDT', 'SAND/BTC', 'SAND/USD',
  'MANA/USDT', 'MANA/BTC', 'MANA/USD',
  'AXS/USDT', 'AXS/BTC', 'AXS/USD',
  'THETA/USDT', 'THETA/BTC', 'THETA/USD',
  'ENJ/USDT', 'ENJ/BTC', 'ENJ/USD',
  'CHZ/USDT', 'CHZ/BTC', 'CHZ/USD',
  'HBAR/USDT', 'HBAR/BTC', 'HBAR/USD',
  'FLOW/USDT', 'FLOW/BTC', 'FLOW/USD',
  'EGLD/USDT', 'EGLD/BTC', 'EGLD/USD',
  'ZIL/USDT', 'ZIL/BTC', 'ZIL/USD',
  'XTZ/USDT', 'XTZ/BTC', 'XTZ/USD',
  'ZEC/USDT', 'ZEC/BTC', 'ZEC/USD',
  'DASH/USDT', 'DASH/BTC', 'DASH/USD',
  'WAVES/USDT', 'WAVES/BTC', 'WAVES/USD',
  'IOTA/USDT', 'IOTA/BTC', 'IOTA/USD',
  'NEO/USDT', 'NEO/BTC', 'NEO/USD',
  'QTUM/USDT', 'QTUM/BTC', 'QTUM/USD',
  'ONT/USDT', 'ONT/BTC', 'ONT/USD',
  'ZRX/USDT', 'ZRX/BTC', 'ZRX/USD',
  'BAT/USDT', 'BAT/BTC', 'BAT/USD',
  'OMG/USDT', 'OMG/BTC', 'OMG/USD',
  'KSM/USDT', 'KSM/BTC', 'KSM/USD',
  'LUNA/USDT', 'LUNA/BTC', 'LUNA/USD',
  'ROSE/USDT', 'ROSE/BTC', 'ROSE/USD',
  'CELO/USDT', 'CELO/BTC', 'CELO/USD',
  'KLAY/USDT', 'KLAY/BTC', 'KLAY/USD',
  'GALA/USDT', 'GALA/BTC', 'GALA/USD',
  'APE/USDT', 'APE/BTC', 'APE/USD',
  'GMT/USDT', 'GMT/BTC', 'GMT/USD',
  'APT/USDT', 'APT/BTC', 'APT/USD',
  'OP/USDT', 'OP/BTC', 'OP/USD',
  'ARB/USDT', 'ARB/BTC', 'ARB/USD',
  'INJ/USDT', 'INJ/BTC', 'INJ/USD',
  'SUI/USDT', 'SUI/BTC', 'SUI/USD',
  'PEPE/USDT', 'PEPE/BTC', 'PEPE/USD',
  'FLOKI/USDT', 'FLOKI/BTC', 'FLOKI/USD',
  'SHIB/USDT', 'SHIB/BTC', 'SHIB/USD'
];

// Функция для нормализации символа пары
function normalizeSymbol(symbol, exchange) {
  const [base, quote] = symbol.split('/');
  
  if (exchange === 'binance') {
    return `${base}${quote}`;
  } else if (exchange === 'coinbase') {
    return `${base}-${quote}`;
  } else if (exchange === 'kraken') {
    return `${base}${quote}`;
  } else if (exchange === 'kucoin') {
    return `${base}-${quote}`;
  } else if (exchange === 'bybit') {
    return `${base}${quote}`;
  } else if (exchange === 'okx') {
    return `${base}-${quote}`;
  } else if (exchange === 'gateio') {
    return `${base}_${quote}`;
  } else if (exchange === 'huobi') {
    return `${base.toLowerCase()}${quote.toLowerCase()}`;
  } else if (exchange === 'bitfinex') {
    return `t${base}${quote}`;
  } else if (exchange === 'bitstamp') {
    return `${base.toLowerCase()}${quote.toLowerCase()}`;
  }
  return symbol;
}

// Получение цены с Binance
async function getBinancePrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'binance');
    const response = await axios.get(`${EXCHANGES.binance.tickerUrl}?symbol=${normalized}`, { timeout: 5000 });
    return parseFloat(response.data.price);
  } catch (error) {
    return null;
  }
}

// Получение цены с Coinbase
async function getCoinbasePrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'coinbase');
    const response = await axios.get(`${EXCHANGES.coinbase.tickerUrl}/${normalized}/ticker`, { timeout: 5000 });
    return parseFloat(response.data.price);
  } catch (error) {
    return null;
  }
}

// Получение цены с Kraken
async function getKrakenPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'kraken');
    const response = await axios.get(`${EXCHANGES.kraken.tickerUrl}?pair=${normalized}`, { timeout: 5000 });
    const pairKey = Object.keys(response.data.result)[0];
    if (pairKey && response.data.result[pairKey].c) {
      return parseFloat(response.data.result[pairKey].c[0]);
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Получение цены с KuCoin
async function getKuCoinPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'kucoin');
    const response = await axios.get(EXCHANGES.kucoin.tickerUrl, { timeout: 5000 });
    const ticker = response.data.data.ticker.find(t => t.symbol === normalized);
    if (ticker && ticker.last) {
      return parseFloat(ticker.last);
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Получение цены с Bybit
async function getBybitPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'bybit');
    const response = await axios.get(`${EXCHANGES.bybit.tickerUrl}?symbol=${normalized}`, { timeout: 5000 });
    if (response.data.result && response.data.result.length > 0) {
      return parseFloat(response.data.result[0].last_price);
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Получение цены с OKX
async function getOKXPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'okx');
    const response = await axios.get(`${EXCHANGES.okx.tickerUrl}?instId=${normalized}`, { timeout: 5000 });
    if (response.data.data && response.data.data.length > 0) {
      return parseFloat(response.data.data[0].last);
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Получение цены с Gate.io
async function getGateIOPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'gateio');
    const response = await axios.get(`${EXCHANGES.gateio.tickerUrl}?currency_pair=${normalized}`, { timeout: 5000 });
    if (response.data && response.data.length > 0 && response.data[0].last) {
      return parseFloat(response.data[0].last);
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Получение цены с Huobi
async function getHuobiPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'huobi');
    const response = await axios.get(`${EXCHANGES.huobi.tickerUrl}?symbol=${normalized}`, { timeout: 5000 });
    if (response.data && response.data.tick && response.data.tick.close) {
      return parseFloat(response.data.tick.close);
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Получение цены с Bitfinex
async function getBitfinexPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'bitfinex');
    const response = await axios.get(`${EXCHANGES.bitfinex.tickerUrl}/${normalized}`, { timeout: 5000 });
    if (response.data && Array.isArray(response.data) && response.data.length > 6) {
      return parseFloat(response.data[6]); // last_price находится в индексе 6
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Получение цены с Bitstamp
async function getBitstampPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'bitstamp');
    const response = await axios.get(`${EXCHANGES.bitstamp.tickerUrl}/${normalized}`, { timeout: 5000 });
    if (response.data && response.data.last) {
      return parseFloat(response.data.last);
    }
    return null;
  } catch (error) {
    return null;
  }
}

// Получение всех цен для пары
async function getAllPrices(symbol) {
  const prices = {};
  
  const pricePromises = [
    getBinancePrice(symbol).then(price => price && (prices.binance = price)),
    getCoinbasePrice(symbol).then(price => price && (prices.coinbase = price)),
    getKrakenPrice(symbol).then(price => price && (prices.kraken = price)),
    getKuCoinPrice(symbol).then(price => price && (prices.kucoin = price)),
    getBybitPrice(symbol).then(price => price && (prices.bybit = price)),
    getOKXPrice(symbol).then(price => price && (prices.okx = price)),
    getGateIOPrice(symbol).then(price => price && (prices.gateio = price)),
    getHuobiPrice(symbol).then(price => price && (prices.huobi = price)),
    getBitfinexPrice(symbol).then(price => price && (prices.bitfinex = price)),
    getBitstampPrice(symbol).then(price => price && (prices.bitstamp = price))
  ];

  await Promise.allSettled(pricePromises);

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
      
      if (!price1 || !price2) continue;
      
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
    const limit = parseInt(req.query.limit) || 50; // Ограничение для производительности
    
    // Обрабатываем только первые limit пар для быстрого ответа
    const pairsToProcess = TRADING_PAIRS.slice(0, limit);
    
    for (const pair of pairsToProcess) {
      const prices = await getAllPrices(pair);
      const opportunities = calculateArbitrageOpportunities(prices, pair);
      allOpportunities.push(...opportunities);
    }
    
    res.json({
      success: true,
      opportunities: allOpportunities.sort((a, b) => b.profitPercent - a.profitPercent),
      timestamp: new Date().toISOString(),
      totalPairs: TRADING_PAIRS.length,
      processedPairs: pairsToProcess.length
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
    const limit = parseInt(req.query.limit) || 30; // Ограничение для производительности
    
    // Обрабатываем только первые limit пар
    const pairsToProcess = TRADING_PAIRS.slice(0, limit);
    
    for (const pair of pairsToProcess) {
      const prices = await getAllPrices(pair);
      allPrices[pair] = prices;
    }
    
    res.json({
      success: true,
      prices: allPrices,
      timestamp: new Date().toISOString(),
      totalPairs: TRADING_PAIRS.length,
      processedPairs: pairsToProcess.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint для получения списка всех торговых пар
app.get('/api/pairs', (req, res) => {
  res.json({
    success: true,
    pairs: TRADING_PAIRS,
    total: TRADING_PAIRS.length
  });
});

// API endpoint для получения списка всех бирж
app.get('/api/exchanges', (req, res) => {
  const exchangesList = Object.keys(EXCHANGES).map(key => ({
    id: key,
    name: EXCHANGES[key].name
  }));
  
  res.json({
    success: true,
    exchanges: exchangesList,
    total: exchangesList.length
  });
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
    console.log(`📈 Поддерживается ${Object.keys(EXCHANGES).length} бирж и ${TRADING_PAIRS.length} торговых пар`);
  });
}

// Для Vercel serverless
module.exports = app;
