export interface ImportPage { total: number; next_offset: number | null; created: number; duplicates: number }

export async function runImport(
  content: string,
  invoke: (b: { content: string; offset: number }) => Promise<ImportPage>,
  onProgress: (p: { done: number; total: number; created: number; duplicates: number }) => void,
): Promise<{ total: number; created: number; duplicates: number }> {
  let offset = 0, total = 0, created = 0, duplicates = 0;
  for (;;) {
    const page = await invoke({ content, offset });
    total = page.total;
    created += page.created;
    duplicates += page.duplicates;
    onProgress({ done: page.next_offset ?? total, total, created, duplicates });
    if (page.next_offset === null) return { total, created, duplicates };
    offset = page.next_offset;
  }
}
