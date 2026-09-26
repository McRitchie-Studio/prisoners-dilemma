class ApplicationController < ActionController::Base
  # No allow_browser gate: a public demo should not answer an older browser
  # with a 406. A browser that cannot run module scripts sees the form and a
  # note that the tournament needs JavaScript.

  # Changes to the importmap will invalidate the etag for HTML responses
  stale_when_importmap_changes
end
