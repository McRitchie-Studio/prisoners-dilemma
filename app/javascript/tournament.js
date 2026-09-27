// The tournament engine: strategies, payoffs, matches and the round robin.
// Pure functions with no DOM, so node:test can run them (test/javascript/)
// and the page (tournament_ui.js) can call them the same way.

export const COOPERATE = "C"
export const DEFECT = "D"

// The standard payoffs (Axelrod, 1980): Temptation to defect, Reward for
// mutual cooperation, Punishment for mutual defection, Sucker's payoff.
export const DEFAULT_PAYOFF = Object.freeze({ T: 5, R: 3, P: 1, S: 0 })

export const MAX_ROUNDS = 1000

// Points for one round, as [mine, theirs].
export function score(mine, theirs, payoff = DEFAULT_PAYOFF) {
  if (mine === COOPERATE && theirs === COOPERATE) return [ payoff.R, payoff.R ]
  if (mine === COOPERATE && theirs === DEFECT) return [ payoff.S, payoff.T ]
  if (mine === DEFECT && theirs === COOPERATE) return [ payoff.T, payoff.S ]
  if (mine === DEFECT && theirs === DEFECT) return [ payoff.P, payoff.P ]
  throw new Error(`Unknown moves: ${mine}, ${theirs}`)
}

// A dilemma only when defecting always pays more for you (T > R, P > S),
// mutual cooperation beats mutual defection (R > P), and taking turns
// exploiting each other does not beat cooperating (2R > T + S).
export function payoffProblems({ T, R, P, S }) {
  const values = [ T, R, P, S ]
  if (!values.every(Number.isFinite)) return [ "Every payoff must be a number." ]

  const problems = []
  if (!(T > R && R > P && P > S)) problems.push("The order should be T > R > P > S.")
  if (!(2 * R > T + S)) problems.push("2R should beat T + S, or taking turns pays best.")
  return problems
}

// Mulberry32: a tiny seeded generator, so a "Random" player makes the same
// choices every time the same seed runs. Returns floats in [0, 1).
export function seededRandom(seed) {
  let state = seed >>> 0
  return function next() {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// One independent stream per player per match, derived from the tournament
// seed, so adding or removing an entrant never shifts another match's coins.
export function streamSeed(seed, ...parts) {
  let h = (seed >>> 0) ^ 0x9E3779B9
  for (const part of parts) {
    h = Math.imul(h ^ (part >>> 0), 0x85EBCA6B) >>> 0
    h = (h ^ (h >>> 13)) >>> 0
  }
  return h
}

const last = (moves) => moves[moves.length - 1]

// A strategy decides its next move from the history so far:
// move({ mine, theirs, random }) where mine and theirs are arrays of "C"/"D"
// and random() is that player's seeded generator.
export const STRATEGIES = Object.freeze({
  tit_for_tat: {
    name: "Tit for Tat",
    move: ({ theirs }) => theirs.length === 0 ? COOPERATE : last(theirs)
  },
  always_defect: {
    name: "Always Defect",
    move: () => DEFECT
  },
  grudger: {
    name: "Grudger",
    move: ({ theirs }) => theirs.includes(DEFECT) ? DEFECT : COOPERATE
  },
  random: {
    name: "Random",
    move: ({ random }) => random() < 0.5 ? COOPERATE : DEFECT
  },
  always_cooperate: {
    name: "Always Cooperate",
    move: () => COOPERATE
  },
  tit_for_two_tats: {
    name: "Tit for Two Tats",
    move: ({ theirs }) => {
      const n = theirs.length
      return n >= 2 && theirs[n - 1] === DEFECT && theirs[n - 2] === DEFECT ? DEFECT : COOPERATE
    }
  },
  pavlov: {
    name: "Pavlov",
    // Win-stay, lose-shift: keep the last move if they cooperated, else switch.
    move: ({ mine, theirs }) => {
      if (mine.length === 0) return COOPERATE
      if (last(theirs) === COOPERATE) return last(mine)
      return last(mine) === COOPERATE ? DEFECT : COOPERATE
    }
  },
  suspicious_tit_for_tat: {
    name: "Suspicious Tit for Tat",
    move: ({ theirs }) => theirs.length === 0 ? DEFECT : last(theirs)
  }
})

// A strategy the visitor writes: a first move, then an answer for each of
// the four ways the last round can have gone (my move, their move). Every
// "memory-one" strategy fits: Tit for Tat is C, then C D C D.
export const RULE_KEYS = Object.freeze([ "cc", "cd", "dc", "dd" ])

export const CUSTOM_PRESETS = Object.freeze({
  tit_for_tat: { first: "C", cc: "C", cd: "D", dc: "C", dd: "D" },
  pavlov: { first: "C", cc: "C", cd: "D", dc: "D", dd: "C" },
  always_cooperate: { first: "C", cc: "C", cd: "C", dc: "C", dd: "C" },
  always_defect: { first: "D", cc: "D", cd: "D", dc: "D", dd: "D" }
})

const isMove = (value) => value === COOPERATE || value === DEFECT

export function customStrategy({ name, rules }) {
  const cleanName = String(name ?? "").trim().slice(0, 40) || "Your Fighter"
  for (const key of [ "first", ...RULE_KEYS ]) {
    if (!isMove(rules[key])) throw new Error(`Rule ${key} must be C or D`)
  }
  const table = { ...rules }
  return {
    name: cleanName,
    custom: true,
    move: ({ mine, theirs }) => {
      if (mine.length === 0) return table.first
      return table[(last(mine) + last(theirs)).toLowerCase()]
    }
  }
}

// Plays one match of `rounds` rounds and returns every round plus totals.
export function playMatch(a, b, { rounds, payoff = DEFAULT_PAYOFF, randomA, randomB }) {
  const movesA = []
  const movesB = []
  const log = []
  let totalA = 0
  let totalB = 0

  for (let round = 1; round <= rounds; round++) {
    const moveA = a.move({ mine: movesA, theirs: movesB, random: randomA })
    const moveB = b.move({ mine: movesB, theirs: movesA, random: randomB })
    if (!isMove(moveA) || !isMove(moveB)) throw new Error(`Bad move in round ${round}`)

    const [ pointsA, pointsB ] = score(moveA, moveB, payoff)
    movesA.push(moveA)
    movesB.push(moveB)
    totalA += pointsA
    totalB += pointsB
    log.push({ round, moveA, moveB, pointsA, pointsB, totalA, totalB })
  }

  return { rounds: log, totalA, totalB }
}

export function clampRounds(value) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return 1
  return Math.min(MAX_ROUNDS, Math.max(1, n))
}

// Round robin: every entrant meets every other entrant once. Entrants are
// { id, strategy } where strategy has a name and a move function.
export function runTournament(entrants, { rounds, payoff = DEFAULT_PAYOFF, seed = 1 }) {
  if (entrants.length < 2) throw new Error("A tournament needs at least two strategies")
  const n = clampRounds(rounds)

  const rows = new Map(entrants.map((entrant) => [ entrant.id, {
    id: entrant.id,
    name: entrant.strategy.name,
    custom: Boolean(entrant.strategy.custom),
    total: 0,
    wins: 0,
    ties: 0,
    losses: 0,
    cooperations: 0,
    moves: 0
  } ]))

  const matches = []
  for (let i = 0; i < entrants.length; i++) {
    for (let j = i + 1; j < entrants.length; j++) {
      const a = entrants[i]
      const b = entrants[j]
      const result = playMatch(a.strategy, b.strategy, {
        rounds: n,
        payoff,
        randomA: seededRandom(streamSeed(seed, i, j, 0)),
        randomB: seededRandom(streamSeed(seed, i, j, 1))
      })
      matches.push({ a: a.id, b: b.id, ...result })

      const rowA = rows.get(a.id)
      const rowB = rows.get(b.id)
      rowA.total += result.totalA
      rowB.total += result.totalB
      if (result.totalA > result.totalB) { rowA.wins++; rowB.losses++ }
      else if (result.totalA < result.totalB) { rowA.losses++; rowB.wins++ }
      else { rowA.ties++; rowB.ties++ }
      for (const r of result.rounds) {
        if (r.moveA === COOPERATE) rowA.cooperations++
        if (r.moveB === COOPERATE) rowB.cooperations++
      }
      rowA.moves += n
      rowB.moves += n
    }
  }

  return { rounds: n, payoff, seed, leaderboard: rank([ ...rows.values() ]), matches }
}

// Highest total first; equal totals share a rank (1, 2, 2, 4).
export function rank(rows) {
  const sorted = rows
    .map((row) => ({
      ...row,
      average: row.moves ? row.total / row.moves : 0,
      cooperationRate: row.moves ? row.cooperations / row.moves : 0
    }))
    .sort((x, y) => y.total - x.total || x.name.localeCompare(y.name))

  let above = null
  return sorted.map((row, index) => {
    const place = above && above.total === row.total ? above.rank : index + 1
    above = { ...row, rank: place }
    return above
  })
}

// The match between two entrants, oriented so `first` is side A.
export function findMatch(tournament, first, second) {
  for (const match of tournament.matches) {
    if (match.a === first && match.b === second) return match
    if (match.a === second && match.b === first) {
      return {
        a: first,
        b: second,
        totalA: match.totalB,
        totalB: match.totalA,
        rounds: match.rounds.map((r) => ({
          round: r.round,
          moveA: r.moveB,
          moveB: r.moveA,
          pointsA: r.pointsB,
          pointsB: r.pointsA,
          totalA: r.totalB,
          totalB: r.totalA
        }))
      }
    }
  }
  return null
}
