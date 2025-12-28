// =============================
// PAGE VIEW ANALYTICS (Synced)
// =============================

// IMPORTANT: Supabase credentials are now loaded from settings
// Do NOT hardcode keys here - they should be set in admin panel
// Hardcoded credentials as requested
window.SB_URL = "https://jfmvebvwovibxuxskrcd.supabase.co";
window.SB_KEY = "sb_publishable_YSsIGJW7AQuh37VqbwmDWg_fmRZVXVh";

// Load Supabase credentials from localStorage settings or use hardcoded defaults
function loadSupabaseCredentials() {
    // 1. Check LocalStorage (User overrides)
    try {
        const stored = localStorage.getItem('supabaseSyncSettings');
        if (stored) {
            const settings = JSON.parse(stored);
            if (settings.url && settings.key) {
                 window.SB_URL = settings.url;
                 window.SB_KEY = settings.key;
                 return true;
            }
        }
    } catch (e) {
        console.error('Analytics: Error loading settings', e);
    }

    // 2. Check defaults (Hardcoded)
    if (window.SB_URL && window.SB_KEY) {
        return true;
    }

    return false;
}

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Track a page view (Unique per day per device, Synced to DB)
async function trackPageView() {
    // Load credentials first
    if (!loadSupabaseCredentials()) {
        console.warn('Analytics: Supabase not configured, skipping tracking');
        return;
    }

    const today = getTodayDate();
    const visitTokenKey = `sync_v6_token_${today}`;
    
    // 1. Check if already visited in this session
    if (sessionStorage.getItem(visitTokenKey)) {
        return; // Silent - already tracked
    }

    try {
        const url = `${window.SB_URL.replace(/\/$/, '')}/rest/v1/predictions`;
        
        // INSERT new log record (Safe, no race conditions)
        const payload = {
            condition: '__VIEW_LOG__',
            notes: JSON.stringify({ 
                device: navigator.userAgent.substring(0, 50), // First 50 chars of UA
                timestamp: new Date().toISOString(),
                date: today 
            }),
            date: today,
            temperature: '0'  // Required field
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': window.SB_KEY,
                'Authorization': `Bearer ${window.SB_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            sessionStorage.setItem(visitTokenKey, 'true');
            console.log('Analytics: Visit logged');
        } else {
            const errorText = await response.text();
            console.error('Analytics: Failed to log visit', response.status, errorText);
        }

    } catch (error) {
        console.error('Analytics: Error tracking visit', error.message);
    }
}

// Auto-track page view when script loads (only on index page)
if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
    // Delay slightly to ensure settings are loaded
    setTimeout(trackPageView, 500);
}
