export interface InsertResult {
  text: string;
  caret: number;
}

/**
 * Insert `snippet` into `text` at the caret.
 * `caretOffset` positions the caret relative to the end of the snippet
 * (negative values move it left, e.g. -1 puts it inside `sqrt(|)`).
 */
export function insertSnippet(
  text: string,
  snippet: string,
  selectionStart: number,
  selectionEnd: number = selectionStart,
  caretOffset = 0,
): InsertResult {
  const start = Math.max(0, Math.min(selectionStart, text.length));
  const end = Math.max(start, Math.min(selectionEnd, text.length));
  const next = text.slice(0, start) + snippet + text.slice(end);
  const caret = Math.max(0, Math.min(start + snippet.length + caretOffset, next.length));
  return { text: next, caret };
}

/** Delete one character (or the selection) to the left of the caret. */
export function backspace(text: string, selectionStart: number, selectionEnd = selectionStart): InsertResult {
  const start = Math.max(0, Math.min(selectionStart, text.length));
  const end = Math.max(start, Math.min(selectionEnd, text.length));
  if (start === end) {
    if (start === 0) return { text, caret: 0 };
    const next = text.slice(0, start - 1) + text.slice(start);
    return { text: next, caret: start - 1 };
  }
  return { text: text.slice(0, start) + text.slice(end), caret: start };
}
