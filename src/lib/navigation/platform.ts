/** Primary LeagueZone platform navigation. Keep the standalone Research shell in sync;
 * tests/unit/platform-navigation.test.ts enforces its generated menu destinations. */
export const PLATFORM_NAV = [
  {
    "id": "home",
    "label": "Home",
    "href": "/",
    "links": []
  },
  {
    "id": "websites",
    "label": "League Websites",
    "href": "/features",
    "links": [
      {
        "label": "League Website Features",
        "href": "/features"
      },
      {
        "label": "Create a League Website",
        "href": "/setup?new=1"
      },
      {
        "label": "My League Websites",
        "href": "/app/leagues"
      },
      {
        "label": "Join a League",
        "href": "/app#join-league"
      }
    ]
  },
  {
    "id": "research",
    "label": "Research",
    "href": "/research",
    "links": [
      {
        "label": "Research Home",
        "href": "/research"
      },
      {
        "label": "Fantasy Insights",
        "href": "/research/decisions"
      },
      {
        "label": "Player Research",
        "href": "/research/players"
      },
      {
        "label": "Stat Leaders",
        "href": "/research/stats"
      },
      {
        "label": "Opportunity Radar",
        "href": "/research/radar"
      },
      {
        "label": "NFL Weekly Center",
        "href": "/weekly"
      },
      {
        "label": "Injuries & Availability",
        "href": "/availability"
      }
    ]
  },
  {
    "id": "tools",
    "label": "Tools",
    "href": "/fantasy-tools",
    "links": [
      {
        "label": "All Tools",
        "href": "/fantasy-tools"
      },
      {
        "label": "Start / Bench Advisor",
        "href": "/fantasy-tools/start-bench"
      },
      {
        "label": "Waiver & Pickup Finder",
        "href": "/fantasy-tools/waivers"
      },
      {
        "label": "Trade Analyzer",
        "href": "/fantasy-tools/trade"
      },
      {
        "label": "Improve My Roster",
        "href": "/fantasy-tools/roster"
      },
      {
        "label": "Player Rankings",
        "href": "/fantasy-tools/rankings"
      },
      {
        "label": "Taxi Squad Advisor",
        "href": "/fantasy-tools/taxi"
      },
      {
        "label": "Draft Advisor",
        "href": "/fantasy-tools/draft"
      },
      {
        "label": "Season Outlook",
        "href": "/fantasy-tools/outlook"
      },
      {
        "label": "Development Lab",
        "href": "/research/development"
      },
      {
        "label": "Prediction Receipts",
        "href": "/research/receipts"
      }
    ]
  },
  {
    "id": "demo",
    "label": "Demo League",
    "href": "/demo",
    "links": [
      {
        "label": "Visit Demo League",
        "href": "/demo"
      },
      {
        "label": "What League Websites Offer",
        "href": "/features"
      }
    ]
  },
  {
    "id": "hub",
    "label": "Hub",
    "href": "/app",
    "links": [
      {
        "label": "My Hub",
        "href": "/app"
      },
      {
        "label": "My League Websites",
        "href": "/app/leagues"
      },
      {
        "label": "Connect a Sleeper League",
        "href": "/app/connect-sleeper"
      },
      {
        "label": "My Research & Watchlists",
        "href": "/my-research"
      },
      {
        "label": "Saved Research",
        "href": "/saved"
      },
      {
        "label": "Account & Profile",
        "href": "/profile"
      }
    ]
  }
] as const;

function matches(pathname: string, href: string): boolean {
  const path = href.split('?')[0];
  return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/');
}

/** Prefer specific destinations so Development Lab is highlighted under Tools,
 * rather than the broader /research parent. */
export function getPlatformNavigationSection(pathname: string): string {
  let best = { id: 'home', length: pathname === '/' ? 1 : -1 };
  for (const section of PLATFORM_NAV) {
    for (const href of [section.href, ...section.links.map(link => link.href)]) {
      const path = href.split('?')[0];
      if (matches(pathname, href) && path.length > best.length) best = { id: section.id, length: path.length };
    }
  }
  return best.length < 0 ? '' : best.id;
}
