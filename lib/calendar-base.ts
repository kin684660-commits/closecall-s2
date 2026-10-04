// NYSE published schedule, verified 2026-10-03. Outside supported years, never claim an open session.
export const calendarSource = "https://www.nyse.com/trade/hours-calendars";
const holidays: Record<number, string[]> = {
  2026: [
    "01-01",
    "01-19",
    "02-16",
    "04-03",
    "05-25",
    "06-19",
    "07-03",
    "09-07",
    "11-26",
    "12-25",
  ],
  2027: [
    "01-01",
    "01-18",
    "02-15",
    "03-26",
    "05-31",
    "06-18",
    "07-05",
    "09-06",
    "11-25",
    "12-24",
  ],
  2028: [
    "01-17",
    "02-21",
    "04-14",
    "05-29",
    "06-19",
    "07-04",
    "09-04",
    "11-23",
    "12-25",
  ],
};
const early: Record<string, number> = {
  "2026-11-27": 780,
  "2026-12-24": 780,
  "2027-11-26": 780,
  "2028-07-03": 780,
  "2028-11-24": 780,
};
export function equitySession(at = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  if (["Sat", "Sun"].includes(p.weekday)) return "weekend";
  const year = Number(p.year);
  if (!holidays[year]) return "calendar-unverified";
  const md = `${p.month}-${p.day}`;
  if (holidays[year].includes(md)) return "holiday";
  const mins = Number(p.hour) * 60 + Number(p.minute);
  const close = early[`${p.year}-${md}`] || 960;
  return mins >= 570 && mins < close
    ? "regular-hours"
    : "outside-regular-hours";
}
