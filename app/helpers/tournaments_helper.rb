module TournamentsHelper
  RULE_LABELS = {
    "first" => "First move",
    "cc" => "We both cooperated",
    "cd" => "I cooperated, they defected",
    "dc" => "I defected, they cooperated",
    "dd" => "We both defected"
  }.freeze

  # A two-button Cooperate / Defect choice for one rule of the visitor's
  # strategy, as a radio group so it works with a keyboard and a screen reader.
  def move_choice(rule, selected)
    tag.fieldset(class: "rule", data: { rule: rule }) do
      safe_join([
        tag.legend(RULE_LABELS.fetch(rule), class: "rule__label"),
        tag.div(class: "segmented") do
          safe_join(%w[C D].map do |move|
            id = "rule-#{rule}-#{move.downcase}"
            safe_join([
              radio_button_tag("rules[#{rule}]", move, selected == move, id: id, class: "segmented__input"),
              label_tag(id, move == "C" ? "Cooperate" : "Defect", class: "segmented__option segmented__option--#{move.downcase}")
            ])
          end)
        end
      ])
    end
  end
end
