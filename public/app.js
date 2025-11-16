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

// Элементы DOM
const refreshBtn = document.getElementById('refreshBtn');
const autoRefreshBtn = document.getElementById('autoRefreshBtn');
const exportBtn = document.getElementById('exportBtn');
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
        
        const response = await fetch(`${API_BASE}/arbitrage?limit=100`, {
            cache: 'no-cache',
            headers: { 'Cache-Control': 'no-cache' }
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
    
    // Фильтрация по кнопкам
    const activeFilter = document.querySelector('.profit-filter-btn.active')?.dataset.filter;
    if (activeFilter && activeFilter !== 'all') {
        if (activeFilter === '0.5-1') {
            filtered = filtered.filter(o => o.profitPercent >= 0.5 && o.profitPercent < 1);
        } else if (activeFilter === '1-5') {
            filtered = filtered.filter(o => o.profitPercent >= 1 && o.profitPercent < 5);
        } else if (activeFilter === '5-50') {
            filtered = filtered.filter(o => o.profitPercent >= 5);
        }
    }
    
    // Сортировка
    const sortValue = sortSelect.value;
    if (sortValue === 'profit-desc') {
        filtered.sort((a, b) => b.profitPercent - a.profitPercent);
    } else if (sortValue === 'profit-asc') {
        filtered.sort((a, b) => a.profitPercent - b.profitPercent);
    } else if (sortValue === 'symbol-asc') {
        filtered.sort((a, b) => a.symbol.localeCompare(b.symbol));
    } else if (sortValue === 'symbol-desc') {
        filtered.sort((a, b) => b.symbol.localeCompare(a.symbol));
    }
    
    // Категоризация
    const high = filtered.filter(o => o.profitPercent >= 5);
    const medium = filtered.filter(o => o.profitPercent >= 1 && o.profitPercent < 5);
    const low = filtered.filter(o => o.profitPercent >= 0.5 && o.profitPercent < 1);
    
    countHigh.textContent = high.length;
    countMedium.textContent = medium.length;
    countLow.textContent = low.length;
    
    opportunitiesHigh.innerHTML = high.length > 0 ? renderOpportunities(high) : '<div class="loading">Нет возможностей</div>';
    opportunitiesMedium.innerHTML = medium.length > 0 ? renderOpportunities(medium) : '<div class="loading">Нет возможностей</div>';
    opportunitiesLow.innerHTML = low.length > 0 ? renderOpportunities(low) : '<div class="loading">Нет возможностей</div>';
}

function renderOpportunities(opportunities) {
    return opportunities.map(opp => {
        const profitClass = getProfitBadgeClass(opp.profitPercent);
        return `
            <div class="opportunity-card">
                <div class="opportunity-header">
                    <span class="opportunity-symbol">${escapeHtml(opp.symbol)}</span>
                    <span class="profit-badge ${profitClass}">+${opp.profitPercent}%</span>
                </div>
                <div class="opportunity-details">
                    <div class="opportunity-detail">
                        <span class="detail-label">Купить на:</span>
                        <span class="detail-value">${escapeHtml(opp.buyExchange)}</span>
                    </div>
                    <div class="opportunity-detail">
                        <span class="detail-label">Продать на:</span>
                        <span class="detail-value">${escapeHtml(opp.sellExchange)}</span>
                    </div>
                    <div class="opportunity-detail">
                        <span class="detail-label">Цена покупки:</span>
                        <span class="detail-value">$${parseFloat(opp.buyPrice).toFixed(2)}</span>
                    </div>
                    <div class="opportunity-detail">
                        <span class="detail-label">Цена продажи:</span>
                        <span class="detail-value">$${parseFloat(opp.sellPrice).toFixed(2)}</span>
                    </div>
                    <div class="opportunity-detail">
                        <span class="detail-label">Прибыль:</span>
                        <span class="detail-value">$${parseFloat(opp.profit).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
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
                    ? `<td class="price-value" data-exchange="${exchange}" data-pair="${pair}">$${parseFloat(price).toFixed(2)}</td>`
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
                            cell.textContent = `$${parseFloat(newPrice).toFixed(2)}`;
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
    const validPrices = Object.values(prices).filter(p => p !== null && p !== undefined);
    if (validPrices.length < 2) return null;
    
    const minPrice = Math.min(...validPrices);
    const maxPrice = Math.max(...validPrices);
    const avgPrice = (minPrice + maxPrice) / 2;
    const profitPercent = ((maxPrice - minPrice) / avgPrice) * 100;
    
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
                            ${price ? `$${parseFloat(price).toFixed(2)}` : '-'}
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

// Экспорт данных
function exportData() {
    const data = {
        opportunities: cachedOpportunities,
        timestamp: new Date().toISOString(),
        stats: {
            exchanges: exchangesCountEl.textContent,
            pairs: pairsCountEl.textContent,
            opportunities: opportunitiesCountEl.textContent
        }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arbitrage-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
        autoRefreshInterval = setInterval(() => {
            loadArbitrageOpportunities(false);
        }, 30000);
        
        pricesUpdateInterval = setInterval(() => {
            loadPrices(false);
        }, 3000);
        
        isAutoRefresh = true;
        document.getElementById('autoRefreshText').textContent = 'Остановить';
        autoRefreshBtn.classList.add('active');
        loadPrices(false);
    }
}

// Обработчики событий
refreshBtn.addEventListener('click', throttle(() => {
    loadArbitrageOpportunities();
    loadPrices();
}, 2000));

autoRefreshBtn.addEventListener('click', toggleAutoRefresh);

exportBtn.addEventListener('click', exportData);

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

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
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
