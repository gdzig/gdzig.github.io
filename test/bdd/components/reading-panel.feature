Feature: Reading panel
  Panel chrome must not steal width from the reading column or paint decoration behind prose.

  Scenario Outline: Reading panel preserves its measure and bridges the introduction
    Given the marketing page story "<story>" at <width> pixels in "<theme>"
    Then the reading surface is opaque and fits the viewport
    And the inset panel overlaps the introduction without covering its title
    And the reading column uses the available width up to 65 characters

    Examples:
      | story | width | theme |
      | article-fade-light | 1447 | light |
      | article-pattern-dark | 1447 | dark |
      | article-fade-light | 390 | light |
      | article-pattern-dark | 390 | dark |
      | roomy-panel | 1447 | light |
      | compact-panel | 390 | light |
