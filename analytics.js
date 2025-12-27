// =============================
// PAGE VIEW ANALYTICS
// =============================

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Track a page view (Unique per day per device)
function trackPageView() {
    const today = getTodayDate();
    const storageKey = 'pageViews';
    const visitTokenKey = `visit_token_${today}`;
    
    // Check if already visited today on this device
    if (localStorage.getItem(visitTokenKey)) {
        return; // Already counted today
    }
    
    // Get existing data
    let viewData = localStorage.getItem(storageKey);
    let views = viewData ? JSON.parse(viewData) : {};
    
    // If it's a new day, reset the counter
    if (views.date !== today) {
        views = {
            date: today,
            count: 0
        };
    }
    
    // Increment the counter
    views.count++;
    
    // Save back to localStorage
    localStorage.setItem(storageKey, JSON.stringify(views));
    
    // Mark this device as visited for today
    localStorage.setItem(visitTokenKey, 'true');
}

// Get today's page view count
function getTodayPageViews() {
    const today = getTodayDate();
    const storageKey = 'pageViews';
    
    let viewData = localStorage.getItem(storageKey);
    let views = viewData ? JSON.parse(viewData) : {};
    
    // If the stored date is not today, return 0
    if (views.date !== today) {
        return {
            date: today,
            count: 0
        };
    }
    
    return views;
}

// Reset daily views (Admin function)
function resetDailyViews() {
    const today = getTodayDate();
    const storageKey = 'pageViews';
    const visitTokenKey = `visit_token_${today}`;
    
    const views = {
        date: today,
        count: 0
    };
    
    localStorage.setItem(storageKey, JSON.stringify(views));
    localStorage.removeItem(visitTokenKey); // Allow counting again if desired, or keep it? 
    // Usually reset implies we want to start over, so removing token allows "me" to be counted again as 1.
    
    return views;
}

// Make globally available
window.resetDailyViews = resetDailyViews;

// Auto-track page view when script loads (only on index.html)
if (window.location.pathname.includes('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('/')) {
    trackPageView();
}
