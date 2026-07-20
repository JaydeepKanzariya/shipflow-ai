import type { PrFile } from "./repos";

/** Paths that add no review value and burn context. */
const SKIP_PATTERNS = [
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)package-lock\.json$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)generated\//,
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)\.next\//,
  /\.(png|jpe?g|gif|webp|svg|ico|pdf|zip|woff2?|ttf|mp4)$/i,
  /\.min\.(js|css)$/,
];

const MAX_PATCH_CHARS = 12_000; // per file
const MAX_TOTAL_CHARS = 90_000; // across the whole review
const MAX_FILES = 40;

export interface SelectedDiff {
  files: PrFile[];
  /** Files intentionally excluded — surfaced in the review, never hidden. */
  skipped: string[];
}

/**
 * Choose which changed files to send to the reviewer, capping size so a large
 * PR can't exceed the model's context. Anything dropped is reported back so
 * the review can state its own limits instead of appearing complete.
 */
export function selectReviewableFiles(files: PrFile[]): SelectedDiff {
  const kept: PrFile[] = [];
  const skipped: string[] = [];
  let total = 0;

  for (const f of files) {
    if (SKIP_PATTERNS.some((re) => re.test(f.filename))) {
      skipped.push(`${f.filename} (generated/binary)`);
      continue;
    }
    if (!f.patch) {
      skipped.push(`${f.filename} (no textual diff)`);
      continue;
    }
    if (kept.length >= MAX_FILES) {
      skipped.push(`${f.filename} (file limit reached)`);
      continue;
    }

    let patch = f.patch;
    if (patch.length > MAX_PATCH_CHARS) {
      patch = patch.slice(0, MAX_PATCH_CHARS) + "\n… (patch truncated)";
      skipped.push(`${f.filename} (patch truncated)`);
    }
    if (total + patch.length > MAX_TOTAL_CHARS) {
      skipped.push(`${f.filename} (total diff budget reached)`);
      continue;
    }

    total += patch.length;
    kept.push({ ...f, patch });
  }

  return { files: kept, skipped };
}
