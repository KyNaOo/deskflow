import { describe, expect, it } from "vitest";
import { formatFileSize } from "./format-file-size";

describe("formatFileSize", () => {
  it.each([
    [820, "820 o"],
    [12 * 1024, "12 Ko"],
    [3.44 * 1024 * 1024, "3,4 Mo"],
    [10 * 1024 * 1024, "10 Mo"],
  ])("%d octets → %s", (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});
