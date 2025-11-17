const API_BASE = '/api';
let autoRefreshInterval = null;
let pricesUpdateInterval = null;
let isAutoRefresh = false;
let cachedOpportunities = [];
let cachedPrices = {};
let currentView = 'table';
let notificationSettings = {
  high: false,
  medium: false,
  threshold: 1
};

// Настройки темы и языка
let currentTheme = localStorage.getItem('theme') || 'dark';
let currentColorScheme = localStorage.getItem('colorScheme') || 'default';
let currentLanguage = localStorage.getItem('language') || 'ru';
let customProfitRange = {
  min: null,
  max: null
};

// Переводы
const translations = {
  ru: {
    'app.title': 'Крипто Арбитраж',
    'app.tagline': 'Межбиржевая торговля',
    'filters.profit': 'Фильтр по прибыли:',
    'filters.all': 'Все',
    'filters.customRange': 'Диапазон:',
    'filters.apply': 'Применить',
    'opportunity.buy': 'Купить на:',
    'opportunity.sell': 'Продать на:',
    'opportunity.buyPrice': 'Цена покупки:',
    'opportunity.sellPrice': 'Цена продажи:',
    'opportunity.theoreticalProfit': 'Теоретическая прибыль:',
    'opportunity.realProfit': 'Реальная прибыль:',
    'opportunity.fees': 'Комиссии:'
  },
  ua: {
    'app.title': 'Крипто Арбітраж',
    'app.tagline': 'Міжбіржова торгівля',
    'filters.profit': 'Фільтр за прибутком:',
    'filters.all': 'Всі',
    'filters.customRange': 'Діапазон:',
    'filters.apply': 'Застосувати',
    'opportunity.buy': 'Купити на:',
    'opportunity.sell': 'Продати на:',
    'opportunity.buyPrice': 'Ціна покупки:',
    'opportunity.sellPrice': 'Ціна продажу:',
    'opportunity.theoreticalProfit': 'Теоретичний прибуток:',
    'opportunity.realProfit': 'Реальний прибуток:',
    'opportunity.fees': 'Комісії:'
  },
  en: {
    'app.title': 'Crypto Arbitrage',
    'app.tagline': 'Cross-exchange Trading',
    'filters.profit': 'Profit Filter:',
    'filters.all': 'All',
    'filters.customRange': 'Range:',
    'filters.apply': 'Apply',
    'opportunity.buy': 'Buy on:',
    'opportunity.sell': 'Sell on:',
    'opportunity.buyPrice': 'Buy Price:',
    'opportunity.sellPrice': 'Sell Price:',
    'opportunity.theoreticalProfit': 'Theoretical Profit:',
    'opportunity.realProfit': 'Real Profit:',
    'opportunity.fees': 'Fees:'
  }
};

// Элементы DOM
const refreshBtn = document.getElementById('refreshBtn');
const autoRefreshBtn = document.getElementById('autoRefreshBtn');
const notificationsBtn = document.getElementById('notificationsBtn');
const closeNotifications = document.getElementById('closeNotifications');
const notificationPanel = document.getElementById('notificationPanel');
const profitFilters = document.querySelectorAll('.profit-filter-btn');
const sortSelect = document.getElementById('sortSelect');
const searchInput = document.getElementById('searchInput');
const opportunitiesHigh = document.getElementById('opportunitiesHigh');
const opportunitiesMedium = document.getElementById('opportunitiesMedium');
const opportunitiesLow = document.getElementById('opportunitiesLow');
const countHigh = document.getElementById('countHigh');
const countMedium = document.getElementById('countMedium');
const countLow = document.getElementById('countLow');
const pricesTable = document.getElementById('pricesTable');
const pricesCards = document.getElementById('pricesCards');
const lastUpdateEl = document.getElementById('lastUpdate');
const exchangesCountEl = document.getElementById('exchangesCount');
const pairsCountEl = document.getElementById('pairsCount');
const opportunitiesCountEl = document.getElementById('opportunitiesCount');
const exchangesCountCard = document.getElementById('exchangesCountCard');
const pairsCountCard = document.getElementById('pairsCountCard');
const opportunitiesCountCard = document.getElementById('opportunitiesCountCard');
const maxProfitEl = document.getElementById('maxProfit');
const statusText = document.getElementById('statusText');
const viewToggle = document.getElementById('viewToggle');
const viewToggleCards = document.getElementById('viewToggleCards');

// Определение устройства
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Инициализация вида в зависимости от размера экрана
function initView() {
    const tableView = document.getElementById('tableView');
    const cardsView = document.getElementById('cardsView');
    
    if (window.innerWidth < 769 && isMobile) {
        currentView = 'cards';
        if (tableView) tableView.style.display = 'none';
        if (cardsView) cardsView.style.display = 'grid';
        if (viewToggle) viewToggle.classList.remove('active');
        if (viewToggleCards) viewToggleCards.classList.add('active');
    } else {
        currentView = 'table';
        if (tableView) tableView.style.display = 'block';
        if (cardsView) cardsView.style.display = 'none';
        if (viewToggle) viewToggle.classList.add('active');
        if (viewToggleCards) viewToggleCards.classList.remove('active');
    }
}

// Вызываем при загрузке и изменении размера окна
window.addEventListener('resize', debounce(initView, 250));

// Переключение вида
if (viewToggle && viewToggleCards) {
    viewToggle.addEventListener('click', () => {
        currentView = 'table';
        document.getElementById('tableView').style.display = 'block';
        document.getElementById('cardsView').style.display = 'none';
        viewToggle.classList.add('active');
        viewToggleCards.classList.remove('active');
    });

    viewToggleCards.addEventListener('click', () => {
        currentView = 'cards';
        document.getElementById('tableView').style.display = 'none';
        document.getElementById('cardsView').style.display = 'grid';
        viewToggle.classList.remove('active');
        viewToggleCards.classList.add('active');
    });
}

// Утилиты
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Безопасное экранирование HTML для защиты от XSS
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// Валидация и санитизация входных данных
function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    // Удаляем потенциально опасные символы
    return input.replace(/[<>'"&]/g, '');
}

// Валидация символа торговой пары
function validateSymbol(symbol) {
    if (!symbol || typeof symbol !== 'string') return false;
    // Разрешаем только буквы, цифры и слэш
    return /^[A-Z0-9]+\/[A-Z0-9]+$/i.test(symbol);
}

function animateNumber(element, targetValue) {
    const current = parseInt(element.textContent) || 0;
    if (isNaN(targetValue)) return;
    const increment = targetValue > current ? 1 : -1;
    const steps = Math.abs(targetValue - current);
    if (steps === 0) return;
    const stepDuration = 1000 / steps;
    
    let currentValue = current;
    const timer = setInterval(() => {
        currentValue += increment;
        element.textContent = currentValue;
        
        if (currentValue === targetValue) {
            clearInterval(timer);
            element.textContent = targetValue;
        }
    }, stepDuration);
}

// Категоризация по прибыли
function categorizeByProfit(profit) {
    if (profit >= 5) return 'high';
    if (profit >= 1) return 'medium';
    if (profit >= 0.5) return 'low';
    return null;
}

function getProfitBadgeClass(profit) {
    if (profit >= 5) return 'high';
    if (profit >= 1) return 'medium';
    return 'low';
}

// Загрузка статистики
async function loadStats() {
    try {
        const [exchangesRes, pairsRes] = await Promise.all([
            fetch(`${API_BASE}/exchanges`),
            fetch(`${API_BASE}/pairs`)
        ]);
        
        const exchangesData = await exchangesRes.json();
        const pairsData = await pairsRes.json();
        
        if (exchangesData.success) {
            const count = exchangesData.total;
            exchangesCountEl.textContent = count;
            exchangesCountCard.textContent = count;
        }
        
        if (pairsData.success) {
            const count = pairsData.total;
            pairsCountEl.textContent = count;
            pairsCountCard.textContent = count;
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Загрузка арбитражных возможностей
async function loadArbitrageOpportunities(showLoading = true) {
    try {
        if (showLoading) {
            opportunitiesHigh.innerHTML = '<div class="loading">Загрузка...</div>';
            opportunitiesMedium.innerHTML = '<div class="loading">Загрузка...</div>';
            opportunitiesLow.innerHTML = '<div class="loading">Загрузка...</div>';
        }
        
        // Добавляем timestamp для предотвращения кэширования браузером
        const timestamp = Date.now();
        const response = await fetch(`${API_BASE}/arbitrage?limit=100&_t=${timestamp}`, {
            cache: 'no-cache',
            headers: { 
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        const data = await response.json();
        
        if (data.success) {
            cachedOpportunities = data.opportunities;
            displayOpportunities(data.opportunities);
            animateNumber(opportunitiesCountEl, data.opportunities.length);
            animateNumber(opportunitiesCountCard, data.opportunities.length);
            
            // Максимальная прибыль
            if (data.opportunities.length > 0) {
                const maxProfit = Math.max(...data.opportunities.map(o => parseFloat(o.profitPercent)));
                maxProfitEl.textContent = `${maxProfit.toFixed(2)}%`;
            }
            
            updateTimestamp();
            checkNotifications(data.opportunities);
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        if (showLoading) {
            opportunitiesHigh.innerHTML = '<div class="loading">Ошибка подключения</div>';
            opportunitiesMedium.innerHTML = '<div class="loading">Ошибка подключения</div>';
            opportunitiesLow.innerHTML = '<div class="loading">Ошибка подключения</div>';
        }
    }
}

// Отображение возможностей с категоризацией
function displayOpportunities(opportunities) {
    // Фильтрация по поиску
    let filtered = opportunities;
    const searchTerm = searchInput.value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(opp => 
            opp.symbol.toLowerCase().includes(searchTerm) ||
            opp.buyExchange.toLowerCase().includes(searchTerm) ||
            opp.sellExchange.toLowerCase().includes(searchTerm)
        );
    }
    
    // Фильтрация по кастомному диапазону (приоритет над кнопками)
    if (customProfitRange.min !== null || customProfitRange.max !== null) {
        filtered = filtered.filter(o => {
            const profit = parseFloat(o.realProfitPercent) || parseFloat(o.profitPercent) || 0;
            const minCheck = customProfitRange.min === null || profit >= customProfitRange.min;
            const maxCheck = customProfitRange.max === null || profit <= customProfitRange.max;
            return minCheck && maxCheck;
        });
    } else {
        // Фильтрация по кнопкам (если кастомный диапазон не установлен)
        const activeFilter = document.querySelector('.profit-filter-btn.active')?.dataset.filter;
        if (activeFilter && activeFilter !== 'all') {
            if (activeFilter === '0.5-1') {
                filtered = filtered.filter(o => {
                    const profit = parseFloat(o.realProfitPercent) || parseFloat(o.profitPercent) || 0;
                    return profit >= 0.5 && profit < 1;
                });
            } else if (activeFilter === '1-5') {
                filtered = filtered.filter(o => {
                    const profit = parseFloat(o.realProfitPercent) || parseFloat(o.profitPercent) || 0;
                    return profit >= 1 && profit < 5;
                });
            } else if (activeFilter === '5-50') {
                filtered = filtered.filter(o => {
                    const profit = parseFloat(o.realProfitPercent) || parseFloat(o.profitPercent) || 0;
                    return profit >= 5;
                });
            }
        }
    }
    
    // Сортировка (используем реальную прибыль)
    const sortValue = sortSelect.value;
    if (sortValue === 'profit-desc') {
        filtered.sort((a, b) => {
            const profitA = parseFloat(a.realProfitPercent) || parseFloat(a.profitPercent) || 0;
            const profitB = parseFloat(b.realProfitPercent) || parseFloat(b.profitPercent) || 0;
            return profitB - profitA;
        });
    } else if (sortValue === 'profit-asc') {
        filtered.sort((a, b) => {
            const profitA = parseFloat(a.realProfitPercent) || parseFloat(a.profitPercent) || 0;
            const profitB = parseFloat(b.realProfitPercent) || parseFloat(b.profitPercent) || 0;
            return profitA - profitB;
        });
    } else if (sortValue === 'symbol-asc') {
        filtered.sort((a, b) => a.symbol.localeCompare(b.symbol));
    } else if (sortValue === 'symbol-desc') {
        filtered.sort((a, b) => b.symbol.localeCompare(a.symbol));
    }
    
    // Категоризация (используем реальную прибыль)
    const high = filtered.filter(o => {
        const profit = parseFloat(o.realProfitPercent) || parseFloat(o.profitPercent) || 0;
        return profit >= 5;
    });
    const medium = filtered.filter(o => {
        const profit = parseFloat(o.realProfitPercent) || parseFloat(o.profitPercent) || 0;
        return profit >= 1 && profit < 5;
    });
    const low = filtered.filter(o => {
        const profit = parseFloat(o.realProfitPercent) || parseFloat(o.profitPercent) || 0;
        return profit >= 0.5 && profit < 1;
    });
    
    countHigh.textContent = high.length;
    countMedium.textContent = medium.length;
    countLow.textContent = low.length;
    
    opportunitiesHigh.innerHTML = high.length > 0 ? renderOpportunities(high) : '<div class="loading">Нет возможностей</div>';
    opportunitiesMedium.innerHTML = medium.length > 0 ? renderOpportunities(medium) : '<div class="loading">Нет возможностей</div>';
    opportunitiesLow.innerHTML = low.length > 0 ? renderOpportunities(low) : '<div class="loading">Нет возможностей</div>';
}

// Умное форматирование чисел для цен
function formatPrice(price) {
    if (!price || isNaN(price) || price === null || price === undefined) return '0.00';
    
    const num = parseFloat(price);
    if (isNaN(num)) return '0.00';
    
    // Для очень маленьких чисел (< 0.0001) показываем 8 знаков
    if (num < 0.0001) {
        return num.toFixed(8);
    }
    // Для маленьких чисел (< 0.01) показываем 6 знаков
    if (num < 0.01) {
        return num.toFixed(6);
    }
    // Для маленьких чисел (< 1) показываем 4 знака
    if (num < 1) {
        return num.toFixed(4);
    }
    // Для обычных чисел показываем 2 знака
    if (num < 1000) {
        return num.toFixed(2);
    }
    // Для больших чисел показываем 2 знака с разделителями
    return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Форматирование прибыли
function formatProfit(profit) {
    if (!profit || isNaN(profit) || profit === null || profit === undefined) return '0.00';
    
    const num = parseFloat(profit);
    if (isNaN(num)) return '0.00';
    
    // Для очень маленьких прибылей показываем больше знаков
    if (num < 0.0001) {
        return num.toFixed(8);
    }
    if (num < 0.01) {
        return num.toFixed(6);
    }
    if (num < 1) {
        return num.toFixed(4);
    }
    return num.toFixed(2);
}

// Форматирование процентов
function formatPercent(percent) {
    if (!percent || isNaN(percent) || percent === null || percent === undefined) return '0.00';
    
    const num = parseFloat(percent);
    if (isNaN(num)) return '0.00';
    
    // Всегда показываем 2 знака после запятой для процентов
    return num.toFixed(2);
}

function renderOpportunities(opportunities) {
    const t = translations[currentLanguage] || translations.ru;
    
    return opportunities.map(opp => {
        // Парсим и валидируем все значения
        const buyPrice = parseFloat(opp.buyPrice) || 0;
        const sellPrice = parseFloat(opp.sellPrice) || 0;
        const realProfit = parseFloat(opp.realProfit) || parseFloat(opp.profit) || 0;
        const realProfitPercent = parseFloat(opp.realProfitPercent) || parseFloat(opp.profitPercent) || 0;
        const theoreticalProfit = parseFloat(opp.theoreticalProfit) || (sellPrice - buyPrice);
        const theoreticalProfitPercent = parseFloat(opp.theoreticalProfitPercent) || ((theoreticalProfit / buyPrice) * 100);
        const buyFee = parseFloat(opp.buyFee) || 0;
        const sellFee = parseFloat(opp.sellFee) || 0;
        
        // Проверяем валидность
        if (isNaN(buyPrice) || isNaN(sellPrice) || isNaN(realProfit) || isNaN(realProfitPercent)) {
            return ''; // Пропускаем некорректные данные
        }
        
        const profitClass = getProfitBadgeClass(realProfitPercent);
        
        return `
            <div class="opportunity-card">
                <div class="opportunity-header">
                    <span class="opportunity-symbol">${escapeHtml(opp.symbol)}</span>
                    <div class="profit-badges">
                        <span class="profit-badge ${profitClass}" title="${t['opportunity.realProfit'] || 'Реальная прибыль с учетом комиссий'}">
                            +${formatPercent(realProfitPercent)}%
                        </span>
                        ${theoreticalProfitPercent > realProfitPercent ? `
                            <span class="profit-badge theoretical" title="${t['opportunity.theoreticalProfit'] || 'Теоретическая прибыль без комиссий'}">
                                +${formatPercent(theoreticalProfitPercent)}%
                            </span>
                        ` : ''}
                    </div>
                </div>
                <div class="opportunity-details">
                    <div class="opportunity-detail">
                        <span class="detail-label">${t['opportunity.buy'] || 'Купить на:'}</span>
                        <span class="detail-value">${escapeHtml(opp.buyExchange)}</span>
                    </div>
                    <div class="opportunity-detail">
                        <span class="detail-label">${t['opportunity.sell'] || 'Продать на:'}</span>
                        <span class="detail-value">${escapeHtml(opp.sellExchange)}</span>
                    </div>
                    <div class="opportunity-detail">
                        <span class="detail-label">${t['opportunity.buyPrice'] || 'Цена покупки:'}</span>
                        <span class="detail-value">$${formatPrice(buyPrice)}</span>
                    </div>
                    <div class="opportunity-detail">
                        <span class="detail-label">${t['opportunity.sellPrice'] || 'Цена продажи:'}</span>
                        <span class="detail-value">$${formatPrice(sellPrice)}</span>
                    </div>
                    <div class="opportunity-detail real-profit">
                        <span class="detail-label">${t['opportunity.realProfit'] || 'Реальная прибыль:'}</span>
                        <span class="detail-value profit-value">$${formatProfit(realProfit)} (+${formatPercent(realProfitPercent)}%)</span>
                    </div>
                    ${theoreticalProfitPercent > realProfitPercent ? `
                        <div class="opportunity-detail theoretical-profit">
                            <span class="detail-label">${t['opportunity.theoreticalProfit'] || 'Теоретическая прибыль:'}</span>
                            <span class="detail-value">$${formatProfit(theoreticalProfit)} (+${formatPercent(theoreticalProfitPercent)}%)</span>
                        </div>
                    ` : ''}
                    ${buyFee > 0 || sellFee > 0 ? `
                        <div class="opportunity-detail fees">
                            <span class="detail-label">${t['opportunity.fees'] || 'Комиссии:'}</span>
                            <span class="detail-value">${buyFee.toFixed(2)}% / ${sellFee.toFixed(2)}%</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).filter(html => html !== '').join(''); // Убираем пустые элементы
}

// Загрузка цен
async function loadPrices(showLoading = true) {
    try {
        const tbody = pricesTable.querySelector('tbody');
        if (showLoading && (!tbody.querySelector('tr') || tbody.querySelector('tr').textContent.includes('Загрузка'))) {
            tbody.innerHTML = '<tr><td colspan="15" class="loading">Загрузка данных...</td></tr>';
            if (pricesCards) pricesCards.innerHTML = '<div class="loading">Загрузка данных...</div>';
        }
        
        const response = await fetch(`${API_BASE}/prices?limit=50`, {
            cache: 'no-cache',
            headers: { 'Cache-Control': 'no-cache' }
        });
        const data = await response.json();
        
        if (data.success) {
            updatePricesTable(data.prices);
            updatePricesCards(data.prices);
            cachedPrices = data.prices;
            updateTimestamp();
        }
    } catch (error) {
        console.error('Ошибка загрузки цен:', error);
    }
}

// Обновление таблицы цен
function updatePricesTable(prices) {
    const tbody = pricesTable.querySelector('tbody');
    const exchanges = ['binance', 'coinbase', 'kraken', 'kucoin', 'bybit', 'okx', 'gateio', 'huobi', 'bitfinex', 'bitstamp', 'gemini', 'bitget', 'mexc'];
    
    if (!tbody.querySelector('tr') || tbody.querySelector('tr').textContent.includes('Загрузка')) {
        tbody.innerHTML = Object.entries(prices).map(([pair, pairPrices]) => {
            const cells = exchanges.map(exchange => {
                const price = pairPrices[exchange];
                return price 
                    ? `<td class="price-value" data-exchange="${exchange}" data-pair="${pair}">$${formatPrice(price)}</td>`
                    : `<td class="price-unavailable" data-exchange="${exchange}" data-pair="${pair}">-</td>`;
            }).join('');
            
            // Вычисляем арбитраж для этой пары
            const arbitrage = calculateArbitrageForPair(pairPrices);
            const arbitrageCell = arbitrage 
                ? `<td class="arbitrage-indicator ${getProfitBadgeClass(arbitrage)}">${arbitrage.toFixed(2)}%</td>`
                : '<td class="price-unavailable">-</td>';
            
            return `
                <tr data-pair="${pair}">
                    <td><strong>${escapeHtml(pair)}</strong></td>
                    ${cells}
                    ${arbitrageCell}
                </tr>
            `;
        }).join('');
    } else {
        Object.entries(prices).forEach(([pair, pairPrices]) => {
            exchanges.forEach(exchange => {
                const cell = tbody.querySelector(`td[data-exchange="${exchange}"][data-pair="${pair}"]`);
                if (cell) {
                    const newPrice = pairPrices[exchange];
                    const oldPrice = cachedPrices[pair]?.[exchange];
                    
                    if (newPrice !== oldPrice) {
                        if (newPrice) {
                            cell.className = 'price-value updating';
                            cell.textContent = `$${formatPrice(newPrice)}`;
                            setTimeout(() => cell.classList.remove('updating'), 500);
                        } else {
                            cell.className = 'price-unavailable';
                            cell.textContent = '-';
                        }
                    }
                }
            });
            
            // Обновляем арбитраж
            const arbitrage = calculateArbitrageForPair(pairPrices);
            const row = tbody.querySelector(`tr[data-pair="${pair}"]`);
            if (row) {
                const arbitrageCell = row.querySelector('td:last-child');
                if (arbitrageCell) {
                    if (arbitrage) {
                        arbitrageCell.className = `arbitrage-indicator ${getProfitBadgeClass(arbitrage)}`;
                        arbitrageCell.textContent = `${arbitrage.toFixed(2)}%`;
                    } else {
                        arbitrageCell.className = 'price-unavailable';
                        arbitrageCell.textContent = '-';
                    }
                }
            }
        });
    }
}

function calculateArbitrageForPair(prices) {
    const validPrices = Object.values(prices).filter(p => p !== null && p !== undefined && p > 0);
    if (validPrices.length < 2) return null;
    
    const minPrice = Math.min(...validPrices);
    const maxPrice = Math.max(...validPrices);
    
    // Правильный расчет процента прибыли от минимальной цены (цены покупки)
    const profitPercent = ((maxPrice - minPrice) / minPrice) * 100;
    
    return profitPercent > 0.1 ? profitPercent : null;
}

// Обновление карточек цен
function updatePricesCards(prices) {
    if (!pricesCards) return;
    
    const exchanges = ['binance', 'coinbase', 'kraken', 'kucoin', 'bybit', 'okx', 'gateio', 'huobi', 'bitfinex', 'bitstamp', 'gemini', 'bitget', 'mexc'];
    const exchangeNames = {
        binance: 'Binance', coinbase: 'Coinbase', kraken: 'Kraken', kucoin: 'KuCoin',
        bybit: 'Bybit', okx: 'OKX', gateio: 'Gate.io', huobi: 'Huobi',
        bitfinex: 'Bitfinex', bitstamp: 'Bitstamp', gemini: 'Gemini',
        bitget: 'Bitget', mexc: 'MEXC'
    };
    
    if (!pricesCards.querySelector('.price-card')) {
        pricesCards.innerHTML = Object.entries(prices).map(([pair, pairPrices]) => {
            const exchangeCards = exchanges.map(exchange => {
                const price = pairPrices[exchange];
                return `
                    <div class="price-card-exchange">
                        <div class="price-card-exchange-name">${exchangeNames[exchange]}</div>
                        <div class="price-card-exchange-value ${price ? '' : 'unavailable'}">
                            ${price ? `$${formatPrice(price)}` : '-'}
                        </div>
                    </div>
                `;
            }).join('');
            
            const arbitrage = calculateArbitrageForPair(pairPrices);
            const arbitrageBadge = arbitrage 
                ? `<div class="arbitrage-badge ${getProfitBadgeClass(arbitrage)}">Арбитраж: ${arbitrage.toFixed(2)}%</div>`
                : '';
            
            return `
                <div class="price-card" data-pair="${pair}">
                    <div class="price-card-header">${escapeHtml(pair)}</div>
                    ${arbitrageBadge}
                    <div class="price-card-exchanges">${exchangeCards}</div>
                </div>
            `;
        }).join('');
    }
}

// Уведомления
function checkNotifications(opportunities) {
    if (!('Notification' in window)) return;
    
    const highProfits = opportunities.filter(o => o.profitPercent >= 5);
    const mediumProfits = opportunities.filter(o => o.profitPercent >= 1 && o.profitPercent < 5);
    
    if (notificationSettings.high && highProfits.length > 0) {
        showNotification(`Найдено ${highProfits.length} возможностей с прибылью >5%!`);
    }
    
    if (notificationSettings.medium && mediumProfits.length > 0) {
        showNotification(`Найдено ${mediumProfits.length} возможностей с прибылью 1-5%!`);
    }
}

function showNotification(message) {
    if (Notification.permission === 'granted') {
        new Notification('Крипто Арбитраж', {
            body: message,
            icon: '💎'
        });
    }
}


// Обновление временной метки
function updateTimestamp() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    lastUpdateEl.textContent = `Последнее обновление: ${timeString}`;
    statusText.textContent = 'Система активна';
}

// Переключение автообновления
function toggleAutoRefresh() {
    if (isAutoRefresh) {
        clearInterval(autoRefreshInterval);
        clearInterval(pricesUpdateInterval);
        isAutoRefresh = false;
        document.getElementById('autoRefreshText').textContent = 'Автообновление';
        autoRefreshBtn.classList.remove('active');
    } else {
        // Обновление арбитражных возможностей каждые 2 секунды
        autoRefreshInterval = setInterval(() => {
            loadArbitrageOpportunities(false);
        }, 2000);
        
        // Обновление цен каждые 2 секунды (синхронно с арбитражем)
        pricesUpdateInterval = setInterval(() => {
            loadPrices(false);
        }, 2000);
        
        // Загружаем данные сразу при включении
        loadArbitrageOpportunities(false);
        loadPrices(false);
        
        isAutoRefresh = true;
        document.getElementById('autoRefreshText').textContent = 'Остановить';
        autoRefreshBtn.classList.add('active');
    }
}

// Обработчики событий
refreshBtn.addEventListener('click', throttle(() => {
    loadArbitrageOpportunities();
    loadPrices();
}, 2000));

autoRefreshBtn.addEventListener('click', toggleAutoRefresh);

notificationsBtn.addEventListener('click', () => {
    notificationPanel.classList.toggle('open');
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

closeNotifications.addEventListener('click', () => {
    notificationPanel.classList.remove('open');
});

profitFilters.forEach(btn => {
    btn.addEventListener('click', () => {
        profitFilters.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        displayOpportunities(cachedOpportunities);
    });
});

sortSelect.addEventListener('change', () => {
    displayOpportunities(cachedOpportunities);
});

searchInput.addEventListener('input', debounce(() => {
    displayOpportunities(cachedOpportunities);
}, 300));

// Настройки уведомлений
document.getElementById('notifyHigh').addEventListener('change', (e) => {
    notificationSettings.high = e.target.checked;
});

document.getElementById('notifyMedium').addEventListener('change', (e) => {
    notificationSettings.medium = e.target.checked;
});

document.getElementById('profitThreshold').addEventListener('input', (e) => {
    notificationSettings.threshold = parseFloat(e.target.value);
    document.getElementById('thresholdValue').textContent = `${e.target.value}%`;
});

// Функции для темы
function applyTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('theme', theme);
    
    // Применяем тему с учетом цветовой схемы
    updateThemeAttribute();
    
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
}

function toggleTheme() {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

// Обновление атрибута темы с учетом цветовой схемы
function updateThemeAttribute() {
    if (currentColorScheme !== 'default') {
        document.documentElement.setAttribute('data-theme', `${currentTheme}-${currentColorScheme}`);
        document.documentElement.setAttribute('data-color-scheme', currentColorScheme);
    } else {
        document.documentElement.setAttribute('data-theme', currentTheme);
        document.documentElement.removeAttribute('data-color-scheme');
    }
}

// Функции для цветовой схемы
function applyColorScheme(scheme) {
    currentColorScheme = scheme;
    localStorage.setItem('colorScheme', scheme);
    
    // Обновляем атрибут темы
    updateThemeAttribute();
    
    const colorSchemeSelect = document.getElementById('colorSchemeSelect');
    if (colorSchemeSelect) {
        colorSchemeSelect.value = scheme;
    }
}

// Функции для языка
function applyLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    
    const t = translations[lang] || translations.ru;
    
    // Обновляем все элементы с data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            el.textContent = t[key];
        }
    });
    
    // Обновляем селект языка
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) {
        langSelect.value = lang;
    }
    
    // Перерисовываем возможности с новым языком
    if (cachedOpportunities.length > 0) {
        displayOpportunities(cachedOpportunities);
    }
}

// Функция для применения кастомного диапазона прибыли
function applyCustomProfitRange() {
    const minInput = document.getElementById('profitMin');
    const maxInput = document.getElementById('profitMax');
    
    customProfitRange.min = minInput.value ? parseFloat(minInput.value) : null;
    customProfitRange.max = maxInput.value ? parseFloat(maxInput.value) : null;
    
    // Сбрасываем активную кнопку фильтра
    document.querySelectorAll('.profit-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('.profit-filter-btn[data-filter="all"]')?.classList.add('active');
    
    // Применяем фильтр
    if (cachedOpportunities.length > 0) {
        displayOpportunities(cachedOpportunities);
    }
}

// Обработчики для новых элементов
const themeToggle = document.getElementById('themeToggle');
const colorSchemeSelect = document.getElementById('colorSchemeSelect');
const languageSelect = document.getElementById('languageSelect');
const applyRangeFilter = document.getElementById('applyRangeFilter');

if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
}

if (colorSchemeSelect) {
    colorSchemeSelect.addEventListener('change', (e) => {
        applyColorScheme(e.target.value);
    });
}

if (languageSelect) {
    languageSelect.addEventListener('change', (e) => {
        applyLanguage(e.target.value);
    });
}

if (applyRangeFilter) {
    applyRangeFilter.addEventListener('click', applyCustomProfitRange);
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Применяем сохраненные настройки
    applyTheme(currentTheme);
    applyColorScheme(currentColorScheme);
    applyLanguage(currentLanguage);
    
    initView(); // Инициализируем вид
    loadStats();
    loadArbitrageOpportunities();
    loadPrices();
    
    setTimeout(() => {
        toggleAutoRefresh();
    }, 2000);
    
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
});

// Обработка видимости страницы
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (isAutoRefresh) {
            clearInterval(autoRefreshInterval);
            clearInterval(pricesUpdateInterval);
        }
    } else {
        if (isAutoRefresh) {
            toggleAutoRefresh();
        }
    }
});
