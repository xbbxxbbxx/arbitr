const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

// Безопасность заголовков с помощью Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// Настройка CORS с ограничениями
const corsOptions = {
  origin: function (origin, callback) {
    // В продакшене можно указать конкретные домены
    // Для разработки разрешаем все, но можно ограничить
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['*'];
    
    if (allowedOrigins.includes('*') || !origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: false,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 часа
};

app.use(cors(corsOptions));

// Ограничение размера тела запроса (защита от больших payload)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Rate limiting для защиты от DDoS и злоупотреблений
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов с одного IP за окно
  message: {
    error: 'Слишком много запросов с этого IP, попробуйте позже.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Более строгий лимит для API endpoints
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 30, // максимум 30 запросов в минуту
  message: {
    error: 'Слишком много запросов к API, попробуйте позже.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Применяем общий rate limiter ко всем запросам
app.use(limiter);

// Применяем строгий лимит к API endpoints
app.use('/api/', apiLimiter);

// Кэш для цен (TTL: 2 секунды для более частого обновления)
const priceCache = new Map();
const CACHE_TTL = 2000;

// Кэш для арбитражных возможностей (TTL: 2 секунды для частого обновления)
const arbitrageCache = new Map();
const ARBITRAGE_CACHE_TTL = 2000;

// HTTP клиент с оптимизацией
const axiosInstance = axios.create({
  timeout: 5000,
  maxRedirects: 3,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json'
  },
  validateStatus: function (status) {
    return status >= 200 && status < 300;
  }
});

// Комиссии бирж (maker/taker в процентах)
const EXCHANGE_FEES = {
  binance: { maker: 0.001, taker: 0.001 },      // 0.1%
  coinbase: { maker: 0.005, taker: 0.005 },     // 0.5%
  kraken: { maker: 0.0016, taker: 0.0026 },    // 0.16%/0.26%
  kucoin: { maker: 0.001, taker: 0.001 },      // 0.1%
  bybit: { maker: 0.001, taker: 0.001 },       // 0.1%
  okx: { maker: 0.0008, taker: 0.001 },        // 0.08%/0.1%
  gateio: { maker: 0.002, taker: 0.002 },      // 0.2%
  huobi: { maker: 0.002, taker: 0.002 },       // 0.2%
  bitfinex: { maker: 0.001, taker: 0.002 },    // 0.1%/0.2%
  bitstamp: { maker: 0.005, taker: 0.005 },    // 0.5%
  gemini: { maker: 0.0025, taker: 0.0035 },    // 0.25%/0.35%
  bitget: { maker: 0.001, taker: 0.001 },     // 0.1%
  mexc: { maker: 0.002, taker: 0.002 }         // 0.2%
};

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
    tickerUrl: 'https://api.bybit.com/v5/market/tickers'
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
  if (!base || !quote) return null;
  
  // Нормализация для каждой биржи
  if (exchange === 'binance') {
    // Binance использует формат BTCUSDT (без разделителя, все заглавные)
    return `${base.toUpperCase()}${quote.toUpperCase()}`;
  }
  if (exchange === 'coinbase') {
    // Coinbase использует формат BTC-USD
    return `${base.toUpperCase()}-${quote.toUpperCase()}`;
  }
  if (exchange === 'kraken') {
    // Kraken использует специальные форматы для некоторых пар
    // BTC -> XBT, USD -> ZUSD, USDT -> USDT
    let krakenBase = base;
    if (base === 'BTC') krakenBase = 'XBT';
    else if (base === 'ETH') krakenBase = 'ETH';
    else krakenBase = base;
    
    let krakenQuote = quote;
    if (quote === 'USD') krakenQuote = 'ZUSD';
    else if (quote === 'USDT') krakenQuote = 'USDT';
    else krakenQuote = quote;
    
    return `${krakenBase}${krakenQuote}`;
  }
  if (exchange === 'kucoin') {
    // KuCoin использует формат BTC-USDT
    return `${base.toUpperCase()}-${quote.toUpperCase()}`;
  }
  if (exchange === 'bybit') {
    // Bybit использует формат BTCUSDT
    return `${base.toUpperCase()}${quote.toUpperCase()}`;
  }
  if (exchange === 'okx') {
    // OKX использует формат BTC-USDT
    return `${base.toUpperCase()}-${quote.toUpperCase()}`;
  }
  if (exchange === 'gateio') {
    // Gate.io использует формат BTC_USDT
    return `${base.toUpperCase()}_${quote.toUpperCase()}`;
  }
  if (exchange === 'huobi') {
    // Huobi использует формат btcusdt (все строчные)
    return `${base.toLowerCase()}${quote.toLowerCase()}`;
  }
  if (exchange === 'bitfinex') {
    // Bitfinex использует формат tBTCUSD
    return `t${base.toUpperCase()}${quote.toUpperCase()}`;
  }
  if (exchange === 'bitstamp') {
    // Bitstamp использует формат btcusd (все строчные)
    return `${base.toLowerCase()}${quote.toLowerCase()}`;
  }
  if (exchange === 'gemini') {
    // Gemini использует формат btcusd (все строчные)
    return `${base.toLowerCase()}${quote.toLowerCase()}`;
  }
  if (exchange === 'bitget') {
    // Bitget использует формат BTCUSDT
    return `${base.toUpperCase()}${quote.toUpperCase()}`;
  }
  if (exchange === 'mexc') {
    // MEXC использует формат BTCUSDT
    return `${base.toUpperCase()}${quote.toUpperCase()}`;
  }
  return symbol;
}

// Функции получения цен
async function getBinancePrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'binance');
    if (!normalized) return null;
    
    const response = await axiosInstance.get(`${EXCHANGES.binance.tickerUrl}?symbol=${normalized}`, {
      timeout: 5000
    });
    
    if (response.data && response.data.price) {
      return parseFloat(response.data.price);
    }
    return null;
  } catch (error) {
    // Тихая обработка ошибок - не логируем, чтобы не засорять консоль
    return null;
  }
}

async function getCoinbasePrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'coinbase');
    if (!normalized) return null;
    
    const response = await axiosInstance.get(`${EXCHANGES.coinbase.tickerUrl}/${normalized}/ticker`, {
      timeout: 5000
    });
    
    if (response.data && response.data.price) {
      return parseFloat(response.data.price);
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getKrakenPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'kraken');
    if (!normalized) return null;
    
    const response = await axiosInstance.get(`${EXCHANGES.kraken.tickerUrl}?pair=${normalized}`, {
      timeout: 5000
    });
    
    if (response.data && response.data.result) {
      const pairKey = Object.keys(response.data.result)[0];
      if (pairKey && response.data.result[pairKey] && response.data.result[pairKey].c) {
        return parseFloat(response.data.result[pairKey].c[0]);
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getKuCoinPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'kucoin');
    if (!normalized) return null;
    
    const response = await axiosInstance.get(EXCHANGES.kucoin.tickerUrl, {
      timeout: 5000
    });
    
    if (response.data && response.data.data && response.data.data.ticker) {
      const ticker = response.data.data.ticker.find(t => t.symbol === normalized);
      if (ticker && ticker.last) {
        return parseFloat(ticker.last);
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getBybitPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'bybit');
    if (!normalized) return null;
    
    const response = await axiosInstance.get(`${EXCHANGES.bybit.tickerUrl}?category=spot&symbol=${normalized}`, {
      timeout: 5000
    });
    
    // Проверяем новый формат API v5
    if (response.data && response.data.result && response.data.result.list && Array.isArray(response.data.result.list) && response.data.result.list.length > 0) {
      const price = response.data.result.list[0].lastPrice;
      if (price) {
        return parseFloat(price);
      }
    }
    // Fallback на старый формат v2
    if (response.data && response.data.result && Array.isArray(response.data.result) && response.data.result.length > 0) {
      const price = response.data.result[0].last_price;
      if (price) {
        return parseFloat(price);
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getOKXPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'okx');
    if (!normalized) return null;
    
    const response = await axiosInstance.get(`${EXCHANGES.okx.tickerUrl}?instId=${normalized}`, {
      timeout: 5000
    });
    
    if (response.data && response.data.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
      const price = response.data.data[0].last;
      if (price) {
        return parseFloat(price);
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getGateIOPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'gateio');
    if (!normalized) return null;
    
    const response = await axiosInstance.get(`${EXCHANGES.gateio.tickerUrl}?currency_pair=${normalized}`, {
      timeout: 5000
    });
    
    if (response.data && Array.isArray(response.data) && response.data.length > 0 && response.data[0].last) {
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
    if (!normalized) return null;
    
    const response = await axiosInstance.get(`${EXCHANGES.huobi.tickerUrl}?symbol=${normalized}`, {
      timeout: 5000
    });
    
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
    if (!normalized) return null;
    
    const response = await axiosInstance.get(`${EXCHANGES.bitfinex.tickerUrl}/${normalized}`, {
      timeout: 5000
    });
    
    if (response.data && Array.isArray(response.data) && response.data.length > 6) {
      const price = response.data[6];
      if (price) {
        return parseFloat(price);
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function getBitstampPrice(symbol) {
  try {
    const normalized = normalizeSymbol(symbol, 'bitstamp');
    if (!normalized) return null;
    
    const response = await axiosInstance.get(`${EXCHANGES.bitstamp.tickerUrl}/${normalized}`, {
      timeout: 5000
    });
    
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
    if (!normalized) return null;
    
    const response = await axiosInstance.get(`${EXCHANGES.gemini.tickerUrl}/${normalized}`, {
      timeout: 5000
    });
    
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
    if (!normalized) return null;
    
    const response = await axiosInstance.get(`${EXCHANGES.bitget.tickerUrl}?symbol=${normalized}`, {
      timeout: 5000
    });
    
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
    if (!normalized) return null;
    
    const response = await axiosInstance.get(`${EXCHANGES.mexc.tickerUrl}?symbol=${normalized}`, {
      timeout: 5000
    });
    
    if (response.data && response.data.price) {
      return parseFloat(response.data.price);
    }
    return null;
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
      const price1 = parseFloat(prices[exchange1]);
      const price2 = parseFloat(prices[exchange2]);
      
      // Проверяем валидность цен
      if (!price1 || !price2 || isNaN(price1) || isNaN(price2) || price1 <= 0 || price2 <= 0) continue;
      
      // Определяем где покупать (дешевле) и где продавать (дороже)
      const buyPrice = Math.min(price1, price2);
      const sellPrice = Math.max(price1, price2);
      const buyExchange = price1 < price2 ? exchange1 : exchange2;
      const sellExchange = price1 < price2 ? exchange2 : exchange1;
      
      // Рассчитываем теоретическую прибыль (без учета комиссий)
      const theoreticalProfit = sellPrice - buyPrice;
      const theoreticalProfitPercent = (theoreticalProfit / buyPrice) * 100;
      
      // Рассчитываем реальную прибыль с учетом комиссий бирж
      const buyFee = EXCHANGE_FEES[buyExchange]?.taker || 0.002; // Используем taker fee
      const sellFee = EXCHANGE_FEES[sellExchange]?.taker || 0.002;
      
      // Реальная цена покупки с комиссией
      const realBuyPrice = buyPrice * (1 + buyFee);
      // Реальная цена продажи с комиссией
      const realSellPrice = sellPrice * (1 - sellFee);
      
      // Реальная прибыль
      const realProfit = realSellPrice - realBuyPrice;
      const realProfitPercent = (realProfit / realBuyPrice) * 100;
      
      // Проверяем минимальный порог прибыли (используем реальную прибыль)
      if (realProfitPercent > 0.1 && realProfit > 0) {
        opportunities.push({
          symbol,
          buyExchange,
          sellExchange,
          // Теоретические значения
          buyPrice: buyPrice,
          sellPrice: sellPrice,
          theoreticalProfit: theoreticalProfit,
          theoreticalProfitPercent: theoreticalProfitPercent,
          // Реальные значения с учетом комиссий
          realBuyPrice: realBuyPrice,
          realSellPrice: realSellPrice,
          realProfit: realProfit,
          realProfitPercent: realProfitPercent,
          // Комиссии
          buyFee: buyFee * 100, // В процентах
          sellFee: sellFee * 100,
          // Для обратной совместимости
          profit: realProfit,
          profitPercent: realProfitPercent,
          timestamp: new Date().toISOString()
        });
      }
    }
  }
  
  return opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
}

// Middleware для обработки ошибок валидации
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Некорректные параметры запроса',
      details: errors.array()
    });
  }
  next();
};

// API endpoints с валидацией
app.get('/api/arbitrage', 
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage('Лимит должен быть числом от 1 до 500'),
    query('_t')
      .optional()
      .isNumeric()
      .withMessage('Timestamp должен быть числом')
  ],
  handleValidationErrors,
  async (req, res) => {
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
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Внутренняя ошибка сервера' 
      : error.message;
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

app.get('/api/prices/:symbol',
  [
    param('symbol')
      .notEmpty()
      .withMessage('Символ не может быть пустым')
      .matches(/^[A-Z0-9]+(-[A-Z0-9]+)?$/i)
      .withMessage('Некорректный формат символа')
      .isLength({ min: 2, max: 20 })
      .withMessage('Символ должен быть от 2 до 20 символов')
  ],
  handleValidationErrors,
  async (req, res) => {
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
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Внутренняя ошибка сервера' 
      : error.message;
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

app.get('/api/prices',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 200 })
      .withMessage('Лимит должен быть числом от 1 до 200')
  ],
  handleValidationErrors,
  async (req, res) => {
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
  try {
    res.json({
      success: true,
      pairs: TRADING_PAIRS,
      total: TRADING_PAIRS.length
    });
  } catch (error) {
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Внутренняя ошибка сервера' 
      : error.message;
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

app.get('/api/exchanges', (req, res) => {
  try {
    const exchangesList = Object.keys(EXCHANGES).map(key => ({
      id: key,
      name: EXCHANGES[key].name
    }));
    
    res.json({
      success: true,
      exchanges: exchangesList,
      total: exchangesList.length
    });
  } catch (error) {
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Внутренняя ошибка сервера' 
      : error.message;
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

// Раздача статических файлов (должно быть ДО обработчика 404)
const publicPath = path.join(__dirname, 'public');

// Проверка существования директории public
if (!fs.existsSync(publicPath)) {
  console.error(`❌ Ошибка: Директория ${publicPath} не найдена!`);
  console.error('Убедитесь, что папка public существует в корне проекта.');
} else {
  console.log(`✅ Статические файлы из: ${publicPath}`);
}

app.use(express.static(publicPath, {
  maxAge: '1d',
  etag: true,
  index: false // Отключаем автоматический index, используем явный маршрут
}));

// Явные маршруты для статических файлов (на случай проблем с express.static)
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

// Главная страница (SPA fallback)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Общий обработчик ошибок (должен быть перед 404)
app.use((err, req, res, next) => {
  // Обработка ошибок CORS
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'Доступ запрещен'
    });
  }
  
  // Обработка ошибок валидации
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Ошибка валидации данных',
      details: err.message
    });
  }
  
  // Общая обработка ошибок
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'Внутренняя ошибка сервера' 
    : err.message;
  
  console.error('Ошибка:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: errorMessage
  });
});

// Обработка 404 (должен быть ПОСЛЕДНИМ, после всех маршрутов)
app.use((req, res) => {
  // Если запрос к API - возвращаем JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      error: 'Эндпоинт не найден',
      path: req.path
    });
  }
  
  // Для всех остальных запросов возвращаем index.html (SPA routing)
  const indexPath = path.join(__dirname, 'public', 'index.html');
  
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Ошибка отправки index.html:', err);
        res.status(500).json({
          success: false,
          error: 'Ошибка загрузки страницы'
        });
      }
    });
  } else {
    console.error(`index.html не найден по пути: ${indexPath}`);
    res.status(500).json({
      success: false,
      error: 'Файл index.html не найден',
      path: indexPath
    });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📊 Мониторинг арбитражных возможностей активен`);
    console.log(`📈 Поддерживается ${Object.keys(EXCHANGES).length} бирж и ${TRADING_PAIRS.length} торговых пар`);
    console.log(`📁 Рабочая директория: ${__dirname}`);
    console.log(`🌐 Режим: ${process.env.NODE_ENV || 'development'}`);
    
    // Проверка доступности основных файлов
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      console.log(`✅ index.html найден`);
    } else {
      console.error(`❌ index.html не найден по пути: ${indexPath}`);
    }
  });
}

module.exports = app;
