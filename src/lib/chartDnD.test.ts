import { describe, expect, it } from "vitest";
import { insertIndexFromPointer, pointerInsertSide, type TilePointerRect } from "./chartDnD";

function rect(id: string, left: number, top: number, width: number, height: number): TilePointerRect {
  return { id, left, top, width, height };
}

describe("pointerInsertSide", () => {
  const card = { left: 0, top: 0, width: 400, height: 80 };

  it("treats the top / first half as insert-before", () => {
    expect(pointerInsertSide({ x: 200, y: 0 }, card)).toBe("before");
    expect(pointerInsertSide({ x: 200, y: 39 }, card)).toBe("before");
  });

  it("treats the bottom / second half as insert-after", () => {
    expect(pointerInsertSide({ x: 200, y: 40 }, card)).toBe("after");
    expect(pointerInsertSide({ x: 200, y: 79 }, card)).toBe("after");
  });
});

describe("insertIndexFromPointer", () => {
  const fullA = rect("advisor", 0, 0, 400, 80);
  const fullB = rect("heatmap", 0, 100, 400, 80);
  const stacked = [fullA, fullB];

  it("returns 0 when there are no cards", () => {
    expect(insertIndexFromPointer({ x: 10, y: 10 }, [])).toBe(0);
  });

  it("inserts before a Full card when the pointer is on its top half", () => {
    expect(insertIndexFromPointer({ x: 200, y: 20 }, stacked)).toBe(0);
    expect(insertIndexFromPointer({ x: 200, y: 110 }, stacked)).toBe(1);
  });

  it("inserts after a Full card when the pointer is on its bottom half", () => {
    expect(insertIndexFromPointer({ x: 200, y: 60 }, stacked)).toBe(1);
    expect(insertIndexFromPointer({ x: 200, y: 160 }, stacked)).toBe(2);
  });

  it("uses the gap between stacked Full cards as the insertion slot", () => {
    expect(insertIndexFromPointer({ x: 200, y: 90 }, stacked)).toBe(1);
  });

  it("inserts an md card between two Full cards from the first card's second half", () => {
    const md = rect("pool:p1", 0, 200, 190, 80);
    const rects = [fullA, fullB, md];
    expect(insertIndexFromPointer({ x: 200, y: 60 }, rects)).toBe(1);
    expect(insertIndexFromPointer({ x: 200, y: 90 }, rects)).toBe(1);
  });

  it("uses top / bottom halves on side-by-side md cards, and the gap between them", () => {
    const p1 = rect("pool:p1", 0, 0, 180, 80);
    const p2 = rect("pool:p2", 200, 0, 180, 80);
    const row = [p1, p2];
    expect(insertIndexFromPointer({ x: 90, y: 20 }, row)).toBe(0);
    expect(insertIndexFromPointer({ x: 90, y: 60 }, row)).toBe(1);
    expect(insertIndexFromPointer({ x: 290, y: 20 }, row)).toBe(1);
    expect(insertIndexFromPointer({ x: 290, y: 60 }, row)).toBe(2);
    expect(insertIndexFromPointer({ x: 190, y: 40 }, row)).toBe(1);
  });
});
