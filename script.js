// =============================
// LIVE KUWAIT WEATHER API (ADDED)
// =============================
const KUWAIT_API_KEY = "6cf6b597227cd3370b52a776ca5824ac";
const KUWAIT_WEATHER_URL =
  `https://api.openweathermap.org/data/2.5/weather?q=Kuwait&units=metric&appid=${KUWAIT_API_KEY}`;

async function fetchLiveKuwaitWeather() {
    try {
        const response = await fetch(KUWAIT_WEATHER_URL);
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
const SB_URL = 'https://jfmvebvwovibxuxskrcd.supabase.co';
const SB_KEY = 'sb_publishable_YSsIGJW7AQuh37VqbwmDWg_fmRZVXVh';

// ----------------------------------
// Fetch predictions from Supabase (fallback to localStorage)
// ----------------------------------
async function loadPredictions() {
    // 1. Try to fetch from Supabase using global config
    if (SB_URL && SB_KEY) {
        try {
            const requestUrl = `${SB_URL.replace(/\/$/, '')}/rest/v1/predictions?order=date.desc`;
            
            console.log('Fetching latest forecasts from Supabase...');
            const response = await fetch(requestUrl, {
                headers: { 
                    'apikey': SB_KEY,
                    'Authorization': `Bearer ${SB_KEY}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                // Map back to the expected local format
                const normalizedData = data.map(p => {
                    let uploader = null;
                    let notes = p.notes;
                    
                    // Extract uploader from notes tag {{uploader:NAME}}
                    if (notes && notes.includes('{{uploader:')) {
                        const match = notes.match(/{{uploader:(.*?)}}/);
                        if (match) {
                            uploader = match[1];
                            notes = notes.replace(match[0], '').trim();
                        }
                    }

                    return {
                        date: p.date, 
                        toDate: p.to_date, 
                        temperature: p.temperature, 
                        condition: p.condition, 
                        notes: notes, 
                        uploader: uploader
                    };
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
                        let notes = p.notes;
                        
                        if (notes && notes.includes('{{uploader:')) {
                            const match = notes.match(/{{uploader:(.*?)}}/);
                            if (match) {
                                uploader = match[1];
                                notes = notes.replace(match[0], '').trim();
                            }
                        }

                        return {
                            date: p.date, 
                            toDate: p.to_date, 
                            temperature: p.temperature, 
                            condition: p.condition, 
                            notes: notes, 
                            uploader: uploader
                        };
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

    // Filter out config items
    const actualForecasts = predictions.filter(p => p.condition !== '__ITHINK__');

    // -----------------------------
    // LIVE KUWAIT WEATHER CARD (Only on other.html)
    // -----------------------------
    // Check if we're on other.html - only show live weather there
    const isOtherPage = window.location.pathname.includes('other.html') || document.title.includes('Kuwait Live Weather');
    
    if (isOtherPage) {
        const liveWeather = await fetchLiveKuwaitWeather();
        if (liveWeather) {
            const liveCard = document.createElement('div');
            liveCard.className = 'prediction-card';

            liveCard.innerHTML = `
                <div class="weather-icon">
                    <img src="https://openweathermap.org/img/wn/${liveWeather.icon}@2x.png" alt="" style="width: 40px; height: 40px;">
                </div>
                <div class="prediction-details">
                    <h4>Kuwait (Live Now)</h4>
                    <p class="temp">${liveWeather.temp}°C</p>
                    <p class="note">${liveWeather.desc}</p>
                </div>
            `;
            listContainer.appendChild(liveCard);
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
    
    // Update main header on index.html to ALWAYS show today's date
    if (targetDateDisplay) {
        const today = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        targetDateDisplay.textContent = today.toLocaleDateString('en-US', options);
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
            else if (pred.condition.includes('drasy')) icon = '📚';
            else if (pred.condition.includes('3aly')) icon = '🧑‍🧑‍🧒‍🧒';
            
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
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Display "Today" on both pages immediately
    const inlineDateDisplay = document.getElementById('target-date-inline');
    const targetDateDisplay = document.getElementById('target-date-display');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const todayStr = new Date().toLocaleDateString('en-US', options);

    if (inlineDateDisplay) inlineDateDisplay.textContent = todayStr;
    if (targetDateDisplay) targetDateDisplay.textContent = todayStr;
    
    // 2. Load and display predictions
    async function loadAndDisplayPredictions() {
        const predictions = await loadPredictions();
        
        // Update "I Think" message from config record
        const iThinkConfig = predictions.find(p => p.condition === '__ITHINK__');
        if (iThinkConfig) {
            const iThinkElement = document.getElementById('i-think-text');
            if (iThinkElement) iThinkElement.textContent = iThinkConfig.notes;
        }

        displayPredictions(predictions);
    }
    
    // Initial load + refresh every 60 seconds
    if (document.getElementById('predictions-list')) {
        loadAndDisplayPredictions();
        setInterval(loadAndDisplayPredictions, 60000);
    }
});
