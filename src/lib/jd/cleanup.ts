/** Strip LinkedIn / ATS / company boilerplate from pasted job descriptions. */
const BLOCK_PATTERNS: RegExp[] = [
  /^about (the )?company[:\s].*/gim,
  /^who we are[:\s].*/gim,
  /^our (mission|culture|values|benefits)[:\s].*/gim,
  /^benefits(?:\s+and\s+perks)?[:\s].*/gim,
  /^what we offer[:\s].*/gim,
  /^equal opportunity[\s\S]*$/gim,
  /^eeo[\s\S]*$/gim,
  /we are an equal opportunity employer[\s\S]*$/gim,
  /applicants will receive consideration[\s\S]*$/gim,
  /reasonable accommodation[\s\S]*$/gim,
  /^privacy (notice|policy)[\s\S]*$/gim,
  /linkedin\.com\/jobs\/view\/\S+/gi,
  /^\s*job (id|ref|reference)[:#]?\s*\S+\s*$/gim,
  /^\s*posted\s+(on\s+)?\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s*$/gim,
  /^\s*\d+\s+(applicant|click|view)s?\s*$/gim,
  /^\s*(easy apply|actively recruiting|promoted)\s*$/gim,
];

const SECTION_CUTOFF =
  /\n(?:benefits|perks|equal opportunity|eeo statement|about us|company overview|life at)\b[\s\S]*$/i;

export function cleanJobDescription(raw: string): {
  cleaned: string;
  removedBoilerplate: boolean;
} {
  let text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return { cleaned: "", removedBoilerplate: false };

  const before = text;
  for (const pattern of BLOCK_PATTERNS) {
    text = text.replace(pattern, "\n");
  }

  const cutoff = text.match(SECTION_CUTOFF);
  if (cutoff && cutoff.index && cutoff.index > text.length * 0.35) {
    text = text.slice(0, cutoff.index).trim();
  }

  text = text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return {
    cleaned: text || before,
    removedBoilerplate: text.length < before.length * 0.95,
  };
}
