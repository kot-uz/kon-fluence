import { Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import store from 'app/store';
import AppThemeProvider from 'app/theme/AppThemeProvider';
import AppHeader from 'app/layout/AppHeader';
import AppMessage from 'app/shared-components/AppMessage';
import Loading from 'app/shared-components/Loading';
import SpacesPage from 'app/main/spaces/SpacesPage';
import AuthPage from 'app/auth/AuthPage';
import CloudGuard from 'app/auth/CloudGuard';
import { DOCS_BASE_PATH, DocsAppConfig } from 'app/docs';

const AppLayout = () => (
  <div className="flex flex-col flex-auto w-full min-h-0 min-w-0">
    <AppHeader />
    <div className="flex flex-auto min-h-0 min-w-0">
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </div>
    <AppMessage />
  </div>
);

const App = () => (
  <Provider store={store}>
    <AppThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route element={<CloudGuard />}>
              <Route path="/" element={<SpacesPage />} />
              {/* роуты описаны самим модулем документации, приложение только задаёт префикс */}
              <Route path={DOCS_BASE_PATH}>
                {DocsAppConfig.routes.map((route) => (
                  <Route key={route.path} path={route.path} element={route.element} />
                ))}
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppThemeProvider>
  </Provider>
);

export default App;
