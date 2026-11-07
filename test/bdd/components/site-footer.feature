Feature: Shared marketing footer
  Scenario Outline: Footer preserves shared navigation
    Given the shared footer canvas is opened at <width> pixels in "<theme>"
    Then the footer retains all five destinations and its existing tagline
    And the footer wraps within the viewport
    And the footer exposes visible keyboard focus on every destination

    Examples:
      | width | theme |
      | 390 | light |
      | 390 | dark |
      | 1447 | light |
      | 1447 | dark |
