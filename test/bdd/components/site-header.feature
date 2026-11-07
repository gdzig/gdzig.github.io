Feature: SiteHeader production component in Storybook
  Rule: Navigation preserves the production responsive layout and native controls
    Scenario Outline: Real headers render their intended treatment and theme
      Given the actual Storybook catalogue is running
      And a canvas at <width> pixels with operating system theme "<system>"
      When I open marketing story "<story>"
      Then the production component is visible in theme "<theme>" without overflow
      And the header native navigation and theme controls work

      Examples:
        | story                               | width | system | theme |
        | marketing-siteheader--default-light | 390   | dark   | light |
        | marketing-siteheader--default-light | 1447  | dark   | light |
        | marketing-siteheader--default-dark  | 390   | light  | dark  |
        | marketing-siteheader--default-dark  | 1447  | light  | dark  |
        | marketing-siteheader--overlay-light | 390   | dark   | light |
        | marketing-siteheader--overlay-light | 1447  | dark   | light |
        | marketing-siteheader--overlay-dark  | 390   | light  | dark  |
        | marketing-siteheader--overlay-dark  | 1447  | light  | dark  |
        | marketing-siteheader--system        | 390   | light  | light |
        | marketing-siteheader--system        | 1447  | light  | light |
        | marketing-siteheader--system        | 390   | dark   | dark  |
        | marketing-siteheader--system        | 1447  | dark   | dark  |

  Rule: Theme respects stored preferences and remains usable without storage
    Scenario Outline: Real theme policy handles storage and system changes
      Given the actual Storybook catalogue is running
      And a canvas at 1447 pixels with operating system theme "light"
      And storage preference "<preference>"
      When I open marketing story "marketing-siteheader--system"
      Then native theme policy respects "<preference>" and persists user changes

      Examples:
        | preference |
        | empty      |
        | invalid    |
        | blocked    |
        | dark       |

  Rule: Remounting does not duplicate native component listeners
    Scenario: Native header remains functional after repeated story remounts
      Given the actual Storybook catalogue is running
      And a canvas at 1447 pixels with operating system theme "light"
      When I navigate between header stories three times in the manager
      Then each remounted native theme button has exactly one listener
      And the Storybook manager keeps its own styling
