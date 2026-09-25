import { useEffect, useMemo, useRef, useState } from 'react';
import { useFocusTrap } from '@/ui/useFocusTrap';
import {
  createCommands,
  filterCommands,
  moveSelection,
  type Command,
  type CommandHandlers,
} from '@/ui/commands';

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  handlers: CommandHandlers;
}

export function CommandPalette({ open, onClose, handlers }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(open);

  const commands = useMemo(() => createCommands(handlers), [handlers]);
  const results = useMemo(() => filterCommands(commands, query), [commands, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActive(0);
      return;
    }
    setActive(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    const node = listRef.current?.children[active] as HTMLElement | undefined;
    node?.scrollIntoView?.({ block: 'nearest' });
  }, [active, results.length]);

  if (!open) return null;

  const run = (command: Command | undefined) => {
    if (!command) return;
    onClose();
    command.run();
  };

  const grouped = results.reduce<Record<string, Command[]>>((accumulator, command) => {
    (accumulator[command.group] ??= []).push(command);
    return accumulator;
  }, {});

  let index = -1;

  return (
    <div className="palette-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="palette__input"
          type="search"
          value={query}
          placeholder="Search tools and actions…"
          aria-label="Search commands"
          aria-controls="palette-results"
          aria-activedescendant={results[active] ? `palette-${results[active]!.id}` : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((current) => moveSelection(current, 1, results.length));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((current) => moveSelection(current, -1, results.length));
            } else if (event.key === 'Home') {
              event.preventDefault();
              setActive(0);
            } else if (event.key === 'End') {
              event.preventDefault();
              setActive(Math.max(0, results.length - 1));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              run(results[active]);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onClose();
            }
          }}
        />

        <ul className="palette__list" id="palette-results" role="listbox" aria-label="Commands" ref={listRef}>
          {results.length === 0 ? (
            <li className="palette__empty">No command matches “{query}”.</li>
          ) : (
            Object.entries(grouped).flatMap(([group, groupCommands]) => [
              <li key={`group-${group}`} className="palette__group" role="presentation">
                {group}
              </li>,
              ...groupCommands.map((command) => {
                index += 1;
                const position = index;
                return (
                  <li
                    key={command.id}
                    id={`palette-${command.id}`}
                    role="option"
                    aria-selected={position === active}
                    className={`palette__item${position === active ? ' is-active' : ''}`}
                    onMouseEnter={() => setActive(position)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      run(command);
                    }}
                  >
                    <span className="palette__label">{command.label}</span>
                    {command.hint ? <span className="palette__hint">{command.hint}</span> : null}
                  </li>
                );
              }),
            ])
          )}
        </ul>

        <p className="palette__footer">
          <kbd>↑</kbd> <kbd>↓</kbd> to navigate · <kbd>Enter</kbd> to run · <kbd>Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
