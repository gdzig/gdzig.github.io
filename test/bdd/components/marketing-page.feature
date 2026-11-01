Feature: Marketing page composition
  Real Astro compositions preserve desktop variants and fade every mobile hero into a flat reading canvas.

  Scenario Outline: Marketing composition keeps decoration outside responsive reading content
    Given the marketing page story "<story>" at <width> pixels in "<theme>"
    Then the responsive marketing background preserves the "<background>" desktop variant
    And the responsive reading surface fits the viewport

    Examples:
      | story | width | theme | background |
      | fade-light | 1447 | light | fade |
      | pattern-light | 1447 | light | pattern |
      | fade-dark | 1447 | dark | fade |
      | pattern-dark | 1447 | dark | pattern |
      | fade-light | 390 | light | fade |
      | pattern-light | 390 | light | pattern |
      | fade-dark | 390 | dark | fade |
      | pattern-dark | 390 | dark | pattern |
      | fade-light | 576 | light | fade |
      | fade-dark | 576 | dark | fade |
      | pattern-light | 576 | light | pattern |
      | pattern-dark | 576 | dark | pattern |
      | fade-light | 577 | light | fade |
      | fade-dark | 577 | dark | fade |
      | pattern-light | 577 | light | pattern |
      | pattern-dark | 577 | dark | pattern |
      | article-pattern-light | 576 | light | pattern |
      | article-pattern-dark | 576 | dark | pattern |
      | article-pattern-light | 577 | light | pattern |
      | article-pattern-dark | 577 | dark | pattern |
