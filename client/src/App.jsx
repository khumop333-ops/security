/**
 * Route table. The dispatch console is a full-screen experience without the
 * mobile bottom navigation; everything else uses the app shell.
 */
import { Routes, Route, useLocation } from 'react-router-dom';

import { AppShell } from './components/AppShell.jsx';
import { Home } from './screens/Home.jsx';
import { StatusScreen } from './screens/StatusScreen.jsx';
import { History } from './screens/History.jsx';
import { Profile } from './screens/Profile.jsx';
import { Settings } from './screens/Settings.jsx';
import { Dispatch } from './screens/Dispatch.jsx';

export function App() {
  const location = useLocation();

  if (location.pathname === '/dispatch') {
    return (
      <Routes>
        <Route path="/dispatch" element={<Dispatch />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/status" element={<StatusScreen />} />
        <Route path="/status/:id" element={<StatusScreen />} />
        <Route path="/history" element={<History />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </AppShell>
  );
}
