// =============================
// ADMIN PAGE FUNCTIONALITY
// =============================

const ADMIN_PASSWORD = "0102"; // Password: 0102
const USER_PASSWORD = "11"; // Password: 11
const PREDICTIONS_STORAGE_KEY = "weatherPredictions";
const ITHINK_STORAGE_KEY = "ithinkMessage";
const SB_SETTINGS_KEY = "supabaseSyncSettings";

// Access Control State
let currentUserRole = null; // 'admin' or 'user'
let userSessionUploadCount = 0;
const USER_UPLOAD_LIMIT = 2;
const USER_API_LIMIT = 2; // Max 2 API cities for users

// API Management State (Global to avoid TDZ)
let pendingApiValid = false;
let pendingApiUrl = ''; 
let pendingApiName = '';
let pendingHeaderImageBase64 = null; // New: For header image upload
let currentPredictions = []; // Global predictions array

// GLOBAL SUPABASE CONFIG
// SB_URL and SB_KEY are provided by analytics.js to avoid duplication/collision

// Make functions global immediately (Top of file to ensure they are available to UI)
window.checkPassword = checkPassword;
window.saveSupabaseSettings = saveSupabaseSettings;
window.testSupabaseConnection = testSupabaseConnection;
window.toggleKeyVisibility = toggleKeyVisibility;
window.addForecast = addPrediction; // Alias for compatibility if needed
window.addPrediction = addPrediction;
window.deletePrediction = deletePrediction;
window.deletePrediction = deletePrediction;
window.saveIThinkMessage = saveIThinkMessage;
window.saveTargetDate = saveTargetDate;
window.handleHeaderImageSelect = handleHeaderImageSelect;
window.uploadHeaderAsset = uploadHeaderAsset;
window.activateHeaderAsset = activateHeaderAsset;
window.removeActiveHeader = removeActiveHeader;
window.deleteHeaderAsset = deleteHeaderAsset;
window.testApiConnection = testApiConnection;
window.addExternalApi = addExternalApi;
window.removeApi = removeApi;
window.debugAnalytics = debugAnalytics;
window.saveThemeSettings = saveThemeSettings;
window.resetThemeSettings = resetThemeSettings;

// Load Supabase settings from localStorage
function loadSupabaseSettings() {
  console.log("Admin: loadSupabaseSettings called");

  // Fill with global config first if available
  if (SB_URL) document.getElementById("sb-url").value = SB_URL;
  if (SB_KEY) document.getElementById("sb-key").value = SB_KEY;

  const stored = localStorage.getItem(SB_SETTINGS_KEY);
  if (stored) {
    try {
      const settings = JSON.parse(stored);
      if (settings.url) document.getElementById("sb-url").value = settings.url;
      if (settings.key) document.getElementById("sb-key").value = settings.key;
      console.log("Admin: Supabase settings loaded (LocalStorage Override)");
    } catch (e) {
      console.error("Admin: Error loading Supabase settings", e);
    }
  }
}

// Save Supabase settings to localStorage
function saveSupabaseSettings() {
  console.log("Admin: saveSupabaseSettings triggered");
  const urlInput = document.getElementById("sb-url");
  const keyInput = document.getElementById("sb-key");

  if (!urlInput || !keyInput) {
    alert("Error: UI elements not found. Please refresh the page.");
    return;
  }

  const url = urlInput.value.trim();
  const key = keyInput.value.trim();

  if (!url || !key) {
    alert("Please fill in both the Supabase URL and the Anon Key");
    return;
  }

  const settings = { url, key };
  localStorage.setItem(SB_SETTINGS_KEY, JSON.stringify(settings));

  // Visual feedback
  const status = document.getElementById("sb-status");
  if (status) {
    status.textContent = "✅ Settings Saved Successfully!";
    status.style.color = "#10b981";
    status.style.display = "block";
    status.style.border = "1px solid #10b981";

    console.log("Admin: Supabase settings saved to localStorage");

    // Hide status after 4 seconds
    setTimeout(() => {
      status.style.display = "none";
    }, 4000);
  } else {
    alert("Settings saved successfully!");
  }
}

// Toggle Key Visibility
function toggleKeyVisibility() {
  const keyInput = document.getElementById("sb-key");
  const toggleBtn = document.getElementById("toggle-key");
  if (keyInput.type === "password") {
    keyInput.type = "text";
    toggleBtn.textContent = "Hide";
  } else {
    keyInput.type = "password";
    toggleBtn.textContent = "Show";
  }
}

// Test Supabase Connection
async function testSupabaseConnection() {
  const url = document.getElementById("sb-url").value.trim();
  const key = document.getElementById("sb-key").value.trim();
  const status = document.getElementById("sb-status");

  if (!url || !key) {
    alert("Please fill in both fields before testing");
    return;
  }

  status.textContent = "⏳ Testing connection...";
  status.style.color = "#cbd5e1";
  status.style.display = "block";

  // Test by fetching from predictions table
  const requestUrl = `${url.replace(
    /\/$/,
    ""
  )}/rest/v1/predictions?select=count`;

  try {
    const response = await fetch(requestUrl, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    if (response.ok) {
      status.textContent = "✅ Connection Successful! Found predictions table";
      status.style.color = "#10b981";
      status.style.border = "1px solid #10b981";
    } else {
      const error = await response.json();
      let msg = error.message || "Unknown error";
      if (response.status === 401) msg = "Invalid API Key (401)";
      if (response.status === 404) msg = 'Table "predictions" not found (404)';

      status.textContent = "❌ Connection Failed: " + msg;
      status.style.color = "#ef4444";
      status.style.border = "1px solid #ef4444";
    }
  } catch (error) {
    status.textContent = "❌ Network Error: " + error.message;
    status.style.color = "#ef4444";
    status.style.border = "1px solid #ef4444";
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
    console.warn("Admin: Supabase settings not found, skipping sync");
    return;
  }

  const requestUrl = `${url.replace(/\/$/, "")}/rest/v1/predictions`;
  const lastStatus = document.getElementById("sync-last-status");

  try {
    console.log("Admin: Syncing to Supabase...");
    if (lastStatus) lastStatus.textContent = "⏳ Syncing...";

    // 1. Delete all existing records (PostgREST style)
    const deleteResponse = await fetch(`${requestUrl}?condition=neq.__VIEW_LOG__`, {
      method: "DELETE",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });

    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.json();
      throw new Error(errorData.message || "Failed to clear old predictions");
    }

    // 2. Insert new records
    if (predictions.length > 0) {
      // WORKAROUND: Embed uploader in notes to avoid schema mismatch
      const sbPredictions = predictions.map((p) => {
        let noteContent = p.notes || "";
        // Append uploader tag if it exists
        if (p.uploader) {
          noteContent += ` {{uploader:${p.uploader}}}`;
        }
        // Append city tag if it exists
        if (p.city) {
          noteContent += ` {{city:${p.city}}}`;
        }

        return {
          date: p.date,
          to_date: p.toDate || null,
          temperature: p.temperature,
          condition: p.condition,
          notes: noteContent.trim() || null,
          // uploader/city fields intentionally omitted to fit schema
        };
      });

      const insertResponse = await fetch(requestUrl, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(sbPredictions),
      });

      if (!insertResponse.ok) {
        const errorData = await insertResponse.json();
        throw new Error(
          errorData.message || "Failed to insert new predictions"
        );
      }
    }

    console.log("Admin: Supabase sync successful!");
    if (lastStatus) {
      const now = new Date();
      lastStatus.textContent = `✅ Last sync: ${now.toLocaleTimeString()}`;
      lastStatus.style.color = "#10b981";
    }
  } catch (error) {
    console.error("Admin: Error syncing to Supabase", error);
    if (lastStatus) {
      lastStatus.textContent = `❌ Sync error: ${error.message}`;
      lastStatus.style.color = "#ef4444";
    }
    alert("Supabase Sync Failed: " + error.message);
  }
}

// Initialize predictions
async function initializePredictions() {
  console.log("Admin: Initializing predictions...");

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
      const requestUrl = `${url.replace(
        /\/$/,
        ""
      )}/rest/v1/predictions?condition=neq.__VIEW_LOG__&order=date.desc&t=${Date.now()}`;

      console.log("Admin: Fetching from Supabase...");
      const response = await fetch(requestUrl, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Cache-Control": "no-cache"
        },
      });

      if (response.ok) {
        const data = await response.json();
        const normalizedData = data.map((p) => {
          let uploader = null;
          let city = null;
          let notes = p.notes;

          // Extract uploader from notes tag {{uploader:NAME}}
          if (notes && notes.includes("{{uploader:")) {
            const match = notes.match(/{{uploader:(.*?)}}/);
            if (match) {
              uploader = match[1];
              notes = notes.replace(match[0], "").trim();
            }
          }

          // Extract city from notes tag {{city:NAME}}
          if (notes && notes.includes("{{city:")) {
            const match = notes.match(/{{city:(.*?)}}/);
            if (match) {
              city = match[1];
              notes = notes.replace(match[0], "").trim();
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
          };
        });
        localStorage.setItem(
          PREDICTIONS_STORAGE_KEY,
          JSON.stringify(normalizedData)
        );
        return normalizedData;
      }
    } catch (error) {
      console.error("Admin: Error syncing from Supabase", error);
    }
  }

  // 2. Fallback to localStorage
  const stored = localStorage.getItem(PREDICTIONS_STORAGE_KEY);
  if (stored) {
    try {
      const predictions = JSON.parse(stored);
      console.log("Admin: Loaded from localStorage:", predictions.length);
      return predictions;
    } catch (e) {
      console.error("Admin: Error parsing localStorage", e);
      localStorage.removeItem(PREDICTIONS_STORAGE_KEY);
    }
  }

  // 3. Fallback to data.json
  try {
    console.log("Admin: Fetching from data.json...");
    const response = await fetch("data.json?t=" + Date.now());
    if (response.ok) {
      const predictions = await response.json();
      console.log("Admin: Loaded from data.json:", predictions.length);
      localStorage.setItem(
        PREDICTIONS_STORAGE_KEY,
        JSON.stringify(predictions)
      );
      return predictions;
    }
  } catch (error) {
    console.error("Admin: Error loading data.json", error);
  }

  return [];
}

// Save predictions
function savePredictions(predictions) {
  console.log("Admin: Saving to localStorage:", predictions.length);
  localStorage.setItem(PREDICTIONS_STORAGE_KEY, JSON.stringify(predictions));
}

// Check password
function checkPassword() {
  const passwordInput = document.getElementById("admin-password");
  const loginSection = document.getElementById("login-section");
  const adminPanel = document.getElementById("admin-panel");
  const errorMsg = document.getElementById("error-msg");

  if (passwordInput.value === ADMIN_PASSWORD) {
    currentUserRole = "admin";
    loginSection.style.display = "none";
    adminPanel.style.display = "block";
    updateUIForRole();
    loadAdminData();
  } else if (passwordInput.value === USER_PASSWORD) {
    currentUserRole = "user";
    userSessionUploadCount = 0; // Reset session count
    loginSection.style.display = "none";
    adminPanel.style.display = "block";
    updateUIForRole();
    loadAdminData();
  } else {
    errorMsg.style.display = "block";
    passwordInput.value = "";
  }
}

// Prepare UI based on role
function updateUIForRole() {
  const analytics = document.getElementById("section-analytics");
  const settings = document.getElementById("section-settings");
    const addSection = document.getElementById('section-add');
    const iThink = document.getElementById('section-ithink');
    const targetDateSection = document.getElementById('section-target-date');
    const headerImageSection = document.getElementById('section-header-image');
    const apiSection = document.getElementById('section-apis');
    const listSection = document.getElementById('section-list');
    const themeSection = document.getElementById('section-theme');
    
    // Default: Show all
    if (analytics) analytics.style.display = 'block';
    if (settings) settings.style.display = 'block';
    if (addSection) addSection.style.display = 'block';
    if (iThink) iThink.style.display = 'block';
    if (targetDateSection) targetDateSection.style.display = 'block';
    if (headerImageSection) headerImageSection.style.display = 'block';
    if (apiSection) apiSection.style.display = 'block';
    if (listSection) listSection.style.display = 'block';
    if (themeSection) themeSection.style.display = 'block';
    
    // User restrictions
    if (currentUserRole === 'user') {
        if (analytics) analytics.style.display = 'none';
        if (settings) settings.style.display = 'none';
        if (iThink) iThink.style.display = 'none';
        if (targetDateSection) targetDateSection.style.display = 'none';
        if (themeSection) themeSection.style.display = 'none';
        // Keep 'Add', 'List', 'Header Image', and 'API' visible (with logic-based restrictions)
    }
}

// Load "I Think" message
async function loadIThinkMessage() {
    // Find config item
    const configItem = currentPredictions.find(p => p.condition === '__ITHINK__');
    if (configItem && configItem.notes) {
        const textarea = document.getElementById('ithink-message');
        if (textarea) textarea.value = configItem.notes;
    }
}

// Save "I Think" message
async function saveIThinkMessage() {
    const textarea = document.getElementById('ithink-message');
    const message = textarea.value;
    
    // Find or create config item
    let configItem = currentPredictions.find(p => p.condition === '__ITHINK__');
    if (configItem) {
        configItem.notes = message;
    } else {
        currentPredictions.push({
            date: '2000-01-01',
            temperature: '0',
            condition: '__ITHINK__',
            notes: message
        });
    }
    
    savePredictions(currentPredictions);
    await syncToSupabase(currentPredictions);
    alert('Message updated successfully!');
}

// Load Target Date
async function loadTargetDate() {
    const configItem = currentPredictions.find(p => p.condition === '__TARGET_DATE__');
    const input = document.getElementById('admin-target-date');
    if (input) {
         if (configItem && configItem.notes) {
            input.value = configItem.notes;
        } else {
            input.value = '';
        }
    }
}

// Save Target Date
async function saveTargetDate() {
    const input = document.getElementById('admin-target-date');
    const dateVal = input.value;
    
    // Find or create config item
    let configItem = currentPredictions.find(p => p.condition === '__TARGET_DATE__');
    if (configItem) {
        configItem.notes = dateVal; // If empty, it means "use live date"
    } else {
        currentPredictions.push({
            date: '2000-01-01',
            temperature: '0',
            condition: '__TARGET_DATE__',
            notes: dateVal
        });
    }
    
    savePredictions(currentPredictions);
    await syncToSupabase(currentPredictions);
    alert('Target Date updated successfully!');
}

// ========================
// HEADER LIBRARY LOGIC
// ========================
async function handleHeaderImageSelect(event) {
    const file = event.target.files[0];
    const fileChosenText = document.getElementById('file-chosen-text');
    if (!file) {
        if(fileChosenText) fileChosenText.textContent = "No file chosen";
        return;
    }
    
    if(fileChosenText) fileChosenText.textContent = file.name;
    
    // Compress/Resize logic
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = function() {
            // Resize to max 800px width
            const maxWidth = 800;
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Compress to JPEG 0.7
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            // Show preview
            const preview = document.getElementById('header-preview');
            const previewContainer = document.getElementById('header-preview-container');
            if (preview && previewContainer) {
                preview.src = dataUrl;
                previewContainer.style.display = 'block';
            }
            
            pendingHeaderImageBase64 = dataUrl;
        }
    }
}

// 1. Upload to Library
async function uploadHeaderAsset() {
    if (!pendingHeaderImageBase64) {
        alert('Please select an image first!');
        return;
    }
    
    // Add new asset record
    currentPredictions.push({
         date: new Date().toISOString().split('T')[0],
         temperature: '0', 
         condition: '__HEADER_ASSET__',
         notes: pendingHeaderImageBase64
    });
    
    // Reset Input UI
    pendingHeaderImageBase64 = null;
    document.getElementById('header-file-input').value = '';
    document.getElementById('header-preview-container').style.display = 'none';
    
    savePredictions(currentPredictions);
    await syncToSupabase(currentPredictions);
    
    loadHeaderLibrary(); // Refresh UI
    alert('Image added to library!');
}

// 2. Activate an Asset
async function activateHeaderAsset(indexInLibrary) {
    // PERMISSION CHECK: Only admin can activate headers
    if (currentUserRole !== 'admin') {
        alert('⚠️ Only administrators can activate header images.');
        return;
    }
    
    // Re-find assets to get correct data
    const assets = currentPredictions.filter(p => p.condition === '__HEADER_ASSET__');
    const asset = assets[indexInLibrary]; // index matches rendered list
    
    if (!asset) return;

    // Find or create Active Record
    let activeRecord = currentPredictions.find(p => p.condition === '__HEADER_IMAGE__');
    if(activeRecord) {
        activeRecord.notes = asset.notes;
    } else {
        currentPredictions.push({
             date: '2000-01-01',
             temperature: '0', 
             condition: '__HEADER_IMAGE__',
             notes: asset.notes
        });
    }

    savePredictions(currentPredictions);
    await syncToSupabase(currentPredictions);
    loadHeaderLibrary(); // Refresh UI
    alert('Header updated successfully!');
}

// 3. Remove Active Header
async function removeActiveHeader() {
    // PERMISSION CHECK: Only admin can remove active header
    if (currentUserRole !== 'admin') {
        alert('⚠️ Only administrators can change the active header.');
        return;
    }
    
    if(!confirm('Revert to default logo?')) return;
    
    const initialLength = currentPredictions.length;
    currentPredictions = currentPredictions.filter(p => p.condition !== '__HEADER_IMAGE__');
    
    if (currentPredictions.length === initialLength) {
        alert("No active custom header found to remove.");
        return;
    }

    savePredictions(currentPredictions);
    await syncToSupabase(currentPredictions);
    loadHeaderLibrary();
    alert("Reverted to default logo.");
}

// 4. Delete Asset
async function deleteHeaderAsset(indexInLibrary) {
    if(!confirm('Delete this image from library?')) return;

    // We need to find the EXACT record in the main array.
    // 1. Re-derive the filtered list exactly as the UI did
    const assets = currentPredictions.filter(p => p.condition === '__HEADER_ASSET__');
    const targetAsset = assets[indexInLibrary];
    
    if (targetAsset) {
        // 2. Remove by Excluding this specific object reference
        // This is robust against index shifting as long as reference holds
        const originalCount = currentPredictions.length;
        currentPredictions = currentPredictions.filter(p => p !== targetAsset);
        
        if (currentPredictions.length < originalCount) {
             savePredictions(currentPredictions);
             await syncToSupabase(currentPredictions);
             loadHeaderLibrary();
             // alert('Asset deleted.'); // Optional: reduce spam if obvious
        } else {
            alert("Error: Could not remove asset from memory.");
        }
    } else {
        alert("Error: Asset not found at index " + indexInLibrary);
    }
}

// 5. Load & Render Library
async function loadHeaderLibrary() {
    const activeHeader = currentPredictions.find(p => p.condition === '__HEADER_IMAGE__');
    const assets = currentPredictions.filter(p => p.condition === '__HEADER_ASSET__');
    
    // Render Active
    const activeContainer = document.getElementById('active-header-display');
    const removeBtn = document.getElementById('btn-remove-active');
    
    if (activeHeader && activeHeader.notes) {
        activeContainer.innerHTML = `<img src="${activeHeader.notes}" style="max-height: 100px; max-width: 100%; border-radius: 8px;">`;
        // Only admin can see the revert button
        if(removeBtn) removeBtn.style.display = currentUserRole === 'admin' ? 'inline-block' : 'none';
    } else {
        activeContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Using Default Logo</p>`;
        if(removeBtn) removeBtn.style.display = 'none';
    }

    // Render Grid
    const grid = document.getElementById('header-library-grid');
    grid.innerHTML = '';
    
    if (assets.length === 0) {
        grid.innerHTML = `<p style="color: var(--text-muted); font-size: 0.8rem; grid-column: 1/-1; text-align: center;">Library is empty.</p>`;
    } else {
        assets.forEach((asset, index) => {
            const item = document.createElement('div');
            item.style.cssText = 'position: relative; aspect-ratio: 1; background: #222; border-radius: 8px; overflow: hidden; border: 1px solid var(--border-color);';
            
            // Check if this asset is the currently active one (simple string comparison)
            const isActive = activeHeader && activeHeader.notes === asset.notes;
            const borderStyle = isActive ? 'border: 2px solid #10b981;' : '';
            if(isActive) item.style.border = '2px solid #10b981';

            // Only admin can activate images, users can only delete
            const activateBtn = currentUserRole === 'admin' 
                ? `<button onclick="activateHeaderAsset(${index})" title="Use This" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; padding: 0;">✅</button>`
                : '';

            item.innerHTML = `
                <img src="${asset.notes}" style="width: 100%; height: 100%; object-fit: cover;">
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); display: flex; justify-content: ${currentUserRole === 'admin' ? 'space-between' : 'center'}; padding: 5px; z-index: 10;">
                    ${activateBtn}
                    <button onclick="deleteHeaderAsset(${index})" title="Delete" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; padding: 0;">🗑️</button>
                </div>
            `;
            grid.appendChild(item);
        });
    }
}

// Load admin data
async function loadAdminData() {
    loadSupabaseSettings(); // Load settings first
    await loadPredictionsForAdmin();
    await loadIThinkMessage();
    await loadTargetDate();
    await loadThemeSettings(); // Load Theme
    // await loadHeaderImage(); // Replaced
    loadHeaderLibrary(); // New loader
    loadApis();
    updateAnalytics();
    setInterval(updateAnalytics, 2000);
}

// ========================
// API MANAGEMENT (Added)
// ========================

// Reset validation when user changes input
document.addEventListener('DOMContentLoaded', () => {
    const cityInput = document.getElementById('api-city');
    const addBtn = document.getElementById('btn-add-api');
    
    if (cityInput && addBtn) {
        cityInput.addEventListener('input', () => {
            if (pendingApiValid) {
                pendingApiValid = false;
                addBtn.textContent = 'Add City (Changed - Retest Required)';
                addBtn.style.background = ''; // Reset color
            }
        });
    }
});

async function testApiConnection() {
    const city = document.getElementById('api-city').value.trim();
    const key = document.getElementById('api-key').value.trim();
    
    if (!city || !key) {
        alert('Please enter both City Name and API Key');
        return;
    }

    const constructedUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${key}`;

    const btn = document.getElementById('btn-test-api');
    const addBtn = document.getElementById('btn-add-api');
    
    const originalText = btn.textContent;
    btn.textContent = 'Testing...';
    btn.disabled = true;
    
    try {
        const response = await fetch(constructedUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status} (City not found?)`);
        const data = await response.json();
        
        // Basic validation for OpenWeatherMap structure
        if (data.main && data.weather && data.weather[0]) {
            alert(`✅ Success! Weather in ${data.name}: ${Math.round(data.main.temp)}°C, ${data.weather[0].description}`);
            pendingApiValid = true;
            pendingApiUrl = constructedUrl;
            pendingApiName = city; // Store the name we tested
            addBtn.textContent = `Add "${data.name}" (Verified)`;
            addBtn.style.background = '#10b981'; // Green to show readiness
        } else {
            throw new Error('Invalid JSON structure (Missing main.temp or weather)');
        }
    } catch (e) {
        alert('❌ Test Failed: ' + e.message);
        pendingApiValid = false;
        pendingApiUrl = '';
        addBtn.textContent = 'Add City';
        addBtn.style.background = ''; // Reset color
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

async function getApiList() {
    // Find config item
    const configItem = currentPredictions.find(p => p.condition === '__EXTERNAL_APIS__');
    if (configItem && configItem.notes) {
        try {
            return JSON.parse(configItem.notes);
        } catch (e) {
            return [];
        }
    }
    return [];
}

async function loadApis() {
    const list = await getApiList();
    const container = document.getElementById('api-list');
    container.innerHTML = '';
    
    if (list.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center;">No cities added.</p>';
        return;
    }
    
    list.forEach((api, index) => {
        const item = document.createElement('div');
        item.style.cssText = 'background: rgba(255,255,255,0.05); padding: 10px; margin-bottom: 8px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;';
        
        // Determine if current user can remove this city
        // Admin can remove any, User can only remove their own
        const canRemove = currentUserRole === 'admin' || api.addedBy === 'user';
        const addedByBadge = api.addedBy === 'user' 
            ? '<span style="font-size:0.7rem;color:#888;margin-left:8px;">(User)</span>' 
            : '<span style="font-size:0.7rem;color:#888;margin-left:8px;">(Admin)</span>';
        
        const removeBtn = canRemove 
            ? `<button onclick="removeApi(${index})" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 4px 10px; font-size: 0.8rem; border: none;">Remove</button>`
            : `<span style="color:#888;font-size:0.75rem;">Admin Only</span>`;
        
        item.innerHTML = `
            <div>
                <strong style="color: white;">${api.name}</strong>${addedByBadge}
            </div>
            ${removeBtn}
        `;
        container.appendChild(item);
    });
}

async function addExternalApi() {
    console.log("Admin: Add External API requested");
    
    if (!pendingApiValid) {
        alert("⚠️ Please test the City first.");
        return;
    }
    
    // Safety check for URL
    if (!pendingApiUrl) {
        alert("⚠️ Error: No validated URL found. Please test again.");
        return;
    }

    // We use the input value for the name
    const name = document.getElementById('api-city').value.trim();
    const addBtn = document.getElementById('btn-add-api');
    
    if (!name) {
         alert("⚠️ Error: City Name is empty.");
         return;
    }
    
    try {
        const list = await getApiList();
        
        // Check for duplicates
        const exists = list.some(api => api.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            alert("⚠️ This city is already in the list!");
            return;
        }

        // USER LIMIT CHECK: Users can only add 2 cities
        if (currentUserRole === 'user') {
            const userCities = list.filter(api => api.addedBy === 'user');
            if (userCities.length >= USER_API_LIMIT) {
                alert(`⚠️ You can only add ${USER_API_LIMIT} cities as a user. Please contact the admin to add more.`);
                return;
            }
        }

        // Track who added this city
        list.push({ name: name, url: pendingApiUrl, addedBy: currentUserRole });
        
        await saveApis(list);
        
        // Reset form
        document.getElementById('api-city').value = '';
        
        // Reset state
        pendingApiValid = false;
        pendingApiUrl = '';
        addBtn.textContent = 'Add City';
        addBtn.style.background = '';
        
        loadApis();
        alert('City added successfully!');
    } catch (e) {
        console.error("Admin: Add Error", e);
        alert("❌ Error adding city: " + e.message);
    }
}

async function removeApi(index) {
    if (!confirm('Remove this API?')) return;
    
    const list = await getApiList();
    
    // Permission check: Users can only remove cities they added
    if (currentUserRole === 'user' && list[index].addedBy !== 'user') {
        alert('⚠️ You can only remove cities that you added.');
        return;
    }
    
    list.splice(index, 1);
    await saveApis(list);
    loadApis();
}

async function saveApis(list) {
    // Find or create config item
    let configItem = currentPredictions.find(p => p.condition === '__EXTERNAL_APIS__');
    if (configItem) {
        configItem.notes = JSON.stringify(list);
    } else {
        currentPredictions.push({
            date: '2000-01-01',
            temperature: '0',
            condition: '__EXTERNAL_APIS__',
            notes: JSON.stringify(list)
        });
    }
    
    savePredictions(currentPredictions);
    await syncToSupabase(currentPredictions);
}

// Debug Analytics
async function debugAnalytics() {
    let url = SB_URL;
    let key = SB_KEY;
    if (!url || !key) {
         const stored = localStorage.getItem(SB_SETTINGS_KEY);
         if (stored) { const s = JSON.parse(stored); url = s.url; key = s.key; }
    }
    
    if (!url || !key) { alert("Missing Credentials"); return; }
    
    alert(`Debug: Fetching from ${url}...`);
    
    try {
        const requestUrl = `${url.replace(/\/$/, '')}/rest/v1/predictions?condition=eq.__VIEW_LOG__`;
        const response = await fetch(requestUrl, {
            method: 'HEAD',
            headers: { 
                'apikey': key, 
                'Authorization': `Bearer ${key}`,
                'Prefer': 'count=exact'
            }
        });
        
        const range = response.headers.get('Content-Range');
        alert(`Status: ${response.status}\nRange Header: ${range}\nOK: ${response.ok}`);
        
    } catch(e) {
        alert("Error: " + e.message);
    }
}    
// Update analytics (Live Log Count)
async function updateAnalytics() {
    let count = 0;
    
    // 1. Try Live Supabase Fetch
    let url = SB_URL;
    let key = SB_KEY;
    
    if (!url || !key) {
        try {
            const stored = localStorage.getItem(SB_SETTINGS_KEY);
            if (stored) {
                const s = JSON.parse(stored);
                url = s.url;
                key = s.key;
            }
        } catch(e) {}
    }

    if (url && key) {
        try {
            // Count rows where condition = __VIEW_LOG__
            // Using HEAD request + count=exact is efficient
            const requestUrl = `${url.replace(/\/$/, '')}/rest/v1/predictions?condition=eq.__VIEW_LOG__`;
            const response = await fetch(requestUrl, {
                method: 'HEAD',
                headers: { 
                    'apikey': key, 
                    'Authorization': `Bearer ${key}`,
                    'Prefer': 'count=exact'
                }
            });
            
            if (response.ok) {
                // Content-Range format: 0-9/10 or */10
                const range = response.headers.get('Content-Range');
                if (range) {
                    const parts = range.split('/');
                    if (parts.length === 2 && parts[1] !== '*') {
                        count = parseInt(parts[1], 10);
                    }
                }
            }
        } catch (e) {
            console.error("Analytics live count failed", e);
        }
    }
    
    // Update UI
    const countEl = document.getElementById("view-count");
    if (countEl) countEl.textContent = count;

    // Date is always today
    const dateEl = document.getElementById("analytics-date");
    if (dateEl) {
        const options = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
        dateEl.textContent = new Date().toLocaleDateString("en-US", options);
    }
}

// Reset Views Handler
async function handleResetViews() {
    if (!confirm('Are you sure you want to reset the global view counter to 0?')) return;
    
    let url = SB_URL;
    let key = SB_KEY;
    
     if (!url || !key) {
        // ... (Local storage fetch if needed, similar to updateAnalytics)
        const stored = localStorage.getItem(SB_SETTINGS_KEY);
        if (stored) {
             const s = JSON.parse(stored);
             url = s.url;
             key = s.key;
        }
     }
    
    if (url && key) {
        try {
            const requestUrl = `${url.replace(/\/$/, '')}/rest/v1/predictions?condition=eq.__VIEW_LOG__`;
            await fetch(requestUrl, {
                method: 'DELETE',
                headers: {
                    'apikey': key,
                    'Authorization': `Bearer ${key}`
                }
            });
            alert('Global counter reset to 0.');
            updateAnalytics();
        } catch (e) {
            alert('Error resetting: ' + e.message);
        }
    } else {
        alert("Supabase credentials missing.");
    }
}

// Load predictions for admin
async function loadPredictionsForAdmin() {
  try {
    currentPredictions = await initializePredictions();
    // Explicitly purge logs from memory to prevent admin clutter
    currentPredictions = currentPredictions.filter(p => p.condition !== '__VIEW_LOG__');
    displayPredictionsInAdmin(currentPredictions);
  } catch (error) {
    console.error("Admin: Error loading predictions", error);
  }
}

// Display predictions
function displayPredictionsInAdmin(predictions) {
  console.log("Admin: Displaying", predictions.length, "predictions");
  const container = document.getElementById("predictions-admin-list");
  container.innerHTML = "";

  if (!predictions || predictions.length === 0) {
    container.innerHTML =
      '<p style="color: #888; text-align: center;">No predictions yet.</p>';
    return;
  }

  predictions.forEach((pred, index) => {
    // Skip config items
    if (pred.condition === '__ITHINK__' || pred.condition === '__EXTERNAL_APIS__' || pred.condition === '__ANALYTICS__' || pred.condition === '__VIEW_LOG__' || pred.condition === '__TARGET_DATE__' || pred.condition === '__HEADER_IMAGE__' || pred.condition === '__HEADER_ASSET__') return;

    const card = document.createElement("div");
    card.className = "admin-prediction-card";

    let dateRange = pred.date;
    if (pred.toDate) dateRange += ` to ${pred.toDate}`;

    card.innerHTML = `
            <div class="admin-pred-info">
                <h4>${pred.condition}</h4>
                <p><strong>Date:</strong> ${dateRange}</p>
                <p><strong>Temperature:</strong> ${pred.temperature}°C</p>
                ${pred.city ? `<p><strong>City:</strong> ${pred.city}</p>` : ""}
                ${
                  pred.uploader
                    ? `<p><strong>Uploader:</strong> ${pred.uploader}</p>`
                    : ""
                }
                ${
                  pred.notes
                    ? `<p><strong>Notes:</strong> ${pred.notes}</p>`
                    : ""
                }
            </div>
            ${
              currentUserRole === "admin"
                ? `<button class="delete-btn" onclick="deletePrediction(${index})">Delete</button>`
                : ""
            }
        `;
    container.appendChild(card);
  });
}

// Delete prediction
async function deletePrediction(index) {
  console.log("Admin: Delete requested for index:", index);

  // Check if we are in a test environment (bypass confirm)
  const skipConfirm =
    window.localStorage.getItem("test_skip_confirm") === "true";

  if (
    !skipConfirm &&
    !confirm("Are you sure you want to delete this prediction?")
  ) {
    console.log("Admin: Delete cancelled by user");
    return;
  }

  try {
    if (index >= 0 && index < currentPredictions.length) {
      console.log("Admin: Deleting item:", currentPredictions[index].condition);
      currentPredictions.splice(index, 1);
      savePredictions(currentPredictions);
      displayPredictionsInAdmin(currentPredictions);

      // Sync to Supabase
      await syncToSupabase(currentPredictions);

      console.log("Admin: Delete successful, list updated");
      if (!skipConfirm) alert("Prediction deleted successfully!");
    } else {
      console.error("Admin: Invalid index:", index);
    }
  } catch (error) {
    console.error("Admin: Error deleting", error);
  }
}

// Add prediction
async function addPrediction() {
  // Permission Check
  if (currentUserRole === "user") {
    if (userSessionUploadCount >= USER_UPLOAD_LIMIT) {
      alert("🚫 Limit Reached: You can only add 2 forecasts per session.");
      return;
    }
  }

  const date = document.getElementById("pred-date").value;
  const toDate = document.getElementById("pred-to-date").value;
  const temperature = document.getElementById("pred-temp").value;
  const condition = document.getElementById("pred-condition").value;
  const uploader = document.getElementById("pred-uploader").value;
  const city = document.getElementById("pred-city").value;
  const notes = document.getElementById("pred-notes").value;

  if (!date || !temperature || !condition) {
    alert("Please fill in Date, Temperature, and Condition");
    return;
  }

  try {
    const newPrediction = {
      date: date,
      temperature: temperature,
      condition: condition,
      toDate: toDate || undefined,
      uploader: uploader || undefined,
      city: city || undefined,
      notes: notes || undefined,
    };

    currentPredictions.unshift(newPrediction);
    savePredictions(currentPredictions);

    document.getElementById("pred-date").value = "";
    document.getElementById("pred-to-date").value = "";
    document.getElementById("pred-temp").value = "";
    document.getElementById("pred-condition").value = "";
    document.getElementById("pred-uploader").value = "";
    document.getElementById("pred-city").value = "";
    document.getElementById("pred-notes").value = "";

    displayPredictionsInAdmin(currentPredictions);

    // Sync to Supabase
    await syncToSupabase(currentPredictions);

    // Increase user count if applicable
    if (currentUserRole === "user") {
      userSessionUploadCount++;
      const remaining = USER_UPLOAD_LIMIT - userSessionUploadCount;
      alert(
        `Prediction added successfully! (Remaining this session: ${remaining})`
      );
    } else {
      alert("Prediction added successfully!");
    }
  } catch (error) {
    console.error("Admin: Error adding", error);
  }
}

// Make functions global immediately
// Enter key listeners
document.addEventListener("DOMContentLoaded", () => {
  console.log("Admin: DOM Content Loaded");

  // Password input
  const passwordInput = document.getElementById("admin-password");
  if (passwordInput) {
    passwordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") checkPassword();
    });
  }

  // Supabase settings inputs
  ["sb-url", "sb-key"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          console.log("Admin: Enter pressed on", id);
          saveSupabaseSettings();
        }
      });
    }
  });
});

// ========================
// THEME EDITOR LOGIC
// ========================

// Load Theme Settings
async function loadThemeSettings() {
    const configItem = currentPredictions.find(p => p.condition === '__THEME_CONFIG__');
    if (configItem && configItem.notes) {
        try {
            const theme = JSON.parse(configItem.notes);
            
            // Update Inputs
            const updateInput = (type, val) => {
                const colorInput = document.getElementById(`theme-${type}-color`);
                const textInput = document.getElementById(`theme-${type}-text`);
                if(colorInput) colorInput.value = val;
                if(textInput) textInput.value = val;
            };

            if(theme.bg) updateInput('bg', theme.bg);
            if(theme.text) updateInput('text', theme.text);
            if(theme.primary) updateInput('primary', theme.primary);
            if(theme.accent) updateInput('accent', theme.accent);
            if(theme.cardBg) updateInput('card-bg', theme.cardBg);
            if(theme.cardBorder) updateInput('card-border', theme.cardBorder);
            if(theme.glassBg) updateInput('glass-bg', theme.glassBg);
            if(theme.glassBorder) updateInput('glass-border', theme.glassBorder);

            // Apply to Admin Page (Optional, but nice for preview)
            const r = document.documentElement;
            if(theme.bg) r.style.setProperty('--bg-color', theme.bg);
            if(theme.text) r.style.setProperty('--text-color', theme.text);
            if(theme.primary) r.style.setProperty('--primary-color', theme.primary);
            if(theme.accent) r.style.setProperty('--accent-color', theme.accent);
            if(theme.cardBg) r.style.setProperty('--card-bg', theme.cardBg);
            if(theme.cardBorder) r.style.setProperty('--card-border', theme.cardBorder);
            if(theme.glassBg) r.style.setProperty('--glass-bg', theme.glassBg);
            if(theme.glassBorder) r.style.setProperty('--glass-border', theme.glassBorder);
            
        } catch(e) {
            console.error("Error parsing theme config", e);
        }
    }
}

// Save Theme Settings
async function saveThemeSettings() {
    const theme = {
        bg: document.getElementById('theme-bg-text').value,
        text: document.getElementById('theme-text-text').value,
        primary: document.getElementById('theme-primary-text').value,
        accent: document.getElementById('theme-accent-text').value,
        cardBg: document.getElementById('theme-card-bg-text').value,
        cardBorder: document.getElementById('theme-card-border-text').value,
        glassBg: document.getElementById('theme-glass-bg-text').value,
        glassBorder: document.getElementById('theme-glass-border-text').value
    };

    // Find or create config item
    let configItem = currentPredictions.find(p => p.condition === '__THEME_CONFIG__');
    if (configItem) {
        configItem.notes = JSON.stringify(theme);
    } else {
        currentPredictions.push({
            date: '2000-01-01',
            temperature: '0',
            condition: '__THEME_CONFIG__',
            notes: JSON.stringify(theme)
        });
    }

    // Apply immediately
    const r = document.documentElement;
    r.style.setProperty('--bg-color', theme.bg);
    r.style.setProperty('--text-color', theme.text);
    r.style.setProperty('--primary-color', theme.primary);
    r.style.setProperty('--accent-color', theme.accent);
    r.style.setProperty('--card-bg', theme.cardBg);
    r.style.setProperty('--card-border', theme.cardBorder);
    r.style.setProperty('--glass-bg', theme.glassBg);
    r.style.setProperty('--glass-border', theme.glassBorder);

    savePredictions(currentPredictions);
    await syncToSupabase(currentPredictions);
    alert('Theme updated successfully!');
}

// Reset Theme Settings
async function resetThemeSettings() {
    if(!confirm("Reset all colors to default?")) return;

    // Remove config item
    currentPredictions = currentPredictions.filter(p => p.condition !== '__THEME_CONFIG__');
    
    // Reset Inputs
    const defaults = {
        bg: '#0c0c14',
        text: '#f8fafc',
        primary: '#3b82f6',
        accent: '#06b6d4',
        cardBg: 'rgba(255, 255, 255, 0.05)',
        cardBorder: 'rgba(255, 255, 255, 0.1)',
        glassBg: 'rgba(15, 23, 42, 0.7)',
        glassBorder: 'rgba(255, 255, 255, 0.08)'
    };
    
    const updateInput = (type, val) => {
        const colorInput = document.getElementById(`theme-${type}-color`);
        const textInput = document.getElementById(`theme-${type}-text`);
        if(colorInput) colorInput.value = val;
        if(textInput) textInput.value = val;
    };

    updateInput('bg', defaults.bg);
    updateInput('text', defaults.text);
    updateInput('primary', defaults.primary);
    updateInput('accent', defaults.accent);
    updateInput('card-bg', defaults.cardBg);
    updateInput('card-border', defaults.cardBorder);
    updateInput('glass-bg', defaults.glassBg);
    updateInput('glass-border', defaults.glassBorder);

    // Reset Styles
    const r = document.documentElement;
    r.style.removeProperty('--bg-color');
    r.style.removeProperty('--text-color');
    r.style.removeProperty('--primary-color');
    r.style.removeProperty('--accent-color');
    r.style.removeProperty('--card-bg');
    r.style.removeProperty('--card-border');
    r.style.removeProperty('--glass-bg');
    r.style.removeProperty('--glass-border');

    savePredictions(currentPredictions);
    await syncToSupabase(currentPredictions);
    alert('Theme reset to default.');
}