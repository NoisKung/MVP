const DEFAULT_HOUR = 9;

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

interface ParsedTime {
  hours: number;
  minutes: number;
}

interface ParsedOptionalTime {
  parsedTime: ParsedTime | null;
  hasInvalidTime: boolean;
}

function atStartOfDay(referenceDate: Date): Date {
  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    0,
    0,
    0,
    0,
  );
}

function withTime(referenceDate: Date, time: ParsedTime): Date {
  const nextDate = new Date(referenceDate);
  nextDate.setHours(time.hours, time.minutes, 0, 0);
  return nextDate;
}

function parseTimeExpression(value: string | undefined): ParsedTime | null {
  /* c8 ignore start -- defensive guard for direct internal misuse */
  if (!value) return null;
  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) return null;
  /* c8 ignore stop */

  if (normalizedValue === "noon") {
    return { hours: 12, minutes: 0 };
  }

  if (normalizedValue === "midnight") {
    return { hours: 0, minutes: 0 };
  }

  const match = normalizedValue.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  const period = match[3];

  if (Number.isNaN(hours) || Number.isNaN(minutes) || minutes > 59) {
    return null;
  }

  if (period) {
    if (hours < 1 || hours > 12) return null;
    const normalizedHours =
      period === "am"
        ? hours === 12
          ? 0
          : hours
        : hours === 12
          ? 12
          : hours + 12;
    return { hours: normalizedHours, minutes };
  }

  if (hours > 23) return null;
  return { hours, minutes };
}

function parseOptionalTimeExpression(
  value: string | undefined,
): ParsedOptionalTime {
  if (!value) {
    return { parsedTime: null, hasInvalidTime: false };
  }

  const parsedTime = parseTimeExpression(value);
  if (!parsedTime) {
    return { parsedTime: null, hasInvalidTime: true };
  }

  return { parsedTime, hasInvalidTime: false };
}

function getUpcomingWeekdayDate(
  referenceDate: Date,
  weekday: number,
  forceNextWeek: boolean,
): Date {
  const dayStart = atStartOfDay(referenceDate);
  const delta = (weekday - dayStart.getDay() + 7) % 7;
  const dayOffset = forceNextWeek && delta === 0 ? 7 : delta;

  const nextDate = new Date(dayStart);
  nextDate.setDate(nextDate.getDate() + dayOffset);
  return nextDate;
}

function parseRelativeOffset(input: string, referenceDate: Date): Date | null {
  const match = input.match(
    /^in\s+(\d+)\s*(minutes?|mins?|min|m|hours?|hrs?|hr|h|days?|d|weeks?|w)(?:\s+at\s+(.+)|\s+(.+))?$/,
  );
  if (!match) return null;

  const amount = Number(match[1]);
  if (Number.isNaN(amount) || amount <= 0) return null;

  const unit = match[2];
  const timeExpression = match[3] ?? match[4];
  const { parsedTime, hasInvalidTime } =
    parseOptionalTimeExpression(timeExpression);
  if (hasInvalidTime) return null;

  const nextDate = new Date(referenceDate);
  if (
    unit === "minute" ||
    unit === "minutes" ||
    unit === "mins" ||
    unit === "min" ||
    unit === "m"
  ) {
    if (timeExpression) return null;
    nextDate.setMinutes(nextDate.getMinutes() + amount);
    return nextDate;
  }

  if (
    unit === "hour" ||
    unit === "hours" ||
    unit === "hr" ||
    unit === "hrs" ||
    unit === "h"
  ) {
    if (timeExpression) return null;
    nextDate.setHours(nextDate.getHours() + amount);
    return nextDate;
  }

  const dayOffset =
    unit === "week" || unit === "weeks" || unit === "w" ? amount * 7 : amount;
  nextDate.setDate(nextDate.getDate() + dayOffset);

  return withTime(nextDate, parsedTime ?? { hours: DEFAULT_HOUR, minutes: 0 });
}

function parseIsoDate(
  input: string,
): { date: Date; time: ParsedTime | null } | null {
  const match = input.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+at\s+(.+)|\s+(.+))?$/,
  );
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const { parsedTime, hasInvalidTime } = parseOptionalTimeExpression(
    match[4] ?? match[5],
  );
  if (hasInvalidTime) return null;

  const nextDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    nextDate.getFullYear() !== year ||
    nextDate.getMonth() !== month - 1 ||
    nextDate.getDate() !== day
  ) {
    return null;
  }

  return { date: nextDate, time: parsedTime };
}

function parseSlashDate(
  input: string,
): { date: Date; time: ParsedTime | null } | null {
  const match = input.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+at\s+(.+)|\s+(.+))?$/,
  );
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const { parsedTime, hasInvalidTime } = parseOptionalTimeExpression(
    match[4] ?? match[5],
  );
  if (hasInvalidTime) return null;

  const nextDate = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    nextDate.getFullYear() !== year ||
    nextDate.getMonth() !== month - 1 ||
    nextDate.getDate() !== day
  ) {
    return null;
  }

  return { date: nextDate, time: parsedTime };
}

/** Parse human-friendly due text like "tomorrow 9am" into a Date. */
export function parseNaturalDueDate(
  input: string,
  referenceDate = new Date(),
): Date | null {
  const normalizedInput = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalizedInput) return null;

  const relativeDate = parseRelativeOffset(normalizedInput, referenceDate);
  if (relativeDate) return relativeDate;

  const todayMatch = normalizedInput.match(/^today(?:\s+at\s+(.+)|\s+(.+))?$/);
  if (todayMatch) {
    const { parsedTime, hasInvalidTime } = parseOptionalTimeExpression(
      todayMatch[1] ?? todayMatch[2],
    );
    if (hasInvalidTime) return null;
    return withTime(
      atStartOfDay(referenceDate),
      parsedTime ?? { hours: DEFAULT_HOUR, minutes: 0 },
    );
  }

  const tomorrowMatch = normalizedInput.match(
    /^tomorrow(?:\s+at\s+(.+)|\s+(.+))?$/,
  );
  if (tomorrowMatch) {
    const { parsedTime, hasInvalidTime } = parseOptionalTimeExpression(
      tomorrowMatch[1] ?? tomorrowMatch[2],
    );
    if (hasInvalidTime) return null;
    const tomorrow = atStartOfDay(referenceDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return withTime(
      tomorrow,
      parsedTime ?? { hours: DEFAULT_HOUR, minutes: 0 },
    );
  }

  const nextWeekdayMatch = normalizedInput.match(
    /^next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s+at\s+(.+)|\s+(.+))?$/,
  );
  if (nextWeekdayMatch) {
    const weekday = WEEKDAY_INDEX[nextWeekdayMatch[1]];
    const { parsedTime, hasInvalidTime } = parseOptionalTimeExpression(
      nextWeekdayMatch[2] ?? nextWeekdayMatch[3],
    );
    if (hasInvalidTime) return null;
    const nextDate = getUpcomingWeekdayDate(referenceDate, weekday, true);
    return withTime(
      nextDate,
      parsedTime ?? { hours: DEFAULT_HOUR, minutes: 0 },
    );
  }

  const weekdayMatch = normalizedInput.match(
    /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s+at\s+(.+)|\s+(.+))?$/,
  );
  if (weekdayMatch) {
    const weekday = WEEKDAY_INDEX[weekdayMatch[1]];
    const { parsedTime, hasInvalidTime } = parseOptionalTimeExpression(
      weekdayMatch[2] ?? weekdayMatch[3],
    );
    if (hasInvalidTime) return null;
    const nextDate = getUpcomingWeekdayDate(referenceDate, weekday, false);
    const withResolvedTime = withTime(
      nextDate,
      parsedTime ?? { hours: DEFAULT_HOUR, minutes: 0 },
    );

    if (withResolvedTime.getTime() <= referenceDate.getTime()) {
      withResolvedTime.setDate(withResolvedTime.getDate() + 7);
    }
    return withResolvedTime;
  }

  const isoDate = parseIsoDate(normalizedInput);
  if (isoDate) {
    return withTime(
      isoDate.date,
      isoDate.time ?? { hours: DEFAULT_HOUR, minutes: 0 },
    );
  }

  const slashDate = parseSlashDate(normalizedInput);
  if (slashDate) {
    return withTime(
      slashDate.date,
      slashDate.time ?? { hours: DEFAULT_HOUR, minutes: 0 },
    );
  }

  return null;
}
