import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ChevronRight,
  Globe,
  Smartphone,
  Workflow,
  Activity,
  Terminal,
  Sliders,
  Cable,
  Crosshair,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { MessageKey } from '@/lib/messages';
import { HermetraMark } from '@/components/brand/hermetra-mark';

interface NavItem {
  to: string;
  labelKey: MessageKey;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
}

interface NavGroup {
  titleKey: MessageKey;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    titleKey: 'sidebar.group.web',
    items: [
      { to: '/web/remote', labelKey: 'sidebar.web.remote', icon: Globe, testId: 'nav-web-remote' },
      { to: '/web/code', labelKey: 'sidebar.web.code', icon: Terminal, testId: 'nav-web-code' },
    ],
  },
  {
    titleKey: 'sidebar.group.mobile',
    items: [
      { to: '/mobile/devices', labelKey: 'sidebar.mobile.devices', icon: Smartphone, testId: 'nav-mobile-devices' },
      { to: '/mobile/code', labelKey: 'sidebar.mobile.code', icon: Terminal, testId: 'nav-mobile-code' },
      { to: '/mobile/inspector', labelKey: 'sidebar.mobile.inspector', icon: Crosshair, testId: 'nav-mobile-inspector' },
    ],
  },
  {
    titleKey: 'sidebar.group.bridge',
    items: [
      { to: '/bridge/scenarios', labelKey: 'sidebar.bridge.scenarios', icon: Workflow, testId: 'nav-bridge-scenarios' },
      { to: '/bridge/variables', labelKey: 'sidebar.bridge.variables', icon: Sliders, testId: 'nav-bridge-variables' },
      { to: '/bridge/bus', labelKey: 'sidebar.bridge.bus', icon: Cable, testId: 'nav-bridge-bus' },
      { to: '/bridge/events', labelKey: 'sidebar.bridge.events', icon: Activity, testId: 'nav-bridge-events' },
    ],
  },
];

const LEGACY_OPEN_KEY = 'hermetra.sidebar.legacyOpen';

/**
 * Starts **open**, and remembers.
 *
 * Every screen this app has lives inside the drawer, so opening collapsed would
 * hide the app from itself on first launch. Folding it away is therefore a
 * deliberate act — and one the app does not undo behind your back.
 */
const readStoredOpen = (): boolean => {
  try {
    return window.localStorage.getItem(LEGACY_OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
};

const writeStoredOpen = (open: boolean): void => {
  try {
    window.localStorage.setItem(LEGACY_OPEN_KEY, String(open));
  } catch {
    /* a rail that cannot remember is still a rail */
  }
};

/**
 * The rail is the darkest surface in the app; each group is a card lifted out
 * of it. Nothing here is tinted — the sidebar used to mark its groups and its
 * selected row with module accents, and an accent on a card is exactly what
 * this product's design forbids.
 *
 * Selection therefore reads by depth, not colour: the chosen row is pressed
 * into its card (darker fill, inset shadow) while every other row is flush.
 * That keeps the highlight inside the list's own grid instead of floating a
 * coloured box out of it, and it survives being seen in greyscale.
 *
 * The three groups sit inside one collapsible card rather than standing as three
 * of their own. The group title owns a full-bleed band in this rail, and a band
 * inside a band reads as two competing headers — so a shelf one level down is a
 * plain muted label instead.
 */
export function Sidebar() {
  const t = useT();
  const [open, setOpen] = useState(readStoredOpen);

  const toggle = () => {
    setOpen((wasOpen) => {
      writeStoredOpen(!wasOpen);
      return !wasOpen;
    });
  };

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-sidebar">
      {/* Mark plus wordmark, one line — no tagline. "Web / Mobile automation
          bridge" is a landing-page line: true on first launch, dead pixels
          every launch after. The one thing that does change here, the active
          workspace, already has a home in the topbar, so this stays a
          nameplate and gives its vertical space back to the nav. */}
      <div className="flex h-12 items-center gap-2 border-b border-border px-3.5">
        <HermetraMark className="h-7 w-7" />
        <span className="text-sm font-semibold tracking-tight">{t('titlebar.brand')}</span>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto p-2">
        <section className="overflow-hidden rounded-lg bg-card shadow">
          <h2>
            <button
              type="button"
              data-testid="nav-legacy-toggle"
              aria-expanded={open}
              onClick={toggle}
              className={cn(
                'flex h-8 w-full items-center gap-1.5 bg-muted px-3.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground',
                'transition-colors hover:bg-accent',
                open && 'border-b border-border',
              )}
            >
              <ChevronRight
                className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')}
                aria-hidden="true"
              />
              <span>{t('sidebar.group.legacy')}</span>
            </button>
          </h2>

          {open && (
            <div className="space-y-1 p-1.5">
              {groups.map((group) => (
                <div key={group.titleKey}>
                  <p className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {t(group.titleKey)}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          data-testid={item.testId}
                          className={({ isActive }) =>
                            cn(
                              'flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors',
                              'hover:bg-accent hover:text-foreground',
                              isActive && 'bg-muted font-semibold text-foreground shadow-inner',
                            )
                          }
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{t(item.labelKey)}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </nav>

      <div className="border-t border-border p-2.5 text-[10px] text-muted-foreground">
        {t('sidebar.footer')}
      </div>
    </aside>
  );
}
