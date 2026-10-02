export type CsvPreviewRow = {
  rowNumber: number;
  valid: boolean;
  errors: string[];
  questionText: string;
  category: string;
};

export type CsvImportState = {
  status: "idle" | "previewed" | "error" | "imported";
  message?: string;
  rows?: CsvPreviewRow[];
  validCount?: number;
  invalidCount?: number;
  importedCount?: number;
  /** The raw file text, round-tripped through a hidden field so "Confirm" re-parses and re-validates it from scratch. */
  csvText?: string;
};

export const initialCsvImportState: CsvImportState = { status: "idle" };

// Leave space below Next's default 1 MB request limit for multipart/Action encoding.
export const MAX_CSV_FILE_BYTES = 256 * 1024;
export const CSV_FILE_LIMIT_LABEL = "256 KB";
