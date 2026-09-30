import { NAV_GROUPS, READY_TOOLS, getTool, resolveNavGroup } from '@/ui/tools';
import { Icon } from './Icon';
import { useState } from 'react';

interface NavProps {
  route: string;
  onNavigate: (id: string) => void;
}

function GroupNav({ route, onNavigate, variant }: NavProps & { variant: 'sidebar' | 'bottom' }) {
  const currentGroup = resolveNavGroup(route);
  const [expanded, setExpanded] = useState<string | null>(currentGroup?.id || 'calculate');

  if (variant === 'bottom') {
    const primary = [
      NAV_GROUPS.find(g => g.id === 'home')!,
      NAV_GROUPS.find(g => g.id === 'calculate')!,
      NAV_GROUPS.find(g => g.id === 'graph')!,
      NAV_GROUPS.find(g => g.id === 'tools')!,
      NAV_GROUPS.find(g => g.id === 'settings')!,
    ].filter(Boolean);

    return (
      <>
        {primary.map(group => {
          const active = currentGroup?.id === group.id || route === group.defaultTool || group.tools.includes(route);
          return (
            <button
              key={group.id}
              type="button"
              className={`nav__item nav__item--bottom${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate(group.defaultTool)}
              title={group.label}
            >
              <Icon path={group.icon} />
              <span className="nav__label">{group.label}</span>
            </button>
          );
        })}
      </>
    );
  }

  return (
    <>
      {NAV_GROUPS.map(group => {
        const isActiveGroup = currentGroup?.id === group.id || group.tools.includes(route) || route === group.id;
        const isExpanded = expanded === group.id || isActiveGroup;
        const tools = group.tools.map(id => getTool(id)).filter((t): t is NonNullable<typeof t> => Boolean(t));
        return (
          <div key={group.id} className={`nav__group${isActiveGroup ? ' is-active-group' : ''}`}>
            <button
              type="button"
              className={`nav__item nav__item--sidebar nav__item--group${isActiveGroup ? ' is-active' : ''}`}
              aria-current={isActiveGroup ? 'page' : undefined}
              aria-expanded={isExpanded}
              onClick={() => {
                if (isActiveGroup && group.tools.length > 1) {
                  setExpanded(isExpanded ? null : group.id);
                } else {
                  onNavigate(group.defaultTool);
                  setExpanded(group.id);
                }
              }}
              title={group.label}
            >
              <Icon path={group.icon} />
              <span className="nav__label">{group.label}</span>
              {group.tools.length > 1 && <span className="nav__chevron" aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>}
            </button>
            {isExpanded && group.tools.length > 1 && (
              <div className="nav__sub">
                {tools.map(tool => {
                  const active = tool.id === route;
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      className={`nav__item nav__item--sub${active ? ' is-active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => onNavigate(tool.id)}
                      title={tool.summary}
                    >
                      <span className="nav__label nav__label--sub">{tool.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export function Sidebar({ route, onNavigate }: NavProps) {
  return (
    <aside className="sidebar" aria-label="Tools">
      <div className="brand">
        <span className="brand__mark" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 8h8M8 12h8M8 16h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        <span className="brand__text">
          <strong>OmniCalc</strong>
          <small>Free · Offline</small>
        </span>
      </div>
      <div className="sidebar__search">
        <button type="button" className="btn btn--small" style={{ width: '100%' }} onClick={() => { window.dispatchEvent(new CustomEvent('omnica:openPalette')); }}>
          Search <kbd className="kbd-inline">Ctrl K</kbd>
        </button>
      </div>
      <nav className="nav nav--sidebar">{<GroupNav route={route} onNavigate={onNavigate} variant="sidebar" />}</nav>
      <p className="sidebar__foot">
        {READY_TOOLS.length} tools • <button className="btn btn--tiny" style={{ padding: 0, border: 0, background: 'none', color: 'var(--accent)', cursor: 'pointer' }} onClick={() => onNavigate('tools')}>Browse all</button> • Built in phases — see About.
      </p>
    </aside>
  );
}

export function BottomNav({ route, onNavigate }: NavProps) {
  return (
    <nav className="nav nav--bottom" aria-label="Tools">
      {<GroupNav route={route} onNavigate={onNavigate} variant="bottom" />}
    </nav>
  );
}
