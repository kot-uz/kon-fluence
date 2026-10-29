// Единственная точка, где модуль документации зависит от сетевого слоя приложения.
//
// hostApi — createApi, в который инжектятся эндпоинты документации,
// см. app/services/docs/docsHostApi.
//
// httpClient — axios с базовым URL и токеном из localStorage (app/helpers/httpClient).
// Нужен только в облачном режиме.
export { default as httpClient } from 'app/helpers/httpClient';
export { rtkBaseQuery } from 'src/app/helpers/rtkquery';
export type { DocsBaseQuery, RtkQueryArgs, RtkQueryError } from 'src/app/helpers/rtkquery';
export { docsHostApi as hostApi } from 'app/services/docs/docsHostApi';
