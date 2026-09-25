import { createStore } from '@/storage/store';

/** Single-slot, transient user notice shown by the status strip. */
export interface NoticeState {
  id: number;
  kind: 'info' | 'ok' | 'error';
  text: string;
}

export const notifyStore = createStore<NoticeState>('omnica.notice.v1', { id: 0, kind: 'info', text: '' });

export function notify(text: string, kind: NoticeState['kind'] = 'info'): void {
  notifyStore.set({ id: notifyStore.get().id + 1, kind, text });
}

export function clearNotice(): void {
  notifyStore.set({ id: notifyStore.get().id + 1, kind: 'info', text: '' });
}
