Feature: Local component catalogue tooling
  Scenario: Every explicit marketing story is indexed
    Given the actual Storybook catalogue is running
    Then its index includes every explicit marketing story ID

  Scenario: Browser evidence paths reject missing and repository destinations
    Then the output guard rejects missing configuration and direct or symlink repository destinations
