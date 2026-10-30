export class TFolder {
  constructor(public path = "") {}
}

export class TFile {
  name: string;
  extension: string;
  parent: TFolder | null;

  constructor(public path = "") {
    this.name = path.split("/").pop() ?? path;
    this.extension = this.name.split(".").pop() ?? "";
    const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    this.parent = new TFolder(folder);
  }
}

export class ItemView {
  getViewType(): string {
    return "empty";
  }
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/^\.\//, "");
}

export function stringifyYaml(value: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, entry] of Object.entries(value)) {
    if (Array.isArray(entry)) {
      lines.push(`${key}:`, ...entry.map((item) => `  - ${String(item)}`));
    } else {
      lines.push(`${key}: ${JSON.stringify(entry)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
