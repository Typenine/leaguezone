# Team Logos

This directory contains team logos for your fantasy football league.

## Directory Structure

Place team logos in the `logos/` subdirectory:

```
public/assets/teams/logos/
  my-team-name.png
  another-team.png
  ...
```

Also place your league logo at:

```
public/assets/league-logo.png
```

This is used in the navbar, login page, and other places as a fallback when no team session is active.

## Naming Convention

Logo files must be named using the URL-slug format of the canonical team name:

1. Lowercase the team name
2. Remove apostrophes, periods, and other special characters
3. Replace spaces with hyphens
4. Use PNG format with a transparent background

## Examples

| Team Name | Logo Filename |
|-----------|--------------|
| My Team Name | `my-team-name.png` |
| The Raptors | `the-raptors.png` |
| Red Pandas | `red-pandas.png` |

## Usage in Code

The utility function in `src/lib/utils/team-utils.ts` automatically builds the path:

```typescript
// Returns /assets/teams/logos/<slug>.png
const logoPath = getTeamLogoPath(teamName);
```
