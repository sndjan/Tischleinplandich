/**
 * Minutes in a free-text prep time like "30 Min.", "1 Std. 15 Min.", "1,5 Stunden"
 * or "PT45M". Null when the text holds no recognisable time.
 */
export function parsePrepMinutes(prepTime: string | null | undefined): number | null {
  const text = (prepTime ?? "").trim().toLowerCase();
  if (!text) return null;

  // ISO 8601 durations from recipe sites, e.g. "PT1H20M".
  const iso = text.match(/^pt(?:(\d+)h)?(?:(\d+)m)?$/);
  if (iso && (iso[1] || iso[2])) {
    return Number(iso[1] ?? 0) * 60 + Number(iso[2] ?? 0);
  }

  // "15 Min. Zubereitung (35 Min. gesamt)": a stated total wins over the parts.
  const total =
    text.match(/(\d[^,;()]*?)\s*(?:insgesamt|gesamt|total)/) ??
    text.match(/(?:insgesamt|gesamt|total)\s*:?\s*([^,;()]+)/);
  if (total && total[1] !== text) {
    const totalMinutes = parsePrepMinutes(total[1]);
    if (totalMinutes !== null) return totalMinutes;
  }

  let minutes = 0;
  let found = false;

  // Ranges like "20–25 Min." count with their upper end.
  const pattern =
    /(\d+(?:[.,]\d+)?)\s*(?:(?:-|–|bis)\s*(\d+(?:[.,]\d+)?)\s*)?(std|stunde|h\b|hour|min|m\b)/g;

  for (const match of text.matchAll(pattern)) {
    const value = Number.parseFloat((match[2] ?? match[1]).replace(",", "."));
    if (!Number.isFinite(value)) continue;
    found = true;
    minutes += /^(std|stunde|h|hour)/.test(match[3]) ? value * 60 : value;
  }

  if (found) return Math.round(minutes);

  // A bare number is almost always minutes.
  const bare = text.match(/^(\d+)$/);
  return bare ? Number(bare[1]) : null;
}

export const formatPrepMinutes = (minutes: number) =>
  minutes < 60
    ? `${minutes} Min.`
    : minutes % 60 === 0
      ? `${minutes / 60} Std.`
      : `${Math.floor(minutes / 60)} Std. ${minutes % 60} Min.`;
