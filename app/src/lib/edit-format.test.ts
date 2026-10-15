import { expect, test } from "vitest";
import { ingredientsToText, stepsToText, textToIngredients, textToSteps } from "./edit-format";

test("ingredients round-trip with group headers", () => {
  const text = ingredientsToText([
    { group: "לבצק", name: "קמח", amount: "2", unit: "כוסות", note: null },
    { group: "לבצק", name: "מים", amount: null, unit: null, note: null },
    { group: null, name: "מלח", amount: null, unit: null, note: null },
  ]);
  expect(text).toBe("# לבצק\n2 כוסות קמח\nמים\n#\nמלח");
  expect(textToIngredients(text)).toEqual([
    { group: "לבצק", name: "2 כוסות קמח", amount: null, unit: null, note: null },
    { group: "לבצק", name: "מים", amount: null, unit: null, note: null },
    { group: null, name: "מלח", amount: null, unit: null, note: null },
  ]);
});

test("with the original list, unchanged lines keep their structure and only edited lines are flattened", () => {
  const original = [
    { group: "לבצק", name: "קמח", amount: "2", unit: "כוסות", note: "מנופה" },
    { group: "לבצק", name: "מים", amount: "1", unit: "כוס", note: null },
    { group: null, name: "מלח", amount: "1", unit: "כפית", note: null },
  ];
  const text = ingredientsToText(original).replace("1 כוס מים", "1.5 כוס מים פושרים");
  const out = textToIngredients(text, original);
  expect(out[0]).toBe(original[0]);
  expect(out[1]).toEqual({ group: "לבצק", name: "1.5 כוס מים פושרים", amount: null, unit: null, note: null });
  expect(out[2]).toBe(original[2]);
});

test("an original is not reused when its line moves to another group, and each original is reused once", () => {
  const original = [{ group: "א", name: "ביצה", amount: "1", unit: null, note: null }];
  expect(textToIngredients("# ב\n1 ביצה", original)).toEqual([{ group: "ב", name: "1 ביצה", amount: null, unit: null, note: null }]);
  const out = textToIngredients("# א\n1 ביצה\n1 ביצה", original);
  expect(out[0]).toBe(original[0]);
  expect(out[1]).toEqual({ group: "א", name: "1 ביצה", amount: null, unit: null, note: null });
});

test("steps: one per non-empty line", () => {
  expect(textToSteps("א\n\n ב \n")).toEqual([{ text: "א" }, { text: "ב" }]);
  expect(stepsToText([{ text: "א" }, { text: "ב" }])).toBe("א\nב");
});
