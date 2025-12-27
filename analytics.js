// =============================
// PAGE VIEW ANALYTICS (Synced)
// =============================

const SB_URL = 'https://jfmvebvwovibxuxskrcd.supabase.co';
const SB_KEY = 'sb_publishable_YSsIGJW7AQuh37VqbwmDWg_fmRZVXVh';

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
    const today = getTodayDate();
    const visitTokenKey = `sync_v5_token_${today}`;
    
    // 1. Check if already visited in this session
    if (sessionStorage.getItem(visitTokenKey)) {
        console.log('Analytics: Already visited today');
        return; 
    }
    
    console.log('Analytics: recording new visit...');

    try {
        const url = `${SB_URL.replace(/\/$/, '')}/rest/v1/predictions`;
        
        // INSERT new log record (Safe, no race conditions)
        const payload = {
            condition: '__VIEW_LOG__',
            notes: JSON.stringify({ device: 'visitor', date: today }), // Minimal data
            date: today,      // Store real date for easy clearing later
            temperature: '0'  // Dummy
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': SB_KEY,
                'Authorization': `Bearer ${SB_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            // Mark as visited in session
            sessionStorage.setItem(visitTokenKey, 'true');
            console.log('Analytics: Logged visit successfully');
        } else {
            console.error('Analytics: Log failed', await response.text());
        }

    } catch (error) {
        console.error('Analytics Limit/Error:', error);
    }
}

// Helper to reset views (Admin use mainly, but logic lives here or in admin.js)
// Since we are moving to DB, admin.js should handle the DB update directly for reset.
// We keep this for local testing or valid fallback.

// Auto-track page view when script loads
if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
    trackPageView();
}
