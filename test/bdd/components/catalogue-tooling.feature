Feature: Local component catalogue tooling
  Scenario: Every explicit marketing story is indexed
    Given the actual Storybook catalogue is running
    Then its index includes all eleven marketing story IDs

  Scenario: Browser evidence paths reject missing and repository destinations
    Then the output guard rejects missing configuration and direct or symlink repository destinations
