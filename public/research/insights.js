'use strict';
// Phase 5 decision descriptions reuse the same observed, week-bounded Radar
// signals across public research and authenticated league pages. No forecasts,
// injury assumptions, waiver ownership, or trade prices are inferred here.
(function (root, factory) {
  var make = function (engine) { return factory(engine); };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  if (typeof module === 'object' && module.exports) module.exports = make(require('./opportunities.js'));
  else root.LZDecisions = make(root.LZOpportunities);
})(typeof self !== 'undefined' ? self : this, function (O) {
  function classify(signal) {
    if (!signal || !['rising', 'falling'].includes(signal.direction)) return null;
    var scoring = Number(signal.scoringChange);
    if (!Number.isFinite(scoring) || !Number.isFinite(signal.change)) return null;
    var growing = signal.direction === 'rising';
    var ahead = scoring >= 2;
    var behind = scoring <= -2;
    if (growing && !ahead) return {
      category: 'watch', type: behind ? 'buy-low-watch' : 'breakout-watch',
      label: behind ? 'Production lagging usage' : 'Emerging opportunity',
      heading: behind ? 'More opportunity, fewer fantasy points' : 'Growing opportunity without a matching scoring jump',
      why: behind ? 'His recent workload increased while fantasy scoring fell. That can warrant a closer look, not an assumed rebound.'
        : 'His recent workload increased without a comparable fantasy scoring increase. Monitor whether the role holds.',
      next: 'Check injury reports, schedule and league availability before acting.'
    };
    if (growing) return {
      category: 'momentum', type: 'role-growth',
      label: 'Role gaining momentum', heading: 'Usage and fantasy production both improved',
      why: 'Recent opportunities and fantasy output rose together. The trend is observed, not a projection for next week.',
      next: 'Review whether the usage is sustainable before setting a lineup or trade price.'
    };
    if (!behind) return {
      category: 'risk', type: ahead ? 'scoring-masks-role' : 'role-warning',
      label: ahead ? 'Scoring hides a shrinking role' : 'Opportunity warning',
      heading: ahead ? 'Fantasy production rose as usage fell' : 'Recent opportunities are declining',
      why: ahead ? 'More fantasy points came with fewer opportunities. Check whether unusual efficiency drove the result.'
        : 'Recent usage declined. That matters even if fantasy points have not fallen yet.',
      next: 'Check injuries, depth charts and matchups before changing a roster.'
    };
    return {
      category: 'risk', type: 'role-and-scoring-down',
      label: 'Role and scoring declining', heading: 'Both opportunity and fantasy output decreased',
      why: 'Both workload and fantasy production declined in the most recent two recorded games.',
      next: 'Investigate playing time and recent game context before making a move.'
    };
  }
  function build(data, scoring) {
    if (!data || !Array.isArray(data.players) || !Number.isInteger(data.throughWeek)) return [];
    return O.radar(data, scoring || 'half').map(function (signal) {
      var detail = classify(signal);
      if (!detail) return null;
      // Use observed movement, never score as an asserted win probability.
      var weight = Math.min(80, Math.abs(signal.relativeChange || 0)) +
        Math.min(30, Math.abs(signal.change || 0) * 3) +
        (detail.category === 'watch' ? 8 : 0) -
        (signal.teamChanged ? 12 : 0);
      return Object.assign({}, detail, {
        id: signal.id, name: signal.name, team: signal.team, pos: signal.pos,
        week: signal.week, signal: signal, order: Math.round(weight * 10) / 10,
        context: signal.teamChanged ? 'NFL team changed during this four-game sample; context may be different.' : ''
      });
    }).filter(Boolean).sort(function (a, b) {
      return b.order - a.order || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    });
  }
  return {classify: classify, build: build};
});
