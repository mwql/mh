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
    const visitTokenKey = `sync_v3_token_${today}`;
    
    // 1. Check if already visited today on this device
    if (localStorage.getItem(visitTokenKey)) {
        console.log('Analytics: Already visited today');
        return; 
    }
    
    console.log('Analytics: recording new visit...');

    try {
        const url = `${SB_URL.replace(/\/$/, '')}/rest/v1/predictions`;
        
        // 2. Fetch existing analytics record
        const response = await fetch(`${url}?condition=eq.__ANALYTICS__&select=*`, {
            headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
        });

        if (!response.ok) throw new Error('Failed to fetch analytics');
        
        const data = await response.json();
        let record = data.length > 0 ? data[0] : null;
        
        let views = { date: today, count: 0 };
        
        // Parse existing data
        if (record && record.notes) {
            try {
                const storedViews = JSON.parse(record.notes);
                // If it's the same day, keep the count. If new day, reset (logic handled by just initializing 0 above)
                if (storedViews.date === today) {
                    views = storedViews;
                }
            } catch (e) {}
        }
        
        // 3. Increment
        views.count++;
        views.date = today; // Ensure date is current
        
        const payload = {
            condition: '__ANALYTICS__',
            notes: JSON.stringify(views),
            date: '2000-01-01', // Dummy date
            temperature: '0'     // Dummy temp
        };

        // 4. Update or Insert
        let updateUrl = url;
        let method = 'POST';
        
        if (record) {
            // Update existing using ID if possible (safer), else condition
            if (record.id) {
                updateUrl = `${url}?id=eq.${record.id}`;
            } else {
                updateUrl = `${url}?condition=eq.__ANALYTICS__`;
            }
            method = 'PATCH';
        }
        
        await fetch(updateUrl, {
            method: method,
            headers: {
                'apikey': SB_KEY,
                'Authorization': `Bearer ${SB_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(payload)
        });
        
        // 5. Mark as visited locally
        localStorage.setItem(visitTokenKey, 'true');
        console.log('Analytics: Visit synced successfully');

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
