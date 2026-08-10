import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Antenna,
  ArrowDownToLine,
  BarChart3,
  ChevronRight,
  Cog,
  Database,
  Globe,
  ListChecks,
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

/** A run of items under an optional muted label, one level inside a drawer. */
interface NavShelf {
  titleKey?: MessageKey;
  items: NavItem[];
}

/** The Data Pipeline drawer: six stage screens, no shelves — the order is the pipeline. */
const pipelineShelves: NavShelf[] = [
  {
    items: [
      { to: '/pipeline/jobs', labelKey: 'sidebar.pipeline.jobs', icon: ListChecks, testId: 'nav-pipeline-jobs' },
      { to: '/pipeline/sources', labelKey: 'sidebar.pipeline.sources', icon: Antenna, testId: 'nav-pipeline-sources' },
      { to: '/pipeline/ingestion', labelKey: 'sidebar.pipeline.ingestion', icon: ArrowDownToLine, testId: 'nav-pipeline-ingestion' },
      { to: '/pipeline/processing', labelKey: 'sidebar.pipeline.processing', icon: Cog, testId: 'nav-pipeline-processing' },
      { to: '/pipeline/storage', labelKey: 'sidebar.pipeline.storage', icon: Database, testId: 'nav-pipeline-storage' },
      { to: '/pipeline/insights', labelKey: 'sidebar.pipeline.insights', icon: BarChart3, testId: 'nav-pipeline-insights' },
    ],
  },
];

const legacyShelves: NavShelf[] = [
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

const PIPELINE_OPEN_KEY = 'hermetra.sidebar.pipelineOpen';
const LEGACY_OPEN_KEY = 'hermetra.sidebar.legacyOpen';

/**
 * Each drawer remembers how you left it; the fallback is only ever the first
 * launch. Data Pipeline opens, Legacy does not.
 *
 * Both used to open, because every screen this app had lived in one drawer and
 * starting collapsed would have hidden the app from itself. Fifteen rows no
 * longer fit a 1024x720 rail with both open — the last one is clipped to a
 * sliver — so one has to give, and the group named "Legacy" is the one whose
 * own name says it does not lead. It is a click away, and that click sticks.
 */
const readStoredOpen = (key: string, fallbackOpen: boolean): boolean => {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallbackOpen : stored !== 'false';
  } catch {
    return fallbackOpen;
  }
};

const writeStoredOpen = (key: string, open: boolean): void => {
  try {
    window.localStorage.setItem(key, String(open));
  } catch {
    /* a rail that cannot remember is still a rail */
  }
};

interface NavDrawerProps {
  titleKey: MessageKey;
  toggleTestId: string;
  storageKey: string;
  /** First-launch state only. Once the user folds or opens it, that wins. */
  defaultOpen: boolean;
  shelves: NavShelf[];
}

/**
 * One collapsible card in the rail. The group title owns a full-bleed band here,
 * and a band inside a band reads as two competing headers — so a shelf one level
 * down is a plain muted label, and a drawer with a single unnamed shelf shows no
 * label at all.
 */
function NavDrawer({ titleKey, toggleTestId, storageKey, defaultOpen, shelves }: NavDrawerProps) {
  const t = useT();
  const [open, setOpen] = useState(() => readStoredOpen(storageKey, defaultOpen));

  const toggle = () => {
    setOpen((wasOpen) => {
      writeStoredOpen(storageKey, !wasOpen);
      return !wasOpen;
    });
  };

  return (
    <section className="overflow-hidden rounded-lg bg-card shadow">
      <h2>
        <button
          type="button"
          data-testid={toggleTestId}
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
          <span>{t(titleKey)}</span>
        </button>
      </h2>

      {open && (
        <div className="space-y-1 p-1.5">
          {shelves.map((shelf, i) => (
            <div key={shelf.titleKey ?? i}>
              {shelf.titleKey && (
                <p className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {t(shelf.titleKey)}
                </p>
              )}
              <ul className="space-y-0.5">
                {shelf.items.map((item) => (
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
  );
}

/**
 * The rail is the darkest surface in the app; each drawer is a card lifted out
 * of it. Nothing here is tinted — the sidebar used to mark its groups and its
 * selected row with module accents, and an accent on a card is exactly what
 * this product's design forbids.
 *
 * Selection therefore reads by depth, not colour: the chosen row is pressed
 * into its card (darker fill, inset shadow) while every other row is flush.
 * That keeps the highlight inside the list's own grid instead of floating a
 * coloured box out of it, and it survives being seen in greyscale.
 *
 * Data Pipeline sits above Legacy because that is the ordering the two names
 * already claim — web / mobile / bridge became "Legacy" precisely so the
 * pipeline could take the top of the rail.
 */
export function Sidebar() {
  const t = useT();

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
        <NavDrawer
          titleKey="sidebar.group.pipeline"
          toggleTestId="nav-pipeline-toggle"
          storageKey={PIPELINE_OPEN_KEY}
          defaultOpen
          shelves={pipelineShelves}
        />
        <NavDrawer
          titleKey="sidebar.group.legacy"
          toggleTestId="nav-legacy-toggle"
          storageKey={LEGACY_OPEN_KEY}
          defaultOpen={false}
          shelves={legacyShelves}
        />
      </nav>

      <div className="border-t border-border p-2.5 text-[10px] text-muted-foreground">
        {t('sidebar.footer')}
      </div>
    </aside>
  );
}
