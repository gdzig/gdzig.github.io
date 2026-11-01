Feature: Marketing page composition
  Real Astro compositions let the reviewer compare a fading introduction with a persistent patterned canvas.

  Scenario Outline: Marketing composition keeps decoration outside opaque reading content
    Given the marketing page story "<story>" at <width> pixels in "<theme>"
    Then the marketing background "<background>" is painted beyond the introduction
    And the reading surface is opaque and fits the viewport

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
