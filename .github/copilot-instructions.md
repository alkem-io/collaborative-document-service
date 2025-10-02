# Copilot Instructions

## Project Overview
Read the README.md file in the root directory.

## Key Features
Read the README.md file in the root directory.

## Architecture
Read the README.md file in the root directory.

## Coding Standards
- Use TypeScript for new files; prefer `.ts` over `.js`.
- Use ES6+ syntax.
- Write clear, descriptive comments for complex logic.

## Folder Structure
- `src/`: Source code
- `tests/`: Unit and integration tests

## Dependencies
- Use `pnpm` for package management.
- hocuspocus
- y.js

## Testing
- Use ViTest for unit tests.
- Place test files next to the file you are testing with `.spec.ts` suffix.
- Avoid mocking private methods of a class
- Test failing paths first
- Test green paths second
- DO NOT test if the logger is called
- Write each unit test with the pattern `arrange, act, assert`. Add a comment before each stage.
- Mocking is generally discouraged, when there is no intention to spy on the mocked functionality.
Instead, use `defaultMockerFactory` with `TestingModuleBuilder.useMocker`.
- to run a specific test file use `pnpm test -- <your file path>`

## Additional Notes
- Always validate Copilot suggestions before merging.
- Document any Copilot-generated code if not self-explanatory.
