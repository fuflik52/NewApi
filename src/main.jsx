import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import ApiPage from './pages/ApiPage';
import ApiDocs from './pages/ApiDocs';
import Settings from './pages/Settings';
import Gallery from './pages/Gallery';
import ApiTest from './pages/ApiTest'; // Import ApiTest
import AdminUsers from './pages/AdminUsers'; // Import AdminUsers
import AdminFigma from './pages/AdminFigma'; // Import AdminFigma
import Layout from './layouts/Layout';
import { ThemeProvider } from './context/ThemeContext';
import './index.css';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/dashboard" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="api" element={<ApiPage />} />
            <Route path="api/docs" element={<ApiDocs />} />
            <Route path="api/test" element={<ApiTest />} /> {/* New Test Route */}
            <Route path="gallery" element={<Gallery />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="figma" element={<AdminFigma />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
