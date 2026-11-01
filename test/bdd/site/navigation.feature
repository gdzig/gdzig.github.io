Feature: Navigate the GDZig website
  Visitors can reach the blog, showcase, and documentation using the published site.

  Scenario Outline: Primary navigation works on desktop and narrow screens
    Given the built website at <width> pixels with system theme "<theme>"
    When I visit the website home page
    And I follow the primary navigation link "Blog"
    Then I arrive at the website path "/blog/"
    And the marketing page shares the branded shell and "Blog" introduction
    And the blog reading surface follows its responsive treatment
    When I follow the primary navigation link "Showcase"
    Then I arrive at the website path "/showcase/"
    And the marketing page shares the branded shell and "Made with GDZig" introduction
    When I follow the primary navigation link "Docs"
    Then I arrive at the website path "/docs/"
    And the page fits the viewport and has one main heading and landmark

    Examples:
      | width | theme |
      | 390   | light |
      | 390   | dark  |
      | 576   | light |
      | 576   | dark  |
      | 577   | light |
      | 577   | dark  |
      | 1447  | light |
      | 1447  | dark  |

  Scenario Outline: Documentation is reachable without a pointer
    Given the built website at <width> pixels with system theme "light"
    When I visit the website home page
    And I reach documentation using only the keyboard
    Then I arrive at the website path "/docs/"

    Examples:
      | width |
      | 390   |
      | 1447  |
