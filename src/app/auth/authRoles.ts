/**
 * Роли доступа. Авторизации в приложении нет — роли использует конфиг роутов
 * модуля документации (DocsAppConfig).
 */
const authRoles = {
  admin: ['administrator'],
  user: ['user'],
  onlyGuest: [] as string[],
};

export default authRoles;
