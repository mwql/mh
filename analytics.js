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

// Track a page view
function trackPageView() {
    const today = getTodayDate();
    const storageKey = 'pageViews';
    
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

// Auto-track page view when script loads (only on index.html)
if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
    trackPageView();
}
