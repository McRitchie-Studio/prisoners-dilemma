# Run by ProductionSslTest under `bin/rails runner -e production`: sends the
# requests Heroku's router forwards (X-Forwarded-Proto says what the visitor
# typed) through the real production middleware stack and prints what came
# back, one JSON object keyed "<proto> <path>".
require "json"

results = [ %w[http /], %w[http /up], %w[https /], %w[https /up] ].to_h do |proto, path|
  env = Rack::MockRequest.env_for("http://prisoners-dilemma.mcritchie.studio#{path}",
    "HTTP_X_FORWARDED_PROTO" => proto, "REMOTE_ADDR" => "10.1.2.3")
  status, headers, body = Rails.application.call(env)
  body.close if body.respond_to?(:close)
  [ "#{proto} #{path}", { "status" => status, "location" => headers["location"], "set_cookie" => headers["set-cookie"] } ]
end

puts JSON.generate(results)
