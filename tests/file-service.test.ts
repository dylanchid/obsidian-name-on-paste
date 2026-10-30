import { describe, expect, it, vi } from "vitest";
import { TFile, TFolder } from "obsidian";
import { ImageFileService } from "../src/file-service";

function folder(path: string): TFolder {
  return Object.assign(new TFolder(), { path });
}

function file(path: string): TFile {
  const parentPath = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  return Object.assign(new TFile(), {
    path,
    name: path.split("/").pop() ?? path,
    extension: path.split(".").pop() ?? "",
    parent: folder(parentPath),
  });
}

function createVault() {
  const files = new Map<string, TFile | TFolder>();
  const createFolder = vi.fn(async (path: string) => {
    const createdFolder = folder(path);
    files.set(path, createdFolder);
    return createdFolder;
  });
  const createBinary = vi.fn(async (path: string) => {
    const createdFile = file(path);
    files.set(path, createdFile);
    return createdFile;
  });
  const create = vi.fn(async (path: string, content: string) => {
    void content;
    const createdFile = file(path);
    files.set(path, createdFile);
    return createdFile;
  });
  const deleteFile = vi.fn(async (file: TFile) => files.delete(file.path));
  const renameFile = vi.fn(async (target: TFile, newPath: string) => {
    files.delete(target.path);
    Object.assign(target, {
      path: newPath,
      name: newPath.split("/").pop() ?? newPath,
      extension: newPath.split(".").pop() ?? "",
      parent: folder(newPath.includes("/") ? newPath.slice(0, newPath.lastIndexOf("/")) : ""),
    });
    files.set(newPath, target);
  });
  return {
    files,
    vault: {
      getAbstractFileByPath: (path: string) => files.get(path) ?? null,
      createFolder,
      createBinary,
      create,
      delete: deleteFile,
    },
    createFolder,
    createBinary,
    create,
    deleteFile,
    renameFile,
  };
}

describe("ImageFileService", () => {
  const date = new Date(2026, 8, 1, 14, 32);
  const image = {
    bytes: new ArrayBuffer(3),
    mimeType: "image/png",
    extension: "png",
    width: 100,
    height: 50,
  };

  it("creates nested folders, image, and searchable companion note", async () => {
    const fake = createVault();
    const service = new ImageFileService({ vault: fake.vault } as never);
    const result = await service.save(
      {
        name: "Kyoto alley",
        folder: "Attachments/Screenshots",
        tags: ["travel", "japan"],
        image,
        createCompanionNote: true,
      },
      true,
      date,
    );

    expect(fake.createFolder).toHaveBeenNthCalledWith(1, "Attachments");
    expect(fake.createFolder).toHaveBeenNthCalledWith(2, "Attachments/Screenshots");
    expect(result.imageFile.path).toBe("Attachments/Screenshots/2026-09-01 Kyoto alley.png");
    expect(result.noteFile?.path).toBe("Attachments/Screenshots/2026-09-01 Kyoto alley.md");
    const note = fake.create.mock.calls[0]?.[1] as string;
    expect(note).toContain("tags:\n  - travel\n  - japan");
    expect(note).toContain('image: "[[2026-09-01 Kyoto alley.png]]"');
    expect(note).toContain("# Kyoto alley\n");
    expect(note).not.toContain("# 2026-09-01 Kyoto alley");
    expect(note).toContain("![[2026-09-01 Kyoto alley.png]]");
  });

  it("uses a shared suffix when a same-name note already exists", async () => {
    const fake = createVault();
    fake.files.set("Attachments/Name.md", file("Attachments/Name.md"));
    fake.files.set("Attachments", folder("Attachments"));
    const service = new ImageFileService({ vault: fake.vault } as never);
    const result = await service.save(
      { name: "Name", folder: "Attachments", tags: [], image, createCompanionNote: false },
      false,
      date,
    );
    expect(result.imageFile.path).toBe("Attachments/Name 2.png");
  });

  it("rolls back a new image if companion-note creation fails", async () => {
    const fake = createVault();
    fake.files.set("Attachments", folder("Attachments"));
    fake.create.mockRejectedValueOnce(new Error("note failed"));
    const service = new ImageFileService({ vault: fake.vault } as never);
    await expect(
      service.save(
        { name: "Name", folder: "Attachments", tags: [], image, createCompanionNote: true },
        false,
        date,
      ),
    ).rejects.toThrow("note failed");
    expect(fake.deleteFile).toHaveBeenCalledOnce();
    expect(fake.files.has("Attachments/Name.png")).toBe(false);
  });

  it("renames an inserted image and companion note to a shared unique basename", async () => {
    const fake = createVault();
    const imageFile = file("Attachments/2026-09-01 Screenshot.png");
    const noteFile = file("Attachments/2026-09-01 Screenshot.md");
    fake.files.set(imageFile.path, imageFile);
    fake.files.set(noteFile.path, noteFile);
    fake.files.set("Attachments/2026-09-01 Kyoto alley.png", file("Attachments/2026-09-01 Kyoto alley.png"));
    const service = new ImageFileService({
      vault: fake.vault,
      fileManager: { renameFile: fake.renameFile },
    } as never);

    const result = await service.rename(
      { imageFile, noteFile, displayName: "Screenshot" },
      "Kyoto alley",
      true,
      date,
    );

    expect(fake.renameFile).toHaveBeenNthCalledWith(1, noteFile, "Attachments/2026-09-01 Kyoto alley 2.md");
    expect(fake.renameFile).toHaveBeenNthCalledWith(2, imageFile, "Attachments/2026-09-01 Kyoto alley 2.png");
    expect(result.imageFile.path).toBe("Attachments/2026-09-01 Kyoto alley 2.png");
    expect(result.noteFile?.path).toBe("Attachments/2026-09-01 Kyoto alley 2.md");
    expect(result.displayName).toBe("Kyoto alley");
  });
});
