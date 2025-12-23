# 🚨 Agenda Crash Fix Guide

## Problem
The Agenda page showed a black screen due to corrupt data in `closeros_events` localStorage.

## ✅ Solution Applied

### 1. **Auto-Repair Logic in MeetingsContext** (CRITICAL FIX)

The `MeetingsContext.tsx` now includes comprehensive data validation:

- ✅ **Checks if data is an array** - Resets if not
- ✅ **Validates each event** - Filters out corrupt items
- ✅ **Checks date formats** - Removes unparseable dates
- ✅ **Validates required fields** - Ensures id, date, time, title exist
- ✅ **Auto-saves cleaned data** - Writes repaired data back to localStorage
- ✅ **Falls back to defaults** - Uses sample data if all events are invalid

**Location:** `/Users/thomasshamoev/closeros-mvp/src/contexts/MeetingsContext.tsx` (lines 111-207)

### 2. **Error Handling in Agenda.tsx**

Added try-catch blocks to prevent crashes when rendering:

- ✅ **Safe date parsing** in `getMeetingsForDate()` (lines 258-295)
- ✅ **Google Calendar event validation** (lines 297-343)
- ✅ **Defensive filtering** - Returns empty array instead of crashing

**Location:** `/Users/thomasshamoev/closeros-mvp/src/pages/Agenda.tsx`

### 3. **Emergency Reset Button**

Added a "Reset" button in the Agenda header:

- 🔴 **Red button** in the top-right corner
- ⚠️ **Confirmation dialog** before resetting
- 🧹 **Clears all events** and reloads the page
- 🔄 **Fresh start** with default sample data

**Location:** Agenda header, next to "Nouveau RDV" button

## 🎯 How to Fix Black Screen

If you're seeing a black screen on Agenda:

### Option 1: Just Reload (Auto-Repair)
1. **Refresh the page** (F5 or Cmd+R)
2. Check browser console - you should see:
   ```
   🔄 Loading meetings from closeros_events...
   📊 Found X events, validating...
   🧹 Removed Y corrupt events
   ✅ Loaded Z valid meetings
   ```
3. The page should now display correctly

### Option 2: Manual Reset
1. Open the Agenda page
2. If it loads (even partially), click the **red "Reset" button**
3. Confirm the dialog
4. Page will reload with clean data

### Option 3: Browser Console
If the page won't load at all:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Run:
   ```javascript
   localStorage.removeItem('closeros_events')
   location.reload()
   ```

### Option 4: Use the Cleaning Tool
1. Open `/Users/thomasshamoev/closeros-mvp/clean-events-data.html` in your browser
2. Click "Scan Events for Issues"
3. Click "Clean & Repair Events"
4. Refresh your Dashboard

## 🛡️ Prevention

The fixes prevent future crashes by:

1. **Validating all incoming data** before it enters the app
2. **Auto-repairing corrupt data** on every page load
3. **Gracefully handling errors** instead of crashing
4. **Providing emergency reset** for worst-case scenarios

## 📊 What Gets Checked

Every event is validated for:

- ✅ Is an object (not null/undefined)
- ✅ Has a valid `date` field (string format YYYY-MM-DD)
- ✅ Date can be parsed by `new Date()`
- ✅ Has required fields: `time`, `title`, `id`
- ✅ Date is not in the far past (optional check for recent dates)

## 🎨 UI Preserved

**IMPORTANT:** All original features are preserved:
- ✅ Month/Week/Day views
- ✅ Google Calendar sync
- ✅ Video call integration
- ✅ Event creation modals
- ✅ Drag & drop functionality
- ✅ All 1,504 lines of premium UI code

## 🚀 Result

Your Agenda is now **crash-proof** and will:
- Load successfully even with corrupt data
- Auto-clean bad entries
- Show helpful console logs
- Provide emergency reset option
- Never show a black screen again

---

**Need help?** Check browser console for detailed logs showing what data was cleaned or rejected.
