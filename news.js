/**
 * Shared News Logic (Supabase Integrated)
 * Handles fetching, displaying, and managing news items.
 */
console.log("[DEBUG] news.js LOADED - Version: 2026-01-11_15-10-FINAL");

// Global config access
function getSupabaseCredentials() {
    let url = window.SB_URL;
    let key = window.SB_KEY;

    if (!url || !key) {
        if (window.SUPABASE_PUBLIC_CONFIG) {
            url = window.SUPABASE_PUBLIC_CONFIG.URL;
            key = window.SUPABASE_PUBLIC_CONFIG.ANON_KEY;
        } else {
             try {
                const stored = localStorage.getItem('supabaseSyncSettings');
                if (stored) {
                    const settings = JSON.parse(stored);
                    url = settings.url;
                    key = settings.key;
                }
             } catch(e) {}
        }
    }
    return { url, key };
}

// Global State
let currentNewsList = [];
let editingNewsId = null;
let currentUserRole = null; // To track if logged in as admin or user

// --- Authentication Logic ---

async function checkPassword() {
    const passwordInput = document.getElementById("admin-password");
    const loginSection = document.getElementById("login-section");
    const adminPanel = document.getElementById("admin-panel");
    const errorMsg = document.getElementById("error-msg");

    const inputPassword = passwordInput.value;

    if (!inputPassword) {
        if (errorMsg) {
            errorMsg.style.display = "block";
            errorMsg.textContent = "Please enter a password";
        }
        return;
    }

    // Hash the input password using the global function from config.js
    if (!window.hashPassword) {
        console.error("News: hashPassword function not found. Ensure config.js is loaded.");
        return;
    }

    const hashedInput = await window.hashPassword(inputPassword);

    if (hashedInput === window.ADMIN_PASSWORD_HASH) {
        currentUserRole = "admin";
        if (loginSection) loginSection.style.display = "none";
        if (adminPanel) adminPanel.style.display = "block";
        
        sessionStorage.setItem("adminAuthSession", JSON.stringify({
            role: "admin",
            timestamp: Date.now()
        }));
        removePinFieldForLoggedInUsers();
        renderNewsAdmin();
    } else if (hashedInput === window.USER_PASSWORD_HASH) {
        currentUserRole = "user";
        if (loginSection) loginSection.style.display = "none";
        if (adminPanel) adminPanel.style.display = "block";
        
        sessionStorage.setItem("adminAuthSession", JSON.stringify({
            role: "user",
            timestamp: Date.now()
        }));
        removePinFieldForLoggedInUsers();
        renderNewsAdmin();
    } else {
        if (errorMsg) {
            errorMsg.style.display = "block";
            errorMsg.textContent = "Incorrect password. Try again.";
        }
        passwordInput.value = "";
    }
}

// Make globally available
window.checkPassword = checkPassword;


// --- Data Fetching ---

async function getNews() {
    const { url, key } = getSupabaseCredentials();
    
    // Strictly use Supabase
    if (!url || !key) {
        console.error("News: Supabase not configured.");
        return [];
    }

    try {
        const requestUrl = `${url.replace(/\/$/, '')}/rest/v1/news?order=news_date.desc`;
        const response = await fetch(requestUrl, {
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentNewsList = data.map(item => ({
                id: item.id,
                title: item.title,
                content: item.content,
                author: item.author,
                date: item.news_date,
                image_url: item.image_url,
                video_url: item.video_url,
                link_url: item.link_url,
                publisher_role: item.publisher_role
            }));
            return currentNewsList;
        } else {
            console.error("News: Failed to fetch", await response.text());
            throw new Error("Fetch failed");
        }
    } catch (e) {
        console.error("News: Network error", e);
        return [];
    }
}

async function saveNews(newsItem, isUpdate = false, id = null) {
    const { url, key } = getSupabaseCredentials();

    if (!url || !key) {
        alert("Error: Supabase not configured.");
        return false;
    }

    try {
        let requestUrl = `${url.replace(/\/$/, '')}/rest/v1/news`;
        let method = 'POST';
        
        const payload = {
            title: newsItem.title,
            content: newsItem.content,
            author: newsItem.author,
            news_date: newsItem.date,
            image_url: newsItem.image_url,
            video_url: newsItem.video_url,
            link_url: newsItem.link_url,
            publisher_role: newsItem.publisher_role
        };

        if (isUpdate && id) {
            requestUrl += `?id=eq.${id}`;
            method = 'PATCH';
        }

        const response = await fetch(requestUrl, {
            method: method,
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            return true;
        } else {
            alert("Error saving to cloud: " + await response.text());
            return false;
        }
    } catch (e) {
        console.error(e);
        alert("Network error: Could not save news.");
        return false;
    }
}

// Security Helper
async function verifyPinForAction(publisherRole, action) {
    let requiredHash = window.ADMIN_PASSWORD_HASH;
    let pinPrompt = "Enter ADMIN PIN to confirm:";
    
    // Logic: 
    // If publisher is User -> Require User PIN ('11')
    // If publisher is Admin -> Require Admin PIN ('2')
    // (As requested by user)
    
    if (publisherRole === 'user') {
        requiredHash = window.USER_PASSWORD_HASH;
        pinPrompt = "Enter USER PIN to confirm:";
    } else {
        // Default to Admin
        requiredHash = window.ADMIN_PASSWORD_HASH;
        pinPrompt = "Enter ADMIN PIN to confirm:";
    }

    const pin = prompt(pinPrompt);
    if (!pin) return false;

    const hashedPin = await window.hashPassword(pin);
    if (hashedPin === requiredHash) return true;
    
    // Fallback: Admin PIN should probably override User items too?
    // But sticking to strict request: "if user... require 11"
    
    // Actually, let's allow Admin PIN to work for everything as a fallback?
    // User request was specific about "require 11", but standard admin rights imply 2 works everywhere.
    // I will stick to the requested logic for now to show strict compliance, 
    // but maybe adding "OR Admin" is safer. 
    // The request: "if the publisher is a user it requre the user pass'11'" -> implies ONLY 11?
    // Let's implement strict request.
    
    alert("❌ Incorrect PIN.");
    return false;
}

async function deleteNews(id, publisherRole) {
    console.log(`[DEBUG] deleteNews START. ID: ${id}, PublisherRole: ${publisherRole}, currentUserRole: ${currentUserRole}`);
    
    if (currentUserRole !== 'admin') {
        console.warn("[DEBUG] Non-admin tried to delete.");
        alert('⚠️ Only administrators can delete news articles.');
        return;
    }

    // Create custom confirmation dialog since confirm() is broken
    const confirmed = await new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
        
        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:#1a1a2e;padding:30px;border-radius:12px;max-width:400px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
        dialog.innerHTML = `
            <h3 style="color:#fff;margin:0 0 15px 0;font-size:1.3rem;">⚠️ Confirm Deletion</h3>
            <p style="color:#ccc;margin:0 0 25px 0;line-height:1.5;">Are you sure you want to delete this news article? This action cannot be undone.</p>
            <div style="display:flex;gap:10px;justify-content:center;">
                <button id="confirm-cancel" style="padding:10px 20px;background:#555;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:1rem;">Cancel</button>
                <button id="confirm-ok" style="padding:10px 20px;background:#ef4444;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:1rem;">Delete</button>
            </div>
        `;
        
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        
        document.getElementById('confirm-ok').onclick = () => {
            document.body.removeChild(overlay);
            resolve(true);
        };
        document.getElementById('confirm-cancel').onclick = () => {
            document.body.removeChild(overlay);
            resolve(false);
        };
    });
    
    console.log(`[DEBUG] Custom confirm result: ${confirmed}`);
    
    if (!confirmed) {
        console.log("[DEBUG] Deletion cancelled by user.");
        return;
    }
    
    console.log("[DEBUG] Admin deletion - proceeding after confirmation...");
    const { url, key } = getSupabaseCredentials();
    console.log(`[DEBUG] Supabase credentials: URL=${url ? 'Present' : 'Missing'}, Key=${key ? 'Present' : 'Missing'}`);
    
    if (!url || !key) {
         console.error("[DEBUG] Supabase credentials missing during delete.");
         alert("Error: Supabase not configured.");
         return;
    }

    console.log("[DEBUG] Starting deletion process...");

    try {
        // 1. Get the item data to find media paths for storage deletion
        const item = currentNewsList.find(n => n.id.toString() === id.toString());
        console.log(`[DEBUG] Item to delete:`, item);
        
        // 2. Delete media from Supabase Storage if they exist
        if (item) {
            const mediaToDelete = [];
            if (item.image_url && item.image_url.includes('/news-images/')) mediaToDelete.push(item.image_url);
            if (item.video_url && item.video_url.includes('/news-images/')) mediaToDelete.push(item.video_url);

            for (const mediaUrl of mediaToDelete) {
                try {
                    const filePath = mediaUrl.split('/news-images/').pop();
                    const storageDeleteUrl = `${url.replace(/\/$/, '')}/storage/v1/object/news-images/${filePath}`;
                    console.log(`[DEBUG] Deleting media from storage: ${storageDeleteUrl}`);
                    
                    await fetch(storageDeleteUrl, {
                        method: 'DELETE',
                        headers: {
                            'apikey': key,
                            'Authorization': `Bearer ${key}`
                        }
                    });
                } catch (err) {
                    console.error("[DEBUG] Error deleting media from storage:", err);
                }
            }
        }

        // 3. Delete the news record from the table
        const requestUrl = `${url.replace(/\/$/, '')}/rest/v1/news?id=eq.${id}`;
        console.log(`[DEBUG] Deleting record: ${requestUrl}`);
        
        const response = await fetch(requestUrl, {
            method: 'DELETE',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });

        if (response.ok) {
            console.log("[DEBUG] News record deleted successfully.");
            renderNewsAdmin(); 
        } else {
            const errText = await response.text();
            console.error("[DEBUG] Supabase delete error:", errText);
            alert("Error deleting news record: " + errText);
        }
    } catch (e) {
        console.error("[DEBUG] Network Error during delete:", e);
        alert("Network Error");
    }
}

async function editNews(id, publisherRole) {
    // PERMISSION CHECK: Only admins can edit news
    if (currentUserRole !== 'admin') {
        alert('⚠️ Only administrators can edit news articles.');
        return;
    }

    // Admin can edit without PIN
    if (currentUserRole !== 'admin') {
        if (!await verifyPinForAction(publisherRole, 'edit')) return;
    }

    const item = currentNewsList.find(n => n.id.toString() === id.toString());
    if (!item) {
        alert("Error: Item not found.");
        return;
    }

    // Populate Form
    document.getElementById('news-title').value = item.title;
    document.getElementById('news-content').value = item.content;
    const linkObj = document.getElementById('news-link');
    if (linkObj) linkObj.value = item.link_url || '';
    
    // Set Edit Mode
    editingNewsId = id;
    const btn = document.getElementById('btn-add-news');
    btn.textContent = "Update News";
    btn.classList.add('btn-warning'); // Visual cue (need CSS for this? btn-primary is fine, maybe change color manually)
    
    // Scroll to form
    document.querySelector('.section').scrollIntoView({ behavior: 'smooth' });
}

function formatDate(dateString) {
    if (!dateString) return '';
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// --- Render Logic ---

function createNewsCardHtml(item, isAdmin = false) {
    let mediaHtml = '';
    
    // Media Logic (Shared)
    if (item.video_url) {
        mediaHtml += `
            <video class="news-video" 
                   src="${escapeHtml(item.video_url)}" 
                   controlsList="nodownload" 
                   oncontextmenu="return false;"
                   onclick="openLightbox('${escapeHtml(item.video_url)}', 'video')"
                   preload="metadata">
            </video>
            <div style="text-align:center; margin-top:-10px; margin-bottom:15px; font-size:0.8rem; color:#aaa;">(Click to Watch)</div>
        `;
    }
    
    if (item.image_url) {
        mediaHtml += `<img src="${escapeHtml(item.image_url)}" 
                           alt="News Image" 
                           class="news-image" 
                           onerror="this.style.display='none'"
                           onclick="openLightbox('${escapeHtml(item.image_url)}', 'image')">`;
    }

    let linkHtml = '';
    if (item.link_url) {
        let url = item.link_url;
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        linkHtml = `
            <div style="margin-top: 10px;">
                <a href="${escapeHtml(url)}" target="_blank" class="news-link-btn">Read More &rarr;</a>
            </div>
        `;
    }

    // Admin Actions - Only show edit/delete for admins
    let adminActionsHtml = '';
    if (isAdmin && currentUserRole === 'admin') {
        const role = item.publisher_role || 'admin';
        adminActionsHtml = `
            <div style="display:flex; gap:10px; margin-top:15px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
                <button class="btn-edit" style="flex:1;" onclick="editNews('${item.id}', '${role}')">✏️ Edit</button>
                <button class="btn-danger" style="flex:1;" onclick="deleteNews('${item.id}', '${role}')">🗑️ Delete</button>
            </div>
        `;
    } else if (isAdmin && currentUserRole === 'user') {
        // Show a message that users can't edit/delete
        adminActionsHtml = `
            <div style="margin-top:15px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px; text-align:center;">
                <p style="color: var(--text-muted); font-size: 0.85rem;">👁️ View only (Admin access required to edit/delete)</p>
            </div>
        `;
    }

    return `
        <div class="news-header">
            <h3 class="news-title">${escapeHtml(item.title)}</h3>
            <span class="news-date">${formatDate(item.date)}</span>
        </div>
        ${mediaHtml}
        <div class="news-content">${formatContent(item.content)}</div>
        ${linkHtml}
        <div class="news-footer">
            <span class="news-author">By ${escapeHtml(item.author || 'Admin')}</span>
        </div>
        ${adminActionsHtml}
    `;
}

// --- Lightbox Logic ---

function setupLightbox() {
    if (document.getElementById('mh-lightbox')) return;

    const lightbox = document.createElement('div');
    lightbox.id = 'mh-lightbox';
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
        <span class="lightbox-close">&times;</span>
        <div id="lightbox-container" style="display:flex; justify-content:center; width:100%;"></div>
    `;
    document.body.appendChild(lightbox);
    
    lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });
}

function openLightbox(src, type) {
    const lightbox = document.getElementById('mh-lightbox');
    const container = document.getElementById('lightbox-container');
    if (!lightbox || !container) return;

    container.innerHTML = ''; 

    if (type === 'video') {
        const video = document.createElement('video');
        video.className = 'lightbox-content';
        video.src = src;
        video.controls = true;
        video.setAttribute('controlsList', 'nodownload');
        video.setAttribute('disablePictureInPicture', 'true');
        video.oncontextmenu = (e) => { e.preventDefault(); return false; }; 
        container.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.className = 'lightbox-content';
        img.src = src;
        container.appendChild(img);
    }
    lightbox.classList.add('active');
}

function closeLightbox() {
    const lightbox = document.getElementById('mh-lightbox');
    const container = document.getElementById('lightbox-container');
    if (lightbox) {
        lightbox.classList.remove('active');
        if (container) container.innerHTML = ''; 
    }
}

window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;

// --- Public Page Logic ---

async function renderNewsPublic() {
    const listContainer = document.getElementById('news-list-public');
    if (!listContainer) return;

    listContainer.innerHTML = '<p style="text-align:center; color:#888;">Loading latest news...</p>';

    const newsItems = await getNews();
    
    listContainer.innerHTML = '';

    if (newsItems.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">No news updates available at the moment.</div>';
        return;
    }

    newsItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'news-card';
        card.innerHTML = createNewsCardHtml(item, false);
        listContainer.appendChild(card);
    });
}

// --- Admin Page Logic ---

async function renderNewsAdmin() {
    const listContainer = document.getElementById('news-list-admin');
    if (!listContainer) return;

    listContainer.innerHTML = '<p style="text-align:center; color:#888;">Fetching news...</p>';

    const newsItems = await getNews();

    listContainer.innerHTML = '';

    if (newsItems.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">No news added yet. Use the form above to add one.</div>';
        return;
    }

    newsItems.forEach(item => {
        const card = document.createElement('div');
        // Use standard glass card class
        card.className = 'news-card'; 
        card.innerHTML = createNewsCardHtml(item, true);
        listContainer.appendChild(card);
    });
}

async function uploadFile(file) {
    const { url, key } = getSupabaseCredentials();
    if (!url || !key) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `${fileName}`;

    try {
        const uploadUrl = `${url.replace(/\/$/, '')}/storage/v1/object/news-images/${filePath}`;
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': file.type || 'application/octet-stream',
                'x-upsert': 'true'
            },
            body: file
        });

        if (response.ok) {
            return `${url.replace(/\/$/, '')}/storage/v1/object/public/news-images/${filePath}`;
        } else {
            console.error("Upload failed", await response.text());
            return null;
        }
    } catch (e) {
        console.error("Upload error", e);
        return null;
    }
}

async function handleAddNews(e) {
    e.preventDefault();
    
    const titleObj = document.getElementById('news-title');
    const contentObj = document.getElementById('news-content');
    const imageInput = document.getElementById('news-image');
    const videoInput = document.getElementById('news-video');
    const linkObj = document.getElementById('news-link');
    const pinObj = document.getElementById('publish-pin');
    const btn = document.getElementById('btn-add-news');

    if (!titleObj || !contentObj) return;

    const title = titleObj.value.trim();
    const content = contentObj.value.trim();
    let link_url = linkObj ? linkObj.value.trim() : '';
    
    // Auto-fix link
    if (link_url && !/^https?:\/\//i.test(link_url)) link_url = 'https://' + link_url;

    if (!title || !content) {
        alert('Please fill in title and content.');
        return;
    }
    
    // AUTH CHECK - Use session role if available, otherwise ask for PIN
    let role = '';
    let authorName = '';

    if (currentUserRole) {
        // User is logged in - use their session role
        role = currentUserRole;
        authorName = currentUserRole === 'admin' ? 'Admin' : 'User';
        
        // Remove PIN field since it's not needed
        removePinFieldForLoggedInUsers();
    } else {
        // User is not logged in - require PIN
        const pin = pinObj ? pinObj.value.trim() : '';
        
        if (!pin) {
            alert('Please enter a Publish PIN.');
            return;
        }

        const hashedPin = await window.hashPassword(pin);

        if (hashedPin === window.ADMIN_PASSWORD_HASH) {
            role = 'admin';
            authorName = 'Admin';
        } else if (hashedPin === window.USER_PASSWORD_HASH) {
            role = 'user';
            authorName = 'User';
        } else {
            alert("Incorrect PIN. Please try again.");
            return;
        }
    }

    // LIMIT CHECK FOR USER (Skip if updating existing item)
    if (role === 'user' && !editingNewsId) {
        try {
            const userPosts = currentNewsList.filter(n => n.publisher_role === 'user').length;
            if (userPosts >= 5) {
                alert(`User limit reached! You have already published ${userPosts}/5 items.`);
                return;
            }
        } catch(e) {}
    }

    // Disable button
    const originalText = btn.textContent;
    btn.textContent = editingNewsId ? "Updating..." : "Publishing...";
    btn.disabled = true;
    
    // Handle Files
    let image_url = ''; 
    let video_url = '';
    
    // For update, if no new file selected, we keep old?
    // fetch/saveNews handles this? No, we need to pass old URL if not changing.
    // But input fields are empty.
    // If editing, retrieve current URLs
    let currentItem = null;
    if (editingNewsId) {
        currentItem = currentNewsList.find(i => i.id.toString() === editingNewsId.toString());
        if (currentItem) {
            image_url = currentItem.image_url;
            video_url = currentItem.video_url;
        }
    }

    const imgFile = imageInput && imageInput.files ? imageInput.files[0] : null;
    const vidFile = videoInput && videoInput.files ? videoInput.files[0] : null;

    if (imgFile) {
        btn.textContent = "Uploading Image...";
        const uploadedUrl = await uploadFile(imgFile);
        if (uploadedUrl) image_url = uploadedUrl;
    }

    if (vidFile) {
        btn.textContent = "Uploading Video...";
        const uploadedUrl = await uploadFile(vidFile);
        if (uploadedUrl) video_url = uploadedUrl;
    }

    btn.textContent = "Saving News...";

    const newItem = {
        title,
        content,
        author: authorName,
        date: new Date().toISOString(), // Update date on edit? Or keep original? Usually keep original on edit, but user didn't specify. I'll update date to show latest activity or keep? Let's NEW date for now or keep old if editing?
        // Let's use NEW date for update to bump it up, OR keep original. 
        // Admin panel usually keeps creation date. I'll use new Date if insert, else keep old.
        // Actually, let's just use new Date to denote "Last Updated".
        image_url,
        video_url,
        link_url,
        publisher_role: role
    };
    
    // Correct Date logic
    if (editingNewsId && currentItem) {
        newItem.date = currentItem.date; // Keep original date
    }

    const success = await saveNews(newItem, !!editingNewsId, editingNewsId);

    if (success) {
        // Reset Form
        titleObj.value = '';
        contentObj.value = '';
        if(imageInput) imageInput.value = ''; 
        if(videoInput) videoInput.value = ''
;
        if(linkObj) linkObj.value = '';
        if(pinObj) pinObj.value = '';
        
        await renderNewsAdmin();
        alert(editingNewsId ? 'News updated!' : 'News published!');
        
        // Reset Edit Mode
        editingNewsId = null;
        btn.textContent = "Publish News";
        btn.classList.remove('btn-warning');
        btn.disabled = false; // Re-enable the button
    } else {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

window.editNews = editNews;

// --- Utilities ---

function escapeHtml(text) {
    if (!text) return '';
    return text.toString().replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
}

function formatContent(text) {
    if (!text) return '';
    return escapeHtml(text).replace(/\n/g, '<br>');
}

// --- Clear All Logic ---

async function handleClearAllNews() {
    // PERMISSION CHECK: Only admins can clear all news
    if (currentUserRole !== 'admin') {
        alert('⚠️ Only administrators can clear all news articles at once.');
        return;
    }

    if (!confirm("⚠️ WARNING: This will delete ALL news items. This action cannot be undone.\n\nAre you sure?")) return;

    const pin = prompt("Please enter the ADMIN PIN to confirm deletion:");
    if (!pin) return;

    const hashedPin = await window.hashPassword(pin);
    if (hashedPin !== window.ADMIN_PASSWORD_HASH) {
        alert("❌ Access Denied: Incorrect PIN. Only Admin can clear all news.");
        return;
    }

    const { url, key } = getSupabaseCredentials();
    if (!url || !key) return;

    // Delete all rows
    try {
        const requestUrl = `${url.replace(/\/$/, '')}/rest/v1/news?id=neq.0`; // Delete where id != 0 (all)
        const response = await fetch(requestUrl, {
            method: 'DELETE',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });

        if (response.ok) {
            alert("✅ All news items have been deleted.");
            renderNewsAdmin();
        } else {
            alert("Error clearing news: " + await response.text());
        }
    } catch (e) {
        console.error(e);
        alert("Network Error");
    }
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    // Determine which page we are on
    setupLightbox(); 

    if (document.getElementById('news-list-public')) {
        renderNewsPublic();
    }

    if (document.getElementById('news-list-admin')) {
        // Recover session if exists (Disabled: forced login on refresh)
        /*
        const session = sessionStorage.getItem('adminAuthSession');
        if (session) {
            try {
                const authData = JSON.parse(session);
                currentUserRole = authData.role;
                
                // Hide PIN field for logged-in users
                hidePinFieldForLoggedInUsers();
            } catch(e) {}
        }
        */

        renderNewsAdmin();
        const addBtn = document.getElementById('btn-add-news');
        if (addBtn) {
            addBtn.addEventListener('click', handleAddNews);
        }
        
        const clearBtn = document.getElementById('btn-clear-all');
        if (clearBtn) {
            clearBtn.addEventListener('click', handleClearAllNews);
        }
    }
});

// Helper function to remove PIN field for logged-in users
function removePinFieldForLoggedInUsers() {
    const pinObj = document.getElementById('publish-pin');
    if (pinObj && pinObj.parentElement && currentUserRole) {
        // Find the parent form-group div and remove it
        const formGroup = pinObj.closest('.form-group');
        if (formGroup) {
            formGroup.remove();
        } else {
            pinObj.remove();
        }
    }
}

window.deleteNews = deleteNews;
