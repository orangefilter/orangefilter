/**
 * Stats Persistence Library
 * Tracks how many items have been blocked.
 */
import { getStorage, setStorage } from './storage';

/**
 * Increments the blocked counter in storage.
 * @param {number} count - Amount to increment by (default 1)
 */
export async function incrementBlockedCount(count = 1) {
  try {
    const data = await getStorage();
    const currentCount = data.stats?.blockedCount || 0;

    await setStorage({
      ...data,
      stats: {
        ...data.stats,
        blockedCount: currentCount + count,
        lastUpdate: Date.now(),
      },
    });
  } catch (error) {
    console.error('Failed to update stats:', error);
  }
}

/**
 * Gets the current blocked count.
 * @returns {Promise<number>}
 */
export async function getBlockedCount() {
  const data = await getStorage();
  return data.stats?.blockedCount || 0;
}
