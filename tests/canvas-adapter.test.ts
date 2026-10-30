import { describe, expect, it, vi } from "vitest";
import { CanvasAdapter, fitLongestEdge } from "../src/canvas-adapter";
import { TFile } from "obsidian";

function file(path: string): TFile {
  const result = new TFile();
  return Object.assign(result, {
    path,
    name: path.split("/").pop() ?? path,
    extension: path.split(".").pop() ?? "",
  });
}

describe("Canvas geometry", () => {
  it.each([
    [1600, 900, { width: 400, height: 225 }],
    [900, 1600, { width: 225, height: 400 }],
    [100, 100, { width: 400, height: 400 }],
    [0, 0, { width: 400, height: 400 }],
  ])("fits %sx%s", (width, height, expected) => {
    expect(fitLongestEdge(width, height, 400)).toEqual(expected);
  });

  it("places an image beside selection and a note beside the image", async () => {
    const createFileNode = vi.fn();
    const requestSave = vi.fn();
    const canvas = {
      readonly: false,
      selection: new Set([
        { getBBox: () => ({ minX: 10, minY: 20, maxX: 210, maxY: 220 }) },
        { getBBox: () => ({ minX: 240, minY: 80, maxX: 440, maxY: 280 }) },
      ]),
      createFileNode,
      requestSave,
      getViewportBBox: () => ({ minX: 0, minY: 0, maxX: 1000, maxY: 800 }),
    };
    const app = {
      workspace: {
        getActiveViewOfType: () => ({ getViewType: () => "canvas", canvas }),
      },
    };
    const adapter = new CanvasAdapter(app as never);
    const imageFile = file("Attachments/image.png") as never;
    const noteFile = file("Attachments/image.md") as never;

    await expect(
      adapter.insert(
        imageFile,
        { bytes: new ArrayBuffer(0), mimeType: "image/png", extension: "png", width: 1600, height: 900 },
        noteFile,
        true,
      ),
    ).resolves.toEqual({ inserted: true });

    expect(createFileNode).toHaveBeenNthCalledWith(1, {
      pos: { x: 480, y: 37.5 },
      size: { width: 400, height: 225 },
      file: imageFile,
    });
    expect(createFileNode).toHaveBeenNthCalledWith(2, {
      pos: { x: 920, y: 37.5 },
      size: { width: 320, height: 240 },
      file: noteFile,
    });
    expect(requestSave).toHaveBeenCalledOnce();
  });

  it("centers an image when there is no selection", async () => {
    const createFileNode = vi.fn();
    const canvas = {
      readonly: false,
      selection: new Set(),
      createFileNode,
      getViewportBBox: () => ({ minX: -500, minY: -300, maxX: 500, maxY: 300 }),
    };
    const app = { workspace: { getActiveViewOfType: () => ({ getViewType: () => "canvas", canvas }) } };
    const adapter = new CanvasAdapter(app as never);
    await adapter.insert(
      file("image.png") as never,
      { bytes: new ArrayBuffer(0), mimeType: "image/png", extension: "png", width: 100, height: 100 },
      null,
      false,
    );
    expect(createFileNode.mock.calls[0]?.[0].pos).toEqual({ x: -200, y: -200 });
  });

  it("centers an image on an external file's Canvas drop position", async () => {
    const createFileNode = vi.fn();
    const posFromClient = vi.fn(() => ({ x: 850, y: 420 }));
    const canvas = {
      readonly: false,
      selection: new Set([{ getBBox: () => ({ minX: 0, minY: 0, maxX: 100, maxY: 100 }) }]),
      createFileNode,
      posFromClient,
      getViewportBBox: () => ({ minX: 0, minY: 0, maxX: 1000, maxY: 800 }),
    };
    const app = { workspace: { getActiveViewOfType: () => ({ getViewType: () => "canvas", canvas }) } };
    const adapter = new CanvasAdapter(app as never);

    await adapter.insert(
      file("image.png") as never,
      { bytes: new ArrayBuffer(0), mimeType: "image/png", extension: "png", width: 1600, height: 900 },
      null,
      false,
      { clientX: 500, clientY: 300 },
    );

    expect(posFromClient).toHaveBeenCalledWith({ x: 500, y: 300 });
    expect(createFileNode.mock.calls[0]?.[0].pos).toEqual({ x: 650, y: 307.5 });
  });

  it("refuses read-only and incompatible canvases", async () => {
    const app = {
      workspace: {
        getActiveViewOfType: () => ({ getViewType: () => "canvas", canvas: { readonly: true } }),
      },
    };
    const adapter = new CanvasAdapter(app as never);
    expect(adapter.canInsert()).toBe(false);
    await expect(
      adapter.insert(
        file("image.png") as never,
        { bytes: new ArrayBuffer(0), mimeType: "image/png", extension: "png", width: 1, height: 1 },
        null,
        false,
      ),
    ).resolves.toMatchObject({ inserted: false, reason: expect.stringContaining("read-only") });
  });

  it("requests persistence when companion-note insertion throws after the image", async () => {
    const requestSave = vi.fn();
    const createFileNode = vi
      .fn()
      .mockReturnValueOnce(undefined)
      .mockImplementationOnce(() => {
        throw new Error("note insertion failed");
      });
    const canvas = {
      readonly: false,
      selection: new Set(),
      createFileNode,
      requestSave,
      getViewportBBox: () => ({ minX: 0, minY: 0, maxX: 800, maxY: 800 }),
    };
    const app = { workspace: { getActiveViewOfType: () => ({ getViewType: () => "canvas", canvas }) } };
    const adapter = new CanvasAdapter(app as never);
    await expect(
      adapter.insert(
        file("image.png") as never,
        { bytes: new ArrayBuffer(0), mimeType: "image/png", extension: "png", width: 100, height: 100 },
        file("image.md") as never,
        true,
      ),
    ).rejects.toThrow("note insertion failed");
    expect(requestSave).toHaveBeenCalledOnce();
  });
});
