# prisoners-dilemma

A prisoner's dilemma tournament in the browser: prisoners-dilemma.mcritchie.studio

Pick a field of strategies, write your own, and run an iterated prisoner's
dilemma round robin. The page shows a leaderboard, a head-to-head grid and every
match round by round. There are no accounts, no cookies and no database.

A rebuild of Alex McRitchie's 2014 Rails 4 app
[amcritchie/prisoners-dilemma-tournament](https://github.com/amcritchie/prisoners-dilemma-tournament),
where players added a "fighter" as Ruby code that the server ran. This version is a
fresh build rather than a port: the tournament runs client-side, and a fighter is a
rule table instead of code. It was built as a showcase for the McRitchie Studio
App Builder (`/build`).

## How it works

| Piece | Where |
|-------|-------|
| The engine: strategies, payoffs, seeded Random, matches, round robin, ranking | `app/javascript/tournament.js`, a plain ES module with no DOM |
| The page's behavior: read the form, run, draw the results, keep the setup in the URL | `app/javascript/tournament_ui.js` |
| The strategy catalog the page lists (key, name, blurb, classic) | `app/models/strategy.rb`, a `Data` class; there is no database |
| The page | `app/views/tournaments/show.html.erb` at `/` |
| The look | `app/assets/stylesheets/application.css`, plain CSS, light and dark |
| Health check | `/up` |

- **The field:** eight strategies. The four classics, Tit for Tat, Always Defect,
  Grudger and Random, are in by default. Always Cooperate, Tit for Two Tats,
  Pavlov and Suspicious Tit for Tat can join.
- **Your fighter:** a first move, then Cooperate or Defect for each way the last
  round can go (both cooperated, I was betrayed, I betrayed, both defected). Any
  memory-one strategy fits; presets start you from Tit for Tat, Pavlov, Always
  Cooperate or Always Defect.
- **The rules:** 1 to 1,000 rounds per match (default 200), the payoffs T, R, P, S
  (default 5, 3, 1, 0; the page warns when they stop being a dilemma), and a seed.
- **Deterministic:** Random draws from a seeded generator (Mulberry32), one stream
  per player per match, so the same seed replays the same tournament.
- **Shareable:** the setup is kept in the address
  (`?field=tit_for_tat,grudger&rounds=200&seed=2014&payoff=5,3,1,0&me=CCDCD&name=...`),
  so a link replays the same run.
- **Results:** the tournament runs on arrival and again on every change. The
  leaderboard ranks by total points (ties share a rank) with points per round,
  wins, ties and losses, and how often each one cooperated. A head-to-head cell
  opens that match: a strip of every move and a round-by-round table.
- **Security:** a strict Content Security Policy (everything from `self`, a
  per-request nonce on the import map). No session, so no cookie and no CSRF tag.
  A visitor's name is only ever set as text.

To add a strategy: add its function to `STRATEGIES` in `tournament.js` and its row
to `Strategy::ALL`. `StrategyTest` fails until the keys and names agree.

## Develop

```bash
bundle install
bin/rails server -p 3811
node --experimental-detect-module --test test/javascript/*_test.mjs   # the engine (unit)
bin/rails test               # catalog + the page as rendered + production SSL
bin/rails test:system        # the tournament in headless Chrome
bin/ci                       # everything CI runs
```

## Deploy

Heroku app `mcr-prisoners-dilemma` on the McRitchie Studio account, `heroku/ruby`
buildpack, stack heroku-26, no add-ons, one Eco `web` dyno (`Procfile`, no
release phase since there is nothing to migrate). There is no
`config/credentials.yml.enc`; production reads `SECRET_KEY_BASE` from the
environment. Production forces HTTPS: the Heroku router reports the visitor's
scheme in `X-Forwarded-Proto`, so `assume_ssl` stays off and plain `http://` gets
a 301, except `/up`, which answers on either scheme (`ProductionSslTest` boots
production to prove it).

Branches follow the McRitchie ladder: feature PRs target `accepted`, which is
promoted to `release` and then `main`. CI runs on every pull request and on
pushes to `accepted`, `release` and `main`.
