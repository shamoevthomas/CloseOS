# Debugging Live Call Room - Troubleshooting Guide

## Issue: Blank Screen when clicking "Rejoindre (Cockpit)"

This guide helps diagnose and fix blank screen issues when navigating to the Call Room.

---

## ✅ Fixes Applied

### 1. Route Registration
- **Route**: `/live-call` is properly registered in `App.tsx`
- **Location**: OUTSIDE the Layout wrapper (full-screen, no sidebar)
- **Status**: ✅ Confirmed

### 2. Navigation Logic
- **Location**: `Agenda.tsx` → Event Details Modal
- **Logic**: Detects Daily.co links and navigates to `/live-call?url=...`
- **Status**: ✅ Implemented with debug logging

### 3. Error Handling
- **Component**: `CallRoom.tsx`
- **Improvements**:
  - Better error messages with console logging
  - Graceful fallback if URL is missing
  - Defensive checks for iframe ref
- **Status**: ✅ Enhanced

---

## 🔍 Debugging Steps

### Step 1: Check Browser Console
When you click "Rejoindre (Cockpit)", you should see:

```
Navigating to Call Room: /live-call?url=https%3A%2F%2F...
Daily URL: https://your-daily-room.daily.co/room-name
CallRoom component rendered
Search params: url=https%3A%2F%2F...
Daily URL from params: https://your-daily-room.daily.co/room-name
Initializing Daily.co call with URL: https://your-daily-room.daily.co/room-name
Successfully joined Daily.co call
```

### Step 2: Check for Common Issues

#### Issue A: "CallRoom component rendered" NOT showing
**Problem**: Route not working
**Solution**:
```bash
# Restart dev server
npm run dev
```

#### Issue B: "Daily URL from params: null"
**Problem**: URL not being passed correctly
**Solution**: Check the event's location field contains a valid Daily.co URL

#### Issue C: Daily iframe error
**Problem**: Daily.co API key or room creation failed
**Solution**: Check `.env` file contains:
```
VITE_DAILY_API_KEY=d28edc1c9da88f1d83eddba0ff45a9abd2d1485607eb3d1f302511a7db05a540
```

#### Issue D: CORS or network errors
**Problem**: Daily.co blocked by browser
**Solution**: Check browser console for CORS errors. Try:
- Disabling browser extensions
- Using incognito mode
- Checking firewall settings

---

## 🧪 Test Procedure

### Test 1: Manual Navigation
Navigate directly to test the route:
```
http://localhost:5173/live-call?url=https://your-room.daily.co/test
```

**Expected**:
- Script editor on left (30%)
- Video area on right (70%)
- "Connexion en cours..." loading screen

### Test 2: Create Event with Daily Link
1. Go to Agenda
2. Click "+ Nouveau RDV"
3. Select a prospect
4. Click "Générer Lien Visio"
5. Save the event
6. Click the event
7. Click "Rejoindre (Cockpit)"

**Expected**: Navigates to Call Room with loading screen

### Test 3: Manual Daily.co Link
1. Create an event manually
2. In "Lieu" field, paste: `https://your-room.daily.co/test`
3. Save and click the event
4. Should see "Rejoindre (Cockpit)" button

---

## 📋 Checklist

- [ ] Route `/live-call` exists in `App.tsx` (line 41)
- [ ] `CallRoom` component imported in `App.tsx` (line 14)
- [ ] `.env` file exists with `VITE_DAILY_API_KEY`
- [ ] Dev server restarted after `.env` changes
- [ ] Browser console shows no errors
- [ ] Event has a Daily.co URL in location field
- [ ] Network tab shows Daily.co requests succeeding

---

## 🚨 Emergency Fallback

If still blank, add this temporary test to `CallRoom.tsx` at line 200:

```tsx
return (
  <div className="flex h-screen items-center justify-center bg-red-500">
    <div className="text-center text-white">
      <h1 className="text-4xl font-bold">CALL ROOM TEST</h1>
      <p className="mt-4">URL: {dailyUrl || 'MISSING'}</p>
      <p>Params: {searchParams.toString()}</p>
    </div>
  </div>
)
```

If you see this red screen, the route is working but Daily initialization is failing.

---

## 📞 Support

If the issue persists:
1. Copy all console logs (Ctrl+A in Console tab)
2. Take a screenshot of the Network tab
3. Check if Daily.co service is operational: https://status.daily.co/
4. Verify your Daily.co API key is valid in the Daily.co dashboard

---

## 🎯 Expected Final Result

When working correctly:
- Click "Rejoindre (Cockpit)" → Instant navigation
- See loading screen with spinner
- Daily.co video interface loads in ~2-3 seconds
- Left panel shows sales script
- Bottom controls for video/audio/recording
