/**
 * Humanize an APScheduler trigger string for the Jobs dashboard.
 *
 * The backend exposes each job's schedule as the raw ``str(trigger)``
 * APScheduler produces — e.g. ``interval[0:20:00]``,
 * ``interval[1 day, 0:00:00]`` or ``cron[minute='0']``. Those leak
 * implementation detail, so we translate the common shapes to a short
 * human label ("every 20 min", "daily", "top of every hour") and fall
 * back to the raw string for anything we don't recognise — the raw
 * value still shows verbatim in the tooltip chip beside it.
 */

/**
 * Minimal translation function shape, matching ``utils/schedule.ts`` so
 * callers can pass ``t`` from ``useTranslation`` without casts.
 */
type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Parse ``[N day[s], ]H:MM:SS`` into total seconds, or ``null``. */
function parseIntervalSeconds(body: string): number | null {
  const match = /^(?:(\d+)\s+days?,\s*)?(\d+):(\d{2}):(\d{2})$/.exec(body.trim());
  if (!match) return null;
  const [, days, hours, minutes, seconds] = match;
  return (
    (days ? Number(days) * 86_400 : 0) +
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds)
  );
}

/** Render a duration in seconds as "every {largest whole unit}". */
function humanizeInterval(totalSeconds: number, t: Translate): string {
  if (totalSeconds % 86_400 === 0) {
    const days = totalSeconds / 86_400;
    return days === 1
      ? t("admin.jobs.schedule.daily")
      : t("admin.jobs.schedule.everyDays", { count: days });
  }
  if (totalSeconds % 3600 === 0) {
    return t("admin.jobs.schedule.everyHours", { count: totalSeconds / 3600 });
  }
  if (totalSeconds % 60 === 0) {
    return t("admin.jobs.schedule.everyMinutes", { count: totalSeconds / 60 });
  }
  return t("admin.jobs.schedule.everySeconds", { count: totalSeconds });
}

/**
 * Turn a raw trigger string into a short human label, or return the raw
 * string unchanged when it isn't a shape we humanize.
 */
export function humanizeSchedule(raw: string | null, t: Translate): string {
  if (!raw) return t("admin.jobs.notScheduled");

  const interval = /^interval\[(.+)\]$/.exec(raw);
  if (interval) {
    const seconds = parseIntervalSeconds(interval[1]);
    if (seconds !== null && seconds > 0) return humanizeInterval(seconds, t);
  }

  // Hourly cron: minute pinned, everything else wild.
  const cron = /^cron\[(.+)\]$/.exec(raw);
  if (cron && /^minute='\d+'$/.test(cron[1].trim())) {
    return t("admin.jobs.schedule.hourly");
  }

  return raw;
}
