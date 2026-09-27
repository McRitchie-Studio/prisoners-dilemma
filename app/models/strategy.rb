# The strategies a visitor can enter, as the page lists them. There is no
# database: this catalog is the whole model. Each key names the function that
# plays it in app/javascript/tournament.js (STRATEGIES); StrategyTest keeps
# the two lists in step.
class Strategy < Data.define(:key, :name, :blurb, :classic)
  alias_method :classic?, :classic

  def self.all = ALL

  def self.classics = ALL.select(&:classic?)

  def self.find(key) = ALL.find { |strategy| strategy.key == key.to_s }

  ALL = [
    Strategy.new("tit_for_tat", "Tit for Tat", "Cooperates first, then copies your last move.", true),
    Strategy.new("always_defect", "Always Defect", "Defects every round, whatever you do.", true),
    Strategy.new("grudger", "Grudger", "Cooperates until you defect once, then never forgives.", true),
    Strategy.new("random", "Random", "Flips a coin each round. Seeded, so the same run repeats.", true),
    Strategy.new("always_cooperate", "Always Cooperate", "Cooperates every round, no matter what.", false),
    Strategy.new("tit_for_two_tats", "Tit for Two Tats", "Forgives one defection; answers two in a row.", false),
    Strategy.new("pavlov", "Pavlov", "Win-stay, lose-shift: repeats a move that paid, switches one that did not.", false),
    Strategy.new("suspicious_tit_for_tat", "Suspicious Tit for Tat", "Tit for Tat that opens with a defection.", false)
  ].freeze
end
