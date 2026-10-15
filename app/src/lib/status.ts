import type { RecipeStatus } from "./types";

export const STATUS_LABEL: Record<RecipeStatus, string> = {
  queued: "ממתין לקריאת הקישור…",
  rewriting: "כותבים את המתכון…",
  imaging: "מצלמים את המנה…",
  published: "פורסם",
  needs_review: "צריך בדיקה ידנית",
  failed: "נכשל",
};
