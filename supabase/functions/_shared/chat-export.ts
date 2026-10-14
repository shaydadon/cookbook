export interface ChatMessage { sender: string; sentAt: string; text: string }

const BIDI = /[‎‏‪-‮⁦-⁩]/g;
// [date, time(, AM/PM)] or date, time(, AM/PM) - ; then "sender: text" (sender optional = system line)
const HEADER_RE =
  /^\[?(\d{1,2})[./](\d{1,2})[./](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?\]?\s*(?:-\s*)?(.*)$/;
const SENDER_RE = /^([^:]{1,60}):\s?([\s\S]*)$/;

function tzOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem", hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return (asUtc - utcMs) / 60_000;
}

export function jerusalemToIso(y: number, mo: number, d: number, h: number, mi: number, s: number): string {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const offset = tzOffsetMinutes(guess - tzOffsetMinutes(guess) * 60_000);
  return new Date(guess - offset * 60_000).toISOString();
}

function parseHeader(line: string): { sentAt: string; rest: string } | null {
  const m = line.match(HEADER_RE);
  if (!m) return null;
  let [a, b, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ampm = m[7]?.toUpperCase();
  // Day-first (Israel) unless the second number can only be a day, or the export is US-style (AM/PM)
  let day = a, month = b;
  if (b > 12 || (ampm && a <= 12)) [day, month] = [b, a];
  if (month > 12 || day > 31) return null;
  if (year < 100) year += 2000;
  let hour = Number(m[4]);
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return { sentAt: jerusalemToIso(year, month, day, hour, Number(m[5]), Number(m[6] ?? 0)), rest: m[8] };
}

export function parseChatExport(content: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let current: ChatMessage | null = null;
  let inSystem = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(BIDI, "");
    const header = parseHeader(line);
    if (header) {
      const sm = header.rest.match(SENDER_RE);
      if (sm) {
        current = { sender: sm[1].trim(), sentAt: header.sentAt, text: sm[2] };
        messages.push(current);
        inSystem = false;
      } else {
        current = null;
        inSystem = true; // system line ("messages are end-to-end encrypted", "X added Y")
      }
    } else if (current && !inSystem) {
      current.text += `\n${line}`;
    }
  }
  return messages.map((m) => ({ ...m, text: m.text.trim() }));
}
