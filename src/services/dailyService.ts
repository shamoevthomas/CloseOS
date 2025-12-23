/**
 * Daily.co Video Service
 */

const DAILY_API_KEY = import.meta.env.VITE_DAILY_API_KEY
const DAILY_API_URL = 'https://api.daily.co/v1/rooms'

/**
 * Creates a new Daily.co video room
 * @returns Promise with the room URL string
 */
export async function createDailyRoom(): Promise<string> {
  const response = await fetch(DAILY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DAILY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        exp: Math.round(Date.now() / 1000) + 7200, // 2 hour expiry
      },
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to create Daily.co room')
  }

  const data = await response.json()
  return data.url
}

/**
 * Checks if a URL is a Daily.co meeting link
 */
export function isDailyCoLink(url: string): boolean {
  return url.includes('daily.co')
}
