Feature: Author notice
  Scenario Outline: Author notice keeps guest status, confirmed roles, and original source independent
    Given the author notice "<variant>" canvas is opened at <width> pixels in "<theme>"
    Then the author notice credits only the selected roles and guest status
    And the author notice preserves the optional author profile link
    And the author notice includes only the supplied original source details
    And the author notice stays readable within the viewport

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
      | maintainer | 390 | light |
      | maintainer | 390 | dark |
      | maintainer | 1447 | light |
      | maintainer | 1447 | dark |
      | founder | 390 | light |
      | founder | 390 | dark |
      | founder | 1447 | light |
      | founder | 1447 | dark |
      | founder-maintainer | 390 | light |
      | founder-maintainer | 390 | dark |
      | founder-maintainer | 1447 | light |
      | founder-maintainer | 1447 | dark |
      | guest-maintainer | 390 | light |
      | guest-maintainer | 390 | dark |
      | guest-maintainer | 1447 | light |
      | guest-maintainer | 1447 | dark |
      | all-roles | 390 | light |
      | all-roles | 390 | dark |
      | all-roles | 1447 | light |
      | all-roles | 1447 | dark |
      | no-roles | 390 | light |
      | no-roles | 390 | dark |
      | no-roles | 1447 | light |
      | no-roles | 1447 | dark |
      | no-profile | 390 | light |
      | no-profile | 390 | dark |
      | no-profile | 1447 | light |
      | no-profile | 1447 | dark |
      | long-name | 390 | light |
      | long-name | 390 | dark |
      | long-name | 1447 | light |
      | long-name | 1447 | dark |
      | source-only | 390 | light |
      | source-only | 390 | dark |
      | source-only | 1447 | light |
      | source-only | 1447 | dark |
      | source-dated | 390 | light |
      | source-dated | 390 | dark |
      | source-dated | 1447 | light |
      | source-dated | 1447 | dark |
      | team-source | 390 | light |
      | team-source | 390 | dark |
      | team-source | 1447 | light |
      | team-source | 1447 | dark |
      | long-source | 390 | light |
      | long-source | 390 | dark |
      | long-source | 1447 | light |
      | long-source | 1447 | dark |

  Scenario: Author notice controls update roles and source independently without reloading
    Given the author notice "source-dated" canvas is opened at 1447 pixels in "light"
    Then the author notice controls can change guest status, roles, and source details live
