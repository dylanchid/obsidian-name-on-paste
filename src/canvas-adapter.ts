import { ItemView, TFile, type App } from "obsidian";
import type { CanvasDropPlacement, CanvasInsertionResult, ClipboardImage } from "./types";

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface CanvasElementLike {
  getBBox?: () => BBox;
}

interface CanvasLike {
  readonly?: boolean;
  selection?: Set<CanvasElementLike>;
  createFileNode?: (options: {
    pos: { x: number; y: number };
    size: { width: number; height: number };
    file: TFile;
  }) => unknown;
  getViewportBBox?: () => BBox;
  posFromClient?: (position: { x: number; y: number }) => { x: number; y: number };
  requestSave?: () => void;
}

interface CanvasViewLike extends ItemView {
  canvas?: CanvasLike;
}

export class CanvasAdapter {
  constructor(private readonly app: App) {}

  isActive(): boolean {
    return this.getActiveCanvas() !== null;
  }

  canInsert(): boolean {
    const canvas = this.getActiveCanvas();
    return Boolean(
      canvas &&
        !canvas.readonly &&
        canvas.createFileNode &&
        canvas.getViewportBBox,
    );
  }

  containsTarget(target: EventTarget | null): boolean {
    const view = this.getActiveCanvasView();
    return Boolean(view && target instanceof Node && view.containerEl.contains(target));
  }

  async insert(
    imageFile: TFile,
    image: ClipboardImage,
    noteFile: TFile | null,
    addNote: boolean,
    dropPlacement?: CanvasDropPlacement,
  ): Promise<CanvasInsertionResult> {
    const canvas = this.getActiveCanvas();
    if (!canvas) return { inserted: false, reason: "No Canvas is active." };
    if (canvas.readonly) return { inserted: false, reason: "The active Canvas is read-only." };
    if (!canvas.createFileNode || !canvas.getViewportBBox) {
      return { inserted: false, reason: "This Obsidian version does not expose compatible Canvas controls." };
    }

    const imageSize = fitLongestEdge(image.width, image.height, 400);
    const imagePosition = this.getImagePosition(canvas, imageSize, dropPlacement);
    canvas.createFileNode({ pos: imagePosition, size: imageSize, file: imageFile });

    try {
      if (noteFile && addNote) {
        canvas.createFileNode({
          pos: { x: imagePosition.x + imageSize.width + 40, y: imagePosition.y },
          size: { width: 320, height: 240 },
          file: noteFile,
        });
      }
    } finally {
      canvas.requestSave?.();
    }
    return { inserted: true };
  }

  private getActiveCanvas(): CanvasLike | null {
    return this.getActiveCanvasView()?.canvas ?? null;
  }

  private getActiveCanvasView(): CanvasViewLike | null {
    const view = this.app.workspace.getActiveViewOfType(ItemView) as CanvasViewLike | null;
    if (!view || view.getViewType() !== "canvas") return null;
    return view;
  }

  private getImagePosition(
    canvas: CanvasLike,
    size: { width: number; height: number },
    dropPlacement?: CanvasDropPlacement,
  ): { x: number; y: number } {
    if (dropPlacement && canvas.posFromClient) {
      const position = canvas.posFromClient({ x: dropPlacement.clientX, y: dropPlacement.clientY });
      return { x: position.x - size.width / 2, y: position.y - size.height / 2 };
    }

    const boxes = [...(canvas.selection ?? [])]
      .map((element) => element.getBBox?.())
      .filter((box): box is BBox => Boolean(box));
    if (boxes.length > 0) {
      const bounds = combineBoxes(boxes);
      return {
        x: bounds.maxX + 40,
        y: (bounds.minY + bounds.maxY - size.height) / 2,
      };
    }

    const viewport = canvas.getViewportBBox!();
    return {
      x: (viewport.minX + viewport.maxX - size.width) / 2,
      y: (viewport.minY + viewport.maxY - size.height) / 2,
    };
  }
}

export function fitLongestEdge(
  width: number,
  height: number,
  longestEdge: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: longestEdge, height: longestEdge };
  const scale = longestEdge / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function combineBoxes(boxes: BBox[]): BBox {
  return boxes.reduce(
    (combined, box) => ({
      minX: Math.min(combined.minX, box.minX),
      minY: Math.min(combined.minY, box.minY),
      maxX: Math.max(combined.maxX, box.maxX),
      maxY: Math.max(combined.maxY, box.maxY),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}
