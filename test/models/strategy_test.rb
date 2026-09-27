require "test_helper"

# Unit tier: the catalog the page lists, and its contract with the engine.
class StrategyTest < ActiveSupport::TestCase
  ENGINE = Rails.root.join("app/javascript/tournament.js").read

  test "the four classics the tournament is built around are the default field" do
    assert_equal [ "Tit for Tat", "Always Defect", "Grudger", "Random" ], Strategy.classics.map(&:name)
  end

  test "keys and names are unique" do
    assert_equal Strategy.all.size, Strategy.all.map(&:key).uniq.size
    assert_equal Strategy.all.size, Strategy.all.map(&:name).uniq.size
  end

  test "every strategy on the page is played by the engine, under the same name" do
    engine = ENGINE[/export const STRATEGIES = Object\.freeze\(\{(.*?)^\}\)/m, 1]
    assert engine, "tournament.js should export STRATEGIES"
    played = engine.scan(/^  (\w+): \{\n    name: "([^"]+)"/).to_h

    assert_equal Strategy.all.map(&:key).sort, played.keys.sort
    Strategy.all.each { |strategy| assert_equal strategy.name, played[strategy.key], strategy.key }
  end

  test "find looks a strategy up by key" do
    assert_equal "Grudger", Strategy.find(:grudger).name
    assert_nil Strategy.find("nope")
  end
end
