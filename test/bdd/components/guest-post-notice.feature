Feature: Guest post notice
  Scenario Outline: Guest post notice credits the author without implying unconfirmed contributor status
    Given the guest post notice "<variant>" canvas is opened at <width> pixels in "<theme>"
    Then the guest post notice credits the author with the selected community role
    And the guest post notice preserves the optional author profile link
    And the guest post notice stays readable within the viewport

    Examples:
      | variant | width | theme |
      | community-member | 390 | light |
      | community-member | 390 | dark |
      | community-member | 1447 | light |
      | community-member | 1447 | dark |
      | contributor | 390 | light |
      | contributor | 390 | dark |
      | contributor | 1447 | light |
      | contributor | 1447 | dark |
      | no-profile | 390 | light |
      | no-profile | 390 | dark |
      | no-profile | 1447 | light |
      | no-profile | 1447 | dark |
      | long-name | 390 | light |
      | long-name | 390 | dark |
      | long-name | 1447 | light |
      | long-name | 1447 | dark |
