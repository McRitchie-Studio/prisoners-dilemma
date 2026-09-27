require "test_helper"

# Integration tier: the page as the server renders it, before any script runs.
class TournamentsControllerTest < ActionDispatch::IntegrationTest
  test "/up answers 200 with no database" do
    get rails_health_check_path
    assert_response :success
  end

  test "the home page is the tournament" do
    get root_path
    assert_response :success
    assert_select "title", "Prisoner's Dilemma Tournament"
    assert_select "h1", "Prisoner's Dilemma Tournament"
    assert_select "html[lang=en]"
  end

  test "lists every strategy, the four classics checked" do
    get root_path

    assert_select "[data-tournament-form] input[type=checkbox][data-entrant]", Strategy.all.size
    Strategy.all.each do |strategy|
      assert_select "label[for=entrant-#{strategy.key}]", text: /#{Regexp.escape(strategy.name)}/
      checked = strategy.classic? ? "[checked]" : ":not([checked])"
      assert_select "input#entrant-#{strategy.key}[value=#{strategy.key}]#{checked}"
    end
  end

  test "the visitor's own strategy starts as Tit for Tat, entered" do
    get root_path

    assert_select "input#custom-enabled[checked]"
    assert_select "input#custom-name[value='Your Fighter'][maxlength='40']"
    TournamentsController::DEFAULT_RULES.each do |rule, move|
      assert_select "fieldset.rule[data-rule=#{rule}]" do
        assert_select "legend", TournamentsHelper::RULE_LABELS.fetch(rule)
        assert_select "input[type=radio][name='rules[#{rule}]']", 2
        assert_select "input[type=radio][name='rules[#{rule}]'][value=#{move}][checked]"
      end
    end
    assert_select "button[data-preset]", 4
  end

  test "rounds, payoffs and seed start at the standard values" do
    get root_path

    assert_select "input#rounds[type=number][value='200'][min='1'][max='1000']"
    { "T" => 5, "R" => 3, "P" => 1, "S" => 0 }.each do |key, value|
      assert_select "input#payoff-#{key}[type=number][value='#{value}']"
    end
    assert_select "input#seed[value='2014']"
  end

  test "results have a live status and hidden panels until the script runs" do
    get root_path

    assert_select "[data-status][role=status][aria-live=polite] noscript"
    assert_select "[data-results-body][hidden]", 3
    assert_select "table[data-leaderboard] tbody"
    assert_select "table[data-rounds-table] tbody"
  end

  test "credits the 2014 original" do
    get root_path
    assert_select "footer a[href='https://github.com/amcritchie/prisoners-dilemma-tournament']"
  end

  test "sets no cookie and a strict content security policy with a nonce on the import map" do
    get root_path

    assert_nil response.headers["set-cookie"], "the page keeps no session"
    assert_select "meta[name=csrf-token]", 0

    policy = response.headers["content-security-policy"]
    assert_includes policy, "default-src 'self'"
    assert_includes policy, "object-src 'none'"
    assert_includes policy, "frame-ancestors 'none'"
    nonce = policy[/script-src 'self' 'nonce-([^']+)'/, 1]
    assert nonce, "script-src should carry a nonce"
    assert_select "script[type=importmap][nonce=?]", nonce
  end
end
