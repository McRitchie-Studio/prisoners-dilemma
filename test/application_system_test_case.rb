require "test_helper"

class ApplicationSystemTestCase < ActionDispatch::SystemTestCase
  DESKTOP_SIZE = [ 1400, 1000 ].freeze
  driven_by :selenium, using: :headless_chrome, screen_size: DESKTOP_SIZE

  # The browser outlives the test, so a window resize leaks into whichever test
  # runs next. Every system test starts at the desktop size the case is driven
  # at (task apps-system-tests-reset-window; the same leak turned
  # commercial-welding red under one seed).
  setup { page.driver.browser.manage.window.resize_to(*DESKTOP_SIZE) }
end
