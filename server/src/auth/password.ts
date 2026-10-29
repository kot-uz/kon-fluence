import argon2 from 'argon2';

const options = { type: argon2.argon2id } as const;

export const hashPassword = (password: string) => argon2.hash(password, options);

export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password).catch(() => false);

// Для несуществующего email проверяем пароль против фиктивного хэша, чтобы время ответа не выдавало наличие аккаунта.
let dummyHash: Promise<string> | undefined;
export const verifyDummyPassword = async (password: string) => {
  dummyHash ??= hashPassword('dummy-password');
  await verifyPassword(await dummyHash, password);
};
