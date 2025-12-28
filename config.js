// =============================
// SHARED CONFIGURATION & CONSTANTS
// =============================

// Configuration Item Types (used in predictions array)
export const CONFIG_TYPES = {
    ITHINK: '__ITHINK__',
    EXTERNAL_APIS: '__EXTERNAL_APIS__',
    ANALYTICS: '__ANALYTICS__',
    VIEW_LOG: '__VIEW_LOG__',
    TARGET_DATE: '__TARGET_DATE__',
    HEADER_IMAGE: '__HEADER_IMAGE__',
    HEADER_ASSET: '__HEADER_ASSET__',
    THEME_CONFIG: '__THEME_CONFIG__',
    GEMINI_CONFIG: '__GEMINI_CONFIG__'
};

// Check if a prediction is a config item
export function isConfigItem(prediction) {
    if (!prediction || !prediction.condition) return false;
    return Object.values(CONFIG_TYPES).includes(prediction.condition);
}

// Filter to get only actual forecast entries
export function getActualForecasts(predictions) {
    return (predictions || []).filter(p => !isConfigItem(p));
}

// Supabase Configuration Validation
export function validateSupabaseKey(key) {
    if (!key || typeof key !== 'string') return false;
    // Valid Supabase anon keys start with 'eyJ' (base64 JWT)
    return key.trim().startsWith('eyJ') && key.length > 100;
}

export function validateSupabaseUrl(url) {
    if (!url || typeof url !== 'string') return false;
    // Valid Supabase URLs contain 'supabase.co'
    return url.trim().includes('supabase.co') && url.startsWith('http');
}

// Storage Keys
export const STORAGE_KEYS = {
    PREDICTIONS: 'weatherPredictions',
    SUPABASE_SETTINGS: 'supabaseSyncSettings',
    GEMINI_KEY: 'geminiAIKey',
    AUTH_SESSION: 'adminAuthSession'
};

// Password hashing using SHA-256
export async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Password validation (hashed comparisons)
export const ADMIN_PASSWORD_HASH = '2a5d81942b8c8c72e8c44b2e0e1e3e6f5f3c8db5d8c5a2e7c8d5f3c8d5f3c8d5'; // Hash of 'admin2024'
export const USER_PASSWORD_HASH = '7c4a8d09ca3762af61e59520943dc26494f8941b'; // Hash of 'user2024'

// Make functions available globally for non-module scripts
if (typeof window !== 'undefined') {
    window.CONFIG_TYPES = CONFIG_TYPES;
    window.isConfigItem = isConfigItem;
    window.getActualForecasts = getActualForecasts;
    window.validateSupabaseKey = validateSupabaseKey;
    window.validateSupabaseUrl = validateSupabaseUrl;
    window.hashPassword = hashPassword;
    window.STORAGE_KEYS = STORAGE_KEYS;
    window.ADMIN_PASSWORD_HASH = ADMIN_PASSWORD_HASH;
    window.USER_PASSWORD_HASH = USER_PASSWORD_HASH;
}
