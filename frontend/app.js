const API_BASE = '/api';

let mainChartInstance = null;
let compareChartInstance = null;
let allCompanies = [];
let currentSymbol = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    await fetchCompanies();
    setupEventListeners();
    
    // Select first company by default
    if (allCompanies.length > 0) {
        selectCompany(allCompanies[0].symbol, allCompanies[0].name);
    }
}

async function fetchCompanies() {
    try {
        const res = await fetch(`${API_BASE}/companies`);
        allCompanies = await res.json();
        renderCompanyList(allCompanies);
        populateCompareSelects();
    } catch (e) {
        console.error("Error fetching companies:", e);
    }
}

function renderCompanyList(list) {
    const ul = document.getElementById('company-ul');
    ul.innerHTML = '';
    list.forEach(c => {
        const li = document.createElement('li');
        let rawSymbol = c.symbol;
        let cleanSym = rawSymbol;
        let tag = '';
        if (rawSymbol.endsWith('.NS')) { cleanSym = rawSymbol.replace('.NS', ''); tag = 'NSE'; }
        else if (rawSymbol.endsWith('.BO')) { cleanSym = rawSymbol.replace('.BO', ''); tag = 'BSE'; }
        else { tag = rawSymbol; }

        li.innerHTML = `<span class="company-name">${c.name}</span><div style="display:flex; gap:4px; align-items:center;"><span style="color:var(--text-secondary); font-size:0.75rem;">${cleanSym}</span><span class="company-symbol" style="background: rgba(59, 130, 246, 0.2); color: #93c5fd; padding: 2px 6px; border-radius: 4px; font-weight:bold; font-size:0.7rem;">${tag}</span></div>`;
        li.dataset.symbol = c.symbol;
        li.onclick = () => selectCompany(c.symbol, c.name);
        ul.appendChild(li);
    });
}

async function selectCompany(symbol, name) {
    currentSymbol = symbol;
    
    let cleanSym = symbol;
    if (symbol.endsWith('.NS')) cleanSym = symbol.replace('.NS', '');
    else if (symbol.endsWith('.BO')) cleanSym = symbol.replace('.BO', '');
    
    document.getElementById('selected-symbol-title').textContent = `${name} (${cleanSym})`;
    
    // Update active class in list
    document.querySelectorAll('#company-ul li').forEach(li => {
        li.classList.toggle('active', li.dataset.symbol === symbol);
    });

    await Promise.all([
        fetchSummary(symbol),
        fetchChartData(symbol)
    ]);
}

async function fetchSummary(symbol) {
    try {
        const res = await fetch(`${API_BASE}/summary/${symbol}`);
        const data = await res.json();
        
        document.getElementById('metric-close').textContent = `₹${data.latest_close.toFixed(2)}`;
        document.getElementById('metric-high').textContent = `₹${data['52_week_high'].toFixed(2)}`;
        document.getElementById('metric-low').textContent = `₹${data['52_week_low'].toFixed(2)}`;
        
        // Volatility logic
        const vol = data.current_volatility;
        document.getElementById('metric-volatility').textContent = isNaN(vol) ? '--' : vol.toFixed(4);
    } catch (e) {
        console.error(e);
    }
}

async function fetchChartData(symbol) {
    try {
        // Fetch Historical
        const resData = await fetch(`${API_BASE}/data/${symbol}`);
        const history = await resData.json();
        
        // Fetch Prediction
        const resPred = await fetch(`${API_BASE}/predict/${symbol}`);
        const prediction = await resPred.json();
        
        renderMainChart(history, prediction);
    } catch (e) {
        console.error(e);
    }
}

function renderMainChart(history, prediction) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    if (mainChartInstance) {
        mainChartInstance.destroy();
    }
    
    const labels = history.map(d => d.Date);
    const closeData = history.map(d => d.Close);
    const maData = history.map(d => d['7-day MA']);

    // Map prediction to future labels
    const predLabels = prediction.map(p => p.date);
    const predData = prediction.map(p => p.predicted_close);
    
    // We pad the prediction array with nulls so it aligns properly, or we can just chart it natively
    // A better approach is building a unified timeline
    const allLabels = [...labels, ...predLabels];
    
    const paddedCloseData = [...closeData, ...Array(predLabels.length).fill(null)];
    const paddedMaData = [...maData, ...Array(predLabels.length).fill(null)];
    
    const paddedPredData = [...Array(labels.length - 1).fill(null)];
    // connect last point
    if (closeData.length > 0) {
        paddedPredData.push(closeData[closeData.length - 1]);
    }
    paddedPredData.push(...predData);

    mainChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: allLabels,
            datasets: [
                {
                    label: 'Actual Close',
                    data: paddedCloseData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                },
                {
                    label: '7-Day MA',
                    data: paddedMaData,
                    borderColor: '#10b981',
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    tension: 0.3,
                    pointRadius: 0
                },
                {
                    label: 'ML Prediction (Next 5 Days)',
                    data: paddedPredData,
                    borderColor: '#f59e0b',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.3,
                    pointBackgroundColor: '#f59e0b'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            color: '#94a3b8',
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } }
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    labels: { color: '#f8fafc' }
                }
            }
        }
    });
}

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');
    let searchDebounce;

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        const filtered = allCompanies.filter(c => 
            c.name.toLowerCase().includes(term) || c.symbol.toLowerCase().includes(term)
        );
        renderCompanyList(filtered);

        clearTimeout(searchDebounce);
        if (!term) {
            searchResults.style.display = 'none';
            return;
        }

        searchDebounce = setTimeout(async () => {
            try {
                const res = await fetch(`${API_BASE}/search?q=${term}`);
                const items = await res.json();
                if (items && items.length > 0) {
                    searchResults.innerHTML = '';
                    items.forEach(item => {
                        const div = document.createElement('div');
                        let rawSymbol = item.symbol;
                        let cleanSym = rawSymbol;
                        let tag = '';
                        if (rawSymbol.endsWith('.NS')) {
                            cleanSym = rawSymbol.replace('.NS', '');
                            tag = 'NSE';
                        } else if (rawSymbol.endsWith('.BO')) {
                            cleanSym = rawSymbol.replace('.BO', '');
                            tag = 'BSE';
                        } else {
                            tag = rawSymbol;
                        }

                        div.innerHTML = `<span>${item.name} <span style="color:var(--text-secondary); font-size:0.8em; margin-left:4px;">${cleanSym}</span></span> <span class="company-symbol" style="background: rgba(59, 130, 246, 0.2); color: #93c5fd; padding: 2px 6px; border-radius: 4px; font-weight:bold; font-size:0.7rem;">${tag}</span>`;
                        div.onclick = () => {
                            searchInput.value = '';
                            searchResults.style.display = 'none';
                            if (!allCompanies.find(c => c.symbol === item.symbol)) {
                                allCompanies.unshift({ symbol: item.symbol, name: item.name });
                                renderCompanyList(allCompanies);
                            }
                            document.getElementById('selected-symbol-title').textContent = `Loading ${item.symbol}...`;
                            selectCompany(item.symbol, item.name);
                            // Also trigger watchlist highlighting
                            document.querySelectorAll('#company-ul li').forEach(li => {
                                li.classList.toggle('active', li.dataset.symbol === item.symbol);
                            });
                        };
                        searchResults.appendChild(div);
                    });
                    searchResults.style.display = 'flex';
                } else {
                    searchResults.style.display = 'none';
                }
            } catch (err) {
                console.error(err);
            }
        }, 400);
    });
    
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });

    searchInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const term = e.target.value.trim().toUpperCase();
            if (!term) return;
            
            let symbol = term;
            // Append .NS (NSE) if no extension is provided
            if (!symbol.includes('.')) {
                symbol += '.NS';
            }
            
            try {
                // Check if we can fetch summary
                document.getElementById('selected-symbol-title').textContent = `Loading ${symbol}...`;
                const res = await fetch(`${API_BASE}/summary/${symbol}`);
                if (!res.ok) {
                    alert(`Could not fetch data for: ${symbol}`);
                    document.getElementById('selected-symbol-title').textContent = currentSymbol;
                    return;
                }
                
                // Add to our watchlist if new
                if (!allCompanies.find(c => c.symbol === symbol)) {
                    allCompanies.unshift({ symbol: symbol, name: term });
                    renderCompanyList(allCompanies);
                }
                
                selectCompany(symbol, term);
                e.target.value = ''; // clear search box
            } catch (err) {
                alert(`Network error fetching: ${symbol}`);
            }
        }
    });

    const compareBtn = document.getElementById('compareBtn');
    const modal = document.getElementById('compareModal');
    const cancelBtn = document.getElementById('cancelCompare');
    
    compareBtn.onclick = () => { modal.classList.add('active'); };
    cancelBtn.onclick = () => { modal.classList.remove('active'); };

    document.getElementById('runCompare').onclick = async () => {
        const s1 = document.getElementById('compareStock1').value;
        const s2 = document.getElementById('compareStock2').value;
        if (s1 === s2) return alert("Select different stocks");
        
        const res = await fetch(`${API_BASE}/compare?symbol1=${s1}&symbol2=${s2}`);
        const data = await res.json();
        renderCompareChart(s1, s2, data[s1], data[s2]);
    };
}

function populateCompareSelects() {
    const s1 = document.getElementById('compareStock1');
    const s2 = document.getElementById('compareStock2');
    
    allCompanies.forEach((c, idx) => {
        s1.add(new Option(c.name, c.symbol));
        s2.add(new Option(c.name, c.symbol));
    });
    if (allCompanies.length > 1) {
        s2.selectedIndex = 1;
    }
}

function renderCompareChart(sym1, sym2, data1, data2) {
    const container = document.querySelector('.compare-chart-container');
    container.style.display = 'block';
    
    const ctx = document.getElementById('compareChart').getContext('2d');
    if (compareChartInstance) compareChartInstance.destroy();
    
    // Normalize logic for percentage change from start
    const start1 = data1[0].Close;
    const start2 = data2[0].Close;
    
    const labels = data1.map(d => d.Date); // Assumes aligned dates!
    
    const normData1 = data1.map(d => ((d.Close - start1) / start1) * 100);
    const normData2 = data2.map(d => ((d.Close - start2) / start2) * 100);

    compareChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: sym1 + ' (% Change)', data: normData1, borderColor: '#3b82f6', tension: 0.3 },
                { label: sym2 + ' (% Change)', data: normData2, borderColor: '#ef4444', tension: 0.3 }
            ]
        },
        options: {
            responsive: true,
            color: '#94a3b8',
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.05)' } },
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } }
            }
        }
    });
}
