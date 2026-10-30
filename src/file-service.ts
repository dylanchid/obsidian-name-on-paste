import { normalizePath, stringifyYaml, TFile, TFolder, type App } from "obsidian";
import {
  buildBaseName,
  getLocalDateParts,
  joinVaultPath,
  normalizeFolderPath,
  resolveUniqueBaseName,
  sanitizeDisplayName,
} from "./naming";
import type { SaveRequest, SaveResult } from "./types";

export class ImageFileService {
  constructor(private readonly app: App) {}

  previewPath(
    name: string,
    folderInput: string,
    extension: string,
    datePrefix: boolean,
    now = new Date(),
  ): string {
    const folder = normalizeFolderPath(folderInput);
    const desired = buildBaseName(name, datePrefix, now);
    const basename = resolveUniqueBaseName(desired, folder, extension, (path) =>
      Boolean(this.app.vault.getAbstractFileByPath(normalizePath(path))),
    );
    return joinVaultPath(folder, `${basename}.${extension}`);
  }

  async save(request: SaveRequest, datePrefix: boolean, now = new Date()): Promise<SaveResult> {
    const folder = normalizeFolderPath(request.folder);
    await this.ensureFolder(folder);

    const desired = buildBaseName(request.name, datePrefix, now);
    const basename = resolveUniqueBaseName(desired, folder, request.image.extension, (path) =>
      Boolean(this.app.vault.getAbstractFileByPath(normalizePath(path))),
    );
    const imagePath = normalizePath(joinVaultPath(folder, `${basename}.${request.image.extension}`));
    const notePath = normalizePath(joinVaultPath(folder, `${basename}.md`));

    const imageFile = await this.app.vault.createBinary(imagePath, request.image.bytes);
    let noteFile: TFile | null = null;

    try {
      if (request.createCompanionNote) {
        noteFile = await this.app.vault.create(
          notePath,
          this.buildCompanionNote(sanitizeDisplayName(request.name), imageFile.name, request.tags, now),
        );
      }
    } catch (error) {
      try {
        await this.app.vault.delete(imageFile, true);
      } catch (rollbackError) {
        console.error("[name-on-paste] failed to roll back image", imageFile.path, rollbackError);
      }
      throw error;
    }

    return { imageFile, noteFile, displayName: request.name };
  }

  async rename(saved: SaveResult, name: string, datePrefix: boolean, now = new Date()): Promise<SaveResult> {
    const folder = saved.imageFile.parent?.path ?? "";
    const desired = buildBaseName(name, datePrefix, now);
    const basename = resolveUniqueBaseName(desired, folder, saved.imageFile.extension, (path) => {
      const existing = this.app.vault.getAbstractFileByPath(normalizePath(path));
      return Boolean(existing && existing !== saved.imageFile && existing !== saved.noteFile);
    });
    const imagePath = normalizePath(joinVaultPath(folder, `${basename}.${saved.imageFile.extension}`));
    const notePath = normalizePath(joinVaultPath(folder, `${basename}.md`));
    const originalNotePath = saved.noteFile?.path;

    if (saved.noteFile && saved.noteFile.path !== notePath) {
      await this.app.fileManager.renameFile(saved.noteFile, notePath);
    }

    try {
      if (saved.imageFile.path !== imagePath) {
        await this.app.fileManager.renameFile(saved.imageFile, imagePath);
      }
    } catch (error) {
      if (saved.noteFile && originalNotePath && saved.noteFile.path !== originalNotePath) {
        try {
          await this.app.fileManager.renameFile(saved.noteFile, originalNotePath);
        } catch (rollbackError) {
          console.error("[name-on-paste] failed to roll back companion-note rename", rollbackError);
        }
      }
      throw error;
    }

    return { ...saved, displayName: sanitizeDisplayName(name) };
  }

  private async ensureFolder(folderPath: string): Promise<void> {
    if (!folderPath) return;
    const parts = folderPath.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(normalizePath(current));
      if (existing instanceof TFolder) continue;
      if (existing) throw new Error(`${current} is a file, not a folder.`);
      await this.app.vault.createFolder(normalizePath(current));
    }
  }

  private buildCompanionNote(
    heading: string,
    imageName: string,
    tags: string[],
    now: Date,
  ): string {
    const properties: Record<string, unknown> = {
      image: `[[${imageName}]]`,
      created: getLocalDateParts(now).date,
      source: "clipboard",
    };
    if (tags.length > 0) properties.tags = tags;
    const yaml = stringifyYaml(properties).trimEnd();
    return `---\n${yaml}\n---\n\n# ${heading}\n\n![[${imageName}]]\n`;
  }
}
