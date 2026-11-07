Feature: Reading panel
  Desktop panel chrome and the flat mobile canvas preserve the reading column without decoration behind prose.

  Scenario Outline: Reading panel preserves its measure and bridges the introduction
    Given the marketing page story "<story>" at <width> pixels in "<theme>"
    Then the responsive reading surface fits the viewport
    And the responsive reading panel follows the introduction without covering its title
    And the reading column uses the available width up to 65 characters

    Examples:
      | story | width | theme |
      | article-fade-light | 1447 | light |
      | article-pattern-dark | 1447 | dark |
      | article-fade-light | 390 | light |
      | article-pattern-dark | 390 | dark |
      | article-fade-light | 576 | light |
      | article-pattern-dark | 576 | dark |
      | article-fade-light | 768 | light |
      | article-pattern-dark | 768 | dark |
      | roomy-panel | 1447 | light |
      | compact-panel | 390 | light |
      | article-pattern-light | 576 | light |
      | article-pattern-light | 577 | light |
      | article-pattern-dark | 577 | dark |
      | article-fade-dark | 576 | dark |
      | article-fade-dark | 577 | dark |
      | article-fade-light | 577 | light |
