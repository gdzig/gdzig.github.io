Feature: Keep a visitor's website theme preference
  A visitor's explicit preference takes priority over the operating system.

  Scenario: A chosen theme survives navigation and reload
    Given the built website at 1447 pixels with system theme "light"
    And a saved website theme preference of "dark"
    When I visit the website home page
    Then the website uses the "dark" theme
    When I choose the "light" website theme
    And I follow the primary navigation link "Blog"
    Then the website uses the "light" theme
    When the operating system switches to the "dark" theme
    And I reload the website
    Then the website uses the "light" theme

  Scenario: Without a saved preference the website follows system changes
    Given the built website at 1447 pixels with system theme "light"
    When I visit the website home page
    Then the website uses the "light" theme
    When the operating system switches to the "dark" theme
    Then the website uses the "dark" theme
