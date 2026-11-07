Feature: Keep a visitor's website theme preference
  A visitor's explicit preference takes priority over the operating system.

  Rule: A selected theme paints readable landing surfaces, not just a root attribute
    Scenario: A desktop choice survives a round trip and can be reversed
      Given the built website at 1447 pixels with system theme "light"
      And a saved website theme preference of "dark"
      When I visit the website home page
      Then the website uses the "dark" theme
      And the landing page paints readable "dark" surfaces
      When I choose the "light" website theme
      Then the landing page paints readable "light" surfaces
      When I follow the primary navigation link "Blog"
      Then the website uses the "light" theme
      When the operating system switches to the "dark" theme
      And I reload the website
      Then the website uses the "light" theme
      When I return to the website home page through its wordmark
      Then the landing page paints readable "light" surfaces
      When I choose the "dark" website theme
      Then the landing page paints readable "dark" surfaces
      When I follow the primary navigation link "Blog"
      Then the website uses the "dark" theme
      When I return to the website home page through its wordmark
      And I reload the website
      Then the website uses the "dark" theme
      And the landing page paints readable "dark" surfaces

  Rule: System changes repaint the landing page until a preference is saved
    Scenario Outline: Without a saved preference the website follows system changes both ways
      Given the built website at <width> pixels with system theme "light"
      When I visit the website home page
      Then the website uses the "light" theme
      And the landing page paints readable "light" surfaces
      When the operating system switches to the "dark" theme
      Then the website uses the "dark" theme
      And the landing page paints readable "dark" surfaces
      When the operating system switches to the "light" theme
      Then the website uses the "light" theme
      And the landing page paints readable "light" surfaces
      When I reload the website
      Then the landing page paints readable "light" surfaces

      Examples:
        | width |
        | 1447  |
        | 390   |

  Rule: Mobile uses the same saved preference without needing a desktop-only toggle
    Scenario Outline: A saved mobile preference survives reload and a round trip
      Given the built website at 390 pixels with system theme "<system>"
      And a saved website theme preference of "<saved>"
      When I visit the website home page
      Then the website uses the "<saved>" theme
      And the landing page paints readable "<saved>" surfaces
      When I follow the primary navigation link "Blog"
      Then the website uses the "<saved>" theme
      When I return to the website home page through its wordmark
      And I reload the website
      Then the website uses the "<saved>" theme
      And the landing page paints readable "<saved>" surfaces

      Examples:
        | system | saved |
        | dark   | light |
        | light  | dark  |
