const API_BASE = '/api';
let autoRefreshInterval = null;
let pricesUpdateInterval = null;
let isAutoRefresh = false;
let cachedOpportunities = [];
let cachedPrices = {};
let currentView = 'table';

// Элементы DOM
const refreshBtn = document.getElementById('refreshBtn');
const autoRefreshBtn = document.getElementById('autoRefreshBtn');
const filterSelect = document.getElementById('filterSelect');
const opportunitiesList = document.getElementById('opportunitiesList');
const pricesTable = document.getElementById('pricesTable');
const pricesCards = document.getElementById('cardsView');
const lastUpdateEl = document.getElementById('lastUpdate');
const exchangesCountEl = document.getElementById('exchangesCount');
const pairsCountEl = document.getElementById('pairsCount');
const opportunitiesCountEl = document.getElementById('opportunitiesCount');
const viewToggle = document.getElementById('viewToggle');
const viewToggleCards = document.getElementById('viewToggleCards');

// Определение мобильного устройства
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Автоматическое переключение на карточки на мобильных
if (isMobile && window.innerWidth < 769) {
    currentView = 'cards';
    document.getElementById('tableView').style.display = 'none';
    pricesCards.style.display = 'grid';
    if (viewToggle) viewToggle.classList.remove('active');
    if (viewToggleCards) viewToggleCards.classList.add('active');
}

// Переключение вида
if (viewToggle && viewToggleCards) {
    viewToggle.addEventListener('click', () => {
        currentView = 'table';
        document.getElementById('tableView').style.display = 'block';
        pricesCards.style.display = 'none';
        viewToggle.classList.add('active');
        viewToggleCards.classList.remove('active');
    });

    viewToggleCards.addEventListener('click', () => {
        currentView = 'cards';
        document.getElementById('tableView').style.display = 'none';
        pricesCards.style.display = 'grid';
        viewToggle.classList.remove('active');
        viewToggleCards.classList.add('active');
    });
}

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

// Анимация появления чисел
function animateNumber(element, targetValue) {
    const current = parseInt(element.textContent) || 0;
    const increment = targetValue > current ? 1 : -1;
    const duration = 1000;
    const steps = Math.abs(targetValue - current);
    const stepDuration = duration / steps;
    
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
            animateNumber(exchangesCountEl, exchangesData.total);
        }
        
        if (pairsData.success) {
            animateNumber(pairsCountEl, pairsData.total);
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Загрузка арбитражных возможностей
async function loadArbitrageOpportunities(showLoading = true) {
    try {
        if (showLoading) {
            opportunitiesList.innerHTML = '<div class="loading">> LOADING DATA...</div>';
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
            animateNumber(opportunitiesCountEl, data.opportunities.length);
            updateTimestamp();
        } else {
            if (showLoading) {
                opportunitiesList.innerHTML = '<div class="loading">> ERROR LOADING DATA</div>';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки арбитражных возможностей:', error);
        if (showLoading) {
            opportunitiesList.innerHTML = '<div class="loading">> CONNECTION ERROR</div>';
        }
    }
}

// Отображение арбитражных возможностей
function displayOpportunities(opportunities) {
    if (opportunities.length === 0) {
        opportunitiesList.innerHTML = '<div class="loading">> NO OPPORTUNITIES FOUND</div>';
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
                    <span class="detail-label">BUY:</span>
                    <span class="detail-value">${escapeHtml(opp.buyExchange)}</span>
                </div>
                <div class="opportunity-detail">
                    <span class="detail-label">SELL:</span>
                    <span class="detail-value">${escapeHtml(opp.sellExchange)}</span>
                </div>
                <div class="opportunity-detail">
                    <span class="detail-label">BUY PRICE:</span>
                    <span class="detail-value">$${parseFloat(opp.buyPrice).toFixed(2)}</span>
                </div>
                <div class="opportunity-detail">
                    <span class="detail-label">SELL PRICE:</span>
                    <span class="detail-value">$${parseFloat(opp.sellPrice).toFixed(2)}</span>
                </div>
                <div class="opportunity-detail">
                    <span class="detail-label">PROFIT:</span>
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

// Загрузка цен
async function loadPrices(showLoading = true) {
    try {
        const tbody = pricesTable.querySelector('tbody');
        if (showLoading && (!tbody.querySelector('tr') || tbody.querySelector('tr').textContent.includes('LOADING'))) {
            tbody.innerHTML = '<tr><td colspan="11" class="loading">> LOADING DATA...</td></tr>';
            if (pricesCards) pricesCards.innerHTML = '<div class="loading">> LOADING DATA...</div>';
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
            updatePricesCards(data.prices);
            cachedPrices = data.prices;
            updateTimestamp();
        } else {
            if (showLoading) {
                tbody.innerHTML = '<tr><td colspan="11" class="loading">> ERROR LOADING DATA</td></tr>';
                if (pricesCards) pricesCards.innerHTML = '<div class="loading">> ERROR LOADING DATA</div>';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки цен:', error);
        const tbody = pricesTable.querySelector('tbody');
        if (showLoading) {
            tbody.innerHTML = '<tr><td colspan="11" class="loading">> CONNECTION ERROR</td></tr>';
            if (pricesCards) pricesCards.innerHTML = '<div class="loading">> CONNECTION ERROR</div>';
        }
    }
}

// Обновление таблицы цен
function updatePricesTable(prices) {
    const tbody = pricesTable.querySelector('tbody');
    const exchanges = ['binance', 'coinbase', 'kraken', 'kucoin', 'bybit', 'okx', 'gateio', 'huobi', 'bitfinex', 'bitstamp'];
    
    if (!tbody.querySelector('tr') || tbody.querySelector('tr').textContent.includes('LOADING')) {
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

// Обновление карточек цен
function updatePricesCards(prices) {
    if (!pricesCards) return;
    
    const exchanges = ['binance', 'coinbase', 'kraken', 'kucoin', 'bybit', 'okx', 'gateio', 'huobi', 'bitfinex', 'bitstamp'];
    const exchangeNames = {
        binance: 'BINANCE',
        coinbase: 'COINBASE',
        kraken: 'KRAKEN',
        kucoin: 'KUCOIN',
        bybit: 'BYBIT',
        okx: 'OKX',
        gateio: 'GATE.IO',
        huobi: 'HUOBI',
        bitfinex: 'BITFINEX',
        bitstamp: 'BITSTAMP'
    };
    
    if (!pricesCards.querySelector('.price-card')) {
        pricesCards.innerHTML = Object.entries(prices).map(([pair, pairPrices]) => {
            const exchangeCards = exchanges.map(exchange => {
                const price = pairPrices[exchange];
                if (price) {
                    return `
                        <div class="price-card-exchange">
                            <div class="price-card-exchange-name">${exchangeNames[exchange]}</div>
                            <div class="price-card-exchange-value">$${parseFloat(price).toFixed(2)}</div>
                        </div>
                    `;
                } else {
                    return `
                        <div class="price-card-exchange">
                            <div class="price-card-exchange-name">${exchangeNames[exchange]}</div>
                            <div class="price-card-exchange-value unavailable">-</div>
                        </div>
                    `;
                }
            }).join('');
            
            return `
                <div class="price-card" data-pair="${pair}">
                    <div class="price-card-header">${escapeHtml(pair)}</div>
                    <div class="price-card-exchanges">${exchangeCards}</div>
                </div>
            `;
        }).join('');
    } else {
        Object.entries(prices).forEach(([pair, pairPrices]) => {
            const card = pricesCards.querySelector(`.price-card[data-pair="${pair}"]`);
            if (card) {
                exchanges.forEach(exchange => {
                    const exchangeDivs = card.querySelectorAll('.price-card-exchange');
                    const exchangeIndex = exchanges.indexOf(exchange);
                    if (exchangeDivs[exchangeIndex]) {
                        const valueEl = exchangeDivs[exchangeIndex].querySelector('.price-card-exchange-value');
                        const newPrice = pairPrices[exchange];
                        const oldPrice = cachedPrices[pair]?.[exchange];
                        
                        if (newPrice !== oldPrice && valueEl) {
                            if (newPrice) {
                                valueEl.className = 'price-card-exchange-value';
                                valueEl.textContent = `$${parseFloat(newPrice).toFixed(2)}`;
                            } else {
                                valueEl.className = 'price-card-exchange-value unavailable';
                                valueEl.textContent = '-';
                            }
                        }
                    }
                });
            }
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
    lastUpdateEl.innerHTML = `<span class="realtime-indicator"></span>LAST UPDATE: ${timeString}`;
}

// Переключение автообновления
function toggleAutoRefresh() {
    if (isAutoRefresh) {
        clearInterval(autoRefreshInterval);
        clearInterval(pricesUpdateInterval);
        autoRefreshInterval = null;
        pricesUpdateInterval = null;
        isAutoRefresh = false;
        autoRefreshBtn.querySelector('.btn-text').textContent = '[AUTO]';
        autoRefreshBtn.classList.remove('active');
    } else {
        autoRefreshInterval = setInterval(() => {
            loadArbitrageOpportunities(false);
        }, 30000);
        
        pricesUpdateInterval = setInterval(() => {
            loadPrices(false);
        }, 3000);
        
        isAutoRefresh = true;
        autoRefreshBtn.querySelector('.btn-text').textContent = '[STOP]';
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

filterSelect.addEventListener('change', debounce(() => {
    displayOpportunities(cachedOpportunities);
}, 300));

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadArbitrageOpportunities();
    loadPrices();
    
    setTimeout(() => {
        toggleAutoRefresh();
    }, 2000);
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

// Звуковые эффекты (опционально, можно добавить позже)
function playSound(type) {
    // Можно добавить звуковые эффекты для кнопок
}
