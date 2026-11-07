Feature: SectionHeading production marketing component
  Scenario Outline: Showcase section heading preserves hierarchy and wraps
    Given the showcase heading "<variant>" canvas is opened at <width> pixels in "<theme>"
    Then the showcase heading retains its title association and description
    And the showcase component fits the viewport

    Examples:
      | variant | width | theme |
      | games | 390 | light |
      | games | 1447 | light |
      | games | 390 | dark |
      | games | 1447 | dark |
      | long | 390 | light |
      | long | 1447 | light |
      | long | 390 | dark |
      | long | 1447 | dark |
