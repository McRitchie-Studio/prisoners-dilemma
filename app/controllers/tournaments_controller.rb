# The one page: set up a tournament and read its results. The tournament
# itself runs in the browser (app/javascript/tournament.js); the server only
# renders the form.
class TournamentsController < ApplicationController
  DEFAULT_ROUNDS = 200
  DEFAULT_SEED = 2014
  DEFAULT_PAYOFF = { "T" => 5, "R" => 3, "P" => 1, "S" => 0 }.freeze

  # The four answers the visitor's own strategy starts with: Tit for Tat.
  DEFAULT_RULES = { "first" => "C", "cc" => "C", "cd" => "D", "dc" => "C", "dd" => "D" }.freeze

  def show
    @strategies = Strategy.all
  end
end
