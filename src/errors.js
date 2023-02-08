export default {
  AssertTypeError: () => 'Only string is supported as an assertion value',
  DuplicateAssertionKey:
    ({ type }) => `Duplicate key "${type}" is not allowed in module attributes.`,
  ImportCallArgumentTrailingComma: () => 'Trailing comma is not allowed in import().',
};
