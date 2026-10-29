import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(320)
  .pipe(z.email({ message: 'Некорректный email' }));

// Верхняя граница защищает argon2 от очень длинных входных строк.
export const passwordSchema = z
  .string()
  .min(8, 'Пароль не короче 8 символов')
  .max(128, 'Пароль не длиннее 128 символов');

export const fullNameSchema = z.string().trim().min(1, 'Укажите имя').max(255);

export const userSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  fullName: z.string(),
});

export type PublicUser = z.infer<typeof userSchema>;

export const toPublicUser = (user: PublicUser): PublicUser => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
});

export const sessionSchema = z.object({ accessToken: z.string(), user: userSchema });
