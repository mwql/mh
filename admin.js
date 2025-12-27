// =============================
// ADMIN PAGE FUNCTIONALITY
// =============================

const ADMIN_PASSWORD = '2'; // Password: 1+1=2
const PREDICTIONS_STORAGE_KEY = 'weatherPredictions';
const ITHINK_STORAGE_KEY = 'ithinkMessage';
const SB_SETTINGS_KEY = 'supabaseSyncSettings';

// GLOBAL SUPABASE CONFIG (Added for cross-device sync)
const SB_URL = 'https://jfmvebvwovibxuxskrcd.supabase.co';
const SB_KEY = 'sb_publishable_YSsIGJW7AQuh37VqbwmDWg_fmRZVXVh';

// Make functions global immediately (Top of file to ensure they are available to UI)
window.checkPassword = checkPassword;
window.saveSupabaseSettings = saveSupabaseSettings;
window.testSupabaseConnection = testSupabaseConnection;
window.toggleKeyVisibility = toggleKeyVisibility;
window.addForecast = addPrediction; // Alias for compatibility if needed
window.addPrediction = addPrediction;
window.deletePrediction = deletePrediction;
window.saveIThinkMessage = saveIThinkMessage;

// Load Supabase settings from localStorage
function loadSupabaseSettings() {
    console.log('Admin: loadSupabaseSettings called');
    
    // Fill with global config first if available
    if (SB_URL) document.getElementById('sb-url').value = SB_URL;
    if (SB_KEY) document.getElementById('sb-key').value = SB_KEY;

    const stored = localStorage.getItem(SB_SETTINGS_KEY);
    if (stored) {
        try {
            const settings = JSON.parse(stored);
            if (settings.url) document.getElementById('sb-url').value = settings.url;
            if (settings.key) document.getElementById('sb-key').value = settings.key;
            console.log('Admin: Supabase settings loaded (LocalStorage Override)');
        } catch (e) {
            console.error('Admin: Error loading Supabase settings', e);
        }
    }
}

// Save Supabase settings to localStorage
function saveSupabaseSettings() {
    console.log('Admin: saveSupabaseSettings triggered');
    const urlInput = document.getElementById('sb-url');
    const keyInput = document.getElementById('sb-key');
    
    if (!urlInput || !keyInput) {
        alert('Error: UI elements not found. Please refresh the page.');
        return;
    }

    const url = urlInput.value.trim();
    const key = keyInput.value.trim();
    
    if (!url || !key) {
        alert('Please fill in both the Supabase URL and the Anon Key');
        return;
    }
    
    const settings = { url, key };
    localStorage.setItem(SB_SETTINGS_KEY, JSON.stringify(settings));
    
    // Visual feedback
    const status = document.getElementById('sb-status');
    if (status) {
        status.textContent = '✅ Settings Saved Successfully!';
        status.style.color = '#10b981';
        status.style.display = 'block';
        status.style.border = '1px solid #10b981';
        
        console.log('Admin: Supabase settings saved to localStorage');
        
        // Hide status after 4 seconds
        setTimeout(() => {
            status.style.display = 'none';
        }, 4000);
    } else {
        alert('Settings saved successfully!');
    }
}

// Toggle Key Visibility
function toggleKeyVisibility() {
    const keyInput = document.getElementById('sb-key');
    const toggleBtn = document.getElementById('toggle-key');
    if (keyInput.type === 'password') {
        keyInput.type = 'text';
        toggleBtn.textContent = 'Hide';
    } else {
        keyInput.type = 'password';
        toggleBtn.textContent = 'Show';
    }
}

// Test Supabase Connection
async function testSupabaseConnection() {
    const url = document.getElementById('sb-url').value.trim();
    const key = document.getElementById('sb-key').value.trim();
    const status = document.getElementById('sb-status');
    
    if (!url || !key) {
        alert('Please fill in both fields before testing');
        return;
    }
    
    status.textContent = '⏳ Testing connection...';
    status.style.color = '#cbd5e1';
    status.style.display = 'block';
    
    // Test by fetching from predictions table
    const requestUrl = `${url.replace(/\/$/, '')}/rest/v1/predictions?select=count`;
    
    try {
        const response = await fetch(requestUrl, {
            headers: { 
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });
        
        if (response.ok) {
            status.textContent = '✅ Connection Successful! Found predictions table';
            status.style.color = '#10b981';
            status.style.border = '1px solid #10b981';
        } else {
            const error = await response.json();
            let msg = error.message || 'Unknown error';
            if (response.status === 401) msg = 'Invalid API Key (401)';
            if (response.status === 404) msg = 'Table "predictions" not found (404)';
            
            status.textContent = '❌ Connection Failed: ' + msg;
            status.style.color = '#ef4444';
            status.style.border = '1px solid #ef4444';
        }
    } catch (error) {
        status.textContent = '❌ Network Error: ' + error.message;
        status.style.color = '#ef4444';
        status.style.border = '1px solid #ef4444';
    }
}

// Sync predictions to Supabase
async function syncToSupabase(predictions) {
    // 1. Get credentials (Global first, then LocalStorage)
    let url = SB_URL;
    let key = SB_KEY;

    if (!url || !key) {
        const stored = localStorage.getItem(SB_SETTINGS_KEY);
        if (stored) {
            const settings = JSON.parse(stored);
            url = url || settings.url;
            key = key || settings.key;
        }
    }

    if (!url || !key) {
        console.warn('Admin: Supabase settings not found, skipping sync');
        return;
    }
    
    const requestUrl = `${url.replace(/\/$/, '')}/rest/v1/predictions`;
    const lastStatus = document.getElementById('sync-last-status');
    
    try {
        console.log('Admin: Syncing to Supabase...');
        if (lastStatus) lastStatus.textContent = '⏳ Syncing...';
        
        // 1. Delete all existing records (PostgREST style)
        const deleteResponse = await fetch(`${requestUrl}?id=gt.0`, {
            method: 'DELETE',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });

        if (!deleteResponse.ok) {
            const errorData = await deleteResponse.json();
            throw new Error(errorData.message || 'Failed to clear old predictions');
        }
        
        // 2. Insert new records
        if (predictions.length > 0) {
            // WORKAROUND: Embed uploader in notes to avoid schema mismatch
            const sbPredictions = predictions.map(p => {
                let noteContent = p.notes || '';
                // Append uploader tag if it exists
                if (p.uploader) {
                    noteContent += ` {{uploader:${p.uploader}}}`;
                }
                
                return {
                    date: p.date,
                    to_date: p.toDate || null,
                    temperature: p.temperature,
                    condition: p.condition,
                    notes: noteContent.trim() || null
                    // uploader field intentionally omitted to fit schema
                };
            });

            const insertResponse = await fetch(requestUrl, {
                method: 'POST',
                headers: {
                    'apikey': key,
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(sbPredictions)
            });

            if (!insertResponse.ok) {
                const errorData = await insertResponse.json();
                throw new Error(errorData.message || 'Failed to insert new predictions');
            }
        }
        
        console.log('Admin: Supabase sync successful!');
        if (lastStatus) {
            const now = new Date();
            lastStatus.textContent = `✅ Last sync: ${now.toLocaleTimeString()}`;
            lastStatus.style.color = '#10b981';
        }
    } catch (error) {
        console.error('Admin: Error syncing to Supabase', error);
        if (lastStatus) {
            lastStatus.textContent = `❌ Sync error: ${error.message}`;
            lastStatus.style.color = '#ef4444';
        }
        alert('Supabase Sync Failed: ' + error.message);
    }
}



// Global state
let currentPredictions = [];

// Initialize predictions
async function initializePredictions() {
    console.log('Admin: Initializing predictions...');
    
    // 1. Try to fetch from Supabase (Global first, then LocalStorage)
    let url = SB_URL;
    let key = SB_KEY;

    if (!url || !key) {
        const sbStored = localStorage.getItem(SB_SETTINGS_KEY);
        if (sbStored) {
            try {
                const settings = JSON.parse(sbStored);
                url = settings.url;
                key = settings.key;
            } catch (e) {}
        }
    }

    if (url && key) {
        try {
            const requestUrl = `${url.replace(/\/$/, '')}/rest/v1/predictions?order=date.desc`;
            
            console.log('Admin: Fetching from Supabase...');
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
                localStorage.setItem(PREDICTIONS_STORAGE_KEY, JSON.stringify(normalizedData));
                return normalizedData;
            }
        } catch (error) {
            console.error('Admin: Error syncing from Supabase', error);
        }
    }

    // 2. Fallback to localStorage
    const stored = localStorage.getItem(PREDICTIONS_STORAGE_KEY);
    if (stored) {
        try {
            const predictions = JSON.parse(stored);
            console.log('Admin: Loaded from localStorage:', predictions.length);
            return predictions;
        } catch (e) {
            console.error("Admin: Error parsing localStorage", e);
            localStorage.removeItem(PREDICTIONS_STORAGE_KEY);
        }
    }
    
    // 3. Fallback to data.json
    try {
        console.log('Admin: Fetching from data.json...');
        const response = await fetch('data.json?t=' + Date.now());
        if (response.ok) {
            const predictions = await response.json();
            console.log('Admin: Loaded from data.json:', predictions.length);
            localStorage.setItem(PREDICTIONS_STORAGE_KEY, JSON.stringify(predictions));
            return predictions;
        }
    } catch (error) {
        console.error('Admin: Error loading data.json', error);
    }
    
    return [];
}

// Save predictions
function savePredictions(predictions) {
    console.log('Admin: Saving to localStorage:', predictions.length);
    localStorage.setItem(PREDICTIONS_STORAGE_KEY, JSON.stringify(predictions));
}

// Check password
function checkPassword() {
    const passwordInput = document.getElementById('admin-password');
    const loginSection = document.getElementById('login-section');
    const adminPanel = document.getElementById('admin-panel');
    const errorMsg = document.getElementById('error-msg');
    
    if (passwordInput.value === ADMIN_PASSWORD) {
        loginSection.style.display = 'none';
        adminPanel.style.display = 'block';
        loadAdminData();
    } else {
        errorMsg.style.display = 'block';
        passwordInput.value = '';
    }
}

// Load admin data
async function loadAdminData() {
    loadSupabaseSettings(); // Load settings first
    await loadPredictionsForAdmin();
    await loadIThinkMessage();
    updateAnalytics();
    setInterval(updateAnalytics, 5000);
}

async function loadIThinkMessage() {
    const input = document.getElementById('ithink-message');
    if (!input) return;

    // Find the config item in currentPredictions
    const configItem = currentPredictions.find(p => p.condition === '__ITHINK__');
    if (configItem) {
        input.value = configItem.notes;
    } else {
        // Default if not found
        input.value = "اجواء ورياح باردة، سيتم تحديث الموقع بتاريخ (2026/01/01)";
    }
}

async function saveIThinkMessage() {
    const message = document.getElementById('ithink-message').value;
    
    // Find or create the config item
    let configItem = currentPredictions.find(p => p.condition === '__ITHINK__');
    if (configItem) {
        configItem.notes = message;
    } else {
        currentPredictions.push({
            date: '2000-01-01', // Dummy date
            temperature: '0',    // Dummy temp
            condition: '__ITHINK__',
            notes: message
        });
    }

    savePredictions(currentPredictions);
    
    // This now syncs EVERYTHING including the new "I Think" record
    await syncToSupabase(currentPredictions);
    alert('Message updated and synced with forecasts!');
}

// Update analytics
function updateAnalytics() {
    if (typeof getTodayPageViews === 'function') {
        const viewData = getTodayPageViews();
        document.getElementById('view-count').textContent = viewData.count;
        
        const dateObj = new Date(viewData.date + 'T00:00:00');
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('analytics-date').textContent = dateObj.toLocaleDateString('en-US', options);
    }
}

// Load predictions for admin
async function loadPredictionsForAdmin() {
    try {
        currentPredictions = await initializePredictions();
        displayPredictionsInAdmin(currentPredictions);
    } catch (error) {
        console.error('Admin: Error loading predictions', error);
    }
}

// Display predictions
function displayPredictionsInAdmin(predictions) {
    console.log('Admin: Displaying', predictions.length, 'predictions');
    const container = document.getElementById('predictions-admin-list');
    container.innerHTML = '';
    
    if (!predictions || predictions.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center;">No predictions yet.</p>';
        return;
    }
    
    predictions.forEach((pred, index) => {
        // Skip config items
        if (pred.condition === '__ITHINK__') return;

        const card = document.createElement('div');
        card.className = 'admin-prediction-card';
        
        let dateRange = pred.date;
        if (pred.toDate) dateRange += ` to ${pred.toDate}`;
        
        card.innerHTML = `
            <div class="admin-pred-info">
                <h4>${pred.condition}</h4>
                <p><strong>Date:</strong> ${dateRange}</p>
                <p><strong>Temperature:</strong> ${pred.temperature}°C</p>
                ${pred.uploader ? `<p><strong>Uploader:</strong> ${pred.uploader}</p>` : ''}
                ${pred.notes ? `<p><strong>Notes:</strong> ${pred.notes}</p>` : ''}
            </div>
            <button class="delete-btn" onclick="deletePrediction(${index})">Delete</button>
        `;
        container.appendChild(card);
    });
}

// Delete prediction
async function deletePrediction(index) {
    console.log('Admin: Delete requested for index:', index);
    
    // Check if we are in a test environment (bypass confirm)
    const skipConfirm = window.localStorage.getItem('test_skip_confirm') === 'true';
    
    if (!skipConfirm && !confirm('Are you sure you want to delete this prediction?')) {
        console.log('Admin: Delete cancelled by user');
        return;
    }
    
    try {
        if (index >= 0 && index < currentPredictions.length) {
            console.log('Admin: Deleting item:', currentPredictions[index].condition);
            currentPredictions.splice(index, 1);
            savePredictions(currentPredictions);
            displayPredictionsInAdmin(currentPredictions);
            
            // Sync to Supabase
            await syncToSupabase(currentPredictions);
            
            console.log('Admin: Delete successful, list updated');
            if (!skipConfirm) alert('Prediction deleted successfully!');
        } else {
            console.error('Admin: Invalid index:', index);
        }
    } catch (error) {
        console.error('Admin: Error deleting', error);
    }
}

// Add prediction
async function addPrediction() {
    const date = document.getElementById('pred-date').value;
    const toDate = document.getElementById('pred-to-date').value;
    const temperature = document.getElementById('pred-temp').value;
    const condition = document.getElementById('pred-condition').value;
    const uploader = document.getElementById('pred-uploader').value;
    const notes = document.getElementById('pred-notes').value;
    
    if (!date || !temperature || !condition) {
        alert('Please fill in Date, Temperature, and Condition');
        return;
    }
    
    try {
        const newPrediction = {
            date: date,
            temperature: temperature,
            condition: condition,
            toDate: toDate || undefined,
            uploader: uploader || undefined,
            notes: notes || undefined
        };
        
        currentPredictions.unshift(newPrediction);
        savePredictions(currentPredictions);
        
        document.getElementById('pred-date').value = '';
        document.getElementById('pred-to-date').value = '';
        document.getElementById('pred-temp').value = '';
        document.getElementById('pred-condition').value = '';
        document.getElementById('pred-uploader').value = '';
        document.getElementById('pred-notes').value = '';
        
        displayPredictionsInAdmin(currentPredictions);
        
        // Sync to Supabase
        await syncToSupabase(currentPredictions);
        
        alert('Prediction added successfully!');
    } catch (error) {
        console.error('Admin: Error adding', error);
    }
}

// Make functions global immediately
// Enter key listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin: DOM Content Loaded');
    
    // Password input
    const passwordInput = document.getElementById('admin-password');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkPassword();
        });
    }
    
    // Supabase settings inputs
    ['sb-url', 'sb-key'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    console.log('Admin: Enter pressed on', id);
                    saveSupabaseSettings();
                }
            });
        }
    });
});
