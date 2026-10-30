import { describe, expect, it, vi } from "vitest";
import { findDroppedImage, hasDroppedImage, isSupportedImageFile } from "../src/clipboard";

function dragEvent(files: Array<Pick<File, "name" | "type">>, itemTypes: string[] = []): DragEvent {
  return {
    dataTransfer: {
      files,
      items: itemTypes.map((type) => ({ kind: "file", type, getAsFile: vi.fn(() => null) })),
    },
  } as unknown as DragEvent;
}

describe("external image drops", () => {
  it.each([
    ["Screenshot.png", "image/png", true],
    ["Screenshot.webp", "image/webp", true],
    ["Screenshot.jpeg", "image/jpeg", true],
    ["Screenshot.gif", "image/gif", true],
    ["Screenshot.PNG", "", true],
    ["document.pdf", "application/pdf", false],
    ["vector.svg", "image/svg+xml", false],
  ])("classifies %s (%s)", (name, type, expected) => {
    expect(isSupportedImageFile({ name, type })).toBe(expected);
  });

  it("detects an image during dragover from its data-transfer item", () => {
    expect(hasDroppedImage(dragEvent([], ["image/png"]))).toBe(true);
  });

  it("returns the first supported raster image from a file drop", () => {
    const image = { name: "Screenshot.png", type: "image/png" } as File;
    const event = dragEvent([
      { name: "notes.txt", type: "text/plain" },
      image,
      { name: "second.jpg", type: "image/jpeg" },
    ]);
    expect(findDroppedImage(event)).toBe(image);
  });

  it("ignores a drag without an external image file", () => {
    const event = dragEvent([{ name: "note.md", type: "text/markdown" }]);
    expect(hasDroppedImage(event)).toBe(false);
    expect(findDroppedImage(event)).toBeNull();
  });
});
