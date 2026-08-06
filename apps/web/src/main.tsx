import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import './styles/app.css';
import './styles/toast.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

const root = ReactDOM.createRoot(document.getElementById('root')!);

// The build fails when this key is missing (see vite.config.ts), so this branch only
// runs if a prebuilt bundle is served with a broken config. Show something readable
// rather than a white screen.
if (!publishableKey) {
  root.render(
    <div className="config-error" role="alert">
      <h1>Configuration required</h1>
      <p>
        This deployment is missing its <code>VITE_CLERK_PUBLISHABLE_KEY</code> setting, so
        sign-in cannot load.
      </p>
      <p>Add the key to the deployment environment and redeploy.</p>
    </div>,
  );
} else {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
          <ToastProvider>
            <App />
          </ToastProvider>
        </ClerkProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
