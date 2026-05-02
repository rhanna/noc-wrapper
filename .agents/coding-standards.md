# Coding Standards

## Formatting
- Indentation: 2 spaces, enforced by Prettier.
- Max line length: 100 chars.
- Run `npm run format` after every file change.

## Naming
- Files: kebab-case, e.g. `user-profile.ts`
- Functions: camelCase, e.g. `getUserById`
- Types/classes: PascalCase, e.g. `UserProfile`
- Constants: SCREAMING_SNAKE, e.g. `MAX_RETRIES`

## Patterns to Follow
- Services go in `src/services/`, one class per file.
- Always handle errors explicitly. No silent catches.
- Prefer early returns over nested if/else.

## Patterns to Avoid
- No `any` in TypeScript. Use `unknown` and narrow.
- No default exports from module files.
- No magic strings. Define constants.

## Refactoring
- Refactor only when it reduces current-task complexity.
- Keep behavior-preserving refactors separate when possible.
- Avoid style-only churn in unrelated files.
