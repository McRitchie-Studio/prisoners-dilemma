// Unit tier: the tournament engine in app/javascript/tournament.js.
// Run with: node --experimental-detect-module --test test/javascript/*_test.mjs
import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  COOPERATE as C, DEFECT as D, DEFAULT_PAYOFF, STRATEGIES, CUSTOM_PRESETS, MAX_ROUNDS,
  score, payoffProblems, seededRandom, streamSeed, customStrategy, playMatch,
  runTournament, rank, findMatch, clampRounds
} from "../../app/javascript/tournament.js"

// Plays `strategy` against a scripted opponent and returns strategy's moves.
function against(strategy, script, random = seededRandom(1)) {
  const opponent = { name: "script", move: ({ mine }) => script[mine.length] }
  const match = playMatch(strategy, opponent, { rounds: script.length, randomA: random })
  return match.rounds.map((r) => r.moveA).join("")
}

describe("score", () => {
  test("pays T, R, P, S by the four outcomes", () => {
    assert.deepEqual(score(C, C), [ 3, 3 ])
    assert.deepEqual(score(C, D), [ 0, 5 ])
    assert.deepEqual(score(D, C), [ 5, 0 ])
    assert.deepEqual(score(D, D), [ 1, 1 ])
  })

  test("uses a custom payoff", () => {
    const payoff = { T: 7, R: 4, P: 2, S: -1 }
    assert.deepEqual(score(C, D, payoff), [ -1, 7 ])
    assert.deepEqual(score(C, C, payoff), [ 4, 4 ])
  })

  test("rejects a move that is not C or D", () => {
    assert.throws(() => score("X", C), /Unknown moves/)
  })
})

describe("payoffProblems", () => {
  test("the default payoff is a true dilemma", () => {
    assert.deepEqual(payoffProblems(DEFAULT_PAYOFF), [])
  })

  test("names a broken order and alternation that pays", () => {
    assert.match(payoffProblems({ T: 3, R: 5, P: 1, S: 0 })[0], /T > R > P > S/)
    assert.match(payoffProblems({ T: 10, R: 3, P: 1, S: 0 }).join(), /2R should beat/)
    assert.deepEqual(payoffProblems({ T: NaN, R: 3, P: 1, S: 0 }), [ "Every payoff must be a number." ])
  })
})

describe("seeded random", () => {
  test("the same seed gives the same stream, a different seed does not", () => {
    const take = (seed) => { const r = seededRandom(seed); return [ r(), r(), r(), r() ] }
    assert.deepEqual(take(42), take(42))
    assert.notDeepEqual(take(42), take(43))
    for (const x of take(7)) assert.ok(x >= 0 && x < 1)
  })

  test("streams differ by match and side", () => {
    assert.notEqual(streamSeed(1, 0, 1, 0), streamSeed(1, 0, 1, 1))
    assert.notEqual(streamSeed(1, 0, 1, 0), streamSeed(1, 0, 2, 0))
  })
})

describe("classic strategies", () => {
  test("Tit for Tat opens nice, then copies the last move", () => {
    assert.equal(against(STRATEGIES.tit_for_tat, [ D, D, C, D, C ]), "CDDCD")
  })

  test("Always Defect and Always Cooperate never change", () => {
    assert.equal(against(STRATEGIES.always_defect, [ C, C, D ]), "DDD")
    assert.equal(against(STRATEGIES.always_cooperate, [ D, D, D ]), "CCC")
  })

  test("Grudger cooperates until the first defection, then never forgives", () => {
    assert.equal(against(STRATEGIES.grudger, [ C, C, D, C, C, C ]), "CCCDDD")
  })

  test("Tit for Two Tats only answers two defections in a row", () => {
    assert.equal(against(STRATEGIES.tit_for_two_tats, [ D, C, D, D, C, C ]), "CCCCDC")
  })

  test("Pavlov stays after a win, shifts after a loss", () => {
    // Opponent D,D,C,C: Pavlov C (sucker, shift) D (punished, shift) C (reward, stay) C
    assert.equal(against(STRATEGIES.pavlov, [ D, D, C, C ]), "CDCC")
  })

  test("Suspicious Tit for Tat opens with a defection", () => {
    assert.equal(against(STRATEGIES.suspicious_tit_for_tat, [ C, C, D ]), "DCC")
  })

  test("Random follows its seed: same seed, same moves; both moves occur", () => {
    const script = Array(64).fill(C)
    const first = against(STRATEGIES.random, script, seededRandom(99))
    assert.equal(against(STRATEGIES.random, script, seededRandom(99)), first)
    assert.notEqual(against(STRATEGIES.random, script, seededRandom(100)), first)
    assert.match(first, /C/)
    assert.match(first, /D/)
  })
})

describe("custom strategy", () => {
  test("a rule table reproduces Tit for Tat move for move", () => {
    const mine = customStrategy({ name: "Copycat", rules: CUSTOM_PRESETS.tit_for_tat })
    const script = [ D, C, C, D, D, C, D ]
    assert.equal(against(mine, script), against(STRATEGIES.tit_for_tat, script))
    assert.equal(mine.name, "Copycat")
    assert.equal(mine.custom, true)
  })

  test("the Pavlov preset matches the Pavlov classic", () => {
    const mine = customStrategy({ name: "P", rules: CUSTOM_PRESETS.pavlov })
    const script = [ D, D, C, C, D, C, D, D ]
    assert.equal(against(mine, script), against(STRATEGIES.pavlov, script))
  })

  test("each of the four rules answers its own outcome", () => {
    // first D; after (me D, them C) -> C; after (me C, them C) -> D;
    // after (me D, them D) -> C; after (me C, them D) -> C
    const mine = customStrategy({ name: "x", rules: { first: D, cc: D, cd: C, dc: C, dd: C } })
    assert.equal(against(mine, [ C, C, D, D, C ]), "DCDCC")
  })

  test("a blank name becomes Your Fighter; a long one is cut", () => {
    assert.equal(customStrategy({ name: "  ", rules: CUSTOM_PRESETS.tit_for_tat }).name, "Your Fighter")
    assert.equal(customStrategy({ name: "x".repeat(99), rules: CUSTOM_PRESETS.tit_for_tat }).name.length, 40)
  })

  test("refuses a rule that is not C or D", () => {
    assert.throws(() => customStrategy({ name: "x", rules: { ...CUSTOM_PRESETS.pavlov, dd: "maybe" } }), /Rule dd/)
  })
})

describe("playMatch", () => {
  test("logs every round with points and running totals", () => {
    const match = playMatch(STRATEGIES.tit_for_tat, STRATEGIES.always_defect, { rounds: 3 })
    assert.deepEqual(match.rounds, [
      { round: 1, moveA: C, moveB: D, pointsA: 0, pointsB: 5, totalA: 0, totalB: 5 },
      { round: 2, moveA: D, moveB: D, pointsA: 1, pointsB: 1, totalA: 1, totalB: 6 },
      { round: 3, moveA: D, moveB: D, pointsA: 1, pointsB: 1, totalA: 2, totalB: 7 }
    ])
    assert.equal(match.totalA, 2)
    assert.equal(match.totalB, 7)
  })

  test("two nice strategies cooperate every round", () => {
    const match = playMatch(STRATEGIES.tit_for_tat, STRATEGIES.grudger, { rounds: 10 })
    assert.equal(match.totalA, 30)
    assert.equal(match.totalB, 30)
  })
})

describe("runTournament", () => {
  const entrants = (...keys) => keys.map((key) => ({ id: key, strategy: STRATEGIES[key] }))

  test("every pair meets once", () => {
    const t = runTournament(entrants("tit_for_tat", "always_defect", "grudger", "random"), { rounds: 5 })
    assert.equal(t.matches.length, 6)
    const pairs = t.matches.map((m) => [ m.a, m.b ].sort().join("|"))
    assert.equal(new Set(pairs).size, 6)
  })

  test("the classic four at 200 rounds: nice strategies beat Always Defect", () => {
    const t = runTournament(entrants("tit_for_tat", "always_defect", "grudger", "always_cooperate"), { rounds: 200, seed: 1 })
    const by = Object.fromEntries(t.leaderboard.map((row) => [ row.id, row ]))
    // TFT: 600 vs Grudger, 600 vs All-C, 199 vs All-D = 1399
    assert.equal(by.tit_for_tat.total, 1399)
    assert.equal(by.grudger.total, 1399)
    // All-D: 204 + 204 + 1000 = 1408, yet it wins every match it plays
    assert.equal(by.always_defect.total, 1408)
    assert.equal(by.always_defect.wins, 3)
    assert.equal(by.always_cooperate.total, 1200)
    assert.equal(by.tit_for_tat.cooperationRate, (200 + 200 + 1) / 600)
  })

  test("adding Pavlov and TF2T lets the reciprocators overtake Always Defect", () => {
    const t = runTournament(entrants("tit_for_tat", "always_defect", "grudger", "pavlov", "tit_for_two_tats"), { rounds: 200 })
    assert.equal(t.leaderboard.at(-1).id, "always_defect")
  })

  test("the same seed reproduces a tournament with Random in it; the rounds are clamped", () => {
    const field = entrants("random", "tit_for_tat", "pavlov")
    const once = runTournament(field, { rounds: 50, seed: 2014 })
    assert.deepEqual(runTournament(field, { rounds: 50, seed: 2014 }), once)
    assert.notDeepEqual(runTournament(field, { rounds: 50, seed: 2015 }).leaderboard, once.leaderboard)
    assert.equal(runTournament(field, { rounds: 5000 }).rounds, MAX_ROUNDS)
  })

  test("a custom fighter competes and is marked custom", () => {
    const field = [ ...entrants("always_defect"), { id: "custom", strategy: customStrategy({ name: "Mine", rules: CUSTOM_PRESETS.always_cooperate }) } ]
    const t = runTournament(field, { rounds: 10 })
    const mine = t.leaderboard.find((row) => row.id === "custom")
    assert.equal(mine.name, "Mine")
    assert.equal(mine.custom, true)
    assert.equal(mine.total, 0)
  })

  test("needs two strategies", () => {
    assert.throws(() => runTournament(entrants("tit_for_tat"), { rounds: 5 }), /at least two/)
  })
})

describe("rank", () => {
  test("equal totals share a rank, then the count skips", () => {
    const rows = [ [ "a", 5 ], [ "b", 9 ], [ "c", 9 ], [ "d", 1 ] ].map(([ name, total ]) =>
      ({ id: name, name, total, moves: 1, cooperations: 0 }))
    assert.deepEqual(rank(rows).map((r) => [ r.name, r.rank ]), [ [ "b", 1 ], [ "c", 1 ], [ "a", 3 ], [ "d", 4 ] ])
  })
})

describe("findMatch", () => {
  test("returns the match from either side, mirrored", () => {
    const t = runTournament([ { id: "x", strategy: STRATEGIES.tit_for_tat }, { id: "y", strategy: STRATEGIES.always_defect } ], { rounds: 2 })
    const forward = findMatch(t, "x", "y")
    const mirrored = findMatch(t, "y", "x")
    assert.equal(forward.totalA, mirrored.totalB)
    assert.deepEqual(mirrored.rounds[0], { round: 1, moveA: D, moveB: C, pointsA: 5, pointsB: 0, totalA: 5, totalB: 0 })
    assert.equal(findMatch(t, "x", "nobody"), null)
  })
})

describe("clampRounds", () => {
  test("keeps rounds a whole number between 1 and the max", () => {
    assert.equal(clampRounds("12.4"), 12)
    assert.equal(clampRounds(0), 1)
    assert.equal(clampRounds("abc"), 1)
    assert.equal(clampRounds(99999), MAX_ROUNDS)
  })
})
