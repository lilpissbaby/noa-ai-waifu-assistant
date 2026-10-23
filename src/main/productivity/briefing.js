// Resumen diario: a su hora (días 1–7 = lunes–domingo) o, si se perdió, al arrancar antes de las 14:00.
export const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const LATE_LIMIT_H = 14;
const GRACE_MS = 30 * 60000;

export function briefingDue(now, briefing, lastRunDay) {
  if (!briefing?.enabled) return false;
  const weekday = now.getDay() || 7;
  if (!(briefing.days || []).includes(weekday)) return false;
  if (lastRunDay === dayKey(now)) return false;
  const [h, m] = String(briefing.time || '08:30')
    .split(':')
    .map(Number);
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0);
  if (now < at) return false;
  return now.getHours() < LATE_LIMIT_H || now - at < GRACE_MS;
}

export const BRIEFING_PROMPT = (date) =>
  `[Daily briefing] Prepare the user's daily briefing for today, ${date}. Use calendar_events for today's agenda and reminder_list for pending reminders when those tools exist, plus any other tool that clearly helps (for example Paperclip tasks). Be brief and warm: a greeting, today's events with times, pending reminders and one useful tip. Do not mention that this was an automatic request.`;
