import { parseNaturalDueDate } from "@/lib/natural-date";

function expectDateParts(
  actualDate: Date | null,
  expected: {
    year: number;
    month: number;
    day: number;
    hours: number;
    minutes: number;
  },
): void {
  expect(actualDate).not.toBeNull();
  const date = actualDate as Date;
  expect(date.getFullYear()).toBe(expected.year);
  expect(date.getMonth()).toBe(expected.month);
  expect(date.getDate()).toBe(expected.day);
  expect(date.getHours()).toBe(expected.hours);
  expect(date.getMinutes()).toBe(expected.minutes);
}

describe("parseNaturalDueDate", () => {
  it("returns null for empty and unknown text", () => {
    const referenceDate = new Date(2026, 0, 15, 10, 30, 0, 0);
    expect(parseNaturalDueDate("", referenceDate)).toBeNull();
    expect(parseNaturalDueDate("   ", referenceDate)).toBeNull();
    expect(parseNaturalDueDate("abc xyz", referenceDate)).toBeNull();
  });

  it("parses today/tomorrow with default and explicit times", () => {
    const referenceDate = new Date(2026, 0, 15, 10, 30, 0, 0);

    expectDateParts(parseNaturalDueDate("today", referenceDate), {
      year: 2026,
      month: 0,
      day: 15,
      hours: 9,
      minutes: 0,
    });
    expectDateParts(parseNaturalDueDate("today 5pm", referenceDate), {
      year: 2026,
      month: 0,
      day: 15,
      hours: 17,
      minutes: 0,
    });
    expectDateParts(parseNaturalDueDate("tomorrow at noon", referenceDate), {
      year: 2026,
      month: 0,
      day: 16,
      hours: 12,
      minutes: 0,
    });
    expectDateParts(parseNaturalDueDate("tomorrow", referenceDate), {
      year: 2026,
      month: 0,
      day: 16,
      hours: 9,
      minutes: 0,
    });
    expectDateParts(parseNaturalDueDate("tomorrow midnight", referenceDate), {
      year: 2026,
      month: 0,
      day: 16,
      hours: 0,
      minutes: 0,
    });
  });

  it("parses relative offsets for minutes, hours, days, and weeks", () => {
    const referenceDate = new Date(2026, 0, 15, 10, 30, 0, 0);

    expectDateParts(parseNaturalDueDate("in 90m", referenceDate), {
      year: 2026,
      month: 0,
      day: 15,
      hours: 12,
      minutes: 0,
    });
    expectDateParts(parseNaturalDueDate("in 2 hours", referenceDate), {
      year: 2026,
      month: 0,
      day: 15,
      hours: 12,
      minutes: 30,
    });
    expectDateParts(parseNaturalDueDate("in 3 days", referenceDate), {
      year: 2026,
      month: 0,
      day: 18,
      hours: 9,
      minutes: 0,
    });
    expectDateParts(parseNaturalDueDate("in 1 week at 2:15pm", referenceDate), {
      year: 2026,
      month: 0,
      day: 22,
      hours: 14,
      minutes: 15,
    });
  });

  it("rejects invalid relative expressions and invalid times", () => {
    const referenceDate = new Date(2026, 0, 15, 10, 30, 0, 0);
    expect(parseNaturalDueDate("in 2 hours at 1pm", referenceDate)).toBeNull();
    expect(parseNaturalDueDate("today 25:00", referenceDate)).toBeNull();
    expect(parseNaturalDueDate("today at ???", referenceDate)).toBeNull();
    expect(parseNaturalDueDate("today 0am", referenceDate)).toBeNull();
    expect(parseNaturalDueDate("tomorrow 8:88", referenceDate)).toBeNull();
    expect(parseNaturalDueDate("in 5m at 8am", referenceDate)).toBeNull();
    expect(
      parseNaturalDueDate("in 3 days at invalid", referenceDate),
    ).toBeNull();
    expect(parseNaturalDueDate("in 0 days", referenceDate)).toBeNull();
  });

  it("parses weekday and next weekday behavior", () => {
    const thursdayReferenceDate = new Date(2026, 0, 15, 10, 30, 0, 0);
    expectDateParts(parseNaturalDueDate("friday", thursdayReferenceDate), {
      year: 2026,
      month: 0,
      day: 16,
      hours: 9,
      minutes: 0,
    });

    const mondayReferenceDate = new Date(2026, 0, 19, 10, 0, 0, 0);
    expectDateParts(parseNaturalDueDate("monday", mondayReferenceDate), {
      year: 2026,
      month: 0,
      day: 26,
      hours: 9,
      minutes: 0,
    });
    expectDateParts(
      parseNaturalDueDate("next monday 11am", mondayReferenceDate),
      {
        year: 2026,
        month: 0,
        day: 26,
        hours: 11,
        minutes: 0,
      },
    );
    expectDateParts(parseNaturalDueDate("next monday", mondayReferenceDate), {
      year: 2026,
      month: 0,
      day: 26,
      hours: 9,
      minutes: 0,
    });
    expect(
      parseNaturalDueDate("next monday invalid", mondayReferenceDate),
    ).toBeNull();
    expect(
      parseNaturalDueDate("monday invalid", mondayReferenceDate),
    ).toBeNull();
  });

  it("parses ISO and slash date formats", () => {
    const referenceDate = new Date(2026, 0, 15, 10, 30, 0, 0);

    expectDateParts(parseNaturalDueDate("2026-03-01 14:30", referenceDate), {
      year: 2026,
      month: 2,
      day: 1,
      hours: 14,
      minutes: 30,
    });
    expectDateParts(parseNaturalDueDate("3/5/2026 at 8am", referenceDate), {
      year: 2026,
      month: 2,
      day: 5,
      hours: 8,
      minutes: 0,
    });
    expectDateParts(parseNaturalDueDate("2026-03-10", referenceDate), {
      year: 2026,
      month: 2,
      day: 10,
      hours: 9,
      minutes: 0,
    });
    expectDateParts(parseNaturalDueDate("3/7/2026", referenceDate), {
      year: 2026,
      month: 2,
      day: 7,
      hours: 9,
      minutes: 0,
    });
    expectDateParts(parseNaturalDueDate("today 12am", referenceDate), {
      year: 2026,
      month: 0,
      day: 15,
      hours: 0,
      minutes: 0,
    });
    expectDateParts(parseNaturalDueDate("today 12pm", referenceDate), {
      year: 2026,
      month: 0,
      day: 15,
      hours: 12,
      minutes: 0,
    });
    expect(
      parseNaturalDueDate("2026-03-10 at invalid", referenceDate),
    ).toBeNull();
    expect(
      parseNaturalDueDate("3/7/2026 at invalid", referenceDate),
    ).toBeNull();
    expect(parseNaturalDueDate("2026-02-31", referenceDate)).toBeNull();
    expect(parseNaturalDueDate("13/40/2026", referenceDate)).toBeNull();
  });
});
