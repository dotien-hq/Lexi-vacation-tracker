
import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import EmployeeDetail from './pages/EmployeeDetail';
import CalendarPage from './pages/CalendarPage';
import SettingsPage from './pages/SettingsPage';

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/employee/:id" element={<EmployeeDetail />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/admin" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
