// The page: reads the setup form, runs the tournament (tournament.js) and
// draws the leaderboard, the head-to-head grid and the round-by-round table.
// The setup also lives in the address (?rounds=...&seed=...), so a link
// replays the same tournament.
import {
  STRATEGIES, CUSTOM_PRESETS, RULE_KEYS, COOPERATE,
  customStrategy, runTournament, findMatch, payoffProblems, clampRounds
} from "tournament"

const CUSTOM_ID = "custom"
const PAYOFF_KEYS = [ "T", "R", "P", "S" ]

export function startTournamentPage(root = document.querySelector("[data-tournament]")) {
  if (!root) return
  const page = new TournamentPage(root)
  page.restoreFromUrl(window.location.search)
  page.run({ keepUrl: true })
  return page
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag)
  for (const [ key, value ] of Object.entries(attrs)) {
    if (value === false || value == null) continue
    if (key === "class") node.className = value
    else if (key === "text") node.textContent = value
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value)
    else node.setAttribute(key, value === true ? "" : value)
  }
  for (const child of children) if (child != null) node.append(child)
  return node
}

const moveChip = (move) =>
  el("span", { class: `move move--${move.toLowerCase()}`, text: move === COOPERATE ? "Cooperate" : "Defect" })

const formatNumber = (n) => n.toLocaleString("en-US")
const plural = (n, one, many) => `${formatNumber(n)} ${n === 1 ? one : many}`

class TournamentPage {
  constructor(root) {
    this.root = root
    this.form = root.querySelector("[data-tournament-form]")
    this.q = (selector) => root.querySelector(selector)
    this.qa = (selector) => [ ...root.querySelectorAll(selector) ]
    this.tournament = null
    this.pendingRun = null

    this.form.addEventListener("submit", (event) => { event.preventDefault(); this.run() })
    this.form.addEventListener("input", (event) => this.onInput(event))
    this.form.addEventListener("change", (event) => this.onInput(event))

    this.q("[data-new-seed]").addEventListener("click", () => {
      this.q("[data-seed]").value = 1 + Math.floor(Math.random() * 999_999)
      this.run()
    })
    for (const button of this.qa("[data-preset]")) {
      button.addEventListener("click", () => this.applyPreset(button.dataset.preset))
    }
    this.q("[data-match-a]").addEventListener("change", () => this.showMatch())
    this.q("[data-match-b]").addEventListener("change", () => this.showMatch())
  }

  onInput(event) {
    const target = event.target
    if (target.matches("[data-rounds-range]")) this.q("[data-rounds]").value = target.value
    if (target.matches("[data-rounds]") && event.type === "change") {
      target.value = clampRounds(target.value)
      this.q("[data-rounds-range]").value = Math.min(500, target.value)
    }
    if (target.matches("[data-match-a], [data-match-b]")) return
    this.syncCustomPanel()
    clearTimeout(this.pendingRun)
    this.pendingRun = setTimeout(() => this.run(), 120)
  }

  syncCustomPanel() {
    const enabled = this.q("[data-custom-enabled]").checked
    this.q(".panel--fighter").classList.toggle("is-off", !enabled)
  }

  applyPreset(key) {
    const rules = CUSTOM_PRESETS[key]
    for (const rule of [ "first", ...RULE_KEYS ]) {
      const input = this.form.querySelector(`input[name="rules[${rule}]"][value="${rules[rule]}"]`)
      input.checked = true
    }
    this.q("[data-custom-enabled]").checked = true
    this.syncCustomPanel()
    this.run()
  }

  // ---- The setup, read from and written to the form ----------------------

  readSetup() {
    const rules = {}
    for (const rule of [ "first", ...RULE_KEYS ]) {
      rules[rule] = this.form.querySelector(`input[name="rules[${rule}]"]:checked`)?.value
    }
    const payoff = {}
    for (const key of PAYOFF_KEYS) {
      const raw = this.q(`[data-payoff="${key}"]`).value
      payoff[key] = raw === "" ? NaN : Number(raw)
    }
    return {
      entrants: this.qa("[data-entrant]").filter((box) => box.checked).map((box) => box.value),
      custom: {
        enabled: this.q("[data-custom-enabled]").checked,
        name: this.q("[data-custom-name]").value,
        rules
      },
      rounds: clampRounds(this.q("[data-rounds]").value),
      seed: Math.max(1, Math.round(Number(this.q("[data-seed]").value)) || 1),
      payoff
    }
  }

  restoreFromUrl(search) {
    const params = new URLSearchParams(search)
    if (params.has("field")) {
      const keys = params.get("field").split(",")
      for (const box of this.qa("[data-entrant]")) box.checked = keys.includes(box.value)
    }
    if (params.has("rounds")) {
      const rounds = clampRounds(params.get("rounds"))
      this.q("[data-rounds]").value = rounds
      this.q("[data-rounds-range]").value = Math.min(500, rounds)
    }
    if (params.has("seed")) this.q("[data-seed]").value = Math.max(1, Math.round(Number(params.get("seed"))) || 1)
    if (params.has("payoff")) {
      const values = params.get("payoff").split(",").map(Number)
      PAYOFF_KEYS.forEach((key, i) => { if (Number.isFinite(values[i])) this.q(`[data-payoff="${key}"]`).value = values[i] })
    }
    if (params.has("me")) {
      const me = params.get("me")
      this.q("[data-custom-enabled]").checked = me !== "off"
      if (/^[CD]{5}$/.test(me)) {
        [ "first", ...RULE_KEYS ].forEach((rule, i) => {
          this.form.querySelector(`input[name="rules[${rule}]"][value="${me[i]}"]`).checked = true
        })
      }
    }
    if (params.has("name")) this.q("[data-custom-name]").value = params.get("name").slice(0, 40)
    this.syncCustomPanel()
  }

  writeUrl(setup) {
    const params = new URLSearchParams()
    params.set("field", setup.entrants.join(","))
    params.set("rounds", setup.rounds)
    params.set("seed", setup.seed)
    params.set("payoff", PAYOFF_KEYS.map((key) => setup.payoff[key]).join(","))
    if (setup.custom.enabled) {
      params.set("me", [ "first", ...RULE_KEYS ].map((rule) => setup.custom.rules[rule]).join(""))
      params.set("name", setup.custom.name)
    } else {
      params.set("me", "off")
    }
    history.replaceState(null, "", `${window.location.pathname}?${params}`)
  }

  // ---- Running --------------------------------------------------------------

  run({ keepUrl = false } = {}) {
    clearTimeout(this.pendingRun)
    const setup = this.readSetup()
    const entrants = setup.entrants.map((key) => {
      if (!STRATEGIES[key]) throw new Error(`No strategy plays "${key}"`)
      return { id: key, strategy: STRATEGIES[key] }
    })
    if (setup.custom.enabled) {
      entrants.push({ id: CUSTOM_ID, strategy: customStrategy({ name: setup.custom.name, rules: setup.custom.rules }) })
    }

    const problems = payoffProblems(setup.payoff)
    const warning = this.q("[data-payoff-warning]")
    const badNumbers = !PAYOFF_KEYS.every((key) => Number.isFinite(setup.payoff[key]))
    warning.hidden = problems.length === 0
    warning.textContent = problems.length ? `Not a true dilemma: ${problems.join(" ")}` : ""

    if (entrants.length < 2) return this.fail("Choose at least two strategies to hold a tournament.")
    if (badNumbers) return this.fail("Every payoff needs a number.")

    if (!keepUrl || window.location.search) this.writeUrl(setup)
    this.setup = setup
    this.tournament = runTournament(entrants, setup)
    this.render()
  }

  fail(message) {
    this.tournament = null
    const error = this.q("[data-error]")
    error.textContent = message
    error.hidden = false
    for (const body of this.qa("[data-results-body]")) body.hidden = true
    this.q("[data-status]").textContent = ""
  }

  // ---- Drawing --------------------------------------------------------------

  render() {
    const t = this.tournament
    this.q("[data-error]").hidden = true
    for (const body of this.qa("[data-results-body]")) body.hidden = false

    const leader = t.leaderboard[0]
    const tied = t.leaderboard.filter((row) => row.rank === 1)
    const winner = tied.length > 1 ? `${tied.map((row) => row.name).join(" and ")} tie for first` : `${leader.name} wins`
    this.q("[data-status]").textContent =
      `${winner} with ${formatNumber(leader.total)} points. ${t.leaderboard.length} strategies, ${plural(t.matches.length, "match", "matches")} of ${plural(t.rounds, "round", "rounds")}.`
    this.q("[data-summary]").textContent = `${plural(t.matches.length, "match", "matches")} · ${t.rounds} rounds each · seed ${t.seed}`

    this.renderLeaderboard()
    this.renderGrid()
    this.fillMatchPickers()
    this.showMatch()
  }

  renderLeaderboard() {
    const t = this.tournament
    const best = t.payoff.T
    const rows = t.leaderboard.map((row) => el("tr", { class: row.rank === 1 ? "is-leader" : null, "data-row": row.id },
      el("td", { class: "num rank" }, el("span", { class: `rank-badge rank-badge--${Math.min(row.rank, 4)}`, text: row.rank })),
      el("th", { scope: "row", class: "leaderboard__name" },
        el("span", { text: row.name }),
        row.custom ? el("span", { class: "tag", text: "yours" }) : null),
      el("td", { class: "num strong", text: formatNumber(row.total) }),
      el("td", { class: "num", text: row.average.toFixed(2), title: `out of ${best} possible` }),
      el("td", { class: "num mono", text: `${row.wins}-${row.ties}-${row.losses}` }),
      el("td", { class: "coop" },
        meter(row.cooperationRate),
        el("span", { class: "coop__pct", text: `${Math.round(row.cooperationRate * 100)}%` }))
    ))
    this.q("[data-leaderboard] tbody").replaceChildren(...rows)
  }

  renderGrid() {
    const t = this.tournament
    const order = t.leaderboard
    const perRoundMax = Math.max(t.payoff.T, t.payoff.R, t.payoff.P, t.payoff.S)
    const perRoundMin = Math.min(t.payoff.T, t.payoff.R, t.payoff.P, t.payoff.S)

    const head = el("thead", {}, el("tr", {},
      el("th", { scope: "col", class: "grid__corner" }, el("span", { class: "visually-hidden", text: "Strategy" })),
      ...order.map((col) => el("th", { scope: "col", class: "grid__col", title: col.name },
        el("span", { text: initials(col.name) })))
    ))

    const body = el("tbody", {}, ...order.map((row) => el("tr", {},
      el("th", { scope: "row", class: "grid__row", text: row.name }),
      ...order.map((col) => {
        if (row.id === col.id) return el("td", { class: "grid__self", "aria-label": "no match" }, "")
        const match = findMatch(t, row.id, col.id)
        const share = (match.totalA / t.rounds - perRoundMin) / ((perRoundMax - perRoundMin) || 1)
        const verdict = match.totalA > match.totalB ? "won" : match.totalA < match.totalB ? "lost" : "tied"
        const button = el("button", {
          type: "button",
          class: `grid__cell grid__cell--${verdict}`,
          "aria-label": `${row.name} scored ${match.totalA} against ${col.name} (${match.totalB}), ${verdict}`,
          "data-a": row.id,
          "data-b": col.id,
          onclick: () => this.selectMatch(row.id, col.id)
        }, el("span", { text: formatNumber(match.totalA) }))
        button.style.setProperty("--share", share.toFixed(3))
        return el("td", {}, button)
      })
    )))
    this.q("[data-grid]").replaceChildren(head, body)
  }

  fillMatchPickers() {
    const t = this.tournament
    const a = this.q("[data-match-a]")
    const b = this.q("[data-match-b]")
    const previous = [ a.value, b.value ]
    const options = () => t.leaderboard.map((row) => el("option", { value: row.id, text: row.name }))
    a.replaceChildren(...options())
    b.replaceChildren(...options())

    const ids = t.leaderboard.map((row) => row.id)
    let [ first, second ] = previous
    if (!ids.includes(first) || !ids.includes(second) || first === second) {
      first = ids.includes(CUSTOM_ID) ? CUSTOM_ID : ids[0]
      second = ids.find((id) => id !== first && id === "tit_for_tat") ?? ids.find((id) => id !== first)
    }
    a.value = first
    b.value = second
  }

  selectMatch(first, second) {
    this.q("[data-match-a]").value = first
    this.q("[data-match-b]").value = second
    this.showMatch()
    this.q("[data-match-score]").scrollIntoView({ behavior: "smooth", block: "nearest" })
  }

  showMatch() {
    const t = this.tournament
    if (!t) return
    const a = this.q("[data-match-a]").value
    const b = this.q("[data-match-b]").value
    const nameOf = (id) => t.leaderboard.find((row) => row.id === id).name
    const score = this.q("[data-match-score]")
    const table = this.q("[data-rounds-table] tbody")
    const strips = [ this.q("[data-strip-a]"), this.q("[data-strip-b]") ]

    for (const cell of this.qa(".grid__cell")) {
      cell.classList.toggle("is-selected", cell.dataset.a === a && cell.dataset.b === b)
    }

    if (a === b) {
      score.textContent = "Pick two different strategies to see their match."
      table.replaceChildren()
      strips.forEach((strip) => strip.replaceChildren())
      return
    }

    const match = findMatch(t, a, b)
    const mutual = match.rounds.filter((r) => r.moveA === COOPERATE && r.moveB === COOPERATE).length
    score.replaceChildren(
      el("strong", { text: nameOf(a) }), ` ${formatNumber(match.totalA)} – ${formatNumber(match.totalB)} `,
      el("strong", { text: nameOf(b) }),
      el("span", { class: "match-score__note", text: ` · both cooperated in ${mutual} of ${t.rounds} rounds` })
    )
    this.q("[data-col-a]").textContent = nameOf(a)
    this.q("[data-col-b]").textContent = nameOf(b)

    strips[0].replaceChildren(...match.rounds.map((r) => el("span", { class: `pip pip--${r.moveA.toLowerCase()}` })))
    strips[1].replaceChildren(...match.rounds.map((r) => el("span", { class: `pip pip--${r.moveB.toLowerCase()}` })))
    strips.forEach((strip) => strip.style.setProperty("--rounds", t.rounds))

    table.replaceChildren(...match.rounds.map((r) => el("tr", {},
      el("td", { class: "num mono", text: r.round }),
      el("td", {}, moveChip(r.moveA)),
      el("td", {}, moveChip(r.moveB)),
      el("td", { class: "num mono", text: `${r.pointsA} – ${r.pointsB}` }),
      el("td", { class: "num mono strong", text: `${formatNumber(r.totalA)} – ${formatNumber(r.totalB)}` })
    )))
  }
}

function meter(fraction) {
  const bar = el("span", { class: "meter", "aria-hidden": "true" }, el("span", { class: "meter__fill" }))
  bar.style.setProperty("--fill", fraction.toFixed(3))
  return bar
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).map((word) => word[0]).join("").slice(0, 4).toUpperCase()
}
