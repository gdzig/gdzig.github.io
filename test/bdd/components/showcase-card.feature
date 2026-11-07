Feature: ShowcaseCard production marketing component
  Scenario Outline: Showcase project card preserves content and native links
    Given the showcase project "<variant>" canvas is opened at <width> pixels in "<theme>"
    Then the showcase card retains all supplied project content and destinations
    And the showcase card has native focused links without a card overlay
    And the showcase component fits the viewport

    Examples:
      | variant | width | theme |
      | vector-wave | 390 | light |
      | vector-wave | 1447 | light |
      | vector-wave | 390 | dark |
      | vector-wave | 1447 | dark |
      | native-video | 390 | light |
      | native-video | 1447 | light |
      | native-video | 390 | dark |
      | native-video | 1447 | dark |
      | minimal | 390 | light |
      | minimal | 1447 | light |
      | minimal | 390 | dark |
      | minimal | 1447 | dark |
      | long | 390 | light |
      | long | 1447 | light |
      | long | 390 | dark |
      | long | 1447 | dark |
