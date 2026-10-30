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
  `[Daily briefing] Prepare the user's daily briefing for today, ${date}. Use the tools that exist among these: calendar_events for today's agenda, task_list with filter "today" for due and overdue tasks, reminder_list for pending reminders, weather for today's weather in their city, news_read for two or three headlines, monitor_status for services that are down, and any other tool that clearly helps (for example Paperclip tasks or GitHub notifications). Be brief and warm: a greeting, the weather in one line, today's events with times, the tasks and reminders that matter today and one useful tip. Skip what has nothing to report. Do not mention that this was an automatic request.`;
