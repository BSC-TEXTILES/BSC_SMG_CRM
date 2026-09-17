import { Navigate } from 'react-router-dom';
import { Auth } from '../services/api';
import { getDashboardRouteForRole } from '../utils/dashboardRouting';

export default function Home() {
  if (Auth.check()) {
    const user = Auth.get();
    return <Navigate to={getDashboardRouteForRole(user?.role)} replace />;
  }
  return <Navigate to="/login" replace />;
}
