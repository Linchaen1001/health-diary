import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth.jsx';
import Nav from './components/Nav.jsx';
import Dashboard from './pages/Dashboard.jsx';
import History from './pages/History.jsx';
import Login from './pages/Login.jsx';
import Record from './pages/Record.jsx';
import Settings from './pages/Settings.jsx';

const Protected = ({ children }) => (
  <RequireAuth>
    <Nav />
    <main className="container">{children}</main>
  </RequireAuth>
);

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/record" element={<Protected><Record /></Protected>} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/history" element={<Protected><History /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
