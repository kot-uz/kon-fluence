import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from 'app/translations/ru';
import uz from 'app/translations/uz';
import { DEFAULT_LANGUAGE, readLanguage } from 'app/store/i18nSlice';

// Неймспейс 'translations': модуль документации вызывает
// useTranslation('translations'), а наполнение моков — i18next.t(key, { ns: 'translations' }).
i18next.use(initReactI18next).init({
  resources: {
    ru: { translations: ru },
    uz: { translations: uz },
  },
  lng: readLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  ns: ['translations'],
  defaultNS: 'translations',
  interpolation: { escapeValue: false },
  returnNull: false,
});

document.documentElement.lang = i18next.language;

export default i18next;
