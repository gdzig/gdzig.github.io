Feature: Post summary
  Scenario Outline: Post summary preserves publication and link semantics
    Given the post summary "<variant>" canvas is opened at <width> pixels in "<theme>"
    Then the post summary preserves its semantic list and publication metadata
    And the post summary preserves its title description and author destinations
    And the post summary fits within the viewport

    Examples:
      | variant | width | theme |
      | published | 390 | light |
      | published | 390 | dark |
      | published | 1447 | light |
      | published | 1447 | dark |
      | draft | 390 | light |
      | draft | 390 | dark |
      | draft | 1447 | light |
      | draft | 1447 | dark |
      | scheduled | 390 | light |
      | scheduled | 390 | dark |
      | scheduled | 1447 | light |
      | scheduled | 1447 | dark |
      | no-author-url | 390 | light |
      | no-author-url | 390 | dark |
      | no-author-url | 1447 | light |
      | no-author-url | 1447 | dark |
      | long-title | 390 | light |
      | long-title | 390 | dark |
      | long-title | 1447 | light |
      | long-title | 1447 | dark |
      | no-date | 390 | light |
      | no-date | 390 | dark |
      | no-date | 1447 | light |
      | no-date | 1447 | dark |
