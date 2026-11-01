Feature: Page introduction
  Compact branded introductions retain sentence-case article titles and usable mobile navigation spacing.

  Scenario Outline: Page introduction has one readable title in its intended treatment
    Given the marketing page story "<story>" at <width> pixels in "<theme>"
    Then the introduction title uses "<treatment>" treatment without overflow
    And the responsive reading panel follows the introduction without covering its title

    Examples:
      | story | width | theme | treatment |
      | fade-light | 1447 | light | uppercase |
      | pattern-dark | 390 | dark | uppercase |
      | article-fade-light | 1447 | light | none |
      | article-pattern-dark | 390 | dark | none |
      | long-article-title | 390 | light | none |
      | article-pattern-light | 576 | light | none |
      | article-pattern-dark | 576 | dark | none |
      | article-pattern-light | 577 | light | none |
      | article-pattern-dark | 577 | dark | none |
