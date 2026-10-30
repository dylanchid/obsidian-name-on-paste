export const DEFAULT_NAME_TEMPLATE = "Screenshot — {{time}}";

const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
// eslint-disable-next-line no-control-regex
const FORBIDDEN_FILENAME_CHARACTERS = new RegExp('[<>:"/\\\\|?*\\u0000-\\u001f\\[\\]]', "g");

export interface DateParts {
  date: string;
  time: string;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function getLocalDateParts(date = new Date()): DateParts {
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}.${pad(date.getMinutes())}`,
  };
}

export function renderNameTemplate(template: string, date = new Date()): string {
  const parts = getLocalDateParts(date);
  return template.replaceAll("{{date}}", parts.date).replaceAll("{{time}}", parts.time);
}

export function sanitizeDisplayName(input: string): string {
  let name = input
    .trim()
    .replace(FORBIDDEN_FILENAME_CHARACTERS, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/[-. ]+$/g, "")
    .trim();

  if (!/[\p{L}\p{N}]/u.test(name)) {
    throw new Error("Enter a name containing at least one letter or number.");
  }

  if (WINDOWS_RESERVED_NAMES.test(name)) {
    name = `_${name}`;
  }

  return name;
}

export function normalizeTags(raw: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const value of raw.split(",")) {
    const tag = value.trim().replace(/^#/, "").trim();
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }

  return tags;
}

export function normalizeFolderPath(input: string): string {
  const normalized = input.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Choose a folder inside the vault.");
  }
  if (segments[0]?.toLocaleLowerCase() === ".obsidian") {
    throw new Error("Choose a visible vault folder, not .obsidian.");
  }
  return segments.join("/");
}

export function buildBaseName(displayName: string, datePrefix: boolean, date = new Date()): string {
  const safeName = sanitizeDisplayName(displayName);
  return datePrefix ? `${getLocalDateParts(date).date} ${safeName}` : safeName;
}

export function joinVaultPath(folder: string, filename: string): string {
  return folder ? `${folder}/${filename}` : filename;
}

export function resolveUniqueBaseName(
  desiredBaseName: string,
  folder: string,
  extension: string,
  exists: (path: string) => boolean,
): string {
  let suffix = 1;
  let candidate = desiredBaseName;
  while (
    exists(joinVaultPath(folder, `${candidate}.${extension}`)) ||
    exists(joinVaultPath(folder, `${candidate}.md`))
  ) {
    suffix += 1;
    candidate = `${desiredBaseName} ${suffix}`;
  }
  return candidate;
}
