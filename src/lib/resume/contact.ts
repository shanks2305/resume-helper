export type ContactKind = "email" | "phone" | "location" | "url" | "other";

export type ContactItem = {
  kind: ContactKind;
  value: string;
  label: string;
};

/** Font Awesome / icon-font names that leak into PDF/DOCX text extraction. */
const ICON_TOKEN =
  /\b(?:fa(?:-|\s)?)?(?:envelope(?:-o|-open|-square)?|mail-(?:bulk|square|reply)|at-(?:sign|badge)|phone(?:-(?:alt|volume|flip|square|office|slash))?|mobile(?:-(?:alt|screen(?:-button)?|phone))?|telephone|cell(?:phone)?|smartphone|call|fax|map-(?:marker(?:-alt)?|pin(?:-alt)?|location(?:-dot|-pin)?|signs|marked|location-dot)|location-(?:arrow|crosshairs|dot|pin)|home(?:-city)?|address-(?:book|card|city)|linkedin-in|github(?:-square|-alt)?|twitter|globe(?:-(?:americas|asia|europe|e|-alt))?|external-link(?:-alt)?|user(?:-(?:circle|alt|tie|large|secret|tag|group|gear|shield))?|person(?:-(?:circle|bust|dress|badge|seat|walking|hiking|digging|shelter))?|calendar(?:-(?:alt|check|days|day|plus|minus|times))?|briefcase(?:-(?:medical|blank)?)?|building(?:-(?:columns|user|circle|shield))?|contact-(?:book|book-alt)|globe-alt|whatsapp|skype)\b|\b(?:envelope|phone|mobile|telephone|map-marker|map-pin|marker|pin|linkedin|github|globe|location|icon)\b/gi;

const PROTECT_EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PROTECT_URL =
  /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/[^\s|,)]+|github\.com\/[^\s|,)]+|[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s|,)]*)?)/gi;
const PROTECT_PHONE =
  /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?:\s*(?:x|ext\.?)\s*\d+)?/g;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
/** US-style phone — exactly 10 digits when non-digits are stripped. */
const PHONE_RE =
  /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?:\s*(?:x|ext\.?)\s*\d+)?/i;
const URL_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/[^\s|,)]+|github\.com\/[^\s|,)]+|[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s|,)]*)?)/i;

function phoneDigits(value: string): number {
  return value.replace(/\D/g, "").replace(/^1/, "").length;
}

function findPhone(text: string): string | null {
  const match = text.match(PHONE_RE);
  if (!match || phoneDigits(match[0]) < 10) return null;
  return match[0];
}

const LABELS: Record<ContactKind, string> = {
  email: "Email",
  phone: "Ph",
  location: "Loc",
  url: "Web",
  other: "",
};

function protectValues(text: string): { text: string; slots: string[] } {
  const slots: string[] = [];
  const slotize = (re: RegExp, input: string) =>
    input.replace(re, (match) => {
      const key = `\x00${slots.length}\x00`;
      slots.push(match);
      return key;
    });

  let out = text;
  out = slotize(PROTECT_EMAIL, out);
  out = slotize(PROTECT_URL, out);
  out = slotize(PROTECT_PHONE, out);
  return { text: out, slots };
}

function restoreValues(text: string, slots: string[]): string {
  let out = text;
  slots.forEach((value, i) => {
    out = out.replace(`\x00${i}\x00`, value);
  });
  return out;
}

/** Strip icon-font artifact words and private-use glyphs from extracted text. */
export function stripIconTokens(text: string): string {
  const { text: protectedText, slots } = protectValues(text);
  const cleaned = protectedText
    .replace(/[\uE000-\uF8FF]/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(ICON_TOKEN, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*([|·,])\s*/g, " $1 ")
    .trim();
  return restoreValues(cleaned, slots)
    .replace(/\s+,/g, ",")
    .replace(/,\s+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function urlLabel(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes("linkedin.com")) return "LinkedIn";
  if (lower.includes("github.com")) return "GitHub";
  if (lower.includes("twitter.com") || lower.includes("x.com")) return "X";
  return "Web";
}

function classifyValue(value: string): ContactItem {
  const cleaned = stripIconTokens(value).trim();
  const email = cleaned.match(EMAIL_RE);
  if (email) {
    return { kind: "email", value: email[0], label: LABELS.email };
  }

  const phone = findPhone(cleaned);
  if (phone) {
    return { kind: "phone", value: phone.trim(), label: LABELS.phone };
  }

  const url = cleaned.match(URL_RE);
  if (
    url &&
    (url[0].includes("/") ||
      url[0].includes("linkedin") ||
      url[0].includes("github"))
  ) {
    const val = url[0].replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    return { kind: "url", value: val, label: urlLabel(val) };
  }

  // City, ST or City, Country style
  if (
    /^[A-Za-z .'-]+,\s*[A-Za-z .'-]+(?:\s+\d{5})?$/.test(cleaned) ||
    /\b[A-Z]{2}\s+\d{5}\b/.test(cleaned)
  ) {
    return { kind: "location", value: cleaned, label: LABELS.location };
  }

  return { kind: "other", value: cleaned, label: "" };
}

function dedupeItems(items: ContactItem[]): ContactItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}:${item.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return item.value.length > 0;
  });
}

/** Parse one or more contact lines into labeled items. */
export function parseContactLines(lines: string[]): ContactItem[] {
  const items: ContactItem[] = [];

  for (const rawLine of lines) {
    const line = stripIconTokens(rawLine);
    if (!line) continue;

    const parts = line.split(/\s*[|·]\s*|\s*,\s*(?=[^,]+@)|\s{2,}/);
    const chunks = parts.length > 1 ? parts : [line];

    for (const chunk of chunks) {
      const trimmed = stripIconTokens(chunk);
      if (!trimmed) continue;

      // Pull multiple typed values from one chunk (e.g. "email@x.com phone 555")
      let rest = trimmed;
      let foundAny = false;

      for (let i = 0; i < 6; i++) {
        const email = rest.match(EMAIL_RE);
        if (email) {
          items.push({
            kind: "email",
            value: email[0],
            label: LABELS.email,
          });
          rest = rest.replace(email[0], " ").trim();
          foundAny = true;
          continue;
        }

        const phone = findPhone(rest);
        if (phone) {
          items.push({
            kind: "phone",
            value: phone.trim(),
            label: LABELS.phone,
          });
          rest = rest.replace(phone, " ").trim();
          foundAny = true;
          continue;
        }

        const url = rest.match(URL_RE);
        if (
          url &&
          (url[0].includes("/") ||
            /linkedin|github/i.test(url[0]))
        ) {
          const val = url[0]
            .replace(/^https?:\/\//i, "")
            .replace(/^www\./i, "");
          items.push({
            kind: "url",
            value: val,
            label: urlLabel(val),
          });
          rest = rest.replace(url[0], " ").trim();
          foundAny = true;
          continue;
        }
        break;
      }

      rest = stripIconTokens(rest);
      if (rest) {
        const trailingPhone = findPhone(rest);
        if (trailingPhone) {
          items.push({
            kind: "phone",
            value: trailingPhone.trim(),
            label: LABELS.phone,
          });
          rest = stripIconTokens(rest.replace(trailingPhone, ""));
        }
        if (rest && rest.length > 2) {
          items.push(classifyValue(rest));
        }
      }
    }
  }

  return dedupeItems(items);
}

export function formatContactPlain(items: ContactItem[]): string {
  return items
    .map((item) =>
      item.label ? `${item.label}: ${item.value}` : item.value,
    )
    .join(" · ");
}

export function sanitizeResumeText(raw: string): string {
  return raw
    .split("\n")
    .map((line) => stripIconTokens(line))
    .join("\n");
}
