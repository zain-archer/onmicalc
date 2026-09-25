import { useEffect } from 'react';
import { initTheme } from '@/ui/theme/theme';
import { AppShell } from '@/ui/shell/AppShell';
import { ErrorBoundary } from '@/ui/ErrorBoundary';

export default function App() {
  useEffect(() => initTheme(), []);
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
