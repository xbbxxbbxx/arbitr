const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Кэш для цен (TTL: 3 секунды)
const priceCache = new Map();
const CACHE_TTL = 3000;

// Кэш для арбитражных возможностей (TTL: 30 секунд)
const arbitrageCache = new Map();
const ARBITRAGE_CACHE_TTL = 30000;

// HTTP клиент с оптимизацией
const axiosInstance = axios.create({
  timeout: 3000,
  maxRedirects: 3,
  headers: {
    'User-Agent': 'CryptoArbitrageBot/1.0'
  }
});

// Расширенный список бирж
const EXCHANGES = {
  binance: {
    name: 'Binance',
    tickerUrl: 'https://api.binance.com/api/v3/ticker/price'
  },
  coinbase: {
    name: 'Coinbase Pro',
    tickerUrl: 'https://api.exchange.coinbase.com/products'
  },
  kraken: {
    name: 'Kraken',
    tickerUrl: 'https://api.kraken.com/0/public/Ticker'
  },
  kucoin: {
    name: 'KuCoin',
    tickerUrl: 'https://api.kucoin.com/api/v1/market/allTickers'
  },
  bybit: {
    name: 'Bybit',
    tickerUrl: 'https://api.bybit.com/v2/public/tickers'
  },
  okx: {
    name: 'OKX',
    tickerUrl: 'https://www.okx.com/api/v5/market/ticker'
  },
  gateio: {
    name: 'Gate.io',
    tickerUrl: 'https://api.gateio.ws/api/v4/spot/tickers'
  },
  huobi: {
    name: 'Huobi',
    tickerUrl: 'https://api.huobi.pro/market/detail/merged'
  },
  bitfinex: {
    name: 'Bitfinex',
    tickerUrl: 'https://api-pub.bitfinex.com/v2/ticker'
  },
  bitstamp: {
    name: 'Bitstamp',
    tickerUrl: 'https://www.bitstamp.net/api/v2/ticker'
  },
  gemini: {
    name: 'Gemini',
    tickerUrl: 'https://api.gemini.com/v1/pubticker'
  },
  bitget: {
    name: 'Bitget',
    tickerUrl: 'https://api.bitget.com/api/spot/v1/market/ticker'
  },
  mexc: {
    name: 'MEXC',
    tickerUrl: 'https://api.mexc.com/api/v3/ticker/price'
  }
};

// Очень расширенный список торговых пар
const TRADING_PAIRS = [
  // BTC пары
  'BTC/USDT', 'BTC/USD', 'BTC/EUR', 'BTC/GBP', 'BTC/BUSD', 'BTC/USDC', 'BTC/ETH',
  // ETH пары
  'ETH/USDT', 'ETH/USD', 'ETH/EUR', 'ETH/BTC', 'ETH/BUSD', 'ETH/USDC',
  // Топ альткоины
  'BNB/USDT', 'BNB/BTC', 'BNB/USD', 'BNB/ETH',
  'SOL/USDT', 'SOL/BTC', 'SOL/USD', 'SOL/ETH',
  'ADA/USDT', 'ADA/BTC', 'ADA/USD', 'ADA/ETH',
  'XRP/USDT', 'XRP/BTC', 'XRP/USD', 'XRP/ETH',
  'DOT/USDT', 'DOT/BTC', 'DOT/USD', 'DOT/ETH',
  'DOGE/USDT', 'DOGE/BTC', 'DOGE/USD', 'DOGE/ETH',
  'MATIC/USDT', 'MATIC/BTC', 'MATIC/USD', 'MATIC/ETH',
  'AVAX/USDT', 'AVAX/BTC', 'AVAX/USD', 'AVAX/ETH',
  'LINK/USDT', 'LINK/BTC', 'LINK/USD', 'LINK/ETH',
  'UNI/USDT', 'UNI/BTC', 'UNI/USD', 'UNI/ETH',
  'ATOM/USDT', 'ATOM/BTC', 'ATOM/USD', 'ATOM/ETH',
  'LTC/USDT', 'LTC/BTC', 'LTC/USD', 'LTC/ETH',
  'BCH/USDT', 'BCH/BTC', 'BCH/USD', 'BCH/ETH',
  'XLM/USDT', 'XLM/BTC', 'XLM/USD', 'XLM/ETH',
  'ALGO/USDT', 'ALGO/BTC', 'ALGO/USD', 'ALGO/ETH',
  'VET/USDT', 'VET/BTC', 'VET/USD', 'VET/ETH',
  'ICP/USDT', 'ICP/BTC', 'ICP/USD', 'ICP/ETH',
  'FIL/USDT', 'FIL/BTC', 'FIL/USD', 'FIL/ETH',
  'TRX/USDT', 'TRX/BTC', 'TRX/USD', 'TRX/ETH',
  'ETC/USDT', 'ETC/BTC', 'ETC/USD', 'ETC/ETH',
  'EOS/USDT', 'EOS/BTC', 'EOS/USD', 'EOS/ETH',
  // DeFi токены
  'AAVE/USDT', 'AAVE/BTC', 'AAVE/USD', 'AAVE/ETH',
  'MKR/USDT', 'MKR/BTC', 'MKR/USD', 'MKR/ETH',
  'COMP/USDT', 'COMP/BTC', 'COMP/USD', 'COMP/ETH',
  'SUSHI/USDT', 'SUSHI/BTC', 'SUSHI/USD', 'SUSHI/ETH',
  'SNX/USDT', 'SNX/BTC', 'SNX/USD', 'SNX/ETH',
  'YFI/USDT', 'YFI/BTC', 'YFI/USD', 'YFI/ETH',
  'CRV/USDT', 'CRV/BTC', 'CRV/USD', 'CRV/ETH',
  '1INCH/USDT', '1INCH/BTC', '1INCH/USD', '1INCH/ETH',
  'GRT/USDT', 'GRT/BTC', 'GRT/USD', 'GRT/ETH',
  // Layer 1
  'NEAR/USDT', 'NEAR/BTC', 'NEAR/USD', 'NEAR/ETH',
  'FTM/USDT', 'FTM/BTC', 'FTM/USD', 'FTM/ETH',
  'HBAR/USDT', 'HBAR/BTC', 'HBAR/USD', 'HBAR/ETH',
  'FLOW/USDT', 'FLOW/BTC', 'FLOW/USD', 'FLOW/ETH',
  'EGLD/USDT', 'EGLD/BTC', 'EGLD/USD', 'EGLD/ETH',
  'ZIL/USDT', 'ZIL/BTC', 'ZIL/USD', 'ZIL/ETH',
  'XTZ/USDT', 'XTZ/BTC', 'XTZ/USD', 'XTZ/ETH',
  'ZEC/USDT', 'ZEC/BTC', 'ZEC/USD', 'ZEC/ETH',
  'DASH/USDT', 'DASH/BTC', 'DASH/USD', 'DASH/ETH',
  'WAVES/USDT', 'WAVES/BTC', 'WAVES/USD', 'WAVES/ETH',
  'IOTA/USDT', 'IOTA/BTC', 'IOTA/USD', 'IOTA/ETH',
  'NEO/USDT', 'NEO/BTC', 'NEO/USD', 'NEO/ETH',
  'QTUM/USDT', 'QTUM/BTC', 'QTUM/USD', 'QTUM/ETH',
  'ONT/USDT', 'ONT/BTC', 'ONT/USD', 'ONT/ETH',
  'ZRX/USDT', 'ZRX/BTC', 'ZRX/USD', 'ZRX/ETH',
  'BAT/USDT', 'BAT/BTC', 'BAT/USD', 'BAT/ETH',
  'OMG/USDT', 'OMG/BTC', 'OMG/USD', 'OMG/ETH',
  'KSM/USDT', 'KSM/BTC', 'KSM/USD', 'KSM/ETH',
  // NFT/Gaming
  'SAND/USDT', 'SAND/BTC', 'SAND/USD', 'SAND/ETH',
  'MANA/USDT', 'MANA/BTC', 'MANA/USD', 'MANA/ETH',
  'AXS/USDT', 'AXS/BTC', 'AXS/USD', 'AXS/ETH',
  'THETA/USDT', 'THETA/BTC', 'THETA/USD', 'THETA/ETH',
  'ENJ/USDT', 'ENJ/BTC', 'ENJ/USD', 'ENJ/ETH',
  'CHZ/USDT', 'CHZ/BTC', 'CHZ/USD', 'CHZ/ETH',
  'GALA/USDT', 'GALA/BTC', 'GALA/USD', 'GALA/ETH',
  'APE/USDT', 'APE/BTC', 'APE/USD', 'APE/ETH',
  'GMT/USDT', 'GMT/BTC', 'GMT/USD', 'GMT/ETH',
  // Layer 2
  'OP/USDT', 'OP/BTC', 'OP/USD', 'OP/ETH',
  'ARB/USDT', 'ARB/BTC', 'ARB/USD', 'ARB/ETH',
  // Новые монеты
  'APT/USDT', 'APT/BTC', 'APT/USD', 'APT/ETH',
  'INJ/USDT', 'INJ/BTC', 'INJ/USD', 'INJ/ETH',
  'SUI/USDT', 'SUI/BTC', 'SUI/USD', 'SUI/ETH',
  'TIA/USDT', 'TIA/BTC', 'TIA/USD', 'TIA/ETH',
  'SEI/USDT', 'SEI/BTC', 'SEI/USD', 'SEI/ETH',
  'BLUR/USDT', 'BLUR/BTC', 'BLUR/USD', 'BLUR/ETH',
  'JTO/USDT', 'JTO/BTC', 'JTO/USD', 'JTO/ETH',
  'WLD/USDT', 'WLD/BTC', 'WLD/USD', 'WLD/ETH',
  'PYTH/USDT', 'PYTH/BTC', 'PYTH/USD', 'PYTH/ETH',
  // Мемкоины
  'PEPE/USDT', 'PEPE/BTC', 'PEPE/USD', 'PEPE/ETH',
  'FLOKI/USDT', 'FLOKI/BTC', 'FLOKI/USD', 'FLOKI/ETH',
  'SHIB/USDT', 'SHIB/BTC', 'SHIB/USD', 'SHIB/ETH',
  'BONK/USDT', 'BONK/BTC', 'BONK/USD', 'BONK/ETH',
  // Дополнительные популярные
  'ROSE/USDT', 'ROSE/BTC', 'ROSE/USD', 'ROSE/ETH',
  'CELO/USDT', 'CELO/BTC', 'CELO/USD', 'CELO/ETH',
  'KLAY/USDT', 'KLAY/BTC', 'KLAY/USD', 'KLAY/ETH',
  'LUNA/USDT', 'LUNA/BTC', 'LUNA/USD', 'LUNA/ETH',
  'RUNE/USDT', 'RUNE/BTC', 'RUNE/USD', 'RUNE/ETH',
  'CAKE/USDT', 'CAKE/BTC', 'CAKE/USD', 'CAKE/ETH',
  'BAKE/USDT', 'BAKE/BTC', 'BAKE/USD', 'BAKE/ETH',
  'SFP/USDT', 'SFP/BTC', 'SFP/USD', 'SFP/ETH',
  'DYDX/USDT', 'DYDX/BTC', 'DYDX/USD', 'DYDX/ETH',
  'ENS/USDT', 'ENS/BTC', 'ENS/USD', 'ENS/ETH',
  'IMX/USDT', 'IMX/BTC', 'IMX/USD', 'IMX/ETH',
  'LRC/USDT', 'LRC/BTC', 'LRC/USD', 'LRC/ETH',
  'RNDR/USDT', 'RNDR/BTC', 'RNDR/USD', 'RNDR/ETH',
  'STX/USDT', 'STX/BTC', 'STX/USD', 'STX/ETH',
  'APT/USDT', 'APT/BTC', 'APT/USD', 'APT/ETH',
  'HBAR/USDT', 'HBAR/BTC', 'HBAR/USD', 'HBAR/ETH',
  'QNT/USDT', 'QNT/BTC', 'QNT/USD', 'QNT/ETH',
  'EOS/USDT', 'EOS/BTC', 'EOS/USD', 'EOS/ETH',
  'FLOW/USDT', 'FLOW/BTC', 'FLOW/USD', 'FLOW/ETH'
];

// Нормализация символов
function normalizeSymbol(symbol, exchange) {
  const [base, quote] = symbol.split('/');
  
  if (exchange === 'binance') return `${base}${quote}`;
  if (exchange === 'coinbase') return `${base}-${quote}`;
  if (exchange === 'kraken') return `${base}${quote}`;
  if (exchange === 'kucoin') return `${base}-${quote}`;
  if (exchange === 'bybit') return `${base}${quote}`;
  if (exchange === 'okx') return `${base}-${quote}`;
  if (exchange === 'gateio') return `${base}_${quote}`;
  if (exchange === 'huobi') return `${base.toLowerCase()}${quote.toLowerCase()}`;
  if (exchange === 'bitfinex') return `t${base}${quote}`;
  if (exchange === 'bitstamp') return `${base.toLowerCase()}${quote.toLowerCase()}`;
  if (exchange === 'gemini') return `${base.toLowerCase()}${quote.toLowerCase()}`;
  if (exchange === 'bitget') return `${base}${quote}`;
  if (exchange === 'mexc') return `${base}${quote}`;
  return symbol;
}

// Функции получения цен
async function getBinancePrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'binance');
    const response = await axiosInstance.get(`${EXCHANGES.binance.tickerUrl}?symbol=${normalized}`);
    return parseFloat(response.data.price);
  } catch (error) {
    return null;
  }
}

async function getCoinbasePrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'coinbase');
    const response = await axiosInstance.get(`${EXCHANGES.coinbase.tickerUrl}/${normalized}/ticker`);
    return parseFloat(response.data.price);
  } catch (error) {
    return null;
  }
}

async function getKrakenPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'kraken');
    const response = await axiosInstance.get(`${EXCHANGES.kraken.tickerUrl}?pair=${normalized}`);
    const pairKey = Object.keys(response.data.result)[0];
    if (pairKey && response.data.result[pairKey].c) {
      return parseFloat(response.data.result[pairKey].c[0]);
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getKuCoinPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'kucoin');
    const response = await axiosInstance.get(EXCHANGES.kucoin.tickerUrl);
    const ticker = response.data.data.ticker.find(t => t.symbol === normalized);
    if (ticker && ticker.last) {
      return parseFloat(ticker.last);
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getBybitPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'bybit');
    const response = await axiosInstance.get(`${EXCHANGES.bybit.tickerUrl}?symbol=${normalized}`);
    if (response.data.result && response.data.result.length > 0) {
      return parseFloat(response.data.result[0].last_price);
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getOKXPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'okx');
    const response = await axiosInstance.get(`${EXCHANGES.okx.tickerUrl}?instId=${normalized}`);
    if (response.data.data && response.data.data.length > 0) {
      return parseFloat(response.data.data[0].last);
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getGateIOPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'gateio');
    const response = await axiosInstance.get(`${EXCHANGES.gateio.tickerUrl}?currency_pair=${normalized}`);
    if (response.data && response.data.length > 0 && response.data[0].last) {
      return parseFloat(response.data[0].last);
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getHuobiPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'huobi');
    const response = await axiosInstance.get(`${EXCHANGES.huobi.tickerUrl}?symbol=${normalized}`);
    if (response.data && response.data.tick && response.data.tick.close) {
      return parseFloat(response.data.tick.close);
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getBitfinexPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'bitfinex');
    const response = await axiosInstance.get(`${EXCHANGES.bitfinex.tickerUrl}/${normalized}`);
    if (response.data && Array.isArray(response.data) && response.data.length > 6) {
      return parseFloat(response.data[6]);
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getBitstampPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'bitstamp');
    const response = await axiosInstance.get(`${EXCHANGES.bitstamp.tickerUrl}/${normalized}`);
    if (response.data && response.data.last) {
      return parseFloat(response.data.last);
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getGeminiPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'gemini');
    const response = await axiosInstance.get(`${EXCHANGES.gemini.tickerUrl}/${normalized}`);
    if (response.data && response.data.last) {
      return parseFloat(response.data.last);
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getBitgetPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'bitget');
    const response = await axiosInstance.get(`${EXCHANGES.bitget.tickerUrl}?symbol=${normalized}`);
    if (response.data && response.data.data && response.data.data.close) {
      return parseFloat(response.data.data.close);
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getMEXCPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'mexc');
    const response = await axiosInstance.get(`${EXCHANGES.mexc.tickerUrl}?symbol=${normalized}`);
    return parseFloat(response.data.price);
  } catch (error) {
    return null;
  }
}

// Получение всех цен с кэшированием
async function getAllPrices(symbol, useCache = true) {
  const cacheKey = `price_${symbol}`;
  const cached = priceCache.get(cacheKey);
  
  if (useCache && cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }
  
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
    getBitstampPrice(symbol).then(price => price && (prices.bitstamp = price)),
    getGeminiPrice(symbol).then(price => price && (prices.gemini = price)),
    getBitgetPrice(symbol).then(price => price && (prices.bitget = price)),
    getMEXCPrice(symbol).then(price => price && (prices.mexc = price))
  ];

  await Promise.allSettled(pricePromises);
  
  priceCache.set(cacheKey, {
    data: prices,
    timestamp: Date.now()
  });
  
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
      
      if (profitPercent > 0.1) {
        opportunities.push({
          symbol,
          buyExchange: price1 < price2 ? exchange1 : exchange2,
          sellExchange: price1 < price2 ? exchange2 : exchange1,
          buyPrice: price1 < price2 ? price1 : price2,
          sellPrice: price1 < price2 ? price2 : price1,
          profit: diff,
          profitPercent: parseFloat(profitPercent.toFixed(2)),
          timestamp: new Date().toISOString()
        });
      }
    }
  }
  
  return opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
}

// API endpoints
app.get('/api/arbitrage', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const cacheKey = `arbitrage_${limit}`;
    const cached = arbitrageCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < ARBITRAGE_CACHE_TTL) {
      return res.json(cached.data);
    }
    
    const allOpportunities = [];
    const pairsToProcess = TRADING_PAIRS.slice(0, limit);
    
    const batchSize = 10;
    for (let i = 0; i < pairsToProcess.length; i += batchSize) {
      const batch = pairsToProcess.slice(i, i + batchSize);
      const batchPromises = batch.map(async (pair) => {
        const prices = await getAllPrices(pair, true);
        return calculateArbitrageOpportunities(prices, pair);
      });
      
      const batchResults = await Promise.all(batchPromises);
      allOpportunities.push(...batchResults.flat());
    }
    
    const result = {
      success: true,
      opportunities: allOpportunities.sort((a, b) => b.profitPercent - a.profitPercent),
      timestamp: new Date().toISOString(),
      totalPairs: TRADING_PAIRS.length,
      processedPairs: pairsToProcess.length
    };
    
    arbitrageCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/prices/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.replace('-', '/');
    const prices = await getAllPrices(symbol, false);
    
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

app.get('/api/prices', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const allPrices = {};
    const pairsToProcess = TRADING_PAIRS.slice(0, limit);
    
    const batchSize = 5;
    for (let i = 0; i < pairsToProcess.length; i += batchSize) {
      const batch = pairsToProcess.slice(i, i + batchSize);
      const batchPromises = batch.map(async (pair) => {
        const prices = await getAllPrices(pair, true);
        return { pair, prices };
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ pair, prices }) => {
        allPrices[pair] = prices;
      });
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

app.get('/api/pairs', (req, res) => {
  res.json({
    success: true,
    pairs: TRADING_PAIRS,
    total: TRADING_PAIRS.length
  });
});

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

// Раздача статических файлов
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath, {
  maxAge: '1d',
  etag: true
}));

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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📊 Мониторинг арбитражных возможностей активен`);
    console.log(`📈 Поддерживается ${Object.keys(EXCHANGES).length} бирж и ${TRADING_PAIRS.length} торговых пар`);
  });
}

module.exports = app;
