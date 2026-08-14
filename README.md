# SX5 standalone squad builder

Plain HTML + CSS + JavaScript. No framework and no database is required for league/team/player catalogue browsing.

## What this version does

- Uses the SX5 custom 10-point shape as the formation canvas.
- An SX5 squad always contains 5 players.
- The 5 players can be placed on any 5 of the 10 available points.
- Includes a Manchester City vs Arsenal Matchweek 1 demo fixture.
- Loads the Premier League and team squads from repository JSON in `data/`.
- Saves the default season squad to browser localStorage.
- Saves Matchweek 1 changes separately so they do not overwrite the season squad.
- Allows player replacement/removal by clicking a player or empty position.
- Allows player movement with drag and drop on desktop.
- Generates a random five from the repository catalogue.

## Deploy

Deploy this folder as a static site on Cloudflare Pages. `index.html` must be in the deployed root.

Do not open `index.html` directly using `file://` because browsers block local fetches to the JSON files. Use Cloudflare Pages or a local server.
