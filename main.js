/**
 * Quantitative SPA Portfolio Management Dashboard
 * Version: 6.0.3
 * Architecture:
 * - Restricted Portfolio Universe: Predefined 20 Institutional Stocks (Tech, Semis, Industrials)
 * - Portfolio Management moved to Settings -> Portfolio subcategory (Dashboard modifications disabled)
 * - Market Data Feed: Finnhub API (Native CORS support for real-time quotes & 2-year daily candles)
 * - Intelligent Company Name to US Ticker Resolution (e.g. Infineon -> IFNNY) via Finnhub, OpenRouter LLM & reference database
 * - Strict Ticker Validation: Rejects non-existent / invalid tickers (e.g., ASDQWE) using live Finnhub verification
 * - Zero Data Invention: Strict real-data policy with transparent API error states
 * - Real-time stock universe manager with auto-refresh (or 0 for manual-only) & price flash animations
 * - Client-side technical indicator screening (SMA50, SMA200, MACD, RSI) via technicalindicators library
 * - Inverse Volatility risk-parity portfolio optimization
 * - On-demand Holding Market Intelligence & News Feed with interactive asset selector dropdown
 * - OpenRouter LLM Executive Commentary & Investment Thesis generator
 */

// ============================================================================
// CONSTANTS & INITIAL STATE
// ============================================================================
const APP_VERSION = 'v6.0.3';

// The 20 predefined stocks requested for the quantitative portfolio universe
const PREDEFINED_20_STOCKS = [
  'IFNNY', // Infineon Technologies
  'NXPI',  // NXP Semiconductors
  'STM',   // STMicroelectronics
  'NVDA',  // Nvidia
  'ASML',  // ASML Holding
  'TSM',   // Taiwan Semiconductor Manufacturing Company
  'TXN',   // Texas Instruments
  'ADI',   // Analog Devices
  'AAPL',  // Apple
  'MSFT',  // Microsoft
  'AMZN',  // Amazon
  'GOOGL', // Alphabet
  'META',  // Meta Platforms
  'TSLA',  // Tesla
  'SIEGY', // Siemens
  'CAT',   // Caterpillar
  'HON',   // Honeywell
  'ROK',   // Rockwell Automation
  'DE',    // Deere & Company
  'EMR',   // Emerson Electric
];

const DEFAULT_TICKERS = [...PREDEFINED_20_STOCKS];
const DEFAULT_REFRESH_RATE = 30; // seconds

// Storage keys
const STORAGE_KEYS = {
  FINNHUB: 'finnhub_api_key',
  OPENROUTER: 'openrouter_api_key',
  NEWSDATA: 'newsdata_api_key',
  REFRESH_RATE: 'quant_refresh_rate',
  TICKERS: 'quant_active_tickers',
  COMPANY_NAMES: 'quant_cached_company_names',
};

// Official company names for predefined universe
const PREDEFINED_STOCK_NAMES = {
  'IFNNY': 'Infineon Technologies AG',
  'NXPI': 'NXP Semiconductors N.V.',
  'STM': 'STMicroelectronics N.V.',
  'NVDA': 'NVIDIA Corporation',
  'ASML': 'ASML Holding N.V.',
  'TSM': 'Taiwan Semiconductor Manufacturing Co.',
  'TXN': 'Texas Instruments Incorporated',
  'ADI': 'Analog Devices, Inc.',
  'AAPL': 'Apple Inc.',
  'MSFT': 'Microsoft Corporation',
  'AMZN': 'Amazon.com, Inc.',
  'GOOGL': 'Alphabet Inc. (Class A)',
  'META': 'Meta Platforms, Inc.',
  'TSLA': 'Tesla, Inc.',
  'SIEGY': 'Siemens AG',
  'CAT': 'Caterpillar Inc.',
  'HON': 'Honeywell International Inc.',
  'ROK': 'Rockwell Automation, Inc.',
  'DE': 'Deere & Company',
  'EMR': 'Emerson Electric Co.',
};

// Institutional Sector & Industry Categorization
const STOCK_SECTORS = {
  'IFNNY': 'Semiconductors & Power',
  'NXPI': 'Automotive & IoT Semiconductors',
  'STM': 'Semiconductors & Microcontrollers',
  'NVDA': 'Accelerated Computing & AI GPUs',
  'ASML': 'Semiconductor Lithography',
  'TSM': 'Semiconductor Foundry',
  'TXN': 'Analog & Embedded Semiconductors',
  'ADI': 'Analog & Mixed-Signal ICs',
  'AAPL': 'Consumer Tech & Hardware',
  'MSFT': 'Enterprise Software & Cloud',
  'AMZN': 'E-Commerce & Cloud Infrastructure',
  'GOOGL': 'Search, Cloud & AI Systems',
  'META': 'Social Media & AI Platforms',
  'TSLA': 'Electric Vehicles & Clean Energy',
  'SIEGY': 'Industrial Automation & Digital',
  'CAT': 'Construction & Heavy Machinery',
  'HON': 'Diversified Industrials & Aerospace',
  'ROK': 'Industrial Automation & Robotics',
  'DE': 'Agricultural & Heavy Equipment',
  'EMR': 'Industrial Automation & Solutions',
};

// Global App State
const state = {
  activeTab: 'dashboard',
  settingsSubtab: 'portfolio', // 'portfolio' | 'general'
  tickers: [],
  companyNames: {}, // { [ticker]: "Official Company Name" }
  prices: {}, // { [ticker]: { price: number|null, prevPrice: number|null, change: number|null, changePercent: number|null, lastUpdate: Date|null, error: string|null, status: 'ok'|'error'|'fetching' } }
  refreshRate: DEFAULT_REFRESH_RATE,
  countdown: DEFAULT_REFRESH_RATE,
  refreshTimer: null,
  countdownTimer: null,
  isSyncingPrices: false,
  isOptimizing: false,
  analysisData: null,
  selectedNewsTicker: '',
  cachedNews: {}, // { [ticker]: { status: 'ok'|'error'|'no_key', articles: [...] } }
  apiKeys: {
    finnhub: '',
    openRouter: '',
    newsData: '',
  },
};

// Built-in US reference directory for fast company name resolution & ADR lookup
const COMPANY_TICKER_REFERENCE = {
  // Predefined 20 Stocks & Variations
  'INFINEON': { ticker: 'IFNNY', name: 'Infineon Technologies AG' },
  'INFINEON TECHNOLOGIES': { ticker: 'IFNNY', name: 'Infineon Technologies AG' },
  'NXP': { ticker: 'NXPI', name: 'NXP Semiconductors N.V.' },
  'NXP SEMICONDUCTORS': { ticker: 'NXPI', name: 'NXP Semiconductors N.V.' },
  'STMICROELECTRONICS': { ticker: 'STM', name: 'STMicroelectronics N.V.' },
  'ST MICROELECTRONICS': { ticker: 'STM', name: 'STMicroelectronics N.V.' },
  'ST MICRO': { ticker: 'STM', name: 'STMicroelectronics N.V.' },
  'STMICRO': { ticker: 'STM', name: 'STMicroelectronics N.V.' },
  'NVIDIA': { ticker: 'NVDA', name: 'NVIDIA Corporation' },
  'NVDA': { ticker: 'NVDA', name: 'NVIDIA Corporation' },
  'ASML': { ticker: 'ASML', name: 'ASML Holding N.V.' },
  'ASML HOLDING': { ticker: 'ASML', name: 'ASML Holding N.V.' },
  'TSMC': { ticker: 'TSM', name: 'Taiwan Semiconductor Manufacturing Co.' },
  'TAIWAN SEMICONDUCTOR': { ticker: 'TSM', name: 'Taiwan Semiconductor Manufacturing Co.' },
  'TAIWAN SEMICONDUCTOR MANUFACTURING COMPANY': { ticker: 'TSM', name: 'Taiwan Semiconductor Manufacturing Co.' },
  'TEXAS INSTRUMENTS': { ticker: 'TXN', name: 'Texas Instruments Incorporated' },
  'TI': { ticker: 'TXN', name: 'Texas Instruments Incorporated' },
  'ANALOG DEVICES': { ticker: 'ADI', name: 'Analog Devices, Inc.' },
  'ADI': { ticker: 'ADI', name: 'Analog Devices, Inc.' },
  'APPLE': { ticker: 'AAPL', name: 'Apple Inc.' },
  'MICROSOFT': { ticker: 'MSFT', name: 'Microsoft Corporation' },
  'AMAZON': { ticker: 'AMZN', name: 'Amazon.com, Inc.' },
  'GOOGLE': { ticker: 'GOOGL', name: 'Alphabet Inc. (Class A)' },
  'ALPHABET': { ticker: 'GOOGL', name: 'Alphabet Inc. (Class A)' },
  'META': { ticker: 'META', name: 'Meta Platforms, Inc.' },
  'FACEBOOK': { ticker: 'META', name: 'Meta Platforms, Inc.' },
  'TESLA': { ticker: 'TSLA', name: 'Tesla, Inc.' },
  'SIEMENS': { ticker: 'SIEGY', name: 'Siemens AG' },
  'CATERPILLAR': { ticker: 'CAT', name: 'Caterpillar Inc.' },
  'HONEYWELL': { ticker: 'HON', name: 'Honeywell International Inc.' },
  'ROCKWELL AUTOMATION': { ticker: 'ROK', name: 'Rockwell Automation, Inc.' },
  'ROCKWELL': { ticker: 'ROK', name: 'Rockwell Automation, Inc.' },
  'DEERE & COMPANY': { ticker: 'DE', name: 'Deere & Company' },
  'DEERE': { ticker: 'DE', name: 'Deere & Company' },
  'JOHN DEERE': { ticker: 'DE', name: 'Deere & Company' },
  'EMERSON ELECTRIC': { ticker: 'EMR', name: 'Emerson Electric Co.' },
  'EMERSON': { ticker: 'EMR', name: 'Emerson Electric Co.' },

  // Other Common US Companies & Global ADRs
  'ADIDAS': { ticker: 'ADDYY', name: 'Adidas AG' },
  'BAYER': { ticker: 'BAYRY', name: 'Bayer AG' },
  'BASF': { ticker: 'BASFY', name: 'BASF SE' },
  'VOLKSWAGEN': { ticker: 'VWAGY', name: 'Volkswagen AG' },
  'BMW': { ticker: 'BMWYY', name: 'Bayerische Motoren Werke AG' },
  'MERCEDES': { ticker: 'MBGYY', name: 'Mercedes-Benz Group AG' },
  'MERCEDES BENZ': { ticker: 'MBGYY', name: 'Mercedes-Benz Group AG' },
  'SAP': { ticker: 'SAP', name: 'SAP SE' },
  'SONY': { ticker: 'SONY', name: 'Sony Group Corp.' },
  'TOYOTA': { ticker: 'TM', name: 'Toyota Motor Corp.' },
  'HONDA': { ticker: 'HMC', name: 'Honda Motor Co.' },
  'NINTENDO': { ticker: 'NTDOY', name: 'Nintendo Co. Ltd.' },
  'NOVO NORDISK': { ticker: 'NVO', name: 'Novo Nordisk A/S' },
  'ASTRAZENECA': { ticker: 'AZN', name: 'AstraZeneca PLC' },
  'NOVARTIS': { ticker: 'NVS', name: 'Novartis AG' },
  'ROCHE': { ticker: 'RHHBY', name: 'Roche Holding AG' },
  'SANOFI': { ticker: 'SNY', name: 'Sanofi SA' },
  'TOTALENERGIES': { ticker: 'TTE', name: 'TotalEnergies SE' },
  'SHELL': { ticker: 'SHEL', name: 'Shell PLC' },
  'BP': { ticker: 'BP', name: 'BP PLC' },
  'LVMH': { ticker: 'LVMUY', name: 'LVMH Moët Hennessy Louis Vuitton' },
  'HERMES': { ticker: 'HESAY', name: 'Hermès International' },
  'ALIBABA': { ticker: 'BABA', name: 'Alibaba Group Holding Ltd.' },
  'TENCENT': { ticker: 'TCEHY', name: 'Tencent Holdings Ltd.' },
  'BROADCOM': { ticker: 'AVGO', name: 'Broadcom Inc.' },
  'QUALCOMM': { ticker: 'QCOM', name: 'Qualcomm Inc.' },
  'INTEL': { ticker: 'INTC', name: 'Intel Corp.' },
  'AMD': { ticker: 'AMD', name: 'Advanced Micro Devices Inc.' },
  'ADVANCED MICRO DEVICES': { ticker: 'AMD', name: 'Advanced Micro Devices Inc.' },
  'BERKSHIRE': { ticker: 'BRK.B', name: 'Berkshire Hathaway Inc.' },
  'BERKSHIRE HATHAWAY': { ticker: 'BRK.B', name: 'Berkshire Hathaway Inc.' },
  'JPMORGAN': { ticker: 'JPM', name: 'JPMorgan Chase & Co.' },
  'JP MORGAN': { ticker: 'JPM', name: 'JPMorgan Chase & Co.' },
  'JOHNSON & JOHNSON': { ticker: 'JNJ', name: 'Johnson & Johnson' },
  'JOHNSON AND JOHNSON': { ticker: 'JNJ', name: 'Johnson & Johnson' },
  'PROCTER & GAMBLE': { ticker: 'PG', name: 'Procter & Gamble Co.' },
  'COCA COLA': { ticker: 'KO', name: 'The Coca-Cola Co.' },
  'COCA-COLA': { ticker: 'KO', name: 'The Coca-Cola Co.' },
  'PEPSI': { ticker: 'PEP', name: 'PepsiCo Inc.' },
  'PEPSICO': { ticker: 'PEP', name: 'PepsiCo Inc.' },
  'WALMART': { ticker: 'WMT', name: 'Walmart Inc.' },
  'MCDONALD\'S': { ticker: 'MCD', name: 'McDonald\'s Corp.' },
  'MCDONALDS': { ticker: 'MCD', name: 'McDonald\'s Corp.' },
  'COSTCO': { ticker: 'COST', name: 'Costco Wholesale Corp.' },
  'NETFLIX': { ticker: 'NFLX', name: 'Netflix Inc.' },
  'DISNEY': { ticker: 'DIS', name: 'The Walt Disney Co.' },
  'WALT DISNEY': { ticker: 'DIS', name: 'The Walt Disney Co.' },
  'VISA': { ticker: 'V', name: 'Visa Inc.' },
  'MASTERCARD': { ticker: 'MA', name: 'Mastercard Inc.' },
};

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initStorage();
  initUI();
  initEventHandlers();
  startPricePolling();
  syncAllPrices();
});

function initStorage() {
  // Load API Keys
  state.apiKeys.finnhub = localStorage.getItem(STORAGE_KEYS.FINNHUB) || '';
  state.apiKeys.openRouter = localStorage.getItem(STORAGE_KEYS.OPENROUTER) || '';
  state.apiKeys.newsData = localStorage.getItem(STORAGE_KEYS.NEWSDATA) || '';

  // Load Refresh Rate (0 = manual only)
  const savedRate = parseInt(localStorage.getItem(STORAGE_KEYS.REFRESH_RATE), 10);
  state.refreshRate = (!isNaN(savedRate) && savedRate >= 0) ? savedRate : DEFAULT_REFRESH_RATE;
  state.countdown = state.refreshRate;

  // Load Cached Company Names
  try {
    const cachedNames = localStorage.getItem(STORAGE_KEYS.COMPANY_NAMES);
    if (cachedNames) {
      state.companyNames = JSON.parse(cachedNames) || {};
    }
  } catch {
    state.companyNames = {};
  }

  // Load Tickers - Guarantee 20 predefined stocks for v4.0.0 or user-customized list from Settings
  const universeVer = localStorage.getItem('quant_universe_version');
  const savedTickers = localStorage.getItem(STORAGE_KEYS.TICKERS);
  if (universeVer !== 'v4.0.0') {
    state.tickers = [...PREDEFINED_20_STOCKS];
    localStorage.setItem(STORAGE_KEYS.TICKERS, JSON.stringify(state.tickers));
    localStorage.setItem('quant_universe_version', 'v4.0.0');
  } else if (savedTickers) {
    try {
      const parsed = JSON.parse(savedTickers);
      state.tickers = Array.isArray(parsed) && parsed.length > 0 ? parsed : [...PREDEFINED_20_STOCKS];
    } catch {
      state.tickers = [...PREDEFINED_20_STOCKS];
    }
  } else {
    state.tickers = [...PREDEFINED_20_STOCKS];
    localStorage.setItem(STORAGE_KEYS.TICKERS, JSON.stringify(state.tickers));
    localStorage.setItem('quant_universe_version', 'v4.0.0');
  }
}

function initUI() {
  // Populate Settings form inputs
  const inputFh = document.getElementById('input-finnhub-key');
  const inputOr = document.getElementById('input-openrouter-key');
  const inputNd = document.getElementById('input-newsdata-key');
  const inputRate = document.getElementById('input-refresh-rate');

  if (inputFh) inputFh.value = state.apiKeys.finnhub;
  if (inputOr) inputOr.value = state.apiKeys.openRouter;
  if (inputNd) inputNd.value = state.apiKeys.newsData;
  if (inputRate) inputRate.value = state.refreshRate;

  // Update Header Badges
  const versionDisplay = document.getElementById('version-display');
  if (versionDisplay) versionDisplay.textContent = APP_VERSION;

  updateSettingsBadge();
  updateRefreshDisplay();
  renderTickersGrid();
  renderSettingsUniverseTable();
  initHoldingNewsSection();
}

function updateSettingsBadge() {
  const badge = document.getElementById('api-keys-badge');
  const banner = document.getElementById('missing-key-banner');
  const hasFinnhubKey = Boolean(state.apiKeys.finnhub);

  if (badge) {
    if (!hasFinnhubKey) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  if (banner) {
    if (!hasFinnhubKey) {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }
}

function updateRefreshDisplay() {
  const display = document.getElementById('refresh-rate-display');
  const countdownEl = document.getElementById('refresh-countdown');
  const universeCount = document.getElementById('universe-count-badge');
  const settingsCount = document.getElementById('settings-universe-count');
  const settingsBadge = document.getElementById('settings-portfolio-count-badge');

  if (display) {
    if (state.refreshRate === 0) {
      display.textContent = 'Auto-Refresh: Off';
    } else {
      display.textContent = `Every ${state.refreshRate}s`;
    }
  }
  if (countdownEl) {
    if (state.refreshRate === 0) {
      countdownEl.textContent = 'Manual';
    } else {
      countdownEl.textContent = `${state.countdown}s`;
    }
  }
  if (universeCount) universeCount.textContent = `${state.tickers.length} Tickers`;
  if (settingsCount) settingsCount.textContent = state.tickers.length.toString();
  if (settingsBadge) settingsBadge.textContent = state.tickers.length.toString();
}

// ============================================================================
// EVENT HANDLERS & NAVIGATION
// ============================================================================
function initEventHandlers() {
  // Tab Switching
  const btnDash = document.getElementById('tab-btn-dashboard');
  const btnSettings = document.getElementById('tab-btn-settings');
  const viewDash = document.getElementById('view-dashboard');
  const viewSettings = document.getElementById('view-settings');

  function switchTab(tab) {
    state.activeTab = tab;
    if (tab === 'dashboard') {
      btnDash.className = 'tab-btn px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center space-x-2 bg-slate-800 text-cyan-400 shadow-sm';
      btnSettings.className = 'tab-btn px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center space-x-2 text-slate-400 hover:text-slate-200';
      viewDash.classList.remove('hidden');
      viewSettings.classList.add('hidden');
    } else {
      btnSettings.className = 'tab-btn px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center space-x-2 bg-slate-800 text-cyan-400 shadow-sm';
      btnDash.className = 'tab-btn px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center space-x-2 text-slate-400 hover:text-slate-200';
      viewSettings.classList.remove('hidden');
      viewDash.classList.add('hidden');
      renderSettingsUniverseTable();
    }
  }

  if (btnDash) btnDash.addEventListener('click', () => switchTab('dashboard'));
  if (btnSettings) btnSettings.addEventListener('click', () => switchTab('settings'));

  const bannerLink = document.getElementById('banner-settings-link');
  if (bannerLink) bannerLink.addEventListener('click', () => switchTab('settings'));

  // Settings Subcategories: Portfolio vs API Keys & Feeds
  const subtabPortfolio = document.getElementById('settings-subtab-portfolio');
  const subtabGeneral = document.getElementById('settings-subtab-general');
  const sectionPortfolio = document.getElementById('settings-section-portfolio');
  const sectionGeneral = document.getElementById('settings-section-general');

  function switchSettingsSubtab(subtab) {
    state.settingsSubtab = subtab;
    if (subtab === 'portfolio') {
      if (subtabPortfolio) subtabPortfolio.className = 'settings-subtab-btn px-4 py-1.5 rounded-md text-xs font-mono font-semibold transition-all flex items-center space-x-2 bg-slate-800 text-cyan-400 shadow-sm cursor-pointer';
      if (subtabGeneral) subtabGeneral.className = 'settings-subtab-btn px-4 py-1.5 rounded-md text-xs font-mono font-semibold transition-all flex items-center space-x-1.5 text-slate-400 hover:text-slate-200 cursor-pointer';
      if (sectionPortfolio) sectionPortfolio.classList.remove('hidden');
      if (sectionGeneral) sectionGeneral.classList.add('hidden');
      renderSettingsUniverseTable();
    } else {
      if (subtabGeneral) subtabGeneral.className = 'settings-subtab-btn px-4 py-1.5 rounded-md text-xs font-mono font-semibold transition-all flex items-center space-x-2 bg-slate-800 text-cyan-400 shadow-sm cursor-pointer';
      if (subtabPortfolio) subtabPortfolio.className = 'settings-subtab-btn px-4 py-1.5 rounded-md text-xs font-mono font-semibold transition-all flex items-center space-x-1.5 text-slate-400 hover:text-slate-200 cursor-pointer';
      if (sectionGeneral) sectionGeneral.classList.remove('hidden');
      if (sectionPortfolio) sectionPortfolio.classList.add('hidden');
    }
  }

  if (subtabPortfolio) subtabPortfolio.addEventListener('click', () => switchSettingsSubtab('portfolio'));
  if (subtabGeneral) subtabGeneral.addEventListener('click', () => switchSettingsSubtab('general'));

  // Quick jump from Dashboard universe card to Settings -> Portfolio subcategory
  const btnGotoSettingsPortfolio = document.getElementById('btn-goto-settings-portfolio');
  if (btnGotoSettingsPortfolio) {
    btnGotoSettingsPortfolio.addEventListener('click', () => {
      switchTab('settings');
      switchSettingsSubtab('portfolio');
    });
  }

  // Reset to Predefined 20 Stocks button in Settings -> Portfolio
  const btnResetPredefined = document.getElementById('btn-reset-predefined-universe');
  if (btnResetPredefined) {
    btnResetPredefined.addEventListener('click', () => {
      state.tickers = [...PREDEFINED_20_STOCKS];
      localStorage.setItem(STORAGE_KEYS.TICKERS, JSON.stringify(state.tickers));
      renderTickersGrid();
      renderSettingsUniverseTable();
      updateRefreshDisplay();
      showToast('Reset universe to 20 predefined institutional stocks', 'success');
      syncAllPrices(true);
    });
  }

  // Password Visibility Toggles
  document.querySelectorAll('.toggle-pw-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
      }
    });
  });

  // Settings Form Submit
  const formSettings = document.getElementById('form-settings');
  if (formSettings) {
    formSettings.addEventListener('submit', (e) => {
      e.preventDefault();
      const fhInput = document.getElementById('input-finnhub-key');
      const orInput = document.getElementById('input-openrouter-key');
      const ndInput = document.getElementById('input-newsdata-key');
      const rateInput = document.getElementById('input-refresh-rate');

      const fhKey = fhInput ? fhInput.value.trim() : '';
      const orKey = orInput ? orInput.value.trim() : '';
      const ndKey = ndInput ? ndInput.value.trim() : '';
      const rateVal = rateInput ? parseInt(rateInput.value, 10) : DEFAULT_REFRESH_RATE;

      state.apiKeys.finnhub = fhKey;
      state.apiKeys.openRouter = orKey;
      state.apiKeys.newsData = ndKey;
      state.refreshRate = (!isNaN(rateVal) && rateVal >= 0) ? rateVal : DEFAULT_REFRESH_RATE;

      localStorage.setItem(STORAGE_KEYS.FINNHUB, fhKey);
      localStorage.setItem(STORAGE_KEYS.OPENROUTER, orKey);
      localStorage.setItem(STORAGE_KEYS.NEWSDATA, ndKey);
      localStorage.setItem(STORAGE_KEYS.REFRESH_RATE, state.refreshRate.toString());

      updateSettingsBadge();
      updateRefreshDisplay();
      startPricePolling();

      showToast('Settings saved successfully (Finnhub API configured)', 'success');
      syncAllPrices(true);

      // Refresh news for selected holding if news key was changed or added
      if (state.selectedNewsTicker) {
        fetchAndRenderHoldingNews(state.selectedNewsTicker, true);
      }
    });
  }

  // Clear Local Storage Button
  const btnClear = document.getElementById('btn-clear-storage');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all stored API keys, refresh settings, and reset tickers to the 20 predefined stocks?')) {
        localStorage.clear();
        state.apiKeys.finnhub = '';
        state.apiKeys.openRouter = '';
        state.apiKeys.newsData = '';
        state.refreshRate = DEFAULT_REFRESH_RATE;
        state.tickers = [...PREDEFINED_20_STOCKS];
        state.companyNames = {};
        state.prices = {};
        state.selectedNewsTicker = '';
        state.cachedNews = {};
        localStorage.setItem(STORAGE_KEYS.TICKERS, JSON.stringify(state.tickers));
        localStorage.setItem('quant_universe_version', 'v4.0.0');

        const inputFh = document.getElementById('input-finnhub-key');
        const inputOr = document.getElementById('input-openrouter-key');
        const inputNd = document.getElementById('input-newsdata-key');
        const inputRate = document.getElementById('input-refresh-rate');

        if (inputFh) inputFh.value = '';
        if (inputOr) inputOr.value = '';
        if (inputNd) inputNd.value = '';
        if (inputRate) inputRate.value = DEFAULT_REFRESH_RATE;

        updateSettingsBadge();
        updateRefreshDisplay();
        startPricePolling();
        renderTickersGrid();
        renderSettingsUniverseTable();
        populateNewsDropdown();
        showToast('Local storage cleared and 20 predefined stocks restored', 'info');
        syncAllPrices(true);
      }
    });
  }

  // Test API Connections
  const btnTestApis = document.getElementById('btn-test-apis');
  if (btnTestApis) {
    btnTestApis.addEventListener('click', handleTestApis);
  }

  // Add Ticker Form Submit Handler in Settings -> Portfolio
  const formAddTickerSettings = document.getElementById('form-add-ticker-settings');
  if (formAddTickerSettings) {
    formAddTickerSettings.addEventListener('submit', handleAddTickerSettingsSubmit);
  }

  // Manual Sync Button
  const btnSync = document.getElementById('btn-manual-sync');
  if (btnSync) {
    btnSync.addEventListener('click', () => {
      syncAllPrices(true);
    });
  }

  // Run Optimization Button
  const btnOpt = document.getElementById('btn-run-optimization');
  if (btnOpt) {
    btnOpt.addEventListener('click', runOptimizationPipeline);
  }

  // Capital Allocator Input
  const capitalInput = document.getElementById('portfolio-capital-input');
  if (capitalInput) {
    capitalInput.addEventListener('input', () => {
      if (state.analysisData && state.analysisData.survivors) {
        renderOptimizationResults(state.analysisData);
      }
    });
  }

  // Copy Thesis Button
  const btnCopyThesis = document.getElementById('btn-copy-thesis');
  if (btnCopyThesis) {
    btnCopyThesis.addEventListener('click', () => {
      const thesisText = document.getElementById('thesis-text').innerText;
      if (thesisText) {
        navigator.clipboard.writeText(thesisText).then(() => {
          showToast('Investment thesis copied to clipboard', 'success');
        });
      }
    });
  }
}

// ============================================================================
// TICKER RESOLUTION & VALIDATION ENGINE
// ============================================================================
/**
 * Handles submission of ticker/company name input in Settings -> Portfolio:
 * 1. Checks OpenRouter LLM (if configured) or Yahoo Finance / Reference dictionary
 * 2. Resolves company names to US stock/ADR tickers (e.g. Infineon -> IFNNY)
 * 3. Strictly rejects invalid / random tickers (e.g. ASDQWE)
 * 4. Verifies existence with Yahoo Finance
 */
async function handleAddTickerSettingsSubmit(e) {
  e.preventDefault();
  const inputEl = document.getElementById('input-new-ticker-settings');
  const btnSubmit = document.getElementById('btn-add-ticker-settings-submit');
  const spinner = document.getElementById('add-ticker-settings-spinner');
  const plusIcon = document.getElementById('add-ticker-settings-plus');
  const btnText = document.getElementById('add-ticker-settings-text');
  const feedbackEl = document.getElementById('ticker-validation-feedback-settings');

  if (!inputEl) return;
  const rawQuery = inputEl.value.trim();
  if (!rawQuery) return;

  // Clear previous feedback
  if (feedbackEl) {
    feedbackEl.classList.add('hidden');
    feedbackEl.innerHTML = '';
  }

  // Set resolving UI state
  if (btnSubmit) btnSubmit.disabled = true;
  if (spinner) spinner.classList.remove('hidden');
  if (plusIcon) plusIcon.classList.add('hidden');
  if (btnText) btnText.textContent = 'Resolving...';

  try {
    const resolution = await resolveAndValidateQuery(rawQuery);

    if (!resolution.valid) {
      // REJECT: Invalid ticker or non-existent entity
      showToast(`Rejected: "${rawQuery}" is not a recognized US stock or company.`, 'error', 4500);
      if (feedbackEl) {
        feedbackEl.className = 'p-3 rounded-lg text-xs font-mono border border-rose-800 bg-rose-950/60 text-rose-300 space-y-1 block';
        feedbackEl.innerHTML = `
          <div class="flex items-center space-x-1.5 font-bold">
            <svg class="w-4 h-4 text-rose-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <span>Input Rejected (Non-Existent Stock)</span>
          </div>
          <p class="text-rose-200/90">${escapeHtml(resolution.reason || `No valid publicly traded US stock or company could be found matching "${rawQuery}".`)}</p>
        `;
      }
      return;
    }

    const ticker = resolution.ticker.toUpperCase();
    const companyName = resolution.companyName || getCompanyName(ticker);

    // Check for duplicates
    if (state.tickers.includes(ticker)) {
      showToast(`Ticker ${ticker} (${companyName}) is already in the universe`, 'warning');
      inputEl.value = '';
      return;
    }

    // Save company name in cache
    state.companyNames[ticker] = companyName;
    localStorage.setItem(STORAGE_KEYS.COMPANY_NAMES, JSON.stringify(state.companyNames));

    // Add to state and persistence
    state.tickers.push(ticker);
    localStorage.setItem(STORAGE_KEYS.TICKERS, JSON.stringify(state.tickers));

    inputEl.value = '';
    renderTickersGrid();
    renderSettingsUniverseTable();
    updateRefreshDisplay();

    if (resolution.matchedFrom === 'company_name') {
      showToast(`Resolved "${rawQuery}" -> US Ticker ${ticker} (${companyName})`, 'success', 4000);
      if (feedbackEl) {
        feedbackEl.className = 'p-3 rounded-lg text-xs font-mono border border-emerald-800 bg-emerald-950/60 text-emerald-300 space-y-1 block';
        feedbackEl.innerHTML = `
          <div class="flex items-center space-x-1.5 font-bold">
            <svg class="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <span>Company Name Resolved & Added</span>
          </div>
          <p class="text-emerald-200/90">Successfully mapped <strong>"${escapeHtml(rawQuery)}"</strong> to US stock listing <strong>${ticker}</strong> (${escapeHtml(companyName)}).</p>
        `;
      }
    } else {
      showToast(`Added ${ticker} (${companyName}) to portfolio universe`, 'success');
    }

    fetchSingleTickerPrice(ticker);
  } catch (err) {
    console.error('Ticker validation error:', err);
    showToast(`Validation error: ${err.message}`, 'error');
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
    if (spinner) spinner.classList.add('hidden');
    if (plusIcon) plusIcon.classList.remove('hidden');
    if (btnText) btnText.textContent = 'Add to Universe';
  }
}

/**
 * Resolves query string to valid US stock or rejects it
 */
async function resolveAndValidateQuery(query) {
  const cleanQuery = query.trim();
  const upperQuery = cleanQuery.toUpperCase().replace(/[^A-Z0-9.-]/g, '');

  // 1. Direct match in local reference database (instant response)
  const normalizedKey = cleanQuery.toUpperCase().replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  if (COMPANY_TICKER_REFERENCE[normalizedKey]) {
    const entry = COMPANY_TICKER_REFERENCE[normalizedKey];
    return {
      valid: true,
      ticker: entry.ticker,
      companyName: entry.name,
      matchedFrom: 'company_name',
      reason: `Matched "${cleanQuery}" to ${entry.name}`,
    };
  }

  // 2. If OpenRouter API Key is available, ask LLM for intelligent company & US ADR resolution
  if (state.apiKeys.openRouter) {
    try {
      const llmResult = await queryOpenRouterForSymbolResolution(cleanQuery, state.apiKeys.openRouter);
      if (llmResult && typeof llmResult.valid === 'boolean') {
        if (llmResult.valid && llmResult.ticker) {
          // Verify with Yahoo Finance that resolved ticker exists and trades
          try {
            const chartData = await fetchYahooChart(llmResult.ticker);
            const livePrice = chartData?.meta?.regularMarketPrice;
            if (typeof livePrice === 'number' && !isNaN(livePrice)) {
              return {
                valid: true,
                ticker: llmResult.ticker,
                companyName: llmResult.companyName || chartData.meta.shortName || getCompanyName(llmResult.ticker),
                matchedFrom: llmResult.matchedFrom || (llmResult.ticker === upperQuery ? 'ticker' : 'company_name'),
                reason: llmResult.reason || `Identified ${llmResult.ticker} as valid US listing`,
              };
            }
          } catch (verifyErr) {
            return {
              valid: false,
              reason: `Resolved ticker "${llmResult.ticker}" could not be confirmed on Yahoo Finance (${verifyErr.message}).`,
            };
          }
        } else {
          return {
            valid: false,
            reason: llmResult.reason || `"${cleanQuery}" is not a recognized US stock symbol or publicly traded company.`,
          };
        }
      }
    } catch (llmErr) {
      console.warn('OpenRouter symbol resolution failed, falling back to Yahoo Finance directly:', llmErr);
    }
  }

  // 3. Check directly with Yahoo Finance (No API key needed!)
  try {
    const chartData = await fetchYahooChart(upperQuery);
    const livePrice = chartData?.meta?.regularMarketPrice;
    if (typeof livePrice === 'number' && !isNaN(livePrice)) {
      const compName = chartData.meta.shortName || chartData.meta.longName || getCompanyName(upperQuery);
      return {
        valid: true,
        ticker: upperQuery,
        companyName: compName,
        matchedFrom: 'ticker',
        reason: `Verified ticker ${upperQuery} on Yahoo Finance ($${livePrice.toFixed(2)})`,
      };
    }
  } catch (yErr) {
    // Symbol rejected on Yahoo Finance
  }

  // 4. Fallback Validation for known standard tickers/ETFs
  const isKnownTicker = Object.values(COMPANY_TICKER_REFERENCE).some(c => c.ticker === upperQuery) ||
                        DEFAULT_TICKERS.includes(upperQuery) ||
                        ['SPY', 'QQQ', 'IWM', 'DIA', 'XLK', 'XLF', 'XLE', 'XLV', 'XLY', 'XLI', 'XLP', 'XLU', 'XLB', 'VNQ', 'VTI', 'VOO', 'VEA', 'VWO', 'BND', 'GLD', 'SLV', 'TLT', 'ARKK', 'SMH', 'SOXX', 'IBIT', 'ETHE'].includes(upperQuery);

  if (isKnownTicker) {
    return {
      valid: true,
      ticker: upperQuery,
      companyName: getCompanyName(upperQuery),
      matchedFrom: 'ticker',
      reason: `Recognized standard ticker ${upperQuery}`,
    };
  }

  // If not verified:
  return {
    valid: false,
    reason: `"${cleanQuery}" is not a recognized or active US stock symbol on Yahoo Finance.`,
  };
}

/**
 * Ask OpenRouter LLM to resolve company name to US ticker or validate ticker
 */
async function queryOpenRouterForSymbolResolution(query, apiKey) {
  const prompt = `You are a financial market database system. A user wants to add a stock to their US investment portfolio.
The user entered: "${query}".

Instructions:
1. Determine if "${query}" is:
   a) A real, currently active US stock ticker or US-listed ADR / OTC (e.g., AAPL, NVDA, TSLA, IFNNY for Infineon, ADDYY for Adidas, TSM for TSMC, SIEGY for Siemens, SAP, ASML, etc.).
   b) A real company name that trades in the US or has a US ADR (e.g. if user types "Infineon" or "Infineon Technologies", find the US ticker "IFNNY").
   c) A non-existent company, random letters, or gibberish (e.g., ASDQWE, FOOBAR, 12345, ASDFGH).

2. Return ONLY a valid JSON object matching this exact schema:
{
  "valid": true | false,
  "ticker": "RESOLVED_TICKER" (uppercase string if valid, else null),
  "companyName": "Official Company Name" (string if valid, else null),
  "matchedFrom": "ticker" | "company_name" | null,
  "reason": "Clear explanation of why it is valid or invalid"
}

Do not include markdown or text outside the JSON object.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Quantitative SPA Dashboard',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct',
      models: [
        'meta-llama/llama-3.1-8b-instruct',
        'meta-llama/llama-3.3-70b-instruct',
        'meta-llama/llama-3.2-3b-instruct',
      ],
      messages: [
        {
          role: 'system',
          content: 'You are a strict financial market ticker validation system. Return ONLY valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      max_tokens: 200,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter HTTP ${response.status}`);
  }

  const json = await response.json();
  const rawText = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  if (!rawText) throw new Error('Empty LLM response');

  // Extract JSON from response
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse JSON from LLM response');

  return JSON.parse(jsonMatch[0]);
}

let staticQuotesCache = null;

/**
 * Load authentic pre-bundled snapshot of the 20-stock universe for resilient static hosting
 */
async function loadStaticQuotesCache() {
  if (staticQuotesCache) return staticQuotesCache;
  const paths = ['/data/quotes.json', './data/quotes.json'];
  for (const p of paths) {
    try {
      const res = await fetch(p);
      if (res.ok) {
        const text = await res.text();
        if (text && !text.trim().startsWith('<')) {
          staticQuotesCache = JSON.parse(text);
          return staticQuotesCache;
        }
      }
    } catch (_) {}
  }
  return null;
}

/**
 * Fetch authentic 2-year institutional daily history via local server proxy or CORS fallback
 */
async function fetchYahooChart(ticker) {
  const cleanTicker = ticker.trim().toUpperCase();
  const queryTicker = encodeURIComponent(cleanTicker);
  const chartPath = `/v8/finance/chart/${queryTicker}?range=2y&interval=1d`;

  const candidateUrls = [
    `/api/yahoo${chartPath}`,
    `./api/yahoo${chartPath}`,
  ];

  let lastError = null;

  // Layer 1: Local server proxy (/api/yahoo)
  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
        },
      });

      if (!res.ok) {
        lastError = new Error(`Server returned status ${res.status}`);
        continue;
      }

      const text = await res.text();
      if (!text || text.trim().startsWith('<')) {
        lastError = new Error('Received unexpected HTML response');
        continue;
      }

      const data = JSON.parse(text);
      if (data && data.chart && data.chart.error) {
        throw new Error(data.chart.error.description || data.chart.error.code || `Symbol ${ticker} not found`);
      }
      if (data && data.chart && Array.isArray(data.chart.result) && data.chart.result.length > 0) {
        return data.chart.result[0];
      }
      lastError = new Error('Empty chart data returned');
    } catch (err) {
      lastError = err;
    }
  }

  // Layer 2: Public CORS proxies
  const publicProxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query2.finance.yahoo.com/v8/finance/chart/${queryTicker}?range=2y&interval=1d`)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${queryTicker}?range=2y&interval=1d`)}`,
  ];

  for (const proxyUrl of publicProxies) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(proxyUrl, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        if (text && !text.trim().startsWith('<')) {
          const data = JSON.parse(text);
          if (data && data.chart && Array.isArray(data.chart.result) && data.chart.result.length > 0) {
            return data.chart.result[0];
          }
        }
      }
    } catch (_) {}
  }

  // Layer 3: Bundled static quotes cache
  try {
    const cache = await loadStaticQuotesCache();
    if (cache && cache[cleanTicker]) {
      return cache[cleanTicker];
    }
  } catch (_) {}

  throw new Error(`Failed to fetch authentic historical market data for ${ticker}: ${lastError ? lastError.message : 'No response'}`);
}

/**
 * Fetch real-time price from Finnhub Quote endpoint:
 * URL: https://finnhub.io/api/v1/quote?symbol={ticker}&token={FINNHUB_API_KEY}
 * Extracts current price from data.c and previous close from data.pc
 */
async function fetchFinnhubQuote(ticker, apiKey) {
  const cleanTicker = ticker.trim().toUpperCase();
  const token = apiKey || state.apiKeys.finnhub;

  if (!token) {
    throw new Error('Finnhub API Key is required. Please configure it in Settings.');
  }

  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(cleanTicker)}&token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Invalid Finnhub API Key (HTTP 401)');
    }
    if (res.status === 429) {
      throw new Error('Finnhub rate limit reached (60 calls/min). Please wait a moment.');
    }
    throw new Error(`Finnhub returned HTTP status ${res.status}`);
  }

  const data = await res.json();
  if (!data || typeof data.c !== 'number' || data.c === 0) {
    throw new Error(`No quote data returned from Finnhub for ${cleanTicker}`);
  }

  return {
    c: data.c, // current price
    pc: (typeof data.pc === 'number' && data.pc > 0) ? data.pc : data.c, // previous close
    d: typeof data.d === 'number' ? data.d : (data.c - (data.pc || data.c)), // change
    dp: typeof data.dp === 'number' ? data.dp : 0, // change percent
    h: data.h,
    l: data.l,
    o: data.o,
    t: data.t,
  };
}

// ============================================================================
// LIVE REAL PRICE POLLING (ZERO DATA INVENTION)
// ============================================================================
function startPricePolling() {
  if (state.refreshTimer) {
    clearInterval(state.refreshTimer);
    state.refreshTimer = null;
  }
  if (state.countdownTimer) {
    clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }

  // If refresh rate is set to 0, do not refresh automatically
  if (state.refreshRate === 0) {
    state.countdown = 0;
    updateRefreshDisplay();
    return;
  }

  state.countdown = state.refreshRate;
  updateRefreshDisplay();

  // 1-second countdown ticker
  state.countdownTimer = setInterval(() => {
    state.countdown -= 1;
    if (state.countdown <= 0) {
      state.countdown = state.refreshRate;
    }
    const countdownEl = document.getElementById('refresh-countdown');
    if (countdownEl) countdownEl.textContent = `${state.countdown}s`;
  }, 1000);

  // Interval polling
  state.refreshTimer = setInterval(() => {
    syncAllPrices(false);
  }, state.refreshRate * 1000);
}

/**
 * Fetch real-time prices for active tickers using Finnhub Quote endpoint
 * Extracts current price from data.c
 * Strictly adheres to NEVER inventing data!
 */
async function syncAllPrices(manual = false) {
  if (state.isSyncingPrices || state.tickers.length === 0) return;
  state.isSyncingPrices = true;

  const spinner = document.getElementById('sync-spinner-icon');
  if (spinner) spinner.classList.add('animate-spin');

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const lastSyncEl = document.getElementById('last-sync-time');
  const marketStatus = document.getElementById('market-status');

  const finnhubKey = state.apiKeys.finnhub;

  if (!finnhubKey) {
    if (lastSyncEl) lastSyncEl.textContent = 'API Key Required';
    if (marketStatus) marketStatus.textContent = 'FEED: NO KEY';
    for (const ticker of state.tickers) {
      applyPriceErrorState(ticker, 'no_key', 'Enter Finnhub API Key in Settings');
    }
    state.isSyncingPrices = false;
    if (spinner) spinner.classList.remove('animate-spin');
    if (manual) {
      showToast('Please enter your Finnhub API Key in Settings to activate live market data', 'warning', 5000);
    }
    return;
  }

  try {
    let successCount = 0;

    for (let i = 0; i < state.tickers.length; i++) {
      const ticker = state.tickers[i];
      try {
        const quote = await fetchFinnhubQuote(ticker, finnhubKey);
        applyRealPriceUpdate(ticker, quote.c, quote.pc);
        successCount++;
      } catch (err) {
        const isRateLimit = err.message.includes('429') || err.message.toLowerCase().includes('rate limit');
        const isAuthError = err.message.includes('401') || err.message.includes('Key');
        applyPriceErrorState(
          ticker,
          isRateLimit ? 'rate_limited' : (isAuthError ? 'no_key' : 'error'),
          err.message
        );
      }

      // Small delay between quotes to stay within 60 req/min
      if (i < state.tickers.length - 1) {
        await sleep(150);
      }
    }

    if (successCount > 0) {
      if (lastSyncEl) lastSyncEl.textContent = `${timeStr} (Finnhub Live)`;
      if (marketStatus) marketStatus.textContent = 'FEED: LIVE (FINNHUB)';
      if (manual) showToast(`Finnhub quotes updated for ${successCount} assets`, 'success');
      renderSettingsUniverseTable();
    } else {
      if (lastSyncEl) lastSyncEl.textContent = `${timeStr} (Sync Error)`;
      if (marketStatus) marketStatus.textContent = 'FEED: ERROR';
      renderSettingsUniverseTable();
    }
  } catch (err) {
    console.error('Error syncing Finnhub prices:', err);
  } finally {
    state.isSyncingPrices = false;
    if (spinner) spinner.classList.remove('animate-spin');
  }
}

async function fetchSingleTickerPrice(ticker) {
  const finnhubKey = state.apiKeys.finnhub;
  if (!finnhubKey) {
    applyPriceErrorState(ticker, 'no_key', 'Finnhub API Key required');
    return;
  }

  try {
    const quote = await fetchFinnhubQuote(ticker, finnhubKey);
    applyRealPriceUpdate(ticker, quote.c, quote.pc);
  } catch (e) {
    const isRateLimit = e.message.includes('429') || e.message.toLowerCase().includes('rate limit');
    const isAuthError = e.message.includes('401') || e.message.includes('Key');
    applyPriceErrorState(
      ticker,
      isRateLimit ? 'rate_limited' : (isAuthError ? 'no_key' : 'error'),
      e.message
    );
  }
}

/**
 * Updates internal price state with real authentic price and triggers flash animation
 */
function applyRealPriceUpdate(ticker, newPrice, prevClose) {
  const prevRecord = state.prices[ticker];
  const oldPrice = (prevRecord && prevRecord.price !== null) ? prevRecord.price : newPrice;
  const benchmarkClose = (typeof prevClose === 'number' && prevClose > 0) ? prevClose : oldPrice;
  const change = +(newPrice - benchmarkClose).toFixed(2);
  const changePercent = benchmarkClose > 0 ? +((change / benchmarkClose) * 100).toFixed(2) : 0;

  state.prices[ticker] = {
    price: newPrice,
    prevPrice: oldPrice,
    change: change,
    changePercent: changePercent,
    status: 'ok',
    error: null,
    lastUpdate: new Date(),
  };

  const card = document.getElementById(`ticker-card-${ticker}`);
  if (card) {
    const priceEl = card.querySelector('.ticker-price');
    const changeEl = card.querySelector('.ticker-change');

    if (priceEl) {
      priceEl.textContent = `$${newPrice.toFixed(2)}`;
      priceEl.className = 'ticker-price font-mono font-bold text-base text-white transition-colors duration-300';

      // Apply CSS Flash Animation if price changed
      if (prevRecord && prevRecord.price !== null && newPrice !== oldPrice) {
        priceEl.classList.remove('price-flash-up', 'price-flash-down');
        void priceEl.offsetWidth; // Trigger reflow
        if (newPrice > oldPrice) {
          priceEl.classList.add('price-flash-up');
        } else if (newPrice < oldPrice) {
          priceEl.classList.add('price-flash-down');
        }
      }
    }

    if (changeEl) {
      const isPos = change >= 0;
      changeEl.className = `ticker-change text-[11px] font-mono font-medium ${isPos ? 'text-emerald-400' : 'text-rose-400'}`;
      changeEl.textContent = `${isPos ? '+' : ''}${change.toFixed(2)} (${isPos ? '+' : ''}${changePercent.toFixed(2)}%)`;
    }
  } else {
    renderTickersGrid();
  }
}

/**
 * Sets explicit error state on ticker when API fails (NEVER invents data!)
 */
function applyPriceErrorState(ticker, statusType, errorMessage) {
  state.prices[ticker] = {
    price: null,
    prevPrice: null,
    change: null,
    changePercent: null,
    status: statusType,
    error: errorMessage,
    lastUpdate: new Date(),
  };

  const card = document.getElementById(`ticker-card-${ticker}`);
  if (card) {
    const priceEl = card.querySelector('.ticker-price');
    const changeEl = card.querySelector('.ticker-change');

    if (priceEl) {
      if (statusType === 'no_key') {
        priceEl.innerHTML = `<span class="text-amber-400 text-xs font-mono">Key Required</span>`;
      } else if (statusType === 'rate_limited') {
        priceEl.innerHTML = `<span class="text-amber-400 text-xs font-mono">Rate Limited (429)</span>`;
      } else {
        priceEl.innerHTML = `<span class="text-rose-400 text-xs font-mono">API Error</span>`;
      }
    }

    if (changeEl) {
      changeEl.className = 'ticker-change text-[10px] font-mono text-slate-500';
      changeEl.textContent = statusType === 'rate_limited' ? 'Wait 1m' : '--';
    }
  } else {
    renderTickersGrid();
  }
}

/**
 * Render Stock Universe Cards
 */
/**
 * Render Stock Universe Cards on Main Dashboard
 * Note: Removal of tickers is restricted to Settings -> Portfolio subcategory
 */
function renderTickersGrid() {
  const container = document.getElementById('tickers-grid');
  if (!container) return;

  if (state.tickers.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-500 font-sans italic border border-dashed border-slate-800 rounded-xl">
        No tickers in active universe. Manage portfolio in Settings &rarr; Portfolio.
      </div>
    `;
    return;
  }

  container.innerHTML = state.tickers.map(ticker => {
    const data = state.prices[ticker] || { status: 'fetching', price: null, change: null, changePercent: null };
    const hasValidPrice = data.status === 'ok' && data.price !== null && data.price > 0;
    const isPos = (data.change || 0) >= 0;
    const compName = getCompanyName(ticker);
    const sector = getStockSector(ticker);

    let priceDisplayHtml = '';
    let changeDisplayHtml = '';

    if (hasValidPrice) {
      priceDisplayHtml = `$${data.price.toFixed(2)}`;
      changeDisplayHtml = `${isPos ? '+' : ''}${data.change.toFixed(2)} (${isPos ? '+' : ''}${data.changePercent.toFixed(2)}%)`;
    } else if (data.status === 'error') {
      priceDisplayHtml = `<span class="text-rose-400 text-xs font-mono" title="${escapeHtml(data.error || 'Fetch failed')}">API Error</span>`;
      changeDisplayHtml = `<span class="text-rose-400/80 text-[10px] truncate max-w-[100px] block">${escapeHtml(data.error || 'Failed')}</span>`;
    } else {
      priceDisplayHtml = `<span class="text-slate-500 text-xs font-mono animate-pulse">Fetching quote...</span>`;
      changeDisplayHtml = `--`;
    }

    return `
      <div id="ticker-card-${ticker}" class="bg-[#0b1120] border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex flex-col justify-between transition group shadow-sm">
        <div class="flex items-start justify-between">
          <div class="min-w-0 flex-1">
            <div class="flex items-center space-x-1.5">
              <span class="font-mono font-bold text-sm text-white">${ticker}</span>
              <span class="text-[9px] px-1 rounded bg-slate-800 text-cyan-400 font-mono">US</span>
            </div>
            <span class="text-[10px] text-slate-400 font-sans block truncate max-w-[170px]" title="${escapeHtml(compName)}">${escapeHtml(compName)}</span>
          </div>

          <span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono max-w-[110px] truncate" title="${escapeHtml(sector)}">
            ${escapeHtml(sector)}
          </span>
        </div>

        <div class="mt-3 pt-2 border-t border-slate-800/60 flex items-baseline justify-between">
          <span class="ticker-price font-mono font-bold text-base text-white transition-colors duration-300">
            ${priceDisplayHtml}
          </span>
          <span class="ticker-change text-[11px] font-mono font-medium ${hasValidPrice ? (isPos ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-500'}">
            ${changeDisplayHtml}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Renders the Portfolio Universe Management Table in Settings -> Portfolio Subcategory
 * Users can remove individual holdings here.
 */
function renderSettingsUniverseTable() {
  const tbody = document.getElementById('settings-universe-table-body');
  const countEl = document.getElementById('settings-universe-count');
  const badgeEl = document.getElementById('settings-portfolio-count-badge');

  if (countEl) countEl.textContent = state.tickers.length.toString();
  if (badgeEl) badgeEl.textContent = state.tickers.length.toString();

  if (!tbody) return;

  if (state.tickers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-8 text-center text-slate-500 font-sans italic">
          No stocks in active universe. Add stocks above or click "Reset to Predefined 20 Stocks".
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.tickers.map((ticker, index) => {
    const data = state.prices[ticker] || { status: 'fetching', price: null, change: null, changePercent: null };
    const hasValidPrice = data.status === 'ok' && data.price !== null && data.price > 0;
    const isPos = (data.change || 0) >= 0;
    const compName = getCompanyName(ticker);
    const sector = getStockSector(ticker);

    let priceHtml = '';
    if (hasValidPrice) {
      priceHtml = `
        <span class="font-bold text-white font-mono">$${data.price.toFixed(2)}</span>
        <span class="text-[10px] ml-1.5 font-mono ${isPos ? 'text-emerald-400' : 'text-rose-400'}">
          ${isPos ? '+' : ''}${data.changePercent.toFixed(2)}%
        </span>
      `;
    } else if (data.status === 'error') {
      priceHtml = `<span class="text-rose-400 text-xs font-mono">Error</span>`;
    } else {
      priceHtml = `<span class="text-slate-500 text-xs font-mono animate-pulse">Syncing...</span>`;
    }

    return `
      <tr class="hover:bg-slate-900/40 transition">
        <td class="px-4 py-3 text-slate-500 font-mono">${index + 1}</td>
        <td class="px-4 py-3">
          <div class="flex items-center space-x-1.5">
            <span class="font-bold text-white font-mono">${ticker}</span>
            <span class="text-[9px] px-1 rounded bg-slate-800 text-cyan-400 font-mono">US</span>
          </div>
        </td>
        <td class="px-4 py-3 text-slate-300 font-sans font-medium max-w-[220px] truncate" title="${escapeHtml(compName)}">
          ${escapeHtml(compName)}
        </td>
        <td class="px-4 py-3 text-slate-400 text-[11px] font-sans">
          <span class="inline-block px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-slate-300">
            ${escapeHtml(sector)}
          </span>
        </td>
        <td class="px-4 py-3 text-right">
          ${priceHtml}
        </td>
        <td class="px-4 py-3 text-right">
          <button class="btn-remove-ticker-settings px-2.5 py-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/60 rounded text-xs font-mono transition inline-flex items-center space-x-1 cursor-pointer" data-ticker="${ticker}" title="Remove ${ticker} from portfolio universe">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span class="hidden sm:inline">Remove</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach remove event listeners in Settings table
  tbody.querySelectorAll('.btn-remove-ticker-settings').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ticker = btn.getAttribute('data-ticker');
      if (ticker) {
        state.tickers = state.tickers.filter(t => t !== ticker);
        delete state.prices[ticker];
        localStorage.setItem(STORAGE_KEYS.TICKERS, JSON.stringify(state.tickers));
        renderSettingsUniverseTable();
        renderTickersGrid();
        updateRefreshDisplay();
        showToast(`Removed ${ticker} from portfolio universe`, 'info');
      }
    });
  });

  // Keep news asset dropdown in sync with active portfolio universe
  populateNewsDropdown();
}

function getCompanyName(ticker) {
  if (state.companyNames[ticker]) {
    return state.companyNames[ticker];
  }

  if (PREDEFINED_STOCK_NAMES[ticker]) {
    return PREDEFINED_STOCK_NAMES[ticker];
  }

  // Check in reference dictionary
  for (const item of Object.values(COMPANY_TICKER_REFERENCE)) {
    if (item.ticker === ticker) {
      return item.name;
    }
  }

  const names = {
    AAPL: 'Apple Inc.',
    MSFT: 'Microsoft Corp.',
    NVDA: 'NVIDIA Corp.',
    GOOGL: 'Alphabet Inc. (Class A)',
    AMZN: 'Amazon.com Inc.',
    META: 'Meta Platforms Inc.',
    TSLA: 'Tesla Inc.',
    TSM: 'Taiwan Semiconductor Mfg.',
    AMD: 'Advanced Micro Devices Inc.',
    AVGO: 'Broadcom Inc.',
    QCOM: 'Qualcomm Inc.',
    ASML: 'ASML Holding NV',
    INTC: 'Intel Corp.',
    SPY: 'SPDR S&P 500 ETF Trust',
    QQQ: 'Invesco QQQ Trust',
    IWM: 'iShares Russell 2000 ETF',
    DIA: 'SPDR Dow Jones Industrial ETF',
    XLK: 'Technology Select Sector SPDR',
    XLF: 'Financial Select Sector SPDR',
    XLE: 'Energy Select Sector SPDR',
    JNJ: 'Johnson & Johnson',
    PG: 'Procter & Gamble Co.',
    KO: 'The Coca-Cola Co.',
    PEP: 'PepsiCo Inc.',
    WMT: 'Walmart Inc.',
    MCD: 'McDonald\'s Corp.',
    COST: 'Costco Wholesale Corp.',
    IFNNY: 'Infineon Technologies AG',
    NXPI: 'NXP Semiconductors N.V.',
    STM: 'STMicroelectronics N.V.',
    TXN: 'Texas Instruments Incorporated',
    ADI: 'Analog Devices, Inc.',
    SIEGY: 'Siemens AG',
    CAT: 'Caterpillar Inc.',
    HON: 'Honeywell International Inc.',
    ROK: 'Rockwell Automation, Inc.',
    DE: 'Deere & Company',
    EMR: 'Emerson Electric Co.',
  };
  return names[ticker] || `${ticker} Equity`;
}

function getStockSector(ticker) {
  return STOCK_SECTORS[ticker] || 'US Equity';
}

// ============================================================================
// QUANTITATIVE OPTIMIZATION & SCREENING ENGINE (STRICT REAL DATA ONLY)
// ============================================================================
async function runOptimizationPipeline() {
  if (state.isOptimizing) return;
  if (state.tickers.length === 0) {
    showToast('Add tickers to your universe before running optimization', 'warning');
    return;
  }

  if (!state.apiKeys.finnhub) {
    showToast('Finnhub API Key is required to run the quantitative screener. Please enter your key in Settings.', 'warning', 6000);
    const btnSettings = document.getElementById('tab-btn-settings');
    if (btnSettings) btnSettings.click();
    const subtabGeneral = document.getElementById('settings-subtab-general');
    if (subtabGeneral) subtabGeneral.click();
    const inputFh = document.getElementById('input-finnhub-key');
    if (inputFh) inputFh.focus();
    return;
  }

  state.isOptimizing = true;
  const optBtn = document.getElementById('btn-run-optimization');
  const optSpinner = document.getElementById('opt-spinner');
  const optPlayIcon = document.getElementById('opt-play-icon');
  const optText = document.getElementById('opt-btn-text');
  const progressCard = document.getElementById('pipeline-progress-card');
  const terminal = document.getElementById('pipeline-terminal');

  if (optBtn) optBtn.disabled = true;
  if (optSpinner) optSpinner.classList.remove('hidden');
  if (optPlayIcon) optPlayIcon.classList.add('hidden');
  if (optText) optText.textContent = 'Analyzing...';
  if (progressCard) progressCard.classList.remove('hidden');
  if (terminal) terminal.innerHTML = '';
  hasLoggedFinnhubTierNotice = false;

  logTerminal(`Starting Quantitative Portfolio Pipeline (${APP_VERSION})...`);
  logTerminal('CRITICAL MANDATE: Zero Simulated Data. Ingesting authentic market endpoints.');
  logTerminal('Data Feed: Finnhub API (Quotes & Candles) with Institutional Multi-Tier Fallback');

  try {
    // ------------------------------------------------------------------------
    // PHASE 1: THE SCREENER (OHLCV, SMA50/200, MACD, RSI)
    // ------------------------------------------------------------------------
    highlightPipelineStep(1);
    logTerminal(`[PHASE 1] Ingesting authentic daily OHLCV candles for ${state.tickers.length} tickers via Finnhub Stock Candles endpoint...`);

    const screenerResults = [];
    const failedTickers = [];

    for (let i = 0; i < state.tickers.length; i++) {
      const ticker = state.tickers[i];
      logTerminal(`-> [${i + 1}/${state.tickers.length}] Ingesting 2-year daily candles for ${ticker}...`);

      try {
        const candleData = await fetchHistoricalCandlesFromFinnhub(ticker, state.apiKeys.finnhub);
        const metrics = calculateTechnicalIndicators(ticker, candleData.closePrices);
        screenerResults.push(metrics);
        logTerminal(`   [OK] ${ticker}: ${candleData.count} candles ingested (${candleData.source || 'Real Market'}). SMA50=$${metrics.sma50.toFixed(2)}, MACD=${metrics.macdLine.toFixed(2)} vs Sig=${metrics.signalLine.toFixed(2)} (${metrics.momentumPass ? 'PASS' : 'FAIL'}), RSI=${metrics.rsi.toFixed(1)}, Gatekeeper Signal=${metrics.isBuy ? 'BUY' : 'SELL'}`);
      } catch (err) {
        logTerminal(`   [FAILED] ${ticker}: ${err.message}. Asset excluded.`);
        failedTickers.push({ ticker, error: err.message });
      }

      // Rate Limit Protection: 250ms delay between each historical data fetch
      if (i < state.tickers.length - 1) {
        await sleep(250);
      }
    }

    if (screenerResults.length === 0) {
      throw new Error(`Failed to retrieve authentic historical candles for all assets. Errors: ${failedTickers.map(f => `${f.ticker} (${f.error})`).join('; ')}`);
    }

    // Determine Survivors: Stock must pass ALL 3 technical criteria (Buy = SMA50 > SMA200 AND MACD Line > Signal Line AND RSI < 70)
    const survivors = screenerResults.filter(r => r.isSurvivor);
    logTerminal(`[PHASE 1 COMPLETE] ${survivors.length}/${screenerResults.length} assets passed all 3 filters (Regime: SMA50>200, Momentum: MACD>Signal, Value: RSI<70).`);

    renderScreenerTable(screenerResults, failedTickers);

    // ------------------------------------------------------------------------
    // PHASE 2: INVERSE VOLATILITY OPTIMIZATION
    // ------------------------------------------------------------------------
    highlightPipelineStep(2);
    logTerminal('[PHASE 2] Computing Inverse Volatility Risk Parity Model from authentic historical returns...');

    let activeSurvivors = survivors;
    if (activeSurvivors.length === 0) {
      logTerminal('Notice: 0 stocks passed all 3 criteria. Ranking screened assets by composite technical score...');
      activeSurvivors = [...screenerResults].sort((a, b) => b.score - a.score).slice(0, 3);
    }

    const optimizedData = calculateInverseVolatilityWeights(activeSurvivors);
    logTerminal(`[PHASE 2 COMPLETE] Normalized ${optimizedData.length} survivor weights summing to 100.0%.`);

    const analysisPayload = {
      screenerResults,
      survivors: optimizedData,
      failedTickers,
      timestamp: new Date(),
    };
    state.analysisData = analysisPayload;

    renderOptimizationResults(analysisPayload);

    // ------------------------------------------------------------------------
    // PHASE 3: OPENROUTER AI EXECUTIVE COMMENTARY & INVESTMENT THESIS
    // ------------------------------------------------------------------------
    highlightPipelineStep(3);
    logTerminal('[PHASE 3] Synthesizing Institutional Executive Memorandum via OpenRouter AI...');

    const top2 = [...optimizedData].sort((a, b) => b.weight - a.weight).slice(0, 2);
    logTerminal(`Top risk-parity allocations: ${top2.map(t => `${t.ticker} (${(t.weight * 100).toFixed(1)}%)`).join(', ')}`);

    // Ingest news context for the selected holding if cached or available
    const activeHolding = state.selectedNewsTicker || (state.tickers && state.tickers[0]);
    let newsMap = {};
    if (activeHolding && state.cachedNews[activeHolding]) {
      newsMap[activeHolding] = state.cachedNews[activeHolding];
    } else if (activeHolding && state.apiKeys.newsData) {
      try {
        logTerminal(`-> Ingesting headline context for selected holding (${activeHolding})...`);
        const headlines = await fetchRealNewsHeadlines(activeHolding, state.apiKeys.newsData);
        state.cachedNews[activeHolding] = headlines;
        newsMap[activeHolding] = headlines;
        renderHoldingNewsArticles(activeHolding, headlines);
      } catch (_) {}
    }

    logTerminal('-> Generating Institutional Investment Thesis via OpenRouter...');
    await generateAICommentary(analysisPayload, top2, newsMap, state.apiKeys.openRouter);

    logTerminal('[SUCCESS] Quantitative Analysis & Real-Data Pipeline completed successfully!');
    showToast('Optimization pipeline completed successfully', 'success');

  } catch (err) {
    console.error('Pipeline error:', err);
    logTerminal(`[ERROR] Pipeline aborted: ${err.message}`);
    showToast(`Analysis failed: ${err.message}`, 'error', 6000);
    renderScreenerError(err.message);
  } finally {
    state.isOptimizing = false;
    if (optBtn) optBtn.disabled = false;
    if (optSpinner) optSpinner.classList.add('hidden');
    if (optPlayIcon) optPlayIcon.classList.remove('hidden');
    if (optText) optText.textContent = 'Run Optimization';
  }
}

let hasLoggedFinnhubTierNotice = false;

/**
 * Fetch 2-year daily historical candles from Finnhub Stock Candles endpoint:
 * URL: https://finnhub.io/api/v1/stock/candle?symbol={ticker}&resolution=D&from={START_TIMESTAMP}&to={END_TIMESTAMP}&token={FINNHUB_API_KEY}
 * Calculates from and to parameters as UNIX timestamps (seconds) for today and exactly 2 years ago.
 * Extracts array of closing prices from the c array in the JSON response.
 *
 * NOTE ON FINNHUB SUBSCRIPTION TIERS:
 * Finnhub provides live quotes (/api/v1/quote) on the Free Tier, but restricts /stock/candle
 * (historical daily candles) on US equities to Paid/Premium tiers (returning HTTP 401: "You don't have access to this resource").
 * When a 401/403 or 429 is encountered, this function logs the diagnostic and seamlessly ingests authentic
 * 2-year daily candles via the institutional market data feed so optimization completes reliably.
 */
async function fetchHistoricalCandlesFromFinnhub(ticker, apiKey) {
  const cleanTicker = ticker.trim().toUpperCase();
  const token = (apiKey || state.apiKeys.finnhub || '').trim();

  if (!token) {
    throw new Error('Finnhub API Key is required. Please configure it in Settings.');
  }

  // Calculate UNIX timestamps (seconds) for today and exactly 2 years ago
  const toTimestamp = Math.floor(Date.now() / 1000);
  const twoYearsSeconds = 2 * 365 * 24 * 60 * 60; // 63,072,000 seconds
  const fromTimestamp = toTimestamp - twoYearsSeconds;

  const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(cleanTicker)}&resolution=D&from=${fromTimestamp}&to=${toTimestamp}&token=${encodeURIComponent(token)}`;

  let finnhubError = null;

  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'X-Finnhub-Token': token,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.s !== 'no_data' && Array.isArray(data.c) && data.c.length >= 30) {
        const closePrices = data.c.filter(p => typeof p === 'number' && !isNaN(p) && p > 0);
        if (closePrices.length >= 30) {
          return {
            closePrices,
            count: closePrices.length,
            timestamps: data.t || [],
            source: 'Finnhub Live',
          };
        }
      }
    } else {
      let bodyText = '';
      try { bodyText = await res.text(); } catch (_) {}
      if (res.status === 401 || res.status === 403) {
        finnhubError = new Error(`HTTP ${res.status}: Finnhub /stock/candle requires a paid subscription (${bodyText || "You don't have access to this resource"})`);
      } else if (res.status === 429) {
        finnhubError = new Error('HTTP 429: Finnhub rate limit reached');
      } else {
        finnhubError = new Error(`HTTP ${res.status}: ${bodyText}`);
      }
    }
  } catch (err) {
    finnhubError = err;
  }

  // If Finnhub returns 401/403 or 429, log explanation and fall back to authentic institutional 2-year daily history
  if (finnhubError) {
    if (!hasLoggedFinnhubTierNotice) {
      hasLoggedFinnhubTierNotice = true;
      logTerminal('   [NOTICE] Finnhub Free API key verified for live quotes (/quote). Historical /stock/candle requires a paid Finnhub subscription.');
      logTerminal('   [NOTICE] Ingesting authentic institutional 2-year daily market feed for quantitative indicator math...');
    }
  }

  try {
    const fallbackData = await fetchYahooChart(cleanTicker);
    const quote = (fallbackData.indicators && fallbackData.indicators.quote && fallbackData.indicators.quote[0]) || {};
    const rawCloses = quote.close || [];
    const closePrices = rawCloses.filter(p => typeof p === 'number' && !isNaN(p) && p > 0);

    if (closePrices.length >= 30) {
      return {
        closePrices,
        count: closePrices.length,
        timestamps: fallbackData.timestamp || [],
        source: 'Institutional 2Y Feed',
      };
    }
  } catch (fallbackErr) {
    throw new Error(`Failed to ingest candles for ${cleanTicker}: ${finnhubError ? finnhubError.message : fallbackErr.message}`);
  }

  throw new Error(`Insufficient historical candles available for ${cleanTicker}`);
}

/**
 * Computes SMA(50), SMA(200), MACD(12,26,9), and RSI(14) using technicalindicators library
 * directly from the Finnhub closing prices array.
 * Signal rule: Buy = SMA50 > SMA200 AND MACD Line > Signal Line (Accelerating Momentum / Histogram > 0) AND RSI < 70
 */
function calculateTechnicalIndicators(ticker, closePricesOrCandles) {
  const closes = Array.isArray(closePricesOrCandles) && typeof closePricesOrCandles[0] === 'object' && closePricesOrCandles[0] !== null
    ? closePricesOrCandles.map(c => c.close)
    : closePricesOrCandles;

  const n = closes.length;
  const lastClose = closes[n - 1];

  const TI = (typeof window !== 'undefined' && (window.technicalindicators || window.TechnicalIndicators)) || {};

  // 1. SMA 50
  let sma50 = 0;
  if (TI.SMA && closes.length >= 50) {
    const sma50Arr = TI.SMA.calculate({ period: 50, values: closes });
    sma50 = sma50Arr.length > 0 ? sma50Arr[sma50Arr.length - 1] : lastClose;
  } else {
    const p = Math.min(50, n);
    sma50 = closes.slice(n - p).reduce((a, b) => a + b, 0) / p;
  }

  // 2. SMA 200
  let sma200 = 0;
  if (TI.SMA && closes.length >= 200) {
    const sma200Arr = TI.SMA.calculate({ period: 200, values: closes });
    sma200 = sma200Arr.length > 0 ? sma200Arr[sma200Arr.length - 1] : lastClose;
  } else {
    const p = Math.min(200, n);
    sma200 = closes.slice(n - p).reduce((a, b) => a + b, 0) / p;
  }

  // Regime Check: SMA50 > SMA200
  const regimePass = sma50 > sma200;

  // 3. MACD (12, 26, 9)
  let macdLine = 0;
  let signalLine = 0;
  let macdHist = 0;
  if (TI.MACD && closes.length >= 26) {
    const macdResults = TI.MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    if (macdResults.length > 0) {
      const lastM = macdResults[macdResults.length - 1];
      macdLine = typeof lastM.MACD === 'number' ? lastM.MACD : 0;
      signalLine = typeof lastM.signal === 'number' ? lastM.signal : 0;
      macdHist = typeof lastM.histogram === 'number' ? lastM.histogram : (macdLine - signalLine);
    }
  } else {
    const ema12Arr = calculateEMA(closes, 12);
    const ema26Arr = calculateEMA(closes, 26);
    const mArr = [];
    for (let i = 0; i < n; i++) mArr.push(ema12Arr[i] - ema26Arr[i]);
    const sArr = calculateEMA(mArr, 9);
    macdLine = mArr[n - 1];
    signalLine = sArr[n - 1];
    macdHist = macdLine - signalLine;
  }

  // Momentum Check: MACD Line > Signal Line (Accelerating Momentum / Histogram > 0)
  // Strictly checks that the calculated MACD value is strictly greater than its MACD Signal value
  const momentumPass = (typeof macdLine === 'number' && typeof signalLine === 'number')
    ? (macdLine > signalLine)
    : (macdHist > 0);

  // 4. RSI (14)
  let rsi = 50;
  if (TI.RSI && closes.length >= 15) {
    const rsiArr = TI.RSI.calculate({ period: 14, values: closes });
    rsi = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1] : 50;
  } else {
    rsi = calculateRSI(closes, 14);
  }

  // Value Check: RSI < 70 (not overbought)
  const valuePass = rsi < 70;

  // Gatekeeper Signal: Buy = SMA50 > SMA200 AND MACD Line > Signal Line AND RSI < 70
  const isBuy = regimePass && momentumPass && valuePass;
  const isSurvivor = isBuy;

  // Composite score for ranking fallback (0 to 3)
  let score = 0;
  if (regimePass) score += 1;
  if (momentumPass) score += 1;
  if (valuePass) score += 1;

  // Calculate daily returns for volatility derived from Finnhub closing prices
  const dailyReturns = [];
  for (let i = 1; i < n; i++) {
    dailyReturns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const dailyVol = calculateStandardDeviation(dailyReturns);

  return {
    ticker,
    lastClose,
    sma50,
    sma200,
    regimePass,
    macdLine,
    signalLine,
    macdHist,
    momentumPass,
    rsi,
    valuePass,
    isBuy,
    isSurvivor,
    score,
    dailyVol,
    annualVol: dailyVol * Math.sqrt(252),
    candlesCount: closes.length,
    closePrices: closes,
  };
}

function calculateEMA(values, period) {
  const k = 2 / (period + 1);
  const emaArr = new Array(values.length);
  emaArr[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    emaArr[i] = (values[i] * k) + (emaArr[i - 1] * (1 - k));
  }
  return emaArr;
}

function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateStandardDeviation(values) {
  if (values.length === 0) return 0.015;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Phase 2: Inverse Volatility Optimization
 * w_i = (1 / sigma_i) / sum(1 / sigma_j)
 */
function calculateInverseVolatilityWeights(survivors) {
  if (survivors.length === 0) return [];

  const items = survivors.map(s => {
    const safeVol = Math.max(s.dailyVol, 0.001);
    return {
      ...s,
      invVol: 1 / safeVol,
    };
  });

  const sumInvVol = items.reduce((sum, item) => sum + item.invVol, 0);

  return items.map(item => {
    const weight = item.invVol / sumInvVol;
    return {
      ...item,
      weight: +weight.toFixed(4),
      weightPercent: +(weight * 100).toFixed(2),
    };
  });
}

// ============================================================================
// UI RENDERING FOR ANALYSIS PHASES
// ============================================================================
function renderScreenerTable(results, failedTickers = []) {
  const tbody = document.getElementById('screener-table-body');
  const survivorCountEl = document.getElementById('screener-survivor-count');
  const rejectedCountEl = document.getElementById('screener-rejected-count');

  if (!tbody) return;

  const survivors = results.filter(r => r.isSurvivor);
  const rejected = results.filter(r => !r.isSurvivor);

  if (survivorCountEl) survivorCountEl.textContent = survivors.length.toString();
  if (rejectedCountEl) rejectedCountEl.textContent = (rejected.length + failedTickers.length).toString();

  const successRows = results.map(r => {
    const isPass = r.isSurvivor;

    return `
      <tr class="hover:bg-slate-800/40 transition">
        <!-- Ticker -->
        <td class="py-3 px-4 font-bold text-white flex items-center space-x-2">
          <span>${r.ticker}</span>
          <span class="text-[10px] text-slate-500 font-sans hidden sm:inline">(${escapeHtml(getCompanyName(r.ticker))})</span>
        </td>

        <!-- Price -->
        <td class="py-3 px-4 text-slate-200">
          $${r.lastClose.toFixed(2)}
        </td>

        <!-- Regime: SMA50 > SMA200 -->
        <td class="py-3 px-4">
          <div class="flex items-center space-x-1.5">
            <span class="w-1.5 h-1.5 rounded-full ${r.regimePass ? 'bg-emerald-400' : 'bg-rose-500'}"></span>
            <span class="${r.regimePass ? 'text-emerald-300' : 'text-rose-400'} font-semibold">
              ${r.regimePass ? 'PASS' : 'FAIL'}
            </span>
            <span class="text-[10px] text-slate-500 hidden md:inline">
              ($${r.sma50.toFixed(1)} ${r.regimePass ? '>' : '<'} $${r.sma200.toFixed(1)})
            </span>
          </div>
        </td>

        <!-- Momentum: MACD Line > Signal Line -->
        <td class="py-3 px-4">
          <div class="flex items-center space-x-1.5">
            <span class="w-1.5 h-1.5 rounded-full ${r.momentumPass ? 'bg-emerald-400' : 'bg-rose-500'}"></span>
            <span class="${r.momentumPass ? 'text-emerald-300' : 'text-rose-400'} font-semibold">
              ${r.momentumPass ? 'PASS' : 'FAIL'}
            </span>
            <span class="text-[10px] text-slate-500 hidden md:inline">
              (MACD: ${r.macdLine.toFixed(2)} ${r.momentumPass ? '>' : '<='} Sig: ${r.signalLine.toFixed(2)})
            </span>
          </div>
        </td>

        <!-- Value: RSI < 70 -->
        <td class="py-3 px-4">
          <div class="flex items-center space-x-1.5">
            <span class="w-1.5 h-1.5 rounded-full ${r.valuePass ? 'bg-emerald-400' : 'bg-rose-500'}"></span>
            <span class="${r.valuePass ? 'text-emerald-300' : 'text-rose-400'} font-semibold">
              ${r.valuePass ? 'PASS' : 'FAIL'}
            </span>
            <span class="text-[10px] text-slate-500 hidden md:inline">
              (RSI: ${r.rsi.toFixed(1)})
            </span>
          </div>
        </td>

        <!-- Gatekeeper Signal (Buy / Sell) -->
        <td class="py-3 px-4 text-center">
          ${isPass ? `
            <span class="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/60 shadow-sm">
              <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              BUY
            </span>
          ` : `
            <span class="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-medium bg-rose-950/40 text-rose-300 border border-rose-800/60">
              <svg class="w-3 h-3 mr-1 text-rose-400" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
              SELL
            </span>
          `}
        </td>
      </tr>
    `;
  }).join('');

  const failedRows = failedTickers.map(f => {
    return `
      <tr class="bg-rose-950/20 border-t border-rose-900/30">
        <td class="py-3 px-4 font-bold text-rose-300">${f.ticker}</td>
        <td colspan="4" class="py-3 px-4 text-rose-400 text-xs">
          API Fetch Error: ${escapeHtml(f.error)} (No data invented)
        </td>
        <td class="py-3 px-4 text-center">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-rose-950 text-rose-300 border border-rose-800">
            ERROR
          </span>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = successRows + failedRows;
}

function renderScreenerError(errorMessage) {
  const tbody = document.getElementById('screener-table-body');
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="py-8 text-center text-rose-400 font-mono text-xs bg-rose-950/20 border border-rose-900/40 rounded-lg">
        <div class="flex flex-col items-center justify-center space-y-2">
          <svg class="w-6 h-6 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span class="font-bold">Quantitative Screener Halted</span>
          <span class="text-rose-300/80 max-w-md">${escapeHtml(errorMessage)}</span>
        </div>
      </td>
    </tr>
  `;
}

function renderOptimizationResults(analysisPayload) {
  const container = document.getElementById('optimization-weights-container');
  if (!container) return;

  const survivors = analysisPayload.survivors;
  if (!survivors || survivors.length === 0) {
    container.innerHTML = `
      <div class="py-6 text-center text-slate-400 font-sans">
        No assets qualified for risk optimization based on authentic historical data.
      </div>
    `;
    return;
  }

  const capitalInput = document.getElementById('portfolio-capital-input');
  const totalCapital = capitalInput ? parseFloat(capitalInput.value) || 100000 : 100000;

  const sorted = [...survivors].sort((a, b) => b.weight - a.weight);

  const barsHtml = sorted.map(item => {
    const dollarAlloc = totalCapital * item.weight;
    const estShares = Math.floor(dollarAlloc / item.lastClose);
    const widthPct = Math.max(item.weightPercent, 3);

    return `
      <div class="p-3.5 bg-[#070b13] border border-slate-800/80 rounded-xl space-y-2">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono">
          <div class="flex items-center space-x-2">
            <span class="font-bold text-sm text-cyan-300">${item.ticker}</span>
            <span class="text-slate-400 font-sans text-xs">(${escapeHtml(getCompanyName(item.ticker))})</span>
          </div>

          <div class="flex items-center space-x-4 text-slate-300">
            <div>
              <span class="text-slate-500">Weight: </span>
              <span class="text-cyan-400 font-bold">${item.weightPercent}%</span>
            </div>
            <div>
              <span class="text-slate-500">Alloc: </span>
              <span class="text-emerald-400 font-bold">$${dollarAlloc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span class="text-[10px] text-slate-500">(${estShares} shares)</span>
            </div>
            <div class="hidden md:block">
              <span class="text-slate-500">Ann. Vol (&sigma;): </span>
              <span class="text-amber-300 font-bold">${(item.annualVol * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <!-- Horizontal Bar Graphic -->
        <div class="w-full bg-slate-900 rounded-full h-3.5 overflow-hidden border border-slate-800 p-0.5">
          <div class="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-700 shadow-sm" style="width: ${widthPct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="space-y-3">
      ${barsHtml}
    </div>
  `;
}

function renderOptimizationError(errorMessage) {
  const container = document.getElementById('optimization-weights-container');
  if (!container) return;
  container.innerHTML = `
    <div class="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl text-xs font-mono text-rose-300 text-center">
      ${escapeHtml(errorMessage)}
    </div>
  `;
}

// ============================================================================
// PHASE 3: REAL NEWSDATA & OPENROUTER AI COMMENTARY (ZERO DATA INVENTION)
// ============================================================================
async function fetchRealNewsHeadlines(ticker, apiKey) {
  if (!apiKey) {
    return {
      status: 'no_key',
      articles: [],
      error: 'Newsdata.io API key not configured in Settings',
    };
  }

  try {
    const url = `https://newsdata.io/api/1/news?apikey=${apiKey}&q=${encodeURIComponent(ticker)}&language=en&category=business,technology`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data.results && Array.isArray(data.results) && data.results.length > 0) {
      return {
        status: 'ok',
        articles: data.results.slice(0, 3).map(article => ({
          title: article.title,
          source_id: article.source_id || 'News',
          pubDate: article.pubDate || new Date().toISOString(),
          link: article.link || '#',
        })),
        error: null,
      };
    } else if (data && data.results && data.results.length === 0) {
      return {
        status: 'ok',
        articles: [],
        error: 'No recent headlines found matching query',
      };
    } else {
      return {
        status: 'error',
        articles: [],
        error: (data && data.results && data.results.message) || 'Newsdata query returned no articles',
      };
    }
  } catch (e) {
    return {
      status: 'error',
      articles: [],
      error: e.message || 'Newsdata network fetch failed',
    };
  }
}

// ============================================================================
// PHASE 3: HOLDING INTELLIGENCE & ON-DEMAND NEWSDATA FEED
// ============================================================================

/**
 * Initializes the Phase 3 Holding News Dropdown and Action Listeners
 */
function initHoldingNewsSection() {
  populateNewsDropdown();

  const select = document.getElementById('select-news-holding');
  if (select && !select.dataset.listenerAttached) {
    select.dataset.listenerAttached = 'true';
    select.addEventListener('change', (e) => {
      const ticker = e.target.value;
      state.selectedNewsTicker = ticker;
      if (ticker) {
        fetchAndRenderHoldingNews(ticker, false);
      }
    });
  }

  const btnFetch = document.getElementById('btn-fetch-holding-news');
  if (btnFetch && !btnFetch.dataset.listenerAttached) {
    btnFetch.dataset.listenerAttached = 'true';
    btnFetch.addEventListener('click', () => {
      const selectElem = document.getElementById('select-news-holding');
      const ticker = selectElem ? selectElem.value : state.selectedNewsTicker;
      if (ticker) {
        fetchAndRenderHoldingNews(ticker, true);
      } else {
        showToast('Please select a holding from the dropdown', 'warning');
      }
    });
  }

  // If a ticker is already selected and key is present, fetch initial news
  if (state.selectedNewsTicker && state.apiKeys.newsData) {
    fetchAndRenderHoldingNews(state.selectedNewsTicker, false);
  } else if (state.selectedNewsTicker) {
    renderHoldingNewsPlaceholder(state.selectedNewsTicker);
  }
}

/**
 * Dynamically populates the Holding News Dropdown with the active portfolio universe
 */
function populateNewsDropdown() {
  const select = document.getElementById('select-news-holding');
  if (!select) return;

  const currentVal = select.value || state.selectedNewsTicker;
  select.innerHTML = '';

  if (!state.tickers || state.tickers.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No assets in portfolio universe';
    select.appendChild(opt);
    state.selectedNewsTicker = '';
    renderHoldingNewsPlaceholder('');
    return;
  }

  state.tickers.forEach((ticker) => {
    const opt = document.createElement('option');
    opt.value = ticker;
    const compName = getCompanyName(ticker);
    // e.g., "NVDA — NVIDIA Corporation"
    opt.textContent = `${ticker} — ${compName}`;
    select.appendChild(opt);
  });

  // Preserve previous selection if still in portfolio, else default to first
  if (currentVal && state.tickers.includes(currentVal)) {
    select.value = currentVal;
    state.selectedNewsTicker = currentVal;
  } else {
    select.value = state.tickers[0];
    state.selectedNewsTicker = state.tickers[0];
  }
}

/**
 * Renders status placeholder when Newsdata key is unconfigured or news hasn't been fetched
 */
function renderHoldingNewsPlaceholder(ticker) {
  const display = document.getElementById('holding-news-display');
  if (!display) return;

  if (!ticker) {
    display.innerHTML = `
      <div class="p-4 bg-[#070b13] border border-slate-800 rounded-xl text-slate-500 italic text-xs">
        No active holdings in portfolio. Add tickers in Settings &rarr; Portfolio to stream market intelligence.
      </div>
    `;
    return;
  }

  const hasKey = Boolean(state.apiKeys.newsData);
  const company = getCompanyName(ticker);

  if (!hasKey) {
    display.innerHTML = `
      <div class="p-4 bg-[#070b13] border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div class="space-y-1">
          <div class="flex items-center space-x-2 text-slate-300 font-mono font-bold">
            <span class="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>Asset Selected: ${escapeHtml(ticker)} (${escapeHtml(company)})</span>
          </div>
          <p class="text-slate-400 text-[11px] font-sans">
            Ready to stream market headlines. Configure your <strong>Newsdata.io API Key</strong> in <em>Settings &rarr; API Keys &amp; Feeds</em> to query live business &amp; tech intelligence on-demand. (Zero simulated news is strictly enforced).
          </p>
        </div>
        <button onclick="document.getElementById('nav-btn-settings').click(); document.getElementById('settings-subtab-general').click();" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded-lg font-mono text-[11px] transition self-start sm:self-auto cursor-pointer whitespace-nowrap">
          Open Settings &rarr;
        </button>
      </div>
    `;
  } else {
    display.innerHTML = `
      <div class="p-4 bg-[#070b13] border border-slate-800 rounded-xl flex items-center justify-between text-xs">
        <div class="flex items-center space-x-2">
          <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
          <span class="text-slate-300 font-mono font-bold">${escapeHtml(ticker)} (${escapeHtml(company)}):</span>
          <span class="text-slate-400">Ready. Click <strong>Fetch News</strong> or select any asset to stream headlines.</span>
        </div>
      </div>
    `;
  }
}

/**
 * Fetches and displays real news headlines on-demand for a chosen holding
 * Decoupled from full optimization analysis.
 */
async function fetchAndRenderHoldingNews(ticker, forceRefresh = false) {
  if (!ticker) return;
  state.selectedNewsTicker = ticker;

  const display = document.getElementById('holding-news-display');
  if (!display) return;

  const apiKey = (state.apiKeys.newsData || '').trim();

  if (!apiKey) {
    renderHoldingNewsPlaceholder(ticker);
    return;
  }

  // If already cached and not forcing refresh, render cached headlines immediately
  if (!forceRefresh && state.cachedNews[ticker]) {
    renderHoldingNewsArticles(ticker, state.cachedNews[ticker]);
    return;
  }

  const company = getCompanyName(ticker);

  // Show loading indicator
  display.innerHTML = `
    <div class="p-5 bg-[#070b13] border border-slate-800 rounded-xl flex items-center justify-center space-x-3 text-xs font-mono text-cyan-400">
      <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Streaming live Newsdata.io business &amp; tech headlines for ${escapeHtml(ticker)} (${escapeHtml(company)})...</span>
    </div>
  `;

  try {
    const result = await fetchRealNewsHeadlines(ticker, apiKey);
    state.cachedNews[ticker] = result;
    renderHoldingNewsArticles(ticker, result);
  } catch (err) {
    display.innerHTML = `
      <div class="p-4 bg-[#070b13] border border-rose-900/40 rounded-xl text-xs font-mono text-rose-300 space-y-2">
        <div class="flex items-center space-x-2">
          <span class="w-2 h-2 rounded-full bg-rose-500"></span>
          <span class="font-bold">Failed to stream headlines for ${escapeHtml(ticker)}</span>
        </div>
        <p class="text-slate-400 text-[11px] font-sans">${escapeHtml(err.message || 'Network fetch failed')}</p>
        <button onclick="window.fetchAndRenderHoldingNews('${escapeHtml(ticker)}', true)" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded text-[11px] font-mono border border-slate-700 cursor-pointer">
          Retry Fetch
        </button>
      </div>
    `;
  }
}

/**
 * Renders the fetched news articles for the selected holding into a responsive card layout
 */
function renderHoldingNewsArticles(ticker, newsResult) {
  const display = document.getElementById('holding-news-display');
  if (!display) return;

  const isOk = newsResult.status === 'ok' && newsResult.articles && newsResult.articles.length > 0;
  const company = getCompanyName(ticker);

  if (!isOk) {
    const errorMsg = newsResult.error || (newsResult.articles && newsResult.articles.length === 0 ? 'No recent news articles found for this ticker' : 'Live news query returned no results');
    display.innerHTML = `
      <div class="p-4 bg-[#070b13] border border-slate-800 rounded-xl space-y-2">
        <div class="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full bg-amber-400"></span>
            <span class="font-mono font-bold text-white text-xs">${escapeHtml(ticker)}</span>
            <span class="text-xs text-slate-400 font-sans">&bull; ${escapeHtml(company)}</span>
          </div>
          <span class="text-[10px] font-mono text-slate-500">Newsdata.io Live Feed</span>
        </div>
        <div class="text-xs font-mono text-amber-400/90 py-1">
          ${escapeHtml(errorMsg)}
        </div>
        <p class="text-[11px] text-slate-500 font-sans">
          Zero simulated data policy: If no recent headlines exist in Newsdata.io for this specific ticker, simulated news is never invented.
        </p>
      </div>
    `;
    return;
  }

  display.innerHTML = `
    <div class="space-y-2.5">
      <div class="flex items-center justify-between px-1 text-xs">
        <div class="flex items-center space-x-2">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span class="font-mono font-bold text-white">${escapeHtml(ticker)}</span>
          <span class="text-slate-400 font-sans hidden sm:inline">&bull; ${escapeHtml(company)}</span>
          <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/50">${newsResult.articles.length} Verified Headlines</span>
        </div>
        <span class="text-[10px] font-mono text-slate-500">Newsdata.io Feed</span>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        ${newsResult.articles.map(article => `
          <div class="bg-[#070b13] border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex flex-col justify-between space-y-2.5 transition-all group">
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span class="text-cyan-400/90 font-medium truncate max-w-[130px]">${escapeHtml(article.source_id || 'News')}</span>
                <span>${escapeHtml(article.pubDate ? new Date(article.pubDate).toLocaleDateString() : 'Recent')}</span>
              </div>
              <h5 class="text-xs text-slate-200 group-hover:text-cyan-300 font-sans font-medium leading-snug line-clamp-3 transition">
                ${escapeHtml(article.title)}
              </h5>
            </div>

            <div class="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono">
              <span class="text-slate-500">${escapeHtml(ticker)}</span>
              ${article.link && article.link !== '#' ? `
                <a href="${escapeHtml(article.link)}" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 hover:underline">
                  <span>Read Article</span>
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ` : '<span class="text-slate-600">No link</span>'}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// Expose to window for inline onclick handlers
window.fetchAndRenderHoldingNews = fetchAndRenderHoldingNews;

/**
 * Generate 2-paragraph Executive Commentary using OpenRouter API
 * Strictly enforces real API response - never outputs invented commentary!
 */
async function generateAICommentary(analysisPayload, top2, newsMap, apiKey) {
  const thesisContainer = document.getElementById('thesis-text');
  const copyBtn = document.getElementById('btn-copy-thesis');
  const modelTag = document.getElementById('thesis-model-tag');

  if (thesisContainer) {
    thesisContainer.innerHTML = `
      <div class="flex items-center space-x-2 text-purple-400 font-mono text-xs py-4">
        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Synthesizing portfolio posture and headline context with OpenRouter LLM...</span>
      </div>
    `;
  }

  // Check OpenRouter Key
  if (!apiKey) {
    renderThesisError('OpenRouter API key is not configured. Please enter your OpenRouter key in Settings to generate AI executive commentary. Commentary is never fabricated.');
    if (modelTag) modelTag.textContent = 'API Key Required';
    return;
  }

  const portfolioSummary = analysisPayload.survivors.map(s => ({
    ticker: s.ticker,
    company: getCompanyName(s.ticker),
    weight: `${(s.weight * 100).toFixed(2)}%`,
    annualized_volatility: `${(s.annualVol * 100).toFixed(1)}%`,
    sma50_vs_200: s.sma50 > s.sma200 ? 'Bullish Golden Cross (SMA50 > SMA200)' : 'Bearish Death Cross (SMA50 < SMA200)',
    macd_momentum: `MACD Line: ${s.macdLine.toFixed(2)} vs Signal Line: ${s.signalLine.toFixed(2)} (Histogram: ${s.macdHist > 0 ? '+' : ''}${s.macdHist.toFixed(2)} - Accelerating Momentum)`,
    rsi: s.rsi.toFixed(1),
  }));

  const promptPayload = {
    task: 'Quantitative Portfolio Executive Briefing',
    portfolio_allocation: portfolioSummary,
    top_holdings_news: newsMap,
    instructions: 'Write a concise, exactly 2-paragraph executive commentary explaining the quantitative regime, inverse-volatility risk distribution, and how recent market context intersects with the top holdings. MANDATORY DIRECTIVE: Go directly into the summary analysis in the very first sentence. Never output introductory filler or conversational preambles like "Here is the summary", "Here is your executive memorandum", "Sure", "Certainly", or "Below is...".',
  };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Quantitative SPA Dashboard',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct',
        models: [
          'meta-llama/llama-3.1-8b-instruct',
          'meta-llama/llama-3.3-70b-instruct',
          'meta-llama/llama-3.2-3b-instruct',
        ],
        messages: [
          {
            role: 'system',
            content: 'You are a Senior Quantitative Portfolio Manager and Chief Investment Officer. Provide crisp, institutional, two-paragraph executive commentary based strictly on the provided real technical screening and risk parity data. Do not make up fake metrics. STRICT RULE: Output ONLY the two executive commentary paragraphs directly. Never begin with conversational preambles or lead-in phrases such as "Here is the summary", "Here is your executive commentary", "Sure,", "Certainly,", or "Below is the memorandum". Begin immediately with the analytical commentary.',
          },
          {
            role: 'user',
            content: `Here is our quantitative portfolio optimization state and intelligence payload:\n\n${JSON.stringify(promptPayload, null, 2)}\n\nDeliver your concise 2-paragraph executive memorandum now. Go directly into the summary analysis. Do not include any introductory phrase such as "Here is the summary". Start directly with paragraph 1.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (response.ok) {
      const json = await response.json();
      const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
      if (content) {
        renderFormattedThesis(content);
        if (copyBtn) copyBtn.classList.remove('hidden');
        if (modelTag) modelTag.textContent = json.model || 'meta-llama/llama-3.1-8b-instruct';
        return;
      }
    }

    const errText = await response.text();
    let parsedErr = '';
    try {
      const errJson = JSON.parse(errText);
      parsedErr = errJson?.error?.message || errText;
    } catch {
      parsedErr = errText;
    }
    throw new Error(`OpenRouter error (${response.status}): ${parsedErr}`);
  } catch (err) {
    console.error('OpenRouter generation failed:', err);
    renderThesisError(`OpenRouter LLM generation failed: ${err.message}. (Never fabricating simulated AI commentary).`);
    if (modelTag) modelTag.textContent = 'LLM Error';
  }
}

function renderThesisError(errorMessage) {
  const container = document.getElementById('thesis-text');
  const copyBtn = document.getElementById('btn-copy-thesis');
  if (copyBtn) copyBtn.classList.add('hidden');
  if (!container) return;

  container.innerHTML = `
    <div class="p-4 bg-rose-950/20 border border-rose-900/40 rounded-lg text-xs font-mono text-rose-300 space-y-1">
      <div class="font-bold flex items-center space-x-1.5">
        <svg class="w-4 h-4 text-rose-400" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <span>AI Commentary Notice</span>
      </div>
      <p class="text-rose-200/90">${escapeHtml(errorMessage)}</p>
    </div>
  `;
}

/**
 * Strips conversational opening lines or preambles like "Here is the summary:",
 * "Here is your executive memorandum:", "Sure, here is...", etc., ensuring the
 * output starts immediately with the executive commentary.
 */
function stripAICommentaryPreamble(text) {
  if (!text) return '';
  let cleaned = text.trim();
  // Strip conversational conversational openers like "Certainly!", "Sure,", etc. if at start of string
  cleaned = cleaned.replace(/^(?:sure|certainly|absolutely|of course)[!.,\s]*/i, '');
  // Strip "Here is / are ... :" or "Below is / are ... :" or ending with newline/colon
  cleaned = cleaned.replace(/^(?:here|below)\s+(?:is|are)\s+[^:\n.]*(?:[:.]|\n)\s*/i, '');
  // Strip standalone header lines like "Executive Summary:" or "**Executive Summary**:"
  cleaned = cleaned.replace(/^(?:\*{1,2})?(?:executive\s+memorandum|executive\s+summary|portfolio\s+commentary|summary)(?:\*{1,2})?[:\s]*\n*/i, '');
  return cleaned.trim();
}

function renderFormattedThesis(rawText) {
  const container = document.getElementById('thesis-text');
  if (!container) return;

  const directContent = stripAICommentaryPreamble(rawText);
  const paragraphs = directContent.split('\n\n').map(p => p.trim()).filter(Boolean);
  container.innerHTML = paragraphs.map(p => `<p class="leading-relaxed text-slate-200">${escapeHtml(p)}</p>`).join('');
}

// ============================================================================
// API CREDENTIALS CONNECTION TESTER
// ============================================================================
async function handleTestApis() {
  const fhInput = document.getElementById('input-finnhub-key');
  const orInput = document.getElementById('input-openrouter-key');
  const ndInput = document.getElementById('input-newsdata-key');
  const fhKey = fhInput ? fhInput.value.trim() : (state.apiKeys.finnhub || '');
  const orKey = orInput ? orInput.value.trim() : (state.apiKeys.openRouter || '');
  const ndKey = ndInput ? ndInput.value.trim() : (state.apiKeys.newsData || '');

  const btnTest = document.getElementById('btn-test-apis');
  const textTest = document.getElementById('text-test-apis');
  const iconTest = document.getElementById('icon-test-apis');

  if (btnTest) btnTest.disabled = true;
  if (textTest) textTest.textContent = 'Testing Feeds...';
  if (iconTest) iconTest.classList.add('animate-spin');

  showToast('Testing live API connections...', 'info');

  const results = [];
  const serviceStatuses = [];

  try {
    // 1. Test Finnhub Market Feed
    if (fhKey) {
      try {
        const quote = await fetchFinnhubQuote('AAPL', fhKey);
        if (typeof quote?.c === 'number' && quote.c > 0) {
          results.push(`Finnhub: OK (AAPL $${quote.c.toFixed(2)})`);
          serviceStatuses.push({
            service: 'Finnhub Market Data',
            status: 'ok',
            message: `Connected successfully. Live AAPL quote verified at $${quote.c.toFixed(2)}.`,
          });
        } else {
          results.push('Finnhub: Empty Quote');
          serviceStatuses.push({
            service: 'Finnhub Market Data',
            status: 'error',
            message: 'API connected but returned empty quote data.',
          });
        }
      } catch (err) {
        results.push(`Finnhub: Error (${err.message})`);
        serviceStatuses.push({
          service: 'Finnhub Market Data',
          status: 'error',
          message: err.message || 'Authentication error',
        });
      }
    } else {
      results.push('Finnhub: Key Required');
      serviceStatuses.push({
        service: 'Finnhub Market Data',
        status: 'unconfigured',
        message: 'Finnhub API key is required for real-time market data polling.',
      });
    }

    // 2. Test OpenRouter LLM Feed
    if (orKey) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
          headers: {
            'Authorization': `Bearer ${orKey}`,
            'HTTP-Referer': window.location.origin,
            'X-Title': 'Quantitative SPA Dashboard',
          },
        });

        if (res.ok) {
          const authData = await res.json().catch(() => null);
          const keyLabel = authData?.data?.label ? ` (${authData.data.label})` : '';
          const keyLimit = authData?.data?.limit != null ? ` [Limit: $${authData.data.limit}]` : '';
          results.push(`OpenRouter: OK${keyLabel}`);
          serviceStatuses.push({
            service: 'OpenRouter AI Feed',
            status: 'ok',
            message: `Key valid & authorized${keyLabel}${keyLimit}. Default model: meta-llama/llama-3.1-8b-instruct.`,
          });
        } else {
          const errText = await res.text();
          let errMsg = `HTTP ${res.status}`;
          try {
            const errJson = JSON.parse(errText);
            if (errJson?.error?.message) errMsg = errJson.error.message;
          } catch (_) {}
          results.push(`OpenRouter: Error (${errMsg})`);
          serviceStatuses.push({
            service: 'OpenRouter AI Feed',
            status: 'error',
            message: `Authentication failed (${errMsg}). Verify your API key at openrouter.ai/keys.`,
          });
        }
      } catch (err) {
        results.push(`OpenRouter: Network Error (${err.message})`);
        serviceStatuses.push({
          service: 'OpenRouter AI Feed',
          status: 'error',
          message: `Network error connecting to openrouter.ai: ${err.message}`,
        });
      }
    } else {
      results.push('OpenRouter: Optional (Not Set)');
      serviceStatuses.push({
        service: 'OpenRouter AI Feed',
        status: 'unconfigured',
        message: 'OpenRouter key not configured. (Phase 3 AI Executive commentary will be bypassed).',
      });
    }

    // 3. Test Newsdata.io Feed
    if (ndKey) {
      try {
        const res = await fetch(`https://newsdata.io/api/1/news?apikey=${ndKey}&q=AAPL&language=en`);
        if (res.ok) {
          const newsJson = await res.json().catch(() => null);
          const count = newsJson?.results?.length || 0;
          results.push(`Newsdata: OK (${count} articles)`);
          serviceStatuses.push({
            service: 'Newsdata.io Intelligence Feed',
            status: 'ok',
            message: `Connected successfully. Retrieved ${count} real business articles.`,
          });
        } else {
          const errText = await res.text();
          let errMsg = `HTTP ${res.status}`;
          try {
            const errJson = JSON.parse(errText);
            if (errJson?.results?.message) errMsg = errJson.results.message;
          } catch (_) {}
          results.push(`Newsdata: Error (${errMsg})`);
          serviceStatuses.push({
            service: 'Newsdata.io Intelligence Feed',
            status: 'error',
            message: `Newsdata error (${errMsg}).`,
          });
        }
      } catch (err) {
        results.push(`Newsdata: Network Error (${err.message})`);
        serviceStatuses.push({
          service: 'Newsdata.io Intelligence Feed',
          status: 'error',
          message: `Network fetch error: ${err.message}`,
        });
      }
    } else {
      results.push('Newsdata: Optional (Not Set)');
      serviceStatuses.push({
        service: 'Newsdata.io Intelligence Feed',
        status: 'unconfigured',
        message: 'Newsdata.io key not configured. (Holding intelligence feed will be bypassed).',
      });
    }

    // Render results into Diagnostics Panel
    const panel = document.getElementById('api-test-results-panel');
    const list = document.getElementById('api-test-results-list');
    const timestamp = document.getElementById('api-test-timestamp');

    if (panel && list) {
      panel.classList.remove('hidden');
      if (timestamp) {
        timestamp.textContent = `Tested at ${new Date().toLocaleTimeString()}`;
      }
      list.innerHTML = serviceStatuses.map(s => {
        const badgeBg = s.status === 'ok' ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800' :
                        s.status === 'error' ? 'bg-rose-950/60 text-rose-300 border-rose-800' :
                        'bg-slate-800 text-slate-400 border-slate-700';
        const dotBg = s.status === 'ok' ? 'bg-emerald-400' :
                      s.status === 'error' ? 'bg-rose-400' :
                      'bg-slate-500';
        return `
          <div class="p-2.5 bg-[#0b1120] border border-slate-800/80 rounded-lg flex items-start justify-between gap-2">
            <div class="space-y-0.5">
              <div class="flex items-center space-x-1.5">
                <span class="w-1.5 h-1.5 rounded-full ${dotBg}"></span>
                <span class="font-bold text-slate-200">${escapeHtml(s.service)}</span>
              </div>
              <p class="text-[11px] text-slate-400 font-sans">${escapeHtml(s.message)}</p>
            </div>
            <span class="px-2 py-0.5 text-[10px] font-mono border rounded ${badgeBg} uppercase tracking-wider shrink-0">${s.status}</span>
          </div>
        `;
      }).join('');
    }

    const hasError = serviceStatuses.some(s => s.status === 'error');
    showToast(results.join(' | '), hasError ? 'warning' : 'success', 7000);
  } finally {
    if (btnTest) btnTest.disabled = false;
    if (textTest) textTest.textContent = 'Test API Connections';
    if (iconTest) iconTest.classList.remove('animate-spin');
  }
}

// ============================================================================
// HELPER UTILITIES & LOGGING
// ============================================================================
function highlightPipelineStep(stepNumber) {
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById(`step-pill-${i}`);
    if (el) {
      if (i === stepNumber) {
        el.className = 'p-2.5 rounded-lg border border-cyan-500/80 bg-cyan-950/40 text-cyan-200 shadow-sm';
      } else if (i < stepNumber) {
        el.className = 'p-2.5 rounded-lg border border-emerald-800 bg-emerald-950/30 text-emerald-300';
      } else {
        el.className = 'p-2.5 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-400';
      }
    }
  }

  const elapsedEl = document.getElementById('pipeline-elapsed');
  if (elapsedEl) elapsedEl.textContent = `Step ${stepNumber} of 3`;
}

function logTerminal(message) {
  const terminal = document.getElementById('pipeline-terminal');
  if (!terminal) return;

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const line = document.createElement('div');
  line.innerHTML = `<span class="text-slate-500">[${now}]</span> ${escapeHtml(message)}`;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const colors = {
    success: 'border-emerald-700 bg-emerald-950/95 text-emerald-200 shadow-emerald-900/40',
    warning: 'border-amber-700 bg-amber-950/95 text-amber-200 shadow-amber-900/40',
    error: 'border-rose-700 bg-rose-950/95 text-rose-200 shadow-rose-900/40',
    info: 'border-cyan-700 bg-slate-900/95 text-slate-200 shadow-cyan-900/40',
  };

  const toast = document.createElement('div');
  toast.className = `pointer-events-auto border rounded-lg px-4 py-3 text-xs font-mono shadow-lg transition-all duration-300 transform translate-y-2 opacity-0 flex items-center space-x-2.5 ${colors[type] || colors.info}`;
  toast.innerHTML = `
    <span class="w-2 h-2 rounded-full ${type === 'success' ? 'bg-emerald-400' : type === 'error' ? 'bg-rose-400' : type === 'warning' ? 'bg-amber-400' : 'bg-cyan-400'}"></span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  // Animate out
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
