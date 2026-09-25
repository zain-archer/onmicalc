import { READY_TOOLS, TOOLS } from '@/ui/tools';
import { Icon } from './Icon';

interface NavProps {
  route: string;
  onNavigate: (id: string) => void;
}

function navItems(route: string, onNavigate: (id: string) => void, variant: 'sidebar' | 'bottom') {
  return READY_TOOLS.map((tool) => {
    const active = tool.id === route;
    return (
      <button
        key={tool.id}
        type="button"
        className={`nav__item nav__item--${variant}${active ? ' is-active' : ''}`}
        aria-current={active ? 'page' : undefined}
        onClick={() => onNavigate(tool.id)}
        title={tool.summary}
      >
        <Icon path={tool.icon} />
        <span className="nav__label">{tool.label}</span>
      </button>
    );
  });
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
      <nav className="nav nav--sidebar">{navItems(route, onNavigate, 'sidebar')}</nav>
      <p className="sidebar__foot">
        {READY_TOOLS.length} of {TOOLS.length} tools available. Built in phases — see About.
      </p>
    </aside>
  );
}

export function BottomNav({ route, onNavigate }: NavProps) {
  return (
    <nav className="nav nav--bottom" aria-label="Tools">
      {navItems(route, onNavigate, 'bottom')}
    </nav>
  );
}
