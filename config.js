// =============================
// SHARED CONFIGURATION & CONSTANTS
// =============================

// Configuration Item Types (used in predictions array)
export const CONFIG_TYPES = {
  ITHINK: "__ITHINK__",
  ITHINK_TITLE: "__ITHINK_TITLE__",
  EXTERNAL_APIS: "__EXTERNAL_APIS__",
  ANALYTICS: "__ANALYTICS__",
  VIEW_LOG: "__VIEW_LOG__",
  TARGET_DATE: "__TARGET_DATE__",
  HEADER_IMAGE: "__HEADER_IMAGE__",
  HEADER_ASSET: "__HEADER_ASSET__",
  THEME_CONFIG: "__THEME_CONFIG__",
  GEMINI_CONFIG: "__GEMINI_CONFIG__",
  VOICE_ASSET: "__VOICE_ASSET__",
  // Public Config for Visitors (GitHub Pages)
  PUBLIC_SUPABASE: "__PUBLIC_SUPABASE__",
};

// Check if a prediction is a config item
export function isConfigItem(prediction) {
  if (!prediction || !prediction.condition) return false;
  return Object.values(CONFIG_TYPES).includes(prediction.condition);
}

// Filter to get only actual forecast entries
export function getActualForecasts(predictions) {
  return (predictions || []).filter((p) => !isConfigItem(p));
}

// Supabase Configuration Validation
export function validateSupabaseKey(key) {
  if (!key || typeof key !== "string") return false;
  // Valid Supabase anon keys start with 'eyJ' (base64 JWT)
  return key.trim().startsWith("eyJ") && key.length > 100;
}

export function validateSupabaseUrl(url) {
  if (!url || typeof url !== "string") return false;
  // Valid Supabase URLs contain 'supabase.co'
  return url.trim().includes("supabase.co") && url.startsWith("http");
}

// Storage Keys
export const STORAGE_KEYS = {
  PREDICTIONS: "weatherPredictions",
  SUPABASE_SETTINGS: "supabaseSyncSettings",
  GEMINI_KEY: "geminiAIKey",
  AUTH_SESSION: "adminAuthSession",
};

// Password hashing using SHA-256
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const ADMIN_PASSWORD_HASH =
  "d4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35"; // Hash of '2'

export const USER_PASSWORD_HASH = 
  "4fc82b26aecb47d2868c4efbe3581732a3e7cbcc6c2efb32062c08170a05eeb8"; // Hash of '11'

// ==========================================
// ⚠️ PUBLIC HOSTING CONFIGURATION (GitHub Pages)
// ==========================================
// To allow visitors to see forecasts, you MUST paste your keys here.
// The "Anon" key is safe to share publicly if you have Row Level Security (RLS) enabled.
export const SUPABASE_PUBLIC_CONFIG = {
  URL: "https://jfmvebvwovibxuxskrcd.supabase.co",
  ANON_KEY: "sb_publishable_YSsIGJW7AQuh37VqbwmDWg_fmRZVXVh",
};

// Make functions available globally for non-module scripts
if (typeof window !== "undefined") {
  window.SUPABASE_PUBLIC_CONFIG = SUPABASE_PUBLIC_CONFIG;
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
