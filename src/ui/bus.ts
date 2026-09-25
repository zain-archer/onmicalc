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

/**
 * A plain-language request handed to the Ask panel — used by the command
 * palette ("Ask OmniCalc: convert 5 km to miles") and by deep links.
 */
export interface AskState {
  text: string;
  /** Bumped on every handoff so the panel knows to run the new request. */
  token: number;
}

export const askStore = createStore<AskState>('omnica.ask.v1', { text: '', token: 0 });

export function setAsk(text: string): void {
  askStore.set({ text, token: askStore.get().token + 1 });
}

/** Last successful answer, exposed to the engine as the `ans` variable. */
export const answerStore = createStore<{ value: number; display: string }>('omnica.answer.v1', {
  value: 0,
  display: '0',
});
