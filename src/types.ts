import type { TFile } from "obsidian";

export type PasteBehavior = "always-ask" | "ask-in-canvas" | "paste-immediately";

export interface NameOnPasteSettings {
  defaultImageFolder: string;
  pasteBehavior: PasteBehavior;
  rememberLastFolder: boolean;
  lastFolder: string;
  recentFolders: string[];
  datePrefix: boolean;
  defaultNameTemplate: string;
  createCompanionNote: boolean;
  createNoteWhenTagsEntered: boolean;
  addCompanionNoteToCanvas: boolean;
  nativePasteInterception: boolean;
}

export interface ClipboardImage {
  bytes: ArrayBuffer;
  mimeType: string;
  extension: string;
  width: number;
  height: number;
}

export interface PasteDetails {
  name: string;
  folder: string;
  tags: string[];
}

export interface SaveRequest extends PasteDetails {
  image: ClipboardImage;
  createCompanionNote: boolean;
}

export interface SaveResult {
  imageFile: TFile;
  noteFile: TFile | null;
  displayName: string;
}

export interface CanvasInsertionResult {
  inserted: boolean;
  reason?: string;
}

export interface CanvasDropPlacement {
  clientX: number;
  clientY: number;
}
