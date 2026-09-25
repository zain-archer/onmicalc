import { createStore } from '@/storage/store';

/** Draft expression shared between the calculator and every "insert" tool. */
export interface DraftState {
  text: string;
  /** Bumped when another tool pushes text so the calculator can insert it. */
  revision: number;
}

export const draftStore = createStore<DraftState>('omnica.draft.v1', { text: '', revision: 0 });

export function setDraft(text: string): void {
  draftStore.set({ text, revision: draftStore.get().revision + 1 });
}

/** Append a snippet (used by constants, history, palette). */
export function appendToDraft(snippet: string): void {
  const current = draftStore.get().text;
  const needsSpace = current.length > 0 && !/[\s(+\-*/^,]$/.test(current);
  setDraft(`${current}${needsSpace ? ' ' : ''}${snippet}`);
}

/** Last successful answer, exposed to the engine as the `ans` variable. */
export const answerStore = createStore<{ value: number; display: string }>('omnica.answer.v1', {
  value: 0,
  display: '0',
});
