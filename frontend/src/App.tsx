import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CandidateEntry from './pages/CandidateEntry';
import Candidates from './pages/Candidates';
import OfferProcess from './pages/OfferProcess';
import Employees from './pages/Employees';
import Openings from './pages/Openings';
import Settings from './pages/Settings';
import BroadcastCenter from './pages/BroadcastCenter';
import UserManagement from './pages/UserManagement';
import DepartmentHiring from './pages/DepartmentHiring';
import SectionAllocation from './pages/SectionAllocation';
import Footfall from './pages/Footfall';
import PublicFeedback from './pages/PublicFeedback';
import FeedbackQR from './pages/FeedbackQR';
import FeedbackList from './pages/FeedbackList';
import FeedbackCollection from './pages/FeedbackCollection';
import Divert from './pages/Divert';
import PMView from './pages/PMView';
import CashSettlement from './pages/CashSettlement';
import VmChecklist from './pages/VmChecklist';
import TVDisplay from './pages/TVDisplay';
import Greeter from './pages/Greeter';
import Attendance from './pages/Attendance';
import DailyMCheck from './pages/DailyMCheck';
import MCheckReports from './pages/MCheckReports';
import MCheckHistory from './pages/MCheckHistory';
import WeddingCRM from './pages/WeddingCRM';
import SystemAdmin from './pages/SystemAdmin';
import DeveloperTools from './pages/DeveloperTools';
import QuickActionCenter from './components/ui/QuickActionCenter';
import DevToolsGuard from './components/DevToolsGuard';
import ConnectivityBanner from './components/ConnectivityBanner';
import ErrorBoundary from './components/ErrorBoundary';
import SessionTimeoutGuard from './components/SessionTimeoutGuard';
import DesktopModeWarning from './components/DesktopModeWarning';

export default function App() {
  return (
    <ErrorBoundary>
    <Router>
      <ConnectivityBanner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/wedding-crm" element={<WeddingCRM />} />
        <Route path="/footfall" element={<Footfall />} />
        <Route path="/feedback-public" element={<PublicFeedback />} />
        <Route path="/feedback-qr" element={<FeedbackQR />} />
        <Route path="/feedback-list" element={<FeedbackList />} />
        <Route path="/feedback-collection" element={<FeedbackCollection />} />
        <Route path="/divert" element={<Divert />} />
        <Route path="/pm-view" element={<PMView />} />
        <Route path="/cash-settlement" element={<CashSettlement />} />
        <Route path="/vm-checklist" element={<VmChecklist />} />
        <Route path="/tv" element={<TVDisplay />} />
        <Route path="/greeter" element={<Greeter />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/daily-mcheck" element={<DailyMCheck />} />
        <Route path="/mcheck-reports" element={<MCheckReports />} />
        <Route path="/mcheck-history" element={<MCheckHistory />} />
        <Route path="/candidates" element={<Candidates />} />
        <Route path="/candidate-entry" element={<CandidateEntry />} />
        <Route path="/interview-panel" element={<Navigate to="/candidates" replace />} />
        <Route path="/interview-form" element={<Navigate to="/candidates" replace />} />
        <Route path="/offer-process" element={<OfferProcess />} />
        {/* Disabled pages per user request: Onboarding, Exit & FnF, Interview Panel */}
        <Route path="/onboarding" element={<Navigate to="/employees" replace />} />
        <Route path="/employee-exit" element={<Navigate to="/employees" replace />} />
        <Route path="/exit" element={<Navigate to="/employees" replace />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/department-hiring" element={<DepartmentHiring />} />
        <Route path="/section-allocation" element={<SectionAllocation />} />
        <Route path="/openings" element={<Openings />} />
        <Route path="/broadcast-center" element={<BroadcastCenter />} />
        <Route path="/user-management" element={<UserManagement />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/system-admin" element={<SystemAdmin />} />
        <Route path="/developer-tools" element={<DeveloperTools />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <QuickActionCenter />
      <SessionTimeoutGuard />
      <DevToolsGuard />
      <DesktopModeWarning />
    </Router>
    </ErrorBoundary>
  );
}
