const API_BASE = '/api';
let autoRefreshInterval = null;
let pricesUpdateInterval = null;
let isAutoRefresh = false;
let cachedOpportunities = [];
let cachedPrices = {};

// Элементы DOM
const refreshBtn = document.getElementById('refreshBtn');
const autoRefreshBtn = document.getElementById('autoRefreshBtn');
const filterSelect = document.getElementById('filterSelect');
const opportunitiesList = document.getElementById('opportunitiesList');
const pricesTable = document.getElementById('pricesTable');
const lastUpdateEl = document.getElementById('lastUpdate');
const exchangesCountEl = document.getElementById('exchangesCount');
const pairsCountEl = document.getElementById('pairsCount');
const opportunitiesCountEl = document.getElementById('opportunitiesCount');

// Оптимизация: Debounce функция
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

// Оптимизация: Throttle функция
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

// Загрузка статистики (один раз при загрузке)
async function loadStats() {
    try {
        const [exchangesRes, pairsRes] = await Promise.all([
            fetch(`${API_BASE}/exchanges`),
            fetch(`${API_BASE}/pairs`)
        ]);
        
        const exchangesData = await exchangesRes.json();
        const pairsData = await pairsRes.json();
        
        if (exchangesData.success) {
            exchangesCountEl.textContent = exchangesData.total;
        }
        
        if (pairsData.success) {
            pairsCountEl.textContent = pairsData.total;
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Загрузка арбитражных возможностей (оптимизировано)
async function loadArbitrageOpportunities(showLoading = true) {
    try {
        if (showLoading) {
            opportunitiesList.innerHTML = '<div class="loading">Загрузка данных...</div>';
        }
        
        const response = await fetch(`${API_BASE}/arbitrage?limit=50`, {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        const data = await response.json();
        
        if (data.success) {
            cachedOpportunities = data.opportunities;
            displayOpportunities(data.opportunities);
            opportunitiesCountEl.textContent = data.opportunities.length;
            updateTimestamp();
        } else {
            if (showLoading) {
                opportunitiesList.innerHTML = '<div class="loading">Ошибка загрузки данных</div>';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки арбитражных возможностей:', error);
        if (showLoading) {
            opportunitiesList.innerHTML = '<div class="loading">Ошибка подключения к серверу</div>';
        }
    }
}

// Отображение арбитражных возможностей (оптимизировано с виртуализацией)
function displayOpportunities(opportunities) {
    if (opportunities.length === 0) {
        opportunitiesList.innerHTML = '<div class="loading">Арбитражные возможности не найдены</div>';
        return;
    }
    
    const filter = filterSelect.value;
    let filteredOpportunities = opportunities;
    
    if (filter !== 'all') {
        filteredOpportunities = opportunities.filter(opp => {
            const profit = parseFloat(opp.profitPercent);
            if (filter === 'high') return profit > 1;
            if (filter === 'medium') return profit >= 0.5 && profit <= 1;
            if (filter === 'low') return profit < 0.5;
            return true;
        });
    }
    
    // Используем DocumentFragment для оптимизации
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');
    
    tempDiv.innerHTML = filteredOpportunities.map(opp => `
        <div class="opportunity-card">
            <div class="opportunity-header">
                <span class="opportunity-symbol">${escapeHtml(opp.symbol)}</span>
                <span class="profit-percent">+${opp.profitPercent}%</span>
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
    `).join('');
    
    while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
    }
    
    opportunitiesList.innerHTML = '';
    opportunitiesList.appendChild(fragment);
}

// Защита от XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Загрузка цен (оптимизировано для реального времени)
async function loadPrices(showLoading = true) {
    try {
        const tbody = pricesTable.querySelector('tbody');
        if (showLoading && !tbody.querySelector('tr')) {
            tbody.innerHTML = '<tr><td colspan="11" class="loading">Загрузка данных...</td></tr>';
        }
        
        const response = await fetch(`${API_BASE}/prices?limit=30`, {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        const data = await response.json();
        
        if (data.success) {
            updatePricesTable(data.prices);
            cachedPrices = data.prices;
            updateTimestamp();
        } else {
            if (showLoading) {
                tbody.innerHTML = '<tr><td colspan="11" class="loading">Ошибка загрузки данных</td></tr>';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки цен:', error);
        const tbody = pricesTable.querySelector('tbody');
        if (showLoading) {
            tbody.innerHTML = '<tr><td colspan="11" class="loading">Ошибка подключения к серверу</td></tr>';
        }
    }
}

// Обновление таблицы цен (оптимизировано - обновляет только изменившиеся ячейки)
function updatePricesTable(prices) {
    const tbody = pricesTable.querySelector('tbody');
    const exchanges = ['binance', 'coinbase', 'kraken', 'kucoin', 'bybit', 'okx', 'gateio', 'huobi', 'bitfinex', 'bitstamp'];
    
    // Если таблица пуста, создаем полностью
    if (!tbody.querySelector('tr') || tbody.querySelector('tr').textContent.includes('Загрузка')) {
        tbody.innerHTML = Object.entries(prices).map(([pair, pairPrices]) => {
            const cells = exchanges.map(exchange => {
                const price = pairPrices[exchange];
                if (price) {
                    return `<td class="price-value" data-exchange="${exchange}" data-pair="${pair}">$${parseFloat(price).toFixed(2)}</td>`;
                } else {
                    return `<td class="price-unavailable" data-exchange="${exchange}" data-pair="${pair}">-</td>`;
                }
            }).join('');
            
            return `
                <tr data-pair="${pair}">
                    <td><strong>${escapeHtml(pair)}</strong></td>
                    ${cells}
                </tr>
            `;
        }).join('');
    } else {
        // Обновляем только изменившиеся значения
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
                            cell.setAttribute('data-exchange', exchange);
                            cell.setAttribute('data-pair', pair);
                            
                            // Убираем класс updating после анимации
                            setTimeout(() => {
                                cell.classList.remove('updating');
                            }, 500);
                        } else {
                            cell.className = 'price-unavailable';
                            cell.textContent = '-';
                        }
                    }
                }
            });
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
    lastUpdateEl.innerHTML = `<span class="realtime-indicator"></span>Последнее обновление: ${timeString}`;
}

// Переключение автообновления
function toggleAutoRefresh() {
    if (isAutoRefresh) {
        clearInterval(autoRefreshInterval);
        clearInterval(pricesUpdateInterval);
        autoRefreshInterval = null;
        pricesUpdateInterval = null;
        isAutoRefresh = false;
        autoRefreshBtn.textContent = '▶️ Автообновление';
        autoRefreshBtn.classList.remove('active');
    } else {
        // Обновление арбитражных возможностей каждые 30 секунд
        autoRefreshInterval = setInterval(() => {
            loadArbitrageOpportunities(false);
        }, 30000);
        
        // Обновление цен в реальном времени каждые 3 секунды
        pricesUpdateInterval = setInterval(() => {
            loadPrices(false);
        }, 3000);
        
        isAutoRefresh = true;
        autoRefreshBtn.textContent = '⏸️ Остановить';
        autoRefreshBtn.classList.add('active');
        
        // Сразу запускаем обновление цен
        loadPrices(false);
    }
}

// Оптимизированные обработчики событий
refreshBtn.addEventListener('click', throttle(() => {
    loadArbitrageOpportunities();
    loadPrices();
}, 2000));

autoRefreshBtn.addEventListener('click', toggleAutoRefresh);

filterSelect.addEventListener('change', debounce(() => {
    displayOpportunities(cachedOpportunities);
}, 300));

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadArbitrageOpportunities();
    loadPrices();
    
    // Автоматически включаем автообновление
    setTimeout(() => {
        toggleAutoRefresh();
    }, 2000);
});

// Обработка видимости страницы (пауза обновлений когда вкладка неактивна)
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
