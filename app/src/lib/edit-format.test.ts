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

test("steps: one per non-empty line", () => {
  expect(textToSteps("א\n\n ב \n")).toEqual([{ text: "א" }, { text: "ב" }]);
  expect(stepsToText([{ text: "א" }, { text: "ב" }])).toBe("א\nב");
});
