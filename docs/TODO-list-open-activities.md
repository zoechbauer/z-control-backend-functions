# TODO List: Open Activities

This document tracks open activities and follow-up tasks for the **z-control Backend Functions** project. It is used to coordinate ongoing backend work, keep priorities visible, and ensure important tasks are completed.

## Open tasks

- [x] Move functions from the z-control Landing Page project to this backend repository.
- [x] Update documentation to reflect the new repository structure and function locations.
- [x] Add a Change Log file to document all changes and updates in a structured format.
- [x] Fix the remaining 8 of 172 unit test errors.
        Reason: I removed the console log in the function, but the tests were still expecting it to be called.
- [x] Improve the folder structure of the backend functions project.
- [x]   Refactor GitHub Analytics functions.
- [x]   Add unit tests for the GitHub Analytics functions.
- [ ] Activate lint errors in the lint configuration and fix the remaining issues.
- [x]   Fixed missing function documentation and activated linting for valid-jsdoc and require-jsdoc in .eslintrc.cjs
- [x]   Fixed spaces between function names and parentheses in function calls and activated linting for empty functions.
- [x]   Set line length in function descriptions to 100 characters and activated linting for max-len.
- [x]   Fixed null assertions from the codebase and activated linting for no-non-null-assertion.
- [x]   Enabled no-explicit-any for production code and fixed all related lint errors while keeping tests exempt.
