# Weather App

A weather forecasting web application with admin panel and analytics.

## How to Run

1. **Start any local server** (any of these will work):

   - `python -m http.server 8000`
   - Or use VS Code Live Server extension
   - Or any other local web server

2. **Open in browser:**
   - Main page: http://localhost:8000/index.html
   - Admin panel: http://localhost:8000/admin.html

## Admin Panel

- **Password:** `2` (1+1=2)
- **Features:**
  - View daily page analytics
  - Add new weather forecasts
  - Delete existing forecasts
  - Changes save automatically to browser storage

## Files

- `index.html` - Main weather forecast page
- `admin.html` - Admin dashboard
- `other.html` - Live weather page
- `data.json` - Initial weather predictions data
- `analytics.js` - Page view tracking
- `admin.js` - Admin functionality
- `script.js` - Main page functionality
- `style.css` - Styling

## Supabase Sync Setup

To sync forecasts across devices, you must configure Supabase in the Admin Panel:

1.  **Create Project**: Create a free project at [supabase.com](https://supabase.com).
2.  **Create Table**: In the SQL Editor, run:
    ```sql
    create table predictions (
      id bigint primary key generated always as identity,
      created_at timestamptz default now(),
      date text not null,
      to_date text,
      temperature text not null,
      condition text not null,
      notes text
    );
    ```
3.  **API Keys**: Copy the **Project URL** and **Anon Key** from Settings > API.
4.  **Admin Panel**: Paste them into the Supabase Settings section and click **Save**.

Once saved, any changes made in the Admin Panel will sync instantly to the cloud and appear on all devices.

## Important Notes

- Forecasts are stored in Supabase and cached in browser localStorage.
- Changes appear in real-time (no manual file updates needed).
- Initial data can still be loaded from `data.json` if no Supabase settings are found.
