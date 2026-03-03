/**
 * Time Agent - Date and time information capability
 *
 * Usage: relay agents start time
 */

import { quickConnect } from '../sdk/index';

export function startTimeAgent() {
  quickConnect({
    name: 'TimeAgent',
    capabilities: ['get_time', 'get_date', 'current_time', 'timezone'],
    port: 8103,
    handler: async (task: string, params: Record<string, any>) => {
      const now = new Date();

      if (task === 'get_time' || task === 'current_time') {
        return {
          time: now.toLocaleTimeString('en-US', { hour12: false }),
          time12h: now.toLocaleTimeString('en-US', { hour12: true }),
          timestamp: now.getTime(),
          iso: now.toISOString(),
        };
      }

      if (task === 'get_date') {
        return {
          date: now.toLocaleDateString('en-US'),
          isoDate: now.toISOString().split('T')[0],
          dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
          month: now.toLocaleDateString('en-US', { month: 'long' }),
          year: now.getFullYear(),
        };
      }

      if (task === 'timezone') {
        const timezone = params.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

        try {
          const timeInZone = now.toLocaleString('en-US', { timeZone: timezone });
          const offset = now.toLocaleString('en-US', {
            timeZone: timezone,
            timeZoneName: 'short'
          }).split(' ').pop();

          return {
            timezone,
            time: timeInZone,
            offset,
            timestamp: now.getTime(),
          };
        } catch (error: any) {
          throw new Error(`Invalid timezone: ${timezone}`);
        }
      }

      throw new Error(`Unknown task: ${task}`);
    },
  });

  console.log('✅ TimeAgent started - Tracking time!');
}

// Allow running directly
if (require.main === module) {
  startTimeAgent();
}
