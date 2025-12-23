# Google Calendar Integration Setup

## Installation Required

The Google Calendar integration requires two npm packages. Please install them:

```bash
npm install @react-oauth/google axios
```

Or if you encounter permission errors:

```bash
sudo chown -R $(whoami) ~/.npm
npm install @react-oauth/google axios
```

## What's Been Implemented

### 1. Google OAuth Provider (`src/main.tsx`)
- Wraps the entire app with `GoogleOAuthProvider`
- Uses your Google Client ID: `786115803806-tdcbvlu7u0mogn54dsqci4uku2rldoa8.apps.googleusercontent.com`

### 2. Google Calendar Context (`src/contexts/GoogleCalendarContext.tsx`)
- Handles authentication with Google OAuth
- Fetches events from Google Calendar API
- Stores access token in localStorage for persistence
- Transforms Google events to app format

### 3. Agenda Integration (`src/pages/Agenda.tsx`)
- Added "Synchroniser Google" button in the header
- Button shows "Compte connecté" when authenticated (green badge)
- Merges Google Calendar events with local CRM events
- Google events are displayed with their calendar color (#4285F4 - Google Blue)
- Google events have 📅 emoji prefix in title

## How to Use

1. Install the required packages (see above)
2. Navigate to the Agenda page
3. Click "Synchroniser Google" button
4. Sign in with your Google account
5. Grant calendar read permissions
6. Your Google Calendar events will automatically appear merged with CRM events

## Features

- **Auto-sync**: Events are fetched immediately after login
- **Persistent Login**: Access token is stored in localStorage
- **Month View**: Fetches events for the current month
- **Visual Distinction**: Google events use Google Blue color (#4285F4)
- **Read-Only**: Only reads calendar events (readonly scope)

## Scopes

The integration uses: `https://www.googleapis.com/auth/calendar.readonly`

This is a read-only scope that allows the app to view your calendar events but not modify them.

## Troubleshooting

If you see errors about missing packages:
1. Make sure you've installed `@react-oauth/google` and `axios`
2. Restart the development server: `npm run dev`

If authentication fails:
1. Check that your Google Client ID is correctly configured in the Google Cloud Console
2. Make sure `http://localhost:5174` is added to authorized redirect URIs
3. Clear localStorage and try again

## Technical Details

- Google events are transformed to match the internal meeting format
- Events are filtered by date and merged with local events
- The calendar displays both CRM events and Google events seamlessly
- Click on any event to see details (Google events show description if available)
