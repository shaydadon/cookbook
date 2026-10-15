import { describe, expect, test } from "vitest";
import {
  formatAttribution, formatIngredient, formatMinutes, groupIngredients, imageUrl, sourceLabel, totalMinutes,
} from "./recipes";
import type { Ingredient, Share } from "./types";

const ing = (name: string, over: Partial<Ingredient> = {}): Ingredient =>
  ({ group: null, name, amount: null, unit: null, note: null, ...over });

describe("formatting", () => {
  test("formatIngredient joins amount, unit, name and note", () => {
    expect(formatIngredient(ing("קמח", { amount: "2", unit: "כוסות", note: "מנופה" }))).toBe("2 כוסות קמח (מנופה)");
    expect(formatIngredient(ing("מלח"))).toBe("מלח");
  });

  test("groupIngredients keeps order and groups consecutive items", () => {
    const groups = groupIngredients([
      ing("קמח", { group: "לבצק" }), ing("מים", { group: "לבצק" }), ing("עגבניות", { group: "לרוטב" }),
    ]);
    expect(groups.map((g) => [g.group, g.items.length])).toEqual([["לבצק", 2], ["לרוטב", 1]]);
    expect(groupIngredients([ing("א"), ing("ב")])).toEqual([{ group: null, items: [ing("א"), ing("ב")] }]);
  });

  test("totalMinutes and formatMinutes", () => {
    expect(totalMinutes({ prep_minutes: 10, cook_minutes: 35 })).toBe(45);
    expect(totalMinutes({ prep_minutes: null, cook_minutes: null })).toBeNull();
    expect(formatMinutes(45)).toBe("45 דק׳");
    expect(formatMinutes(60)).toBe("שעה");
    expect(formatMinutes(75)).toBe("שעה ו-15 דק׳");
    expect(formatMinutes(150)).toBe("2 שע׳ ו-30 דק׳");
  });

  test("sourceLabel names social platforms in Hebrew and strips www for sites", () => {
    expect(sourceLabel("https://instagram.com/reel/x", "instagram")).toBe("אינסטגרם");
    expect(sourceLabel("https://www.mako.co.il/food/1", "web")).toBe("mako.co.il");
  });

  test("formatAttribution with and without a share", () => {
    const share: Share = { id: "s", recipe_id: "r", shared_by_name: "רחל", shared_at: "2026-10-12T09:00:00Z", via: "whatsapp" };
    expect(formatAttribution({ source_url: "https://www.mako.co.il/a", source_platform: "web" }, share))
      .toBe("מקור: mako.co.il · שותף ע״י רחל ב-12.10.2026");
    expect(formatAttribution({ source_url: "https://tiktok.com/x", source_platform: "tiktok" }, null)).toBe("מקור: טיקטוק");
  });

  test("imageUrl builds a public storage URL or null", () => {
    expect(imageUrl(null)).toBeNull();
    expect(imageUrl("r1/a.webp")).toBe("http://localhost:54321/storage/v1/object/public/recipe-images/r1/a.webp");
  });
});
