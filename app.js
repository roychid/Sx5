(() => {
  'use strict';

  const state = {
    league: null,
    fixtures: [],
    route: 'home',
    teamCache: new Map(),
    teamSearch: '',
    playerSearch: '',
    positionFilter: 'ALL',
  };

  const app = document.getElementById('app');
  const teamDialog = document.getElementById('teamDialog');
  const dialogTitle = document.getElementById('dialogTitle');
  const teamDialogBody = document.getElementById('teamDialogBody');

  async function readJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    return response.json();
  }

  async function loadData() {
    const [league, fixtures] = await Promise.all([
      readJson('./data/league.json'),
      readJson('./data/fixtures.json').catch(() => ({ fixtures: [] })),
    ]);
    state.league = league;
    state.fixtures = Array.isArray(fixtures.fixtures) ? fixtures.fixtures : [];
  }

  function escapeHtml(value = '') {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function crestStyle(team) {
    const bg = team.primaryColor || '#1e2b22';
    const fg = team.textColor || '#fff';
    return `background:${escapeHtml(bg)};color:${escapeHtml(fg)}`;
  }

  function teamCard(team) {
    return `
      <button class="team-card" data-team="${escapeHtml(team.slug)}" aria-label="Open ${escapeHtml(team.name)} squad">
        <span class="team-crest" style="${crestStyle(team)}">${escapeHtml(team.code)}</span>
        <span class="team-name">${escapeHtml(team.name)}</span>
        <span class="team-meta">${Number(team.playerCount || 0)} players</span>
      </button>`;
  }

  function teamGrid(teams) {
    if (!teams.length) return `<div class="empty-match"><div class="empty-icon">⌕</div><div><strong>No teams found</strong><span>Try a different search.</span></div></div>`;
    return `<div class="team-grid">${teams.map(teamCard).join('')}</div>`;
  }

  function resolveTeam(id) {
    return state.league.teams.find(team => String(team.id) === String(id));
  }

  function fixtureMarkup() {
    if (!state.fixtures.length) {
      return `
        <div class="empty-match">
          <div class="empty-icon">⚽</div>
          <div>
            <strong>No playable fixtures right now</strong>
            <span>SX5 is still available below. Browse the Premier League and every stored squad.</span>
          </div>
        </div>`;
    }

    return `<div class="fixture-list">${state.fixtures.slice(0, 8).map(fixture => {
      const home = resolveTeam(fixture.homeTeamId);
      const away = resolveTeam(fixture.awayTeamId);
      if (!home || !away) return '';
      const kickoff = fixture.kickoff ? new Date(fixture.kickoff) : null;
      const time = kickoff && !Number.isNaN(kickoff.getTime())
        ? kickoff.toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
        : 'Scheduled';
      return `<article class="fixture-card">
        <div class="fixture-time">${escapeHtml(time)}</div>
        <div class="fixture-teams">
          <div class="fixture-team"><strong>${escapeHtml(home.name)}</strong></div>
          <span class="vs">VS</span>
          <div class="fixture-team"><strong>${escapeHtml(away.name)}</strong></div>
        </div>
      </article>`;
    }).join('')}</div>`;
  }

  function renderHome() {
    const { competition, season, teamCount, playerCount, teams } = state.league;
    app.innerHTML = `
      <section class="hero">
        <p class="eyebrow">SX5 · ${escapeHtml(season.name)}</p>
        <h1>Pick five.<br>Own the match.</h1>
        <p>Build a five-player side from a real fixture and go head-to-head. The new SX5 starts with a clean, static football catalogue and adds live gameplay on top.</p>
        <div class="hero-chips"><span class="chip">5 starters</span><span class="chip">Head-to-head</span><span class="chip">Real players</span></div>
      </section>

      <section class="section">
        <div class="section-head"><div><h2>Playable matches</h2><p>Fixtures are separate from the league catalogue.</p></div></div>
        ${fixtureMarkup()}
      </section>

      <section class="section">
        <div class="section-head"><div><h2>League</h2><p>Always available, even with zero matches.</p></div><button class="section-link" data-route="league">View all</button></div>
        <article class="league-card">
          <div>
            <p>${escapeHtml(competition.countryCode)}</p>
            <h3>${escapeHtml(competition.name)}</h3>
            <p>Season ${escapeHtml(season.name)}</p>
            <div class="stats">
              <div class="stat"><strong>${teamCount}</strong><span>TEAMS</span></div>
              <div class="stat"><strong>${playerCount}</strong><span>PLAYERS</span></div>
            </div>
          </div>
          <div class="league-badge">PL</div>
        </article>
      </section>

      <section class="section">
        <div class="section-head"><div><h2>Premier League clubs</h2><p>Tap a club to open its squad.</p></div></div>
        ${teamGrid(teams)}
      </section>`;
  }

  function renderLeague() {
    const q = state.teamSearch.trim().toLowerCase();
    const teams = state.league.teams.filter(team => !q || team.name.toLowerCase().includes(q) || team.code.toLowerCase().includes(q));
    app.innerHTML = `
      <h1 class="page-title">Premier League</h1>
      <p class="page-subtitle">${escapeHtml(state.league.season.name)} · ${state.league.teamCount} clubs · ${state.league.playerCount} players stored directly in the SX5 repository.</p>
      <div class="search-row"><input id="teamSearch" class="search-input" type="search" placeholder="Search clubs…" value="${escapeHtml(state.teamSearch)}" autocomplete="off"></div>
      ${teamGrid(teams)}`;
    const input = document.getElementById('teamSearch');
    input?.addEventListener('input', event => {
      state.teamSearch = event.target.value;
      renderLeague();
      const next = document.getElementById('teamSearch');
      next?.focus();
      next?.setSelectionRange(state.teamSearch.length, state.teamSearch.length);
    });
  }

  function renderHow() {
    app.innerHTML = `
      <h1 class="page-title">How SX5 works</h1>
      <p class="page-subtitle">This rebuild keeps the football catalogue simple first. Multiplayer and scoring can then be added without mixing them into team/player storage.</p>
      <div class="how-grid">
        <article class="how-card"><span class="how-number">01</span><h3>Choose a fixture</h3><p>When a Premier League match is available, open it from the SX5 home screen.</p></article>
        <article class="how-card"><span class="how-number">02</span><h3>Pick your five</h3><p>Select exactly five eligible players from the two clubs in that fixture.</p></article>
        <article class="how-card"><span class="how-number">03</span><h3>Battle</h3><p>Your five go head-to-head against another user's five for the same real match.</p></article>
        <article class="how-card"><span class="how-number">04</span><h3>Score from real events</h3><p>Goals, assists and other match events feed the scoring layer. That layer belongs on a backend, not inside the static catalogue.</p></article>
      </div>`;
  }

  function render() {
    document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.route === state.route));
    if (!state.league) return;
    if (state.route === 'league') return renderLeague();
    if (state.route === 'how') return renderHow();
    renderHome();
  }

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  }

  function positionLabel(player) {
    const detailed = Array.isArray(player.detailedPositions) ? player.detailedPositions.join(' · ') : '';
    return detailed || player.positionGroup || 'Player';
  }

  function renderPlayers(teamDoc) {
    const q = state.playerSearch.trim().toLowerCase();
    const group = state.positionFilter;
    const players = teamDoc.players.filter(player => {
      const matchesSearch = !q || player.name.toLowerCase().includes(q) || (player.shortName || '').toLowerCase().includes(q);
      const matchesGroup = group === 'ALL' || player.positionGroup === group;
      return matchesSearch && matchesGroup;
    });

    return players.length ? `<div class="player-list">${players.map(player => `
      <article class="player-card">
        <div class="player-avatar">${escapeHtml(initials(player.name))}</div>
        <div class="player-name"><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(positionLabel(player))}${player.nationalityAlpha3 ? ` · ${escapeHtml(player.nationalityAlpha3)}` : ''}</span></div>
        <div class="player-number">${player.shirtNumber ?? '—'}</div>
      </article>`).join('')}</div>` : `<div class="empty-match"><div class="empty-icon">⌕</div><div><strong>No players found</strong><span>Change the search or position filter.</span></div></div>`;
  }

  function renderTeamDialog(teamDoc) {
    const team = teamDoc.team;
    dialogTitle.innerHTML = `<div class="dialog-title-wrap"><strong>${escapeHtml(team.name)}</strong><span>${team.playerCount} players</span></div>`;
    teamDialogBody.innerHTML = `
      <section class="team-hero">
        <span class="team-crest" style="${crestStyle(team)}">${escapeHtml(team.code)}</span>
        <div><h2>${escapeHtml(team.name)}</h2><p>Premier League · ${escapeHtml(teamDoc.season.name)}</p></div>
      </section>
      <div class="search-row">
        <input id="playerSearch" class="search-input" type="search" placeholder="Search players…" value="${escapeHtml(state.playerSearch)}" autocomplete="off">
        <select id="positionFilter" class="filter-select" aria-label="Filter by position">
          <option value="ALL">All</option><option value="G">GK</option><option value="D">DEF</option><option value="M">MID</option><option value="F">FWD</option>
        </select>
      </div>
      <div id="playerResults">${renderPlayers(teamDoc)}</div>`;

    const search = document.getElementById('playerSearch');
    const filter = document.getElementById('positionFilter');
    if (filter) filter.value = state.positionFilter;
    search?.addEventListener('input', event => {
      state.playerSearch = event.target.value;
      document.getElementById('playerResults').innerHTML = renderPlayers(teamDoc);
    });
    filter?.addEventListener('change', event => {
      state.positionFilter = event.target.value;
      document.getElementById('playerResults').innerHTML = renderPlayers(teamDoc);
    });
  }

  async function openTeam(slug) {
    try {
      state.playerSearch = '';
      state.positionFilter = 'ALL';
      teamDialog.showModal();
      dialogTitle.innerHTML = `<div class="dialog-title-wrap"><strong>Loading squad…</strong></div>`;
      teamDialogBody.innerHTML = `<section class="loading-screen"><div class="spinner"></div><p>Loading squad…</p></section>`;
      let teamDoc = state.teamCache.get(slug);
      if (!teamDoc) {
        teamDoc = await readJson(`./data/teams/${encodeURIComponent(slug)}.json`);
        state.teamCache.set(slug, teamDoc);
      }
      renderTeamDialog(teamDoc);
    } catch (error) {
      teamDialogBody.innerHTML = `<div class="error-card"><strong>Squad unavailable</strong><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  document.addEventListener('click', event => {
    const routeButton = event.target.closest('[data-route]');
    if (routeButton) {
      state.route = routeButton.dataset.route;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const teamButton = event.target.closest('[data-team]');
    if (teamButton) openTeam(teamButton.dataset.team);
  });

  document.getElementById('closeTeamDialog').addEventListener('click', () => teamDialog.close());
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    try {
      state.teamCache.clear();
      await loadData();
      render();
    } catch (error) {
      app.innerHTML = `<div class="error-card"><strong>SX5 data could not be loaded.</strong><p>${escapeHtml(error.message)}. Run SX5 from a web server, not by double-clicking index.html.</p></div>`;
    }
  });

  (async function boot() {
    try {
      await loadData();
      render();
    } catch (error) {
      app.innerHTML = `<div class="error-card"><strong>SX5 data could not be loaded.</strong><p>${escapeHtml(error.message)}. Run SX5 from a web server, not by double-clicking index.html.</p></div>`;
    }
  })();
})();
