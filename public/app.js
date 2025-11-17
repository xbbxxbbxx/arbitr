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
    'app.title': 'UNKNOWN P2P',
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
    'opportunity.fees': 'Комиссии:',
    'button.refresh': 'Обновить',
    'button.autoRefresh': 'Автообновление',
    'button.stop': 'Остановить',
    'button.notifications': 'Уведомления'
  },
  ua: {
    'app.title': 'UNKNOWN P2P',
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
    'opportunity.fees': 'Комісії:',
    'button.refresh': 'Оновити',
    'button.autoRefresh': 'Автооновлення',
    'button.stop': 'Зупинити',
    'button.notifications': 'Сповіщення'
  },
  en: {
    'app.title': 'UNKNOWN P2P',
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
    'opportunity.fees': 'Fees:',
    'button.refresh': 'Refresh',
    'button.autoRefresh': 'Auto Refresh',
    'button.stop': 'Stop',
    'button.notifications': 'Notifications'
  }
};

// Элементы DOM (будут инициализированы после загрузки DOM)
let refreshBtn, autoRefreshBtn, notificationsBtn, closeNotifications, notificationPanel;
let profitFilters, sortSelect, searchInput;
let opportunitiesHigh, opportunitiesMedium, opportunitiesLow;
let countHigh, countMedium, countLow;
let pricesTable, pricesCards, lastUpdateEl;
let exchangesCountEl, pairsCountEl, opportunitiesCountEl;
let exchangesCountCard, pairsCountCard, opportunitiesCountCard;
let maxProfitEl, statusText, viewToggle, viewToggleCards;

// Функция инициализации DOM элементов
function initDOMElements() {
    refreshBtn = document.getElementById('refreshBtn');
    autoRefreshBtn = document.getElementById('autoRefreshBtn');
    notificationsBtn = document.getElementById('notificationsBtn');
    closeNotifications = document.getElementById('closeNotifications');
    notificationPanel = document.getElementById('notificationPanel');
    profitFilters = document.querySelectorAll('.profit-filter-btn');
    sortSelect = document.getElementById('sortSelect');
    searchInput = document.getElementById('searchInput');
    opportunitiesHigh = document.getElementById('opportunitiesHigh');
    opportunitiesMedium = document.getElementById('opportunitiesMedium');
    opportunitiesLow = document.getElementById('opportunitiesLow');
    countHigh = document.getElementById('countHigh');
    countMedium = document.getElementById('countMedium');
    countLow = document.getElementById('countLow');
    pricesTable = document.getElementById('pricesTable');
    pricesCards = document.getElementById('pricesCards');
    lastUpdateEl = document.getElementById('lastUpdate');
    exchangesCountEl = document.getElementById('exchangesCount');
    pairsCountEl = document.getElementById('pairsCount');
    opportunitiesCountEl = document.getElementById('opportunitiesCount');
    exchangesCountCard = document.getElementById('exchangesCountCard');
    pairsCountCard = document.getElementById('pairsCountCard');
    opportunitiesCountCard = document.getElementById('opportunitiesCountCard');
    maxProfitEl = document.getElementById('maxProfit');
    statusText = document.getElementById('statusText');
    viewToggle = document.getElementById('viewToggle');
    viewToggleCards = document.getElementById('viewToggleCards');
}

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

// Вызываем при загрузке и изменении размера окна (быстрый отклик)
window.addEventListener('resize', debounce(initView, 150));

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

// Улучшенная анимация числа с эффектами
function animateNumber(element, targetValue, suffix = '') {
    if (!element) return;
    
    const currentText = element.textContent.replace(/[^0-9.-]/g, '');
    const startValue = parseFloat(currentText) || 0;
    const duration = 1500;
    const startTime = performance.now();
    
    // Добавляем класс анимации
    element.classList.add('animating');
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing функция для плавной анимации
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const currentValue = startValue + (targetValue - startValue) * easeOutCubic;
        
        // Форматируем число
        if (suffix === '%') {
            element.textContent = currentValue.toFixed(2) + suffix;
        } else {
            element.textContent = Math.floor(currentValue) + suffix;
        }
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = suffix === '%' ? targetValue.toFixed(2) + suffix : targetValue + suffix;
            element.classList.remove('animating');
            element.classList.add('pulse');
            setTimeout(() => element.classList.remove('pulse'), 600);
        }
    }
    
    requestAnimationFrame(update);
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
            if (exchangesCountEl) animateNumber(exchangesCountEl, count);
            if (exchangesCountCard) {
                animateNumber(exchangesCountCard, count);
                // Анимация иконки
                const card = exchangesCountCard.closest('.stat-card');
                if (card) {
                    card.classList.add('stat-updated');
                    setTimeout(() => card.classList.remove('stat-updated'), 1000);
                }
            }
        }
        
        if (pairsData.success) {
            const count = pairsData.total;
            if (pairsCountEl) animateNumber(pairsCountEl, count);
            if (pairsCountCard) {
                animateNumber(pairsCountCard, count);
                // Анимация иконки
                const card = pairsCountCard.closest('.stat-card');
                if (card) {
                    card.classList.add('stat-updated');
                    setTimeout(() => card.classList.remove('stat-updated'), 1000);
                }
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

// Загрузка арбитражных возможностей
async function loadArbitrageOpportunities(showLoading = true) {
    try {
        if (showLoading) {
            if (opportunitiesHigh) opportunitiesHigh.innerHTML = '<div class="loading">Загрузка...</div>';
            if (opportunitiesMedium) opportunitiesMedium.innerHTML = '<div class="loading">Загрузка...</div>';
            if (opportunitiesLow) opportunitiesLow.innerHTML = '<div class="loading">Загрузка...</div>';
        }
        
        // Добавляем timestamp для предотвращения кэширования браузером
        const timestamp = Date.now();
        // Максимальный лимит для получения всех возможностей
        const response = await fetch(`${API_BASE}/arbitrage?limit=1000&_t=${timestamp}`, {
            cache: 'no-cache',
            headers: { 
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
        const data = await response.json();
        
        if (data.success) {
            // Сохраняем предыдущие значения перед обновлением (глубокая копия для правильного сравнения)
            const currentPreviousValues = new Map();
            previousOpportunities.forEach((value, key) => {
                currentPreviousValues.set(key, {
                    profitPercent: value.profitPercent || 0,
                    buyPrice: value.buyPrice || 0,
                    sellPrice: value.sellPrice || 0
                });
            });
            
            cachedOpportunities = data.opportunities;
            
            // Обновляем previousOpportunities ПЕРЕД отображением, чтобы следующее обновление могло сравнить
            data.opportunities.forEach(opp => {
                const key = `${opp.symbol}_${opp.buyExchange}_${opp.sellExchange}`;
                const realProfitPercent = parseFloat(opp.realProfitPercent) || parseFloat(opp.profitPercent) || 0;
                const buyPrice = parseFloat(opp.buyPrice) || 0;
                const sellPrice = parseFloat(opp.sellPrice) || 0;
                
                // Сохраняем только если значения валидны
                if (!isNaN(realProfitPercent) && !isNaN(buyPrice) && !isNaN(sellPrice) && realProfitPercent >= 0) {
                    previousOpportunities.set(key, {
                        profitPercent: realProfitPercent,
                        buyPrice: buyPrice,
                        sellPrice: sellPrice
                    });
                }
            });
            
            // Отображаем с предыдущими значениями для сравнения
            displayOpportunities(data.opportunities, currentPreviousValues);
            
            if (opportunitiesCountEl) animateNumber(opportunitiesCountEl, data.opportunities.length);
            if (opportunitiesCountCard) {
                animateNumber(opportunitiesCountCard, data.opportunities.length);
                // Анимация иконки
                const card = opportunitiesCountCard.closest('.stat-card');
                if (card) {
                    card.classList.add('stat-updated');
                    setTimeout(() => card.classList.remove('stat-updated'), 1000);
                }
            }
            
            // Максимальная прибыль
            if (data.opportunities.length > 0 && maxProfitEl) {
                const maxProfit = Math.max(...data.opportunities.map(o => {
                    const profit = parseFloat(o.realProfitPercent) || parseFloat(o.profitPercent) || 0;
                    return profit;
                }));
                animateNumber(maxProfitEl, maxProfit, '%');
                // Анимация иконки
                const card = maxProfitEl.closest('.stat-card');
                if (card) {
                    card.classList.add('stat-updated');
                    setTimeout(() => card.classList.remove('stat-updated'), 1000);
                }
            }
            
            updateTimestamp();
            checkNotifications(data.opportunities);
        }
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        if (showLoading) {
            if (opportunitiesHigh) opportunitiesHigh.innerHTML = '<div class="loading">Ошибка подключения</div>';
            if (opportunitiesMedium) opportunitiesMedium.innerHTML = '<div class="loading">Ошибка подключения</div>';
            if (opportunitiesLow) opportunitiesLow.innerHTML = '<div class="loading">Ошибка подключения</div>';
        }
    }
}

// Отображение возможностей с категоризацией и отслеживанием изменений
function displayOpportunities(opportunities, previousValues = new Map()) {
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
    
    if (countHigh) countHigh.textContent = high.length;
    if (countMedium) countMedium.textContent = medium.length;
    if (countLow) countLow.textContent = low.length;
    
    // Оптимизированный рендеринг с использованием requestAnimationFrame для плавности
    requestAnimationFrame(() => {
        if (opportunitiesHigh) {
            opportunitiesHigh.innerHTML = high.length > 0 ? renderOpportunities(high, previousValues) : '<div class="loading">Нет возможностей</div>';
        }
        if (opportunitiesMedium) {
            opportunitiesMedium.innerHTML = medium.length > 0 ? renderOpportunities(medium, previousValues) : '<div class="loading">Нет возможностей</div>';
        }
        if (opportunitiesLow) {
            opportunitiesLow.innerHTML = low.length > 0 ? renderOpportunities(low, previousValues) : '<div class="loading">Нет возможностей</div>';
        }
        
        // Запускаем обновление в реальном времени для всех отображаемых возможностей
        startLiveUpdates([...high, ...medium, ...low]);
    });
}

// Запуск обновления цен в реальном времени для каждой возможности
function startLiveUpdates(opportunities) {
    // Останавливаем старые обновления для возможностей, которых больше нет на экране
    const currentKeys = new Set(opportunities.map(opp => 
        `${opp.symbol}_${opp.buyExchange}_${opp.sellExchange}`
    ));
    
    // Удаляем интервалы для возможностей, которых больше нет
    liveUpdateIntervals.forEach((interval, key) => {
        if (!currentKeys.has(key)) {
            clearInterval(interval);
            liveUpdateIntervals.delete(key);
            activeOpportunities.delete(key);
        }
    });
    
    // Запускаем обновления для новых возможностей
    opportunities.forEach(opp => {
        const key = `${opp.symbol}_${opp.buyExchange}_${opp.sellExchange}`;
        
        if (!activeOpportunities.has(key)) {
            activeOpportunities.add(key);
            
            // Обновляем каждые 3 секунды для каждой возможности
            const interval = setInterval(() => {
                updateOpportunityPrice(opp.symbol, opp.buyExchange, opp.sellExchange, key);
            }, 3000);
            
            liveUpdateIntervals.set(key, interval);
            
            // Первое обновление сразу
            updateOpportunityPrice(opp.symbol, opp.buyExchange, opp.sellExchange, key);
        }
    });
}

// Обновление цены для конкретной возможности
async function updateOpportunityPrice(symbol, buyExchange, sellExchange, key) {
    try {
        const response = await fetch(`${API_BASE}/prices/${symbol.replace('/', '-')}?_t=${Date.now()}`, {
            cache: 'no-cache',
            headers: { 'Cache-Control': 'no-cache' }
        });
        
        const data = await response.json();
        
        if (data.success && data.prices) {
            const buyPrice = parseFloat(data.prices[buyExchange]);
            const sellPrice = parseFloat(data.prices[sellExchange]);
            
            if (buyPrice && sellPrice && buyPrice > 0 && sellPrice > 0) {
                // Получаем комиссии из кэшированных данных возможности
                const cachedOpp = cachedOpportunities.find(opp => 
                    opp.symbol === symbol && 
                    opp.buyExchange === buyExchange && 
                    opp.sellExchange === sellExchange
                );
                
                // Используем комиссии из данных или дефолтные
                const buyFee = cachedOpp ? (parseFloat(cachedOpp.buyFee) / 100 || 0.002) : 0.002;
                const sellFee = cachedOpp ? (parseFloat(cachedOpp.sellFee) / 100 || 0.002) : 0.002;
                
                // Рассчитываем реальную прибыль
                const realBuyPrice = buyPrice * (1 + buyFee);
                const realSellPrice = sellPrice * (1 - sellFee);
                const realProfit = realSellPrice - realBuyPrice;
                const realProfitPercent = (realProfit / realBuyPrice) * 100;
                
                // Получаем предыдущие значения
                const previousData = previousOpportunities.get(key);
                const previousProfit = previousData ? (previousData.profitPercent || 0) : 0;
                
                // Обновляем DOM элемент напрямую
                const card = document.querySelector(`[data-opportunity-key="${key}"]`);
                if (card) {
                    // Обновляем процент прибыли
                    const profitValueEl = card.querySelector('.profit-value-live');
                    if (profitValueEl) {
                        const oldValue = parseFloat(profitValueEl.textContent.replace(/[^0-9.-]/g, ''));
                        const newValue = realProfitPercent;
                        
                        // Анимация изменения
                        if (oldValue !== newValue) {
                            profitValueEl.textContent = `+${formatPercent(newValue)}%`;
                            
                            // Добавляем класс для анимации
                            if (newValue > oldValue) {
                                profitValueEl.classList.add('profit-updating-up');
                                setTimeout(() => profitValueEl.classList.remove('profit-updating-up'), 1000);
                            } else if (newValue < oldValue) {
                                profitValueEl.classList.add('profit-updating-down');
                                setTimeout(() => profitValueEl.classList.remove('profit-updating-down'), 1000);
                            }
                        }
                    }
                    
                    // Обновляем изменение прибыли
                    const profitChangeEl = card.querySelector('.profit-change');
                    const change = realProfitPercent - previousProfit;
                    
                    if (Math.abs(change) > 0.001) {
                        if (profitChangeEl) {
                            profitChangeEl.textContent = `${change > 0 ? '↑' : '↓'} ${change > 0 ? '+' : ''}${formatPercent(Math.abs(change))}%`;
                            profitChangeEl.className = `profit-change ${change > 0 ? 'increase' : 'decrease'}`;
                            profitChangeEl.style.display = 'inline-block';
                        } else {
                            // Создаем элемент изменения, если его нет
                            const profitBadge = card.querySelector('.live-profit');
                            if (profitBadge) {
                                const changeSpan = document.createElement('span');
                                changeSpan.className = `profit-change ${change > 0 ? 'increase' : 'decrease'}`;
                                changeSpan.textContent = `${change > 0 ? '↑' : '↓'} ${change > 0 ? '+' : ''}${formatPercent(Math.abs(change))}%`;
                                changeSpan.title = change > 0 ? `Прибыль выросла на ${formatPercent(Math.abs(change))}%` : `Прибыль упала на ${formatPercent(Math.abs(change))}%`;
                                profitBadge.appendChild(changeSpan);
                            }
                        }
                        
                        // Обновляем иконку
                        const profitBadge = card.querySelector('.live-profit');
                        if (profitBadge) {
                            const iconEl = profitBadge.querySelector('span:first-child');
                            if (iconEl && !iconEl.classList.contains('profit-value-live')) {
                                iconEl.textContent = change > 0 ? '📈' : '📉';
                            }
                        }
                    } else if (profitChangeEl) {
                        profitChangeEl.style.display = 'none';
                    }
                    
                    // Обновляем цены покупки и продажи
                    const priceDetails = card.querySelectorAll('.price-detail .detail-value');
                    if (priceDetails.length >= 2) {
                        // Цена покупки
                        const buyPriceText = priceDetails[0].textContent.replace(/[^0-9.-]/g, '');
                        const oldBuyPrice = parseFloat(buyPriceText);
                        if (isNaN(oldBuyPrice) || Math.abs(oldBuyPrice - buyPrice) > 0.0001) {
                            priceDetails[0].innerHTML = `$${formatPrice(buyPrice)} <span class="price-update-indicator" title="Цена обновлена">🔄</span>`;
                            priceDetails[0].classList.add('price-updated');
                            setTimeout(() => priceDetails[0].classList.remove('price-updated'), 1000);
                        }
                        
                        // Цена продажи
                        const sellPriceText = priceDetails[1].textContent.replace(/[^0-9.-]/g, '');
                        const oldSellPrice = parseFloat(sellPriceText);
                        if (isNaN(oldSellPrice) || Math.abs(oldSellPrice - sellPrice) > 0.0001) {
                            priceDetails[1].innerHTML = `$${formatPrice(sellPrice)} <span class="price-update-indicator" title="Цена обновлена">🔄</span>`;
                            priceDetails[1].classList.add('price-updated');
                            setTimeout(() => priceDetails[1].classList.remove('price-updated'), 1000);
                        }
                    }
                    
                    // Обновляем реальную прибыль
                    const realProfitEl = card.querySelector('.profit-value');
                    if (realProfitEl) {
                        realProfitEl.textContent = `$${formatProfit(realProfit)} (+${formatPercent(realProfitPercent)}%)`;
                    }
                }
                
                // Сохраняем новые значения для следующего сравнения
                previousOpportunities.set(key, {
                    profitPercent: realProfitPercent,
                    buyPrice: buyPrice,
                    sellPrice: sellPrice
                });
            }
        }
    } catch (error) {
        console.warn(`Ошибка обновления цены для ${symbol}:`, error);
    }
}

// Остановка всех обновлений в реальном времени
function stopLiveUpdates() {
    liveUpdateIntervals.forEach(interval => clearInterval(interval));
    liveUpdateIntervals.clear();
    activeOpportunities.clear();
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

function renderOpportunities(opportunities, previousValues = new Map()) {
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
        
        // Определяем изменение прибыли и цен в реальном времени
        const key = `${opp.symbol}_${opp.buyExchange}_${opp.sellExchange}`;
        const previousData = previousValues.get(key);
        let profitChange = null;
        let profitChangeClass = '';
        let profitChangeIcon = '';
        let priceChangeIndicator = '';
        
        if (previousData) {
            const previousProfit = previousData.profitPercent || 0;
            const previousBuyPrice = previousData.buyPrice || 0;
            const previousSellPrice = previousData.sellPrice || 0;
            
            // Изменение прибыли - показываем изменения если они есть
            const change = realProfitPercent - previousProfit;
            // Уменьшен порог для показа изменений (0.01% для лучшей видимости)
            if (Math.abs(change) > 0.01) {
                profitChange = change;
                if (change > 0) {
                    profitChangeClass = 'profit-increasing';
                    profitChangeIcon = '📈';
                } else {
                    profitChangeClass = 'profit-decreasing';
                    profitChangeIcon = '📉';
                }
            } else if (Math.abs(change) > 0.001) {
                // Показываем даже маленькие изменения, но без иконки
                profitChange = change;
                if (change > 0) {
                    profitChangeClass = 'profit-increasing';
                } else {
                    profitChangeClass = 'profit-decreasing';
                }
            }
            
            // Изменение цен - уменьшен порог
            const buyPriceChange = buyPrice - previousBuyPrice;
            const sellPriceChange = sellPrice - previousSellPrice;
            
            if (Math.abs(buyPriceChange) > 0.00001 || Math.abs(sellPriceChange) > 0.00001) {
                priceChangeIndicator = '<span class="price-update-indicator" title="Цены обновлены">🔄</span>';
            }
        } else {
            // Если нет предыдущих данных, все равно показываем индикатор обновления
            priceChangeIndicator = '<span class="price-update-indicator" title="Новые данные">🆕</span>';
        }
        
        // Сохраняем текущие данные для следующего сравнения
        previousValues.set(key, {
            profitPercent: realProfitPercent,
            buyPrice: buyPrice,
            sellPrice: sellPrice
        });
        
        const profitClass = getProfitBadgeClass(realProfitPercent);
        
        // Индикатор выгодности
        let profitabilityIndicator = '';
        if (realProfitPercent >= 5) {
            profitabilityIndicator = '<span class="profitability-indicator very-profitable" title="Очень выгодно - прибыль >5%">🔥 Очень выгодно</span>';
        } else if (realProfitPercent >= 2) {
            profitabilityIndicator = '<span class="profitability-indicator profitable" title="Выгодно - прибыль 2-5%">✅ Выгодно</span>';
        } else if (realProfitPercent >= 1) {
            profitabilityIndicator = '<span class="profitability-indicator moderate" title="Умеренно выгодно - прибыль 1-2%">⚡ Умеренно</span>';
        } else if (realProfitPercent >= 0.5) {
            profitabilityIndicator = '<span class="profitability-indicator low-profit" title="Низкая прибыль - 0.5-1%">⚠️ Низкая</span>';
        } else {
            profitabilityIndicator = '<span class="profitability-indicator not-profitable" title="Не выгодно - прибыль <0.5%">❌ Не выгодно</span>';
        }
        
        return `
            <div class="opportunity-card ${profitChangeClass} profitability-${profitClass}" data-opportunity-key="${key}">
                <div class="opportunity-header">
                    <div class="opportunity-symbol-section">
                        <span class="opportunity-symbol">${escapeHtml(opp.symbol)}</span>
                        ${profitabilityIndicator}
                    </div>
                    <div class="profit-badges">
                        <span class="profit-badge ${profitClass} ${profitChangeClass} live-profit" title="${t['opportunity.realProfit'] || 'Реальная прибыль с учетом комиссий - обновляется в реальном времени'}">
                            ${profitChangeIcon || (profitChange !== null ? (profitChange > 0 ? '📈' : '📉') : '⚡')}
                            <span class="profit-value-live">+${formatPercent(realProfitPercent)}%</span>
                            ${profitChange !== null && Math.abs(profitChange) > 0.001 ? `<span class="profit-change ${profitChange > 0 ? 'increase' : 'decrease'}" title="${profitChange > 0 ? 'Прибыль выросла на ' + formatPercent(Math.abs(profitChange)) + '%' : 'Прибыль упала на ' + formatPercent(Math.abs(profitChange)) + '%'}">${profitChange > 0 ? '↑' : '↓'} ${profitChange > 0 ? '+' : ''}${formatPercent(Math.abs(profitChange))}%</span>` : ''}
                            <span class="live-indicator" title="Обновляется в реальном времени">⚡</span>
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
                    <div class="opportunity-detail price-detail">
                        <span class="detail-label">${t['opportunity.buyPrice'] || 'Цена покупки:'}</span>
                        <span class="detail-value price-value-live">$${formatPrice(buyPrice)} ${priceChangeIndicator}</span>
                    </div>
                    <div class="opportunity-detail price-detail">
                        <span class="detail-label">${t['opportunity.sellPrice'] || 'Цена продажи:'}</span>
                        <span class="detail-value price-value-live">$${formatPrice(sellPrice)} ${priceChangeIndicator}</span>
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
        if (!pricesTable) return; // Если таблица не найдена, выходим
        
        const tbody = pricesTable.querySelector('tbody');
        if (!tbody) return; // Если tbody не найден, выходим
        
        if (showLoading && (!tbody.querySelector('tr') || tbody.querySelector('tr').textContent.includes('Загрузка'))) {
            tbody.innerHTML = '<tr><td colspan="15" class="loading">Загрузка данных...</td></tr>';
            if (pricesCards) pricesCards.innerHTML = '<div class="loading">Загрузка данных...</div>';
        }
        
        // Увеличен лимит для получения больше цен быстрее
        const response = await fetch(`${API_BASE}/prices?limit=200`, {
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
    if (!pricesTable) return; // Если таблица не найдена, выходим
    
    const tbody = pricesTable.querySelector('tbody');
    if (!tbody) return; // Если tbody не найден, выходим
    
    const exchanges = ['binance', 'coinbase', 'kraken', 'kucoin', 'bybit', 'okx', 'gateio', 'huobi', 'bitfinex', 'bitstamp', 'gemini', 'bitget', 'mexc', 'bitmart', 'whitebit', 'p2pb2b', 'cryptocom', 'poloniex', 'bittrex', 'telegramwallet', 'telegramcryptobot'];
    
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
    
    const exchanges = ['binance', 'coinbase', 'kraken', 'kucoin', 'bybit', 'okx', 'gateio', 'huobi', 'bitfinex', 'bitstamp', 'gemini', 'bitget', 'mexc', 'bitmart', 'whitebit', 'p2pb2b', 'cryptocom', 'poloniex', 'bittrex', 'telegramwallet', 'telegramcryptobot'];
    const exchangeNames = {
        binance: 'Binance', coinbase: 'Coinbase', kraken: 'Kraken', kucoin: 'KuCoin',
        bybit: 'Bybit', okx: 'OKX', gateio: 'Gate.io', huobi: 'Huobi',
        bitfinex: 'Bitfinex', bitstamp: 'Bitstamp', gemini: 'Gemini',
        bitget: 'Bitget', mexc: 'MEXC', bitmart: 'BitMart', whitebit: 'WhiteBIT',
        p2pb2b: 'P2PB2B', cryptocom: 'Crypto.com', poloniex: 'Poloniex', bittrex: 'Bittrex',
        telegramwallet: 'Telegram Wallet', telegramcryptobot: 'Telegram CryptoBot'
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
    if (lastUpdateEl) {
        lastUpdateEl.textContent = `Последнее обновление: ${timeString}`;
    }
    if (statusText) {
        statusText.textContent = 'Система активна';
    }
}

// Хранение предыдущих значений для отслеживания изменений
let previousOpportunities = new Map();

// Система обновления цен в реальном времени для каждой возможности
let liveUpdateIntervals = new Map(); // Хранит интервалы для каждой возможности
let activeOpportunities = new Set(); // Активные возможности на экране

// Переключение автообновления
function toggleAutoRefresh() {
    if (isAutoRefresh) {
        clearInterval(autoRefreshInterval);
        clearInterval(pricesUpdateInterval);
        stopLiveUpdates(); // Останавливаем обновления в реальном времени
        isAutoRefresh = false;
        const autoRefreshTextEl = document.getElementById('autoRefreshText');
        const t = translations[currentLanguage] || translations.ru;
        if (autoRefreshTextEl) {
            autoRefreshTextEl.textContent = t['button.autoRefresh'] || 'Автообновление';
        }
        if (autoRefreshBtn) {
            autoRefreshBtn.classList.remove('active');
        }
    } else {
        // Комфортная скорость обновления: арбитраж каждые 7 секунд, цены каждые 10 секунд
        // Увеличено для комфортного просмотра сделок
        autoRefreshInterval = setInterval(() => {
            loadArbitrageOpportunities(false);
        }, 7000);
        
        // Обновление цен с комфортной задержкой
        pricesUpdateInterval = setInterval(() => {
            loadPrices(false);
        }, 10000);
        
        // Загружаем данные сразу при включении
        loadArbitrageOpportunities(false);
        loadPrices(false);
        
        isAutoRefresh = true;
        const autoRefreshTextEl = document.getElementById('autoRefreshText');
        const t = translations[currentLanguage] || translations.ru;
        if (autoRefreshTextEl) {
            autoRefreshTextEl.textContent = t['button.stop'] || 'Остановить';
        }
        if (autoRefreshBtn) {
            autoRefreshBtn.classList.add('active');
        }
    }
}

// Функция инициализации всех обработчиков событий
function initEventHandlers() {
    // Обработчики кнопок
    if (refreshBtn) {
        refreshBtn.addEventListener('click', throttle(() => {
            loadArbitrageOpportunities();
            loadPrices();
        }, 2000));
    }

    if (autoRefreshBtn) {
        autoRefreshBtn.addEventListener('click', toggleAutoRefresh);
    }

    if (notificationsBtn) {
        notificationsBtn.addEventListener('click', () => {
            if (notificationPanel) {
                notificationPanel.classList.toggle('open');
            }
            if (Notification.permission === 'default') {
                Notification.requestPermission();
            }
        });
    }

    if (closeNotifications) {
        closeNotifications.addEventListener('click', () => {
            if (notificationPanel) {
                notificationPanel.classList.remove('open');
            }
        });
    }

    // Обработчики фильтров
    if (profitFilters && profitFilters.length > 0) {
        profitFilters.forEach(btn => {
            btn.addEventListener('click', () => {
                profitFilters.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                displayOpportunities(cachedOpportunities);
            });
        });
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            displayOpportunities(cachedOpportunities);
        });
    }

    if (searchInput) {
        // Оптимизированный debounce для поиска (быстрый отклик)
        searchInput.addEventListener('input', debounce(() => {
            displayOpportunities(cachedOpportunities);
        }, 200));
    }

    // Настройки уведомлений
    const notifyHigh = document.getElementById('notifyHigh');
    const notifyMedium = document.getElementById('notifyMedium');
    const profitThreshold = document.getElementById('profitThreshold');
    const thresholdValue = document.getElementById('thresholdValue');

    if (notifyHigh) {
        notifyHigh.addEventListener('change', (e) => {
            notificationSettings.high = e.target.checked;
        });
    }

    if (notifyMedium) {
        notifyMedium.addEventListener('change', (e) => {
            notificationSettings.medium = e.target.checked;
        });
    }

    if (profitThreshold && thresholdValue) {
        profitThreshold.addEventListener('input', (e) => {
            notificationSettings.threshold = parseFloat(e.target.value);
            thresholdValue.textContent = `${e.target.value}%`;
        });
    }
}

// Функции для темы
function applyTheme(theme) {
    if (!theme) return; // Защита от пустого значения
    
    currentTheme = theme;
    localStorage.setItem('theme', theme);
    
    // Применяем тему с учетом цветовой схемы
    updateThemeAttribute();
    
    // Обновляем иконку темы
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
    
    console.log('Тема применена:', theme, 'Цветовая схема:', currentColorScheme);
}

function toggleTheme() {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

// Обновление атрибута темы с учетом цветовой схемы
function updateThemeAttribute() {
    // Удаляем все возможные атрибуты темы
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-color-scheme');
    
    // Применяем тему и цветовую схему
    if (currentColorScheme !== 'default') {
        document.documentElement.setAttribute('data-theme', `${currentTheme}-${currentColorScheme}`);
        document.documentElement.setAttribute('data-color-scheme', currentColorScheme);
    } else {
        document.documentElement.setAttribute('data-theme', currentTheme);
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
    if (!lang || !translations[lang]) {
        console.warn('Язык не найден:', lang);
        lang = 'ru'; // Fallback на русский
    }
    
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    
    const t = translations[lang] || translations.ru;
    
    // Обновляем все элементы с data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            // Для input элементов обновляем placeholder, для остальных - textContent
            if (el.tagName === 'INPUT' && el.type !== 'button' && el.type !== 'number') {
                el.placeholder = t[key];
            } else if (el.tagName !== 'INPUT' || el.type === 'button') {
                el.textContent = t[key];
            }
        }
    });
    
    // Обновляем селект языка
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) {
        langSelect.value = lang;
    }
    
    // Обновляем текст кнопки автообновления
    const autoRefreshText = document.getElementById('autoRefreshText');
    if (autoRefreshText) {
        if (isAutoRefresh) {
            autoRefreshText.textContent = t['button.stop'] || 'Остановить';
        } else {
            autoRefreshText.textContent = t['button.autoRefresh'] || 'Автообновление';
        }
    }
    
    // Перерисовываем возможности с новым языком
    if (cachedOpportunities.length > 0) {
        displayOpportunities(cachedOpportunities);
    }
    
    console.log('Язык применен:', lang);
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

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем все DOM элементы
    initDOMElements();
    
    // Инициализируем все обработчики событий
    initEventHandlers();
    
    // Обработчики для новых элементов (тема, язык, фильтры)
    const themeToggle = document.getElementById('themeToggle');
    const colorSchemeSelect = document.getElementById('colorSchemeSelect');
    const languageSelect = document.getElementById('languageSelect');
    const applyRangeFilter = document.getElementById('applyRangeFilter');

    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    if (colorSchemeSelect) {
        colorSchemeSelect.value = currentColorScheme; // Устанавливаем текущее значение
        colorSchemeSelect.addEventListener('change', (e) => {
            applyColorScheme(e.target.value);
        });
    }

    if (languageSelect) {
        languageSelect.value = currentLanguage; // Устанавливаем текущее значение
        languageSelect.addEventListener('change', (e) => {
            applyLanguage(e.target.value);
        });
    }

    if (applyRangeFilter) {
        applyRangeFilter.addEventListener('click', applyCustomProfitRange);
    }
    
    // Применяем сохраненные настройки (ВАЖНО: сначала тема, потом язык)
    // Тема должна применяться первой, чтобы CSS переменные были установлены
    updateThemeAttribute(); // Применяем тему сразу
    applyColorScheme(currentColorScheme); // Затем цветовую схему
    applyLanguage(currentLanguage); // Затем язык
    
    // Убеждаемся, что иконка темы правильная
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = currentTheme === 'dark' ? '🌙' : '☀️';
    }
    
    initView(); // Инициализируем вид
    loadStats();
    loadArbitrageOpportunities();
    loadPrices();
    
    // Автоматически включаем обновление в реальном времени через 1 секунду после загрузки
    setTimeout(() => {
        if (!isAutoRefresh) {
            toggleAutoRefresh();
        }
    }, 1000);
    
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
