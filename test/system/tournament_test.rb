require "application_system_test_case"

# System tier: the tournament running in headless Chrome.
class TournamentTest < ApplicationSystemTestCase
  def leaderboard_names
    all("[data-leaderboard] tbody .leaderboard__name span:first-child").map(&:text)
  end

  def leaderboard_row(name)
    find("[data-leaderboard] tbody tr", text: name)
  end

  test "runs the default tournament on arrival: four classics plus your fighter" do
    visit root_path

    assert_selector "[data-leaderboard] tbody tr", count: 5
    assert_equal [ "Always Defect", "Grudger", "Random", "Tit for Tat", "Your Fighter" ].sort, leaderboard_names.sort
    assert_selector "[data-status]", text: /wins with|tie for first/
    assert_selector "[data-summary]", text: "10 matches · 200 rounds each · seed 2014"
    within(leaderboard_row("Your Fighter")) { assert_selector ".tag", text: "yours" }

    # 5 strategies: a 5 x 5 grid with 20 playable cells.
    assert_selector "[data-grid] .grid__cell", count: 20

    # The round table opens on your fighter against Tit for Tat, all cooperation.
    assert_equal "custom", find("[data-match-a]").value
    assert_equal "tit_for_tat", find("[data-match-b]").value
    assert_selector "[data-rounds-table] tbody tr", count: 200
    assert_selector "[data-match-score]", text: "600 – 600"
    assert_selector "[data-strip-a] .pip--c", count: 200
    assert_no_selector "[data-error]", visible: true
  end

  test "picking a grid cell replays that match round by round" do
    visit root_path
    find("[data-grid] .grid__cell[data-a=tit_for_tat][data-b=always_defect]").click

    assert_equal "tit_for_tat", find("[data-match-a]").value
    assert_equal "always_defect", find("[data-match-b]").value
    assert_selector "[data-match-score]", text: "Tit for Tat 199 – 204 Always Defect"
    first_round = find("[data-rounds-table] tbody tr:first-child")
    assert_equal [ "1", "Cooperate", "Defect", "0 – 5", "0 – 5" ], first_round.all("td").map(&:text)
    assert_selector "[data-grid] .grid__cell.is-selected", count: 1
  end

  test "a strategy you write competes, and changing the setup reruns the tournament" do
    visit root_path

    fill_in "Name", with: "Sucker"
    click_on "Always Cooperate"
    fill_in "Rounds per match", with: "10"
    find("#rounds").send_keys(:tab)

    assert_selector "[data-summary]", text: "10 matches · 10 rounds each"
    assert_selector "[data-leaderboard] tbody tr", count: 5
    assert_selector "[data-rounds-table] tbody tr", count: 10
    within(leaderboard_row("Sucker")) { assert_selector ".coop__pct", text: "100%" }

    # Always Defect takes 50 from a 10-round match against an always-cooperator.
    select "Always Defect", from: "match-b"
    assert_selector "[data-match-score]", text: "Sucker 0 – 50 Always Defect"
  end

  test "the field can grow and shrink, and needs two strategies" do
    visit root_path

    check "entrant-pavlov"
    assert_selector "[data-leaderboard] tbody tr", count: 6

    find("#custom-enabled", visible: :all).uncheck
    %w[tit_for_tat always_defect grudger pavlov].each { |key| uncheck "entrant-#{key}" }
    assert_selector "[data-error]", text: "Choose at least two strategies"
    assert_no_selector "[data-leaderboard]", visible: true

    check "entrant-grudger"
    assert_selector "[data-leaderboard] tbody tr", count: 2
    assert_no_selector "[data-error]", visible: true
  end

  test "the address carries the setup, so a link replays the same tournament" do
    visit root_path(field: "tit_for_tat,random", rounds: 25, seed: 7, me: "off")

    assert_selector "[data-summary]", text: "1 match · 25 rounds each · seed 7"
    assert_equal [ "Random", "Tit for Tat" ].sort, leaderboard_names.sort
    first_score = find("[data-match-score]").text

    click_on "New seed"
    assert_no_selector "[data-summary]", text: "seed 7"
    assert_match(/seed=(?!7\b)\d+/, current_url)

    visit root_path(field: "tit_for_tat,random", rounds: 25, seed: 7, me: "off")
    assert_selector "[data-match-score]", text: first_score
  end

  test "warns when the payoffs stop being a dilemma, but still runs" do
    visit root_path
    fill_in "payoff-T", with: "10"
    find("#payoff-T").send_keys(:tab)

    assert_selector "[data-payoff-warning]", text: "2R should beat T + S"
    assert_selector "[data-leaderboard] tbody tr", count: 5
  end
end
