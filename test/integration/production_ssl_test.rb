require "test_helper"
require "open3"

# Boots the app in the production environment (a separate process, since the
# test process is already the test environment) and asks it what a visitor on
# plain http:// gets. Heroku terminates TLS at its router and says which scheme
# the visitor used in X-Forwarded-Proto; the app must believe that header
# rather than assume every request is https.
class ProductionSslTest < ActiveSupport::TestCase
  PROBE = Rails.root.join("test/support/production_probe.rb").to_s

  def self.results
    @results ||= begin
      env = { "RAILS_ENV" => "production", "SECRET_KEY_BASE_DUMMY" => "1", "RAILS_LOG_LEVEL" => "fatal" }
      out, err, status = Open3.capture3(env, "bin/rails", "runner", PROBE, chdir: Rails.root.to_s)
      raise "production probe failed: #{err}" unless status.success?
      JSON.parse(out.lines.last)
    end
  end

  test "plain http redirects to https" do
    response = self.class.results["http /"]
    assert_equal 301, response["status"]
    assert_equal "https://prisoners-dilemma.mcritchie.studio/", response["location"]
  end

  test "/up still answers 200 over plain http for health checks" do
    assert_equal 200, self.class.results["http /up"]["status"]
    assert_equal 200, self.class.results["https /up"]["status"]
  end

  test "https serves the tournament without a session cookie" do
    response = self.class.results["https /"]
    assert_equal 200, response["status"]
    assert_nil response["set_cookie"], "the public page should set no cookie"
  end
end
