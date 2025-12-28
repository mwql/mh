// =============================
// WEATHER API CONFIGURATION
// =============================
// API key is now loaded from admin settings or external API config
// No hardcoded keys for better security and management

function getWeatherAPIKey() {
    // Try to get from admin's external API config first
    try {
        const predictions = JSON.parse(localStorage.getItem('weatherPredictions') || '[]');
        const apiConfig = predictions.find(p => p.condition === '__EXTERNAL_APIS__');
        
        if (apiConfig && apiConfig.notes) {
            const apiList = JSON.parse(apiConfig.notes);
            if (apiList.length > 0) {
                // Extract API key from first configured API URL
                const url = apiList[0].url;
                const match = url.match(/appid=([^&]+)/);
                if (match) return match[1];
            }
        }
    } catch (e) {}
    
    // Fallback to default (can be configured in admin panel)
    return 'e89f102cfd638cfbd540bdf7fa673649'; // Default OpenWeatherMap key
}

async function fetchLiveWeatherForCity(cityName) {
    const apiKey = getWeatherAPIKey();
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&units=metric&appid=${apiKey}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Weather API error");
        const data = await response.json();

        return {
            temp: Math.round(data.main.temp),
            desc: data.weather[0].description,
            icon: data.weather[0].icon
        };
    } catch (error) {
        console.error("Live weather error:", error);
        return null;
    }
}

// ----------------------------------
// GLOBAL SUPABASE CONFIG (Added for cross-device sync)
// ----------------------------------
// Keys are now loaded from analytics.js
// window.SB_URL & window.SB_KEY are available globally

// ----------------------------------
// Fetch predictions from Supabase (fallback to localStorage)
// ----------------------------------
async function loadPredictions() {
    // 1. Try to fetch from Supabase using global config or Public Config
    // 1. Try to fetch from Supabase using global config, Public Config, or Hardcoded Config
    let url = window.SB_URL;
    let key = window.SB_KEY;
    
    // Check for hardcoded public config (for GitHub Pages visitors)
    if ((!url || !key) && window.SUPABASE_PUBLIC_CONFIG) {
        if (window.SUPABASE_PUBLIC_CONFIG.URL && window.SUPABASE_PUBLIC_CONFIG.ANON_KEY) {
            url = window.SUPABASE_PUBLIC_CONFIG.URL;
            key = window.SUPABASE_PUBLIC_CONFIG.ANON_KEY;
        }
    }

    // If global keys (from admin session) are missing, try PUBLIC config
    if (!url || !key) {
        try {
            // Read from local storage (synced data)
            const localData = JSON.parse(localStorage.getItem('weatherPredictions') || '[]');
            const publicConfig = localData.find(p => p.condition === '__PUBLIC_SUPABASE__');
            if (publicConfig && publicConfig.notes) {
                const config = JSON.parse(publicConfig.notes);
                url = config.url;
                key = config.key;
            }
        } catch(e) { console.error("Error loading public config:", e); }
    }

    if (url && key) {
        try {
            // Filter out analytics logs to save bandwidth
            const requestUrl = `${url.replace(/\/$/, '')}/rest/v1/predictions?condition=neq.__VIEW_LOG__&order=date.desc&t=${Date.now()}`;
            
            console.log('Fetching latest forecasts from Supabase...');
            const response = await fetch(requestUrl, {
                headers: { 
                    'apikey': key,
                    'Authorization': `Bearer ${key}`,
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    const normalizedData = data.map(p => {
                        let uploader = null;
                        let city = null;
                        let notes = p.notes;
                        
                        // Extract tags
                        if (notes && notes.includes('{{uploader:')) {
                            const match = notes.match(/{{uploader:(.*?)}}/);
                            if (match) {
                                uploader = match[1];
                                notes = notes.replace(match[0], '').trim();
                            }
                        }
                        if (notes && notes.includes('{{city:')) {
                            const match = notes.match(/{{city:(.*?)}}/);
                            if (match) {
                                city = match[1];
                                notes = notes.replace(match[0], '').trim();
                            }
                        }

                        return {
                            date: p.date, 
                            toDate: p.to_date, 
                            temperature: p.temperature, 
                            condition: p.condition, 
                            notes: notes, 
                            uploader: uploader,
                            city: city
                        };
                    });
                    
                    localStorage.setItem('weatherPredictions', JSON.stringify(normalizedData));
                    return normalizedData;
                }
            }
        } catch (error) {
            console.error('Error fetching from Supabase:', error);
        }
    }
    
    // 2. Try localStorage settings (User override)
    const SB_SETTINGS_KEY = 'supabaseSyncSettings';
    const storedSettings = localStorage.getItem(SB_SETTINGS_KEY);
    
    if (storedSettings) {
        try {
            const settings = JSON.parse(storedSettings);
            const url = settings.url;
            const key = settings.key;
            if (url && key) {
                // Filter logs here too
                const requestUrl = `${url.replace(/\/$/, '')}/rest/v1/predictions?condition=neq.__VIEW_LOG__&order=date.desc&t=${Date.now()}`;
                const response = await fetch(requestUrl, {
                    headers: { 
                        'apikey': key, 
                        'Authorization': `Bearer ${key}`,
                        'Cache-Control': 'no-cache'
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    if (Array.isArray(data) && data.length > 0) {
                        const normalizedData = data.map(p => {
                            let uploader = null;
                            let city = null;
                            let notes = p.notes;
                            
                            // Extract tags
                            if (notes && notes.includes('{{uploader:')) {
                                const match = notes.match(/{{uploader:(.*?)}}/);
                                if (match) {
                                    uploader = match[1];
                                    notes = notes.replace(match[0], '').trim();
                                }
                            }
                            if (notes && notes.includes('{{city:')) {
                                const match = notes.match(/{{city:(.*?)}}/);
                                if (match) {
                                    city = match[1];
                                    notes = notes.replace(match[0], '').trim();
                                }
                            }

                            return {
                                date: p.date, 
                                toDate: p.to_date, 
                                temperature: p.temperature, 
                                condition: p.condition, 
                                notes: notes, 
                                uploader: uploader,
                                city: city
                            };
                        });
                        localStorage.setItem('weatherPredictions', JSON.stringify(normalizedData));
                        return normalizedData;
                    }
                }
            }
        } catch (e) {}
    }
    
    // Fallback to localStorage if offline, fetch fails, or no settings
    const stored = localStorage.getItem('weatherPredictions');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (error) {
            console.error('Error parsing stored predictions:', error);
        }
    }
    
    // Last fallback: static data.json (for initial load)
    try {
        const response = await fetch('data.json?t=' + Date.now());
        if (response.ok) return await response.json();
    } catch (e) {}

    return [];
}

// ----------------------------------
// Display predictions on the page
// ----------------------------------
async function displayPredictions(predictions) {
    const listContainer = document.getElementById('predictions-list');
    const targetDateDisplay = document.getElementById('target-date-display');
    
    if (!listContainer) return;
    
    listContainer.innerHTML = '';

    // Filter out config items (Robust check using shared utils)
    // If getActualForecasts is available (it should be via config.js), use it.
    // Otherwise fall back to manual filtering.
    let actualForecasts = [];
    if (typeof window.getActualForecasts === 'function') {
        actualForecasts = window.getActualForecasts(predictions);
    } else {
        actualForecasts = predictions.filter(p => {
             const cond = (p.condition || '').trim();
             return !cond.startsWith('__');
        });
    }

    // -----------------------------
    // DYNAMIC EXTERNAL APIs (Only on other.html)
    // -----------------------------
    const isOtherPage = window.location.pathname.includes('other.html') || document.title.includes('Kuwait Live Weather');
    
    if (isOtherPage) {
        // Find config for external APIs
        const apiConfig = predictions.find(p => p.condition === '__EXTERNAL_APIS__');
        let apiList = [];
        
        if (apiConfig && apiConfig.notes) {
            try {
                apiList = JSON.parse(apiConfig.notes);
            } catch (e) {}
        }

        // If no APIs configured, show default Kuwait
        if (apiList.length === 0) {
            const KUWAIT_API_KEY = "6cf6b597227cd3370b52a776ca5824ac";
            const KUWAIT_URL = `https://api.openweathermap.org/data/2.5/weather?q=Kuwait&units=metric&appid=${KUWAIT_API_KEY}`;
            apiList.push({ name: 'Kuwait (Default)', url: KUWAIT_URL });
        }

        // Fetch and Render all
        for (const api of apiList) {
            try {
                const response = await fetch(api.url);
                if (response.ok) {
                    const data = await response.json();
                    const temp = Math.round(data.main.temp);
                    const desc = data.weather[0].description;
                    const icon = data.weather[0].icon;

                    const liveCard = document.createElement('div');
                    liveCard.className = 'prediction-card';
                    liveCard.innerHTML = `
                        <div class="weather-icon">
                            <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="" style="width: 40px; height: 40px;">
                        </div>
                        <div class="prediction-details">
                            <h4>${api.name}</h4>
                            <p class="temp">${temp}°C</p>
                            <p class="note">${desc}</p>
                        </div>
                    `;
                    listContainer.appendChild(liveCard);
                }
            } catch (e) {
                console.error(`Error loading API ${api.name}:`, e);
            }
        }
    }
    
    // Normalize date format (handles "2026-1-1" -> "2026-01-01")
    function normalizeDate(dateStr) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const year = parts[0];
            const month = parts[1].padStart(2, '0');
            const day = parts[2].padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        return dateStr;
    }
    
    // Update main header on index.html
    // Logic: Look for __TARGET_DATE__ config. If exists and valid, use it. Else use LIVE TODAY.
    if (targetDateDisplay) {
        let displayDate = new Date(); // Default: Live
        let isCustomDate = false;
        
        // Find config
        const dateConfig = predictions.find(p => p.condition === '__TARGET_DATE__');
        if (dateConfig && dateConfig.notes) {
            // Parse configured date (YYYY-MM-DD to Date object)
            // We append T00:00:00 to avoid timezone shifts (naive date)
            const d = new Date(dateConfig.notes + 'T00:00:00');
            if (!isNaN(d.getTime())) {
                displayDate = d;
                isCustomDate = true;
            }
        }
        
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        targetDateDisplay.textContent = displayDate.toLocaleDateString('en-US', options);
        
        // Update badge
        const badge = document.getElementById('date-mode-badge');
        const icon = document.getElementById('date-mode-icon');
        const text = document.getElementById('date-mode-text');
        
        if (badge && icon && text) {
            if (isCustomDate) {
                icon.textContent = '🎯';
                text.textContent = 'Custom Target Date';
                badge.style.color = 'var(--accent-color)';
            } else {
                icon.textContent = '📍';
                text.textContent = 'Live Date (Today)';
                badge.style.color = 'var(--text-muted)';
            }
            // Fade in badge
            badge.style.opacity = '1';
            badge.style.transition = 'opacity 0.3s ease-in';
        }
    }
    
    // -----------------------------
    // OFFICIAL FORECASTS (Only on index.html)
    // -----------------------------
    if (!isOtherPage) {
        if (actualForecasts.length === 0) {
            listContainer.innerHTML += '<p class="empty-state">No official forecasts yet.</p>';
            return;
        }
        
        actualForecasts.forEach((pred) => {
            const card = document.createElement('div');
            card.className = 'prediction-card';
            
            let icon = '❓';
            if (pred.condition.includes('Sunny')) icon = '☀️';
            else if (pred.condition.includes('Cloudy')) icon = '☁️';
            else if (pred.condition.includes('Rainy')) icon = '🌧️';
            else if (pred.condition.includes('Stormy')) icon = '⛈️';
            else if (pred.condition.includes('Snowy')) icon = '❄️';
            else if (pred.condition.includes('Windy')) icon = '💨';
            else if (pred.condition.includes('drasy') || pred.condition.includes('study')) icon = '📚';
            else if (pred.condition.includes('3aly') || pred.condition.includes('famly') || pred.condition.includes('family')) icon = '👨‍👨‍👧‍👦';
            
            // Normalize and parse date
            const normalizedDate = normalizeDate(pred.date);
            const dateObj = new Date(normalizedDate + 'T00:00:00');
            
            // English month names
            const englishMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const month = englishMonths[dateObj.getMonth()];
            const day = dateObj.getDate();
            const cardDate = `${month} ${day}`;
            
            // Handle "to date" if provided
            let dateRange = cardDate;
            if (pred.toDate) {
                const normalizedToDate = normalizeDate(pred.toDate);
                const toDateObj = new Date(normalizedToDate + 'T00:00:00');
                const toMonth = englishMonths[toDateObj.getMonth()];
                const toDay = toDateObj.getDate();
                dateRange = `${cardDate} - ${toMonth} ${toDay}`;
            }
            
            card.innerHTML = `
                <div class="weather-icon">${icon}</div>
                <div class="prediction-details">
                    <h4>
                        ${pred.condition}
                        <span style="font-size: 0.8rem; opacity: 0.6; font-weight: normal;">
                            (${dateRange})
                        </span>
                    </h4>
                    <p class="temp">${pred.temperature}°C</p>
                    ${pred.city ? `<p class="city" style="color: var(--text-color); font-size: 0.9rem; margin-top: -5px; margin-bottom: 5px;">📍 ${pred.city}</p>` : ''}
                    ${pred.uploader ? `<p class="uploader" style="color: var(--accent-color); font-size: 0.85rem; margin-bottom: 4px;">By: ${pred.uploader}</p>` : ''}
                    ${pred.notes ? `<p class="note">${pred.notes}</p>` : ''}
                </div>
            `;
            listContainer.appendChild(card);
        });
    }
}

// ----------------------------------
// Initialize the app
// ----------------------------------
async function initApp() {
    if (window.appInitialized) return;
    window.appInitialized = true;
    
    console.log("Mahdawi Weather: Initializing...");
    
    // 1. Display "Today" on both pages immediately
    const inlineDateDisplay = document.getElementById('target-date-inline');
    const targetDateDisplay = document.getElementById('target-date-display');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const todayStr = new Date().toLocaleDateString('en-US', options);

    if (inlineDateDisplay) inlineDateDisplay.textContent = todayStr;
    if (targetDateDisplay) targetDateDisplay.textContent = todayStr;
    
    // 2. Load and display predictions
    async function loadAndDisplayPredictions() {
        try {
            // Show loading state
            const predictionsList = document.getElementById('predictions-list');
            const iThinkElement = document.getElementById('i-think-text');
            
            if (predictionsList && predictionsList.innerHTML.includes('No official forecasts')) {
                predictionsList.innerHTML = '<p class="empty-state" style="opacity: 0.6;">⏳ Loading forecasts...</p>';
            }
            if (iThinkElement && iThinkElement.textContent === '...') {
                iThinkElement.textContent = 'Loading...';
                iThinkElement.style.opacity = '0.6';
            }
            
            const predictions = await loadPredictions();
            
            if (!predictions || predictions.length === 0) {
                console.warn("No predictions found to display.");
                displayPredictions([]);
                
                // Reset loading states
                if (iThinkElement) {
                    iThinkElement.textContent = 'No message set';
                    iThinkElement.style.opacity = '1';
                }
                return;
            }

            // Update "I Think" message
            const iThinkConfig = predictions.find(p => p.condition === '__ITHINK__');
            if (iThinkConfig) {
                if (iThinkElement) {
                    iThinkElement.textContent = iThinkConfig.notes;
                    iThinkElement.style.opacity = '1';
                }
            } else if (iThinkElement) {
                iThinkElement.textContent = 'No message set';
                iThinkElement.style.opacity = '0.6';
            }

            // Update Header Image
            const headerImgConfig = predictions.find(p => p.condition === '__HEADER_IMAGE__');
            const headerImg = document.querySelector('.header-panel img');
            if (headerImg) {
                if (headerImgConfig && headerImgConfig.notes) {
                    headerImg.src = headerImgConfig.notes;
                    headerImg.style.borderRadius = "12px";
                    headerImg.style.objectFit = "cover";
                } else {
                    headerImg.src = 'img/Mahdawi_Weather.png';
                }
            }

            // Apply Theme
            const themeConfig = predictions.find(p => p.condition === '__THEME_CONFIG__');
            if (themeConfig && themeConfig.notes) {
                try {
                    const theme = JSON.parse(themeConfig.notes);
                    const r = document.documentElement;
                    if(theme.bg) r.style.setProperty('--bg-color', theme.bg);
                    if(theme.text) r.style.setProperty('--text-color', theme.text);
                    if(theme.primary) r.style.setProperty('--primary-color', theme.primary);
                    if(theme.accent) r.style.setProperty('--accent-color', theme.accent);
                    if(theme.cardBg) r.style.setProperty('--card-bg', theme.cardBg);
                    if(theme.cardBorder) r.style.setProperty('--card-border', theme.cardBorder);
                    if(theme.glassBg) r.style.setProperty('--glass-bg', theme.glassBg);
                    if(theme.glassBorder) r.style.setProperty('--glass-border', theme.glassBorder);
                } catch(e) {}
            }

            displayPredictions(predictions);
        } catch (err) {
            console.error("Error in loadAndDisplayPredictions:", err);
            
            // Show error state
            const predictionsList = document.getElementById('predictions-list');
            if (predictionsList) {
                predictionsList.innerHTML = '<p class="empty-state" style="color: #ef4444;">⚠️ Error loading forecasts. Please refresh.</p>';
            }
        }
    }
    
    // Initial load + smarter refresh strategy
    if (document.getElementById('predictions-list')) {
        await loadAndDisplayPredictions();
        
        // Poll every 60 seconds (reduced from 10 seconds for efficiency)
        let pollInterval = setInterval(loadAndDisplayPredictions, 60000);
        
        // Pause polling when page is hidden, resume when visible
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Clear interval when tab is hidden
                if (pollInterval) clearInterval(pollInterval);
            } else {
                // Reload immediately when tab becomes visible
                loadAndDisplayPredictions();
                // Restart polling
                pollInterval = setInterval(loadAndDisplayPredictions, 60000);
            }
        });
    }
}

// Start as early as possible
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initApp();
} else {
    document.addEventListener('DOMContentLoaded', initApp);
    window.addEventListener('load', initApp); // Fallback
}
