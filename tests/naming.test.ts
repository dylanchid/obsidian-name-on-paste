import { describe, expect, it } from "vitest";
import {
  buildBaseName,
  getLocalDateParts,
  joinVaultPath,
  normalizeFolderPath,
  normalizeTags,
  renderNameTemplate,
  resolveUniqueBaseName,
  sanitizeDisplayName,
} from "../src/naming";

const DATE = new Date(2026, 8, 1, 14, 32);

describe("name templates", () => {
  it("renders the configured local date and time", () => {
    expect(getLocalDateParts(DATE)).toEqual({ date: "2026-09-01", time: "14.32" });
    expect(renderNameTemplate("Screenshot — {{date}} {{time}}", DATE)).toBe(
      "Screenshot — 2026-09-01 14.32",
    );
  });

  it("adds the date prefix exactly once with the default template", () => {
    expect(buildBaseName(renderNameTemplate("Screenshot — {{time}}", DATE), true, DATE)).toBe(
      "2026-09-01 Screenshot — 14.32",
    );
  });
});

describe("filename safety", () => {
  it.each([
    ["  Kyoto   alley  ", "Kyoto alley"],
    ["A/B:C*D?", "A-B-C-D"],
    ["Photo... ", "Photo"],
    ["CON", "_CON"],
    ["LPT9.txt", "_LPT9.txt"],
    ["image [draft]", "image -draft"],
  ])("sanitizes %s", (input, expected) => {
    expect(sanitizeDisplayName(input)).toBe(expected);
  });

  it.each(["", "   ", "---", "...", "!?*"])("rejects unusable name %j", (input) => {
    expect(() => sanitizeDisplayName(input)).toThrow(/letter or number/);
  });
});

describe("folders and tags", () => {
  it("normalizes ordinary vault folders", () => {
    expect(normalizeFolderPath("/Attachments\\Screenshots/")).toBe("Attachments/Screenshots");
    expect(normalizeFolderPath("/")).toBe("");
  });

  it.each(["../Secrets", "Attachments/../Secrets", ".obsidian/plugins"])(
    "rejects unsafe folder %s",
    (folder) => expect(() => normalizeFolderPath(folder)).toThrow(),
  );

  it("normalizes and de-duplicates comma-separated tags", () => {
    expect(normalizeTags(" #Travel, japan, travel, , #design/reference ")).toEqual([
      "Travel",
      "japan",
      "design/reference",
    ]);
  });
});

describe("collision handling", () => {
  it("checks both image and companion-note paths", () => {
    const occupied = new Set([
      "Attachments/Name.png",
      "Attachments/Name 2.md",
    ]);
    expect(resolveUniqueBaseName("Name", "Attachments", "png", (path) => occupied.has(path))).toBe(
      "Name 3",
    );
  });

  it("joins root and nested paths", () => {
    expect(joinVaultPath("", "image.png")).toBe("image.png");
    expect(joinVaultPath("Attachments", "image.png")).toBe("Attachments/image.png");
  });
});
