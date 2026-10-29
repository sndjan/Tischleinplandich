// day_of_week in this app is Monday=0..Sunday=6; JS getDay() is Sunday=0..Saturday=6.
export const getDayIndex = (date: Date) => (date.getDay() + 6) % 7;

/** Local midnight of the Monday `offset` weeks from the week containing `now`. */
export function getWeekMonday(offset = 0, now = new Date()): Date {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - getDayIndex(monday) + offset * 7);
  return monday;
}

/**
 * The meal_plans.week_start_date of the week starting on `monday`. Plans have
 * always been stored under the Sunday before, written as the UTC date of local
 * midnight, so this keeps that format and existing plans keep their week.
 */
export function getWeekKey(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() - 1);
  return sunday.toISOString().split("T")[0];
}

/** Day of the month for Monday..Sunday. */
export function getWeekDates(monday: Date): number[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date.getDate();
  });
}

/** E.g. "26. Okt – 1. Nov". */
export function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const format = (date: Date) =>
    date.toLocaleDateString("de-DE", { day: "numeric", month: "short" }).replace(/\.$/, "");
  return `${format(monday)} – ${format(sunday)}`;
}

/** "Diese Woche", "Nächste Woche", … or the date range further away. */
export function getWeekLabel(offset: number, monday: Date): string {
  if (offset === 0) return "Diese Woche";
  if (offset === 1) return "Nächste Woche";
  if (offset === -1) return "Letzte Woche";
  return formatWeekRange(monday);
}
