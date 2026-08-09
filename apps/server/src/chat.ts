const HTML_TAG = /<[^>]*>/g;
const ANGLE_BRACKETS = /[<>]/g;
const EXCESS_WHITESPACE = /\s{3,}/g;

export function sanitizeChat(input: string): string {
  const withoutControlCharacters = [...input]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('');
  return withoutControlCharacters
    .normalize('NFKC')
    .replace(HTML_TAG, '')
    .replace(ANGLE_BRACKETS, '')
    .replace(EXCESS_WHITESPACE, '  ')
    .trim()
    .slice(0, 280);
}
