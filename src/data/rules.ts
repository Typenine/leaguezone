// League rules content.
// Replace the placeholder sections below with your league's actual rules,
// or configure rules storage in the DB (leagues.config) and load them dynamically.
// Each section renders as HTML — use <p>, <ul>, <li>, <strong> tags freely.

export type RulesHtmlSection = {
  id: string;
  title: string;
  html: string;
};

export const rulesHtmlSections: RulesHtmlSection[] = [
  {
    id: 'league-overview',
    title: '1. League Overview',
    html: `
      <p><strong>1.1</strong> — Update this section with your league's basic information.</p>
      <p><strong>1.2</strong> — Format: (e.g. SuperFlex Dynasty League, Redraft, Keeper)</p>
      <p><strong>1.3</strong> — Scoring: (e.g. 0.5 PPR, Full PPR, Standard)</p>
      <p><strong>1.4</strong> — Platform: Sleeper. Sleeper's settings, scoring, and transaction statuses control league operation unless the rulebook explicitly states otherwise.</p>
    `,
  },
  {
    id: 'teams-rosters',
    title: '2. Teams & Rosters',
    html: `
      <p><strong>2.1</strong> — Number of teams: (e.g. 12)</p>
      <p><strong>2.2</strong> — Roster size: (describe your active + taxi + IR spots)</p>
      <p><strong>2.3</strong> — Starting lineup: (list your starting positions)</p>
    `,
  },
  {
    id: 'draft',
    title: '3. Draft',
    html: `
      <p><strong>3.1</strong> — Describe your draft format (startup, rookie, auction, etc.).</p>
      <p><strong>3.2</strong> — Draft order: (e.g. randomized, based on previous season finish)</p>
      <p><strong>3.3</strong> — Add any draft-day rules and procedures here.</p>
    `,
  },
  {
    id: 'transactions',
    title: '4. Transactions',
    html: `
      <p><strong>4.1</strong> — Waiver system: (e.g. FAAB, rolling waivers)</p>
      <p><strong>4.2</strong> — Trade deadline: (configured in league settings)</p>
      <p><strong>4.3</strong> — Add transaction rules and commissioner review policies here.</p>
    `,
  },
  {
    id: 'playoffs',
    title: '5. Playoffs',
    html: `
      <p><strong>5.1</strong> — Playoff teams: (e.g. top 6 teams)</p>
      <p><strong>5.2</strong> — Playoff format: (e.g. single elimination, 3 weeks)</p>
      <p><strong>5.3</strong> — Tiebreaker rules: (e.g. total points scored)</p>
    `,
  },
  {
    id: 'dues-payouts',
    title: '6. Dues & Payouts',
    html: `
      <p><strong>6.1</strong> — Annual dues: (describe buy-in amount and payment method)</p>
      <p><strong>6.2</strong> — Payout structure: (describe how winnings are distributed)</p>
    `,
  },
  {
    id: 'conduct',
    title: '7. Code of Conduct',
    html: `
      <p><strong>7.1</strong> — All league members are expected to act in good faith and maintain competitive integrity.</p>
      <p><strong>7.2</strong> — Commissioner decisions on disputes are final unless overridden by a league vote.</p>
      <p><strong>7.3</strong> — Add your league's specific conduct policies here.</p>
    `,
  },
  {
    id: 'amendments',
    title: '8. Amendments',
    html: `
      <p><strong>8.1</strong> — Rule changes require (e.g. a majority vote of active owners).</p>
      <p><strong>8.2</strong> — Proposed changes should be submitted through the Suggestions page for league review.</p>
    `,
  },
];
