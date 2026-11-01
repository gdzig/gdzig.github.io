Feature: ActionLink production component in Storybook
  Scenario Outline: Real action links render responsively and expose native interaction states
    Given the actual Storybook catalogue is running
    And a canvas at <width> pixels with operating system theme "<system>"
    When I open marketing story "<story>"
    Then the production component is visible in theme "<theme>" without overflow
    And the action link exposes native interaction states

    Examples:
      | story                                  | width | system | theme |
      | marketing-actionlink--primary-light    | 390   | dark   | light |
      | marketing-actionlink--primary-light    | 1447  | dark   | light |
      | marketing-actionlink--primary-dark     | 390   | light  | dark  |
      | marketing-actionlink--primary-dark     | 1447  | light  | dark  |
      | marketing-actionlink--outline-light    | 390   | dark   | light |
      | marketing-actionlink--outline-light    | 1447  | dark   | light |
      | marketing-actionlink--outline-dark     | 390   | light  | dark  |
      | marketing-actionlink--outline-dark     | 1447  | light  | dark  |
      | marketing-actionlink--long-label-light | 390   | dark   | light |
      | marketing-actionlink--long-label-light | 1447  | dark   | light |
      | marketing-actionlink--long-label-dark  | 390   | light  | dark  |
      | marketing-actionlink--long-label-dark  | 1447  | light  | dark  |
