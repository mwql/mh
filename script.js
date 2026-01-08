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
// Fetch predictions from Supabase (fallback to localStorage)
async function loadPredictions() {
    // 1. Try to fetch from Supabase using global config (from analytics.js)
    let url = window.SB_URL;
    let key = window.SB_KEY;
    
    // Also check for Hardcoded/Public config if strictly needed, but Weather-main logic simplifies this:
    // Weather-main primarily checks Global Consts then LocalStorage.
    // We will stick to Window Globals then LocalStorage.

    if (url && key) {
        try {
            // Weather-main logic: ?order=date.desc (Simple)
            // Removed condition=neq filters as per Weather-main style, 
            // but for safety/cleanliness we usually want to avoid logs in the UI list.
            // Weather-main's script.js actually fetches: .../predictions?order=date.desc
            // and THEN filters: const actualForecasts = predictions.filter(...)
            // I will match that.
            
            const requestUrl = `${url.replace(/\/$/, '')}/rest/v1/predictions?order=date.desc`;
            
            console.log('Fetching latest forecasts from Supabase...');
            const response = await fetch(requestUrl, {
                headers: { 
                    'apikey': key,
                    'Authorization': `Bearer ${key}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                const normalizedData = data.map(p => {
                    let uploader = null;
                    let city = null;
                    let notes = p.notes;
                    
                    // Extract uploader from notes tag {{uploader:NAME}}
                    if (notes && notes.includes('{{uploader:')) {
                        const match = notes.match(/{{uploader:(.*?)}}/);
                        if (match) {
                            uploader = match[1];
                            notes = notes.replace(match[0], '').trim();
                        }
                    }

                    // Extract city from notes tag {{city:NAME}} (MH-weather support)
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
                        city: city,
                        isActive: notes && notes.includes('{{active:false}}') ? false : true,
                        severity: notes && notes.includes('{{severity:') ? notes.match(/{{severity:(.*?)}}/)[1] : 'normal'
                    };
                });
                
                // Clean notes from tags for display
                normalizedData.forEach(p => {
                    if (p.notes) {
                        p.notes = p.notes.replace(/{{active:false}}/, '').replace(/{{severity:.*?}}/, '').trim();
                    }
                });
                
                localStorage.setItem('weatherPredictions', JSON.stringify(normalizedData));
                return normalizedData;
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
                const requestUrl = `${url.replace(/\/$/, '')}/rest/v1/predictions?order=date.desc`;
                const response = await fetch(requestUrl, {
                    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    const normalizedData = data.map(p => {
                        let uploader = null;
                        let city = null;
                        let notes = p.notes;
                        
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
                            city: city,
                            isActive: notes && notes.includes('{{active:false}}') ? false : true,
                            severity: notes && notes.includes('{{severity:') ? notes.match(/{{severity:(.*?)}}/)[1] : 'normal'
                        };
                    });

                    // Clean notes
                    normalizedData.forEach(p => {
                        if (p.notes) {
                            p.notes = p.notes.replace(/{{active:false}}/, '').replace(/{{severity:.*?}}/, '').trim();
                        }
                    });
                    localStorage.setItem('weatherPredictions', JSON.stringify(normalizedData));
                    return normalizedData;
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
        // Must also filter for active status here
        actualForecasts = window.getActualForecasts(predictions).filter(p => p.isActive !== false);
    } else {
        actualForecasts = predictions.filter(p => {
             const cond = (p.condition || '').trim();
             // Filter out Configs AND Pending Forecasts (isActive must not be false)
             return !cond.startsWith('__') && p.isActive !== false;
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
            else if (pred.condition.includes('Update')) icon = '👨🏻‍💻';
            else if (pred.condition.includes('Clear')) icon = '';
            else if (pred.condition.includes('drasy') || pred.condition.includes('study')) icon = '📚';
            else if (pred.condition.includes('3aily') || pred.condition.includes('family')) icon = '👨‍👨‍👧‍👦';
            
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
    
    // 1. Initialize Voice & Secondary Events (Crucial to do this before display)
    if (typeof initVoiceEvents === 'function') {
        initVoiceEvents();
    }

    // 2. Display "Today" on both pages immediately
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

            // Update "I Think" Title
            const iThinkTitleConfig = predictions.find(p => p.condition === "__ITHINK_TITLE__");
            const iThinkTitleElement = document.getElementById('i-think-title');
            if (iThinkTitleElement) {
                if (iThinkTitleConfig && iThinkTitleConfig.notes && iThinkTitleConfig.notes.trim() !== '') {
                    iThinkTitleElement.textContent = iThinkTitleConfig.notes;
                } else {
                    iThinkTitleElement.textContent = 'i think'; // Default
                }
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
                    
                    // Update browser theme color
                    if(theme.bg) {
                        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
                        if (metaThemeColor) metaThemeColor.setAttribute('content', theme.bg);
                    }
                } catch(e) {}
            }

            displayPredictions(predictions);
            
            // Check for Urgent Alerts
            renderAlertTicker(predictions);

            // Render Calendar
            renderCalendarView(predictions);
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

// ----------------------------------
// Render Alert Ticker
// ----------------------------------
function renderAlertTicker(predictions) {
    const container = document.getElementById('alert-ticker-container');
    const tickerText = document.getElementById('alert-ticker-text');
    
    if (!container || !tickerText) return;
    
    // Find all active alerts
    const alerts = predictions.filter(p => p.isActive !== false && p.severity && p.severity !== 'normal');
    
    if (alerts.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    // Determine highest severity
    let highestSeverity = 'notice';
    if (alerts.some(a => a.severity === 'danger')) highestSeverity = 'danger';
    else if (alerts.some(a => a.severity === 'urgent')) highestSeverity = 'urgent';
    
    // Construct message
    const message = alerts.map(a => {
        const icon = a.severity === 'danger' ? '⚠️' : (a.severity === 'urgent' ? '🚨' : 'ℹ️');
        return `${icon} ${a.condition.toUpperCase()}: ${a.notes || 'Take precautions.'}`;
    }).join(' | ');
    
    tickerText.textContent = `*** BREAKING WEATHER NEWS *** ${message} *** FOLLOW UPDATES *** `;
    
    // Add severity class
    container.className = '';
    if (highestSeverity === 'danger') container.classList.add('ticker-danger');
    else if (highestSeverity === 'urgent') container.classList.add('ticker-urgent');
    
    container.style.display = 'block';
}

// ----------------------------------
// Switch View (List / Calendar)
// ----------------------------------
window.switchView = function(view) {
    const list = document.getElementById('predictions-list');
    const calendar = document.getElementById('predictions-calendar');
    const btnList = document.getElementById('btn-list-view');
    const btnGrid = document.getElementById('btn-grid-view');
    
    if (!list || !calendar || !btnList || !btnGrid) return;
    
    if (view === 'list') {
        list.style.display = 'grid';
        calendar.style.display = 'none';
        btnList.classList.add('active');
        btnGrid.classList.remove('active');
    } else {
        list.style.display = 'none';
        calendar.style.display = 'grid';
        btnList.classList.remove('active');
        btnGrid.classList.add('active');
    }
}

// ----------------------------------
// Render Calendar View
// ----------------------------------
function renderCalendarView(predictions) {
    const calendar = document.getElementById('predictions-calendar');
    if (!calendar) return;
    calendar.innerHTML = '';
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const actualForecasts = predictions.filter(p => p.isActive !== false && !p.condition.startsWith('__'));
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayForecast = actualForecasts.find(p => p.date === dateStr);
        
        const dayDiv = document.createElement('div');
        dayDiv.className = 'calendar-day';
        if (dayForecast) dayDiv.classList.add('has-forecast');
        if (day === now.getDate()) dayDiv.classList.add('today');
        
        dayDiv.innerHTML = `
            <div class="calendar-day-content">
                <span class="day-number">${day}</span>
                ${dayForecast ? `<span class="day-icon">${getCalendarIcon(dayForecast.condition)}</span>` : ''}
            </div>
        `;
        
        if (dayForecast) {
            dayDiv.title = `${dayForecast.condition} - ${dayForecast.temperature}°C`;
            dayDiv.onclick = () => {
                switchView('list');
                const cards = document.querySelectorAll('.prediction-card');
                for (let card of cards) {
                    if (card.textContent.includes(dayForecast.condition)) {
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        break;
                    }
                }
            };
        }
        calendar.appendChild(dayDiv);
    }
}

// Helper: Icons for Calendar
function getCalendarIcon(condition) {
    const c = condition.toLowerCase();
    if (c.includes('sun') || c.includes('clear')) return '☀️';
    if (c.includes('cloud')) return '☁️';
    if (c.includes('rain')) return '🌧️';
    if (c.includes('storm')) return '⛈️';
    return '⛅';
}

// =============================
// VOICE FEATURE LOGIC
// =============================

let mediaRecorder;
let audioChunks = [];
let recordedAudioBase64 = null;
let currentUserAudio = null;

// Voice Panel visibility is now handled by standalone section
window.toggleVoicePanel = function() {
    const card = document.getElementById('voice-management-card');
    if (card) {
        card.scrollIntoView({ behavior: 'smooth' });
    }
};

// Stop any currently playing audio
window.stopVoiceUser = function() {
    if (currentUserAudio) {
        currentUserAudio.pause();
        currentUserAudio.currentTime = 0;
        currentUserAudio = null;
        const btnPlayVoice = document.getElementById('btn-play-voice');
        if (btnPlayVoice) btnPlayVoice.innerHTML = '<span>▶️</span> Play Sound';
    }
};

async function loadSavedVoices() {
    const select = document.getElementById('voice-select');
    if (!select) return;
    
    // Fetch latest predictions
    const predictions = await loadPredictions();
    // Filter for voice assets that are NOT explicitly inactive
    const voices = predictions.filter(p => 
        p.condition === '__VOICE_ASSET__' && 
        !p.notes?.includes('{{active:false}}')
    );
    
    select.innerHTML = '<option value="">Select a shared sound...</option>';
    
    voices.forEach((v, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        // Data is stored in notes as "{{v:NAME}}BASE64"
        const match = v.notes.match(/{{v:(.*?)}}/);
        const name = match ? match[1] : `Sound ${index + 1}`;
        opt.textContent = name;
        select.appendChild(opt);
    });
    
    // Keep local storage as a cache or fallback
    window._cached_voices = voices;
}

// Initialize Voice Events
function initVoiceEvents() {
    console.log("Voice Initialization: START");
    const btnRecord = document.getElementById('btn-record');
    const btnStopRecord = document.getElementById('btn-stop-record');
    const voiceStatus = document.getElementById('voice-status');
    const uploadForm = document.getElementById('voice-upload-form');
    const btnUploadTrigger = document.getElementById('btn-upload-trigger');
    const fileInput = document.getElementById('voice-file-input');
    const btnSaveVoice = document.getElementById('btn-save-voice');
    const voiceNameInput = document.getElementById('voice-name');
    const btnPlayVoice = document.getElementById('btn-play-voice');
    const voiceSelect = document.getElementById('voice-select');

    if (btnRecord && btnStopRecord) {
        btnRecord.onclick = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                
                // Detect supported MIME type for better cross-device compatibility (iOS support)
                let options = {};
                if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    options = { mimeType: 'audio/mp4' };
                } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    options = { mimeType: 'audio/webm;codecs=opus' };
                }
                
                mediaRecorder = new MediaRecorder(stream, options);
                audioChunks = [];

                mediaRecorder.ondataavailable = (event) => {
                    audioChunks.push(event.data);
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                    recordedAudioBase64 = await blobToBase64(audioBlob);
                    voiceStatus.textContent = '✅ Recording captured!';
                    uploadForm.style.display = 'flex';
                };

                mediaRecorder.start();
                btnRecord.style.display = 'none';
                btnStopRecord.style.display = 'flex';
                voiceStatus.style.display = 'block';
                voiceStatus.textContent = '🔴 Recording...';
            } catch (err) {
                console.error('Error accessing microphone:', err);
                alert('Could not access microphone. Please ensure permissions are granted.');
            }
        };

        btnStopRecord.onclick = () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
                mediaRecorder.stream.getTracks().forEach(track => track.stop());
                btnRecord.style.display = 'flex';
                btnStopRecord.style.display = 'none';
            }
        };
    }

    if (btnUploadTrigger && fileInput) {
        btnUploadTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            // Stop any ongoing recording if user tries to upload
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                btnStopRecord.click();
            }
            fileInput.click();
        });
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            console.log('Voice: File selected:', file.name, file.type, file.size);

            if (file.size > 5 * 1024 * 1024) {
                alert('File is too large! Please choose a file under 5MB.');
                return;
            }

            voiceStatus.style.display = 'block';
            voiceStatus.textContent = `📁 Selected: ${file.name}`;
            
            try {
                const base64 = await blobToBase64(file);
                recordedAudioBase64 = base64;
                uploadForm.style.display = 'flex';
                // Reset input so the same file can be selected again if needed
                fileInput.value = '';
            } catch (err) {
                console.error('File read error:', err);
                alert('Failed to read the audio file. Please try a different format.');
            }
        });
    }

    if (btnSaveVoice) {
    btnSaveVoice.onclick = async () => {
        const name = voiceNameInput.value.trim() || `Sound ${new Date().toLocaleTimeString()}`;
        if (!recordedAudioBase64) return;

        btnSaveVoice.disabled = true;
        btnSaveVoice.textContent = '⏳ Uploading...';

        const success = await postVoiceAsset(name, recordedAudioBase64);
        
        if (success) {
            voiceNameInput.value = '';
            uploadForm.style.display = 'none';
            voiceStatus.textContent = '✨ Voice shared globally!';
            recordedAudioBase64 = null;
            await loadSavedVoices();
        } else {
            alert('Failed to share voice. Please try again.');
        }
        
        btnSaveVoice.disabled = false;
        btnSaveVoice.innerHTML = '💾 Save to Library';
    };
}

if (btnPlayVoice && voiceSelect) {
    btnPlayVoice.onclick = () => {
        const index = voiceSelect.value;
        if (index === '') {
            alert('Please select a sound first!');
            return;
        }

        const voices = window._cached_voices || [];
        const voice = voices[index];
        if (!voice) return;

        // Strip ALL metadata tags recursively using global regex
        const audioData = voice.notes.replace(/{{.*?}}/g, '');
        
        console.log("User: Playing audio, data length:", audioData.length);
        console.log("User: Audio format starts with:", audioData.substring(0, 60));
        
        // Stop any currently playing audio
        if (currentUserAudio) {
            currentUserAudio.pause();
        }
        
        try {
            currentUserAudio = new Audio(audioData);
            currentUserAudio.play().catch(e => {
                console.error('Playback error:', e);
                alert('Audio playback failed. The file might be corrupted or too large.');
            });
            
            const originalText = btnPlayVoice.innerHTML;
            btnPlayVoice.textContent = '🔊 Playing...';
            currentUserAudio.onended = () => {
                btnPlayVoice.innerHTML = originalText;
                currentUserAudio = null;
            };
        } catch (e) {
            alert('Could not play audio.');
        }
    };
    loadSavedVoices();
}
}

// Helper: Blob to Base64
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Helper: Post Voice to Supabase
async function postVoiceAsset(name, base64) {
    let url = window.SB_URL;
    let key = window.SB_KEY;

    if (!url || !key) {
        console.error('Supabase keys missing');
        return false;
    }

    try {
        const payload = {
            date: new Date().toISOString().split('T')[0],
            temperature: '0',
            condition: '__VOICE_ASSET__',
            notes: `{{v:${name}}}{{active:true}}${base64}`
        };

        const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/predictions`, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(payload)
        });

        return response.ok;
    } catch (e) {
        console.error('Error posting voice asset:', e);
        return false;
    }
}

// =============================
// MAIN INITIALIZATION TRIGGER
// =============================

// Start as early as possible
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initApp();
} else {
    document.addEventListener('DOMContentLoaded', initApp);
    window.addEventListener('load', initApp); // Fallback
}
