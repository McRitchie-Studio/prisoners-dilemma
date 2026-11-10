# frozen_string_literal: true

require "application_system_test_case"

# [system] Control for task apps-system-tests-reset-window. The browser
# outlives the test, so a window resize leaks into the next test. These two
# run in name order, the order a bad seed can pick: the first leaves the
# window at a phone width, and the second, a desktop test, must still find
# the desktop window. Red without the setup reset in ApplicationSystemTestCase.
class WindowResetSystemTest < ApplicationSystemTestCase
  i_suck_and_my_tests_are_order_dependent!

  test "1 a phone-width resize is left behind" do
    page.driver.browser.manage.window.resize_to(390, 844)
    visit root_path

    assert_operator evaluate_script("window.innerWidth"), :<, 640, "the window took the phone width"
  end

  test "2 the next test starts at the desktop size" do
    visit root_path

    assert_equal DESKTOP_SIZE, page.driver.browser.manage.window.size.to_a
    assert_operator evaluate_script("window.innerWidth"), :>=, 1280, "a desktop test gets a desktop viewport"
  end
end
