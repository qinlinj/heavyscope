import { describe, expect, it } from "vitest";
import { leftoverAfterPlace, packSpans, tileFitsInRow } from "./gridPack";

describe("tileFitsInRow", () => {
  it("fits when leftover columns are enough, otherwise wraps", () => {
    expect(tileFitsInRow(4, 1)).toBe(true);
    expect(tileFitsInRow(2, 2)).toBe(true);
    expect(tileFitsInRow(1, 2)).toBe(false);
    expect(tileFitsInRow(0, 1)).toBe(false);
  });
});

describe("leftoverAfterPlace", () => {
  it("subtracts when the tile fits the leftover columns", () => {
    expect(leftoverAfterPlace(4, 1, 4)).toEqual({ leftover: 3, wrapped: false });
    expect(leftoverAfterPlace(3, 2, 4)).toEqual({ leftover: 1, wrapped: false });
  });

  it("wraps to the next row when leftover is too small", () => {
    expect(leftoverAfterPlace(1, 2, 4)).toEqual({ leftover: 2, wrapped: true });
    expect(leftoverAfterPlace(2, 4, 4)).toEqual({ leftover: 0, wrapped: true });
  });
});

describe("packSpans", () => {
  it("keeps sm/md/lg packing honest on a 4-column dashboard", () => {
    const packed = packSpans([1, 2, 4, 2, 2], 4);
    expect(packed.map((item) => item.wrapped)).toEqual([false, false, true, false, false]);
    expect(packed.map((item) => item.leftoverAfter)).toEqual([3, 1, 0, 2, 0]);
  });

  it("places two md tiles on one row; a following lg starts the next row", () => {
    const packed = packSpans([2, 2, 4], 4);
    expect(packed[0]).toMatchObject({ wrapped: false, leftoverAfter: 2 });
    expect(packed[1]).toMatchObject({ wrapped: false, leftoverAfter: 0 });
    expect(packed[2]).toMatchObject({ wrapped: false, leftoverAfter: 0 });
    expect(packSpans([2, 4], 4)[1]).toMatchObject({ wrapped: true, leftoverAfter: 0 });
  });
});
