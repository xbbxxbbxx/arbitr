const API_BASE = '/api';
let autoRefreshInterval = null;
let isAutoRefresh = false;

// Элементы DOM
const refreshBtn = document.getElementById('refreshBtn');
const autoRefreshBtn = document.getElementById('autoRefreshBtn');
const filterSelect = document.getElementById('filterSelect');
const opportunitiesList = document.getElementById('opportunitiesList');
const pricesTable = document.getElementById('pricesTable');
const statusIndicator = document.getElementById('status');
const lastUpdate = document.getElementById('lastUpdate');
const totalOpportunities = document.getElementById('totalOpportunities');
const maxProfit = document.getElementById('maxProfit');

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    refreshBtn.addEventListener('click', loadData);
    autoRefreshBtn.addEventListener('click', toggleAutoRefresh);
    filterSelect.addEventListener('change', loadData);
    
    loadData();
});

// Загрузка данных
async function loadData() {
    try {
        statusIndicator.textContent = '🟡 Загрузка...';
        
        const [arbitrageResponse, pricesResponse] = await Promise.all([
            fetch(`${API_BASE}/arbitrage`),
            fetch(`${API_BASE}/prices`)
        ]);
        
        const arbitrageData = await arbitrageResponse.json();
        const pricesData = await pricesResponse.json();
        
        if (arbitrageData.success) {
            displayOpportunities(arbitrageData.opportunities);
            updateStats(arbitrageData.opportunities);
        }
        
        if (pricesData.success) {
            displayPrices(pricesData.prices);
        }
        
        statusIndicator.textContent = '🟢 Активен';
        lastUpdate.textContent = `Обновлено: ${new Date().toLocaleTimeString('ru-RU')}`;
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        statusIndicator.textContent = '🔴 Ошибка';
        opportunitiesList.innerHTML = '<div class="no-opportunities">Ошибка загрузки данных. Проверьте подключение к интернету.</div>';
    }
}

// Отображение арбитражных возможностей
function displayOpportunities(opportunities) {
    const filter = filterSelect.value;
    let filtered = opportunities;
    
    if (filter === 'high') {
        filtered = opportunities.filter(opp => parseFloat(opp.profitPercent) > 1);
    } else if (filter === 'medium') {
        filtered = opportunities.filter(opp => {
            const profit = parseFloat(opp.profitPercent);
            return profit >= 0.5 && profit <= 1;
        });
    } else if (filter === 'low') {
        filtered = opportunities.filter(opp => parseFloat(opp.profitPercent) < 0.5);
    }
    
    if (filtered.length === 0) {
        opportunitiesList.innerHTML = '<div class="no-opportunities">Арбитражных возможностей не найдено</div>';
        return;
    }
    
    opportunitiesList.innerHTML = filtered.map(opp => {
        const profitClass = parseFloat(opp.profitPercent) > 1 ? 'high' : 
                           parseFloat(opp.profitPercent) > 0.5 ? 'medium' : 'low';
        const cardClass = parseFloat(opp.profitPercent) > 1 ? 'high-profit' : 
                         parseFloat(opp.profitPercent) > 0.5 ? 'medium-profit' : '';
        
        return `
            <div class="opportunity-card ${cardClass}">
                <div class="opportunity-info">
                    <div class="opportunity-item">
                        <span class="opportunity-label">Торговая пара</span>
                        <span class="opportunity-value">${opp.symbol}</span>
                    </div>
                    <div class="opportunity-item">
                        <span class="opportunity-label">Купить на</span>
                        <span class="opportunity-value exchange-name">${getExchangeName(opp.buyExchange)}</span>
                    </div>
                    <div class="opportunity-item">
                        <span class="opportunity-label">Цена покупки</span>
                        <span class="opportunity-value">$${parseFloat(opp.buyPrice).toFixed(2)}</span>
                    </div>
                    <div class="opportunity-item">
                        <span class="opportunity-label">Продать на</span>
                        <span class="opportunity-value exchange-name">${getExchangeName(opp.sellExchange)}</span>
                    </div>
                    <div class="opportunity-item">
                        <span class="opportunity-label">Цена продажи</span>
                        <span class="opportunity-value">$${parseFloat(opp.sellPrice).toFixed(2)}</span>
                    </div>
                    <div class="opportunity-item">
                        <span class="opportunity-label">Прибыль</span>
                        <span class="opportunity-value">$${parseFloat(opp.profit).toFixed(2)}</span>
                    </div>
                </div>
                <div class="profit-badge ${profitClass}">
                    ${opp.profitPercent}%
                </div>
            </div>
        `;
    }).join('');
}

// Отображение цен
function displayPrices(prices) {
    const pairs = Object.keys(prices);
    
    if (pairs.length === 0) {
        pricesTable.innerHTML = '<div class="no-opportunities">Нет данных о ценах</div>';
        return;
    }
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Торговая пара</th>
                    <th>Binance</th>
                    <th>Coinbase</th>
                    <th>Kraken</th>
                    <th>Разница</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    pairs.forEach(pair => {
        const pairPrices = prices[pair];
        const exchanges = ['binance', 'coinbase', 'kraken'];
        const availablePrices = exchanges.filter(ex => pairPrices[ex]);
        
        if (availablePrices.length < 2) {
            return;
        }
        
        const priceValues = availablePrices.map(ex => pairPrices[ex]);
        const minPrice = Math.min(...priceValues);
        const maxPrice = Math.max(...priceValues);
        const diff = ((maxPrice - minPrice) / minPrice * 100).toFixed(2);
        
        html += `
            <tr>
                <td class="exchange-name">${pair}</td>
                <td class="price-cell">${pairPrices.binance ? '$' + pairPrices.binance.toFixed(2) : '-'}</td>
                <td class="price-cell">${pairPrices.coinbase ? '$' + pairPrices.coinbase.toFixed(2) : '-'}</td>
                <td class="price-cell">${pairPrices.kraken ? '$' + pairPrices.kraken.toFixed(2) : '-'}</td>
                <td class="price-cell" style="color: ${diff > 0.5 ? '#48bb78' : '#666'}">${diff}%</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    pricesTable.innerHTML = html;
}

// Обновление статистики
function updateStats(opportunities) {
    totalOpportunities.textContent = opportunities.length;
    
    if (opportunities.length > 0) {
        const maxProfitValue = Math.max(...opportunities.map(opp => parseFloat(opp.profitPercent)));
        maxProfit.textContent = `${maxProfitValue.toFixed(2)}%`;
    } else {
        maxProfit.textContent = '0%';
    }
}

// Получение названия биржи
function getExchangeName(exchange) {
    const names = {
        'binance': 'Binance',
        'coinbase': 'Coinbase Pro',
        'kraken': 'Kraken'
    };
    return names[exchange] || exchange;
}

// Переключение автообновления
function toggleAutoRefresh() {
    isAutoRefresh = !isAutoRefresh;
    
    if (isAutoRefresh) {
        autoRefreshBtn.textContent = '⏸️ Автообновление';
        autoRefreshBtn.classList.remove('paused');
        autoRefreshInterval = setInterval(loadData, 10000); // Обновление каждые 10 секунд
    } else {
        autoRefreshBtn.textContent = '▶️ Автообновление';
        autoRefreshBtn.classList.add('paused');
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }
}

