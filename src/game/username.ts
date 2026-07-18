const USERNAME_PATTERN = /^[\p{L}\p{N}_-]{3,18}$/u;

const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'da-mystro',
  'damystro',
  'moderator',
  'teacher',
  'teacher-mesob',
]);

export const normalizeUsername = (value: string) => value.trim();

export const getUsernameError = (value: string): string => {
  const username = normalizeUsername(value);
  if (!username) return 'Create a username to enter the classroom.';
  if (username.length < 3) return 'Username must be at least 3 characters.';
  if (username.length > 18) return 'Username must be 18 characters or fewer.';
  if (!USERNAME_PATTERN.test(username)) return 'Use letters, numbers, hyphens, or underscores only.';
  if (RESERVED_USERNAMES.has(username.toLocaleLowerCase())) return 'Choose a different username.';
  return '';
};

export const isValidUsername = (value: string) => !getUsernameError(value);
