function dumpScalar(value: string): string {
  if (value === "") return '""';
  if (value.includes("\n")) {
    return `|\n${value
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n")}`;
  }
  if (/[:#{}[\],&*?|<>=!%@`'"]/.test(value) || /^\s|\s$/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}

export function toYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);

  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return dumpScalar(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return value
      .map((item) => {
        if (item !== null && typeof item === "object" && !Array.isArray(item)) {
          const body = toYaml(item, indent + 1);
          const lines = body.split("\n").filter(Boolean);
          const first = (lines[0] || "").trimStart();
          const rest = lines.slice(1).join("\n");
          return rest ? `${pad}- ${first}\n${rest}` : `${pad}- ${first}`;
        }
        return `${pad}- ${toYaml(item, 0)}`;
      })
      .join("\n");
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, v]) => v !== undefined,
  );
  if (entries.length === 0) return "{}";

  return entries
    .map(([key, val]) => {
      if (Array.isArray(val)) {
        if (val.length === 0) return `${pad}${key}: []`;
        return `${pad}${key}:\n${toYaml(val, indent + 1)}`;
      }
      if (val !== null && typeof val === "object") {
        const nested = toYaml(val, indent + 1);
        if (nested === "{}") return `${pad}${key}: {}`;
        return `${pad}${key}:\n${nested}`;
      }
      const scalar = toYaml(val, 0);
      if (typeof val === "string" && val.includes("\n")) {
        const inner = val
          .split("\n")
          .map((line) => `${pad}  ${line}`)
          .join("\n");
        return `${pad}${key}: |\n${inner}`;
      }
      return `${pad}${key}: ${scalar}`;
    })
    .join("\n");
}
