/**
 * BSC Enterprise HRMS API Client Service
 */

const getApiBase = () => {
  // @ts-ignore - suppress vite env errors in standard TS compiler
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return '/api';
};

export interface UserSession {
  id?: number | string;
  username: string;
  role: 'HR' | 'Manager' | 'Admin' | 'Super Admin' | string;
  fullName: string;
  displayName: string;
  token?: string;
  // ── Multi-Location Fields ──
  locationId?: number | null;     // null = Global Admin (all locations)
  locationCode?: string | null;   // 'BEL' | 'DAV' | 'SHI'
  locationName?: string | null;   // 'Belagavi' | 'Davanagere' | 'Shivamogga'
  isGlobalAdmin?: boolean;        // true if locationId is null
}

export const Auth = {
  save(session: UserSession) {
    try {
      localStorage.setItem('bsc_crm_session', JSON.stringify({
        ...session,
        loginAt: Date.now()
      }));
    } catch (e) {}
  },

  get(): (UserSession & { loginAt: number }) | null {
    try {
      const data = localStorage.getItem('bsc_crm_session');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  check(): boolean {
    const session = this.get();
    if (!session || !session.token) {
      this.clear();
      return false;
    }
    // Absolute session lifetime: 6 hours. Users who never sign out are
    // logged out automatically (matches the server token + cookie max-age).
    const SESSION_MS = parseInt(String(6 * 60 * 60 * 1000), 10);
    if (Date.now() - session.loginAt > SESSION_MS) {
      this.clear();
      return false;
    }
    return true;
  },

  // Returns location info from session (from JWT decoded on login)
  getLocation(): { locationId: number | null; locationCode: string | null; locationName: string | null } {
    const session = this.get();
    return {
      locationId: session?.locationId ?? null,
      locationCode: session?.locationCode ?? null,
      locationName: session?.locationName ?? null
    };
  },

  // True if user is Global Admin (no specific location assigned)
  isGlobalAdmin(): boolean {
    const session = this.get();
    return session?.isGlobalAdmin === true || session?.locationId === null || session?.locationId === undefined;
  },

  clear() {
    try {
      localStorage.removeItem('bsc_crm_session');
    } catch (e) {}
  },

  logout() {
    // Best-effort server notification so the sign-out is recorded in the
    // admin's login-activity trail. Never blocks the redirect.
    try {
      const session = this.get();
      if (session && session.token) {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
            'x-auth-token': session.token
          },
          keepalive: true
        }).catch(() => {});
      }
    } catch { /* offline — session clears locally regardless */ }
    this.clear();
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
  }
};

export const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
  const session = Auth.get();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (session && session.token) {
    headers['Authorization'] = `Bearer ${session.token}`;
    headers['x-auth-token'] = session.token; // Fallback for Hostinger Apache stripping Authorization header
  }

  // Belt-and-suspenders: also send location in header (JWT is primary enforcement)
  if (session && session.locationId) {
    headers['X-Location-Id'] = String(session.locationId);
  }

  const apiBase = getApiBase();
  const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${endpoint}`;

  try {
    const res = await fetch(url, {
      ...options,
      headers
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      const error: any = new Error(errorData.message || `HTTP ${res.status}`);
      error.errors = errorData.errors || [];
      throw error;
    }
    return await res.json();
  } catch (err: any) {
    console.warn(`[API Fetch Error: ${endpoint}]`, err.message);
    throw err;
  }
};

// Legacy Apps Script API Action Dispatcher Wrapper for 100% compatibility
export const API = {
  async call(action: string, params: any = {}) {
    try {
      const res = await apiFetch('/legacy', {
        method: 'POST',
        body: JSON.stringify({ action, ...params })
      });
      return res;
    } catch (err: any) {
      console.warn(`[Legacy Dispatch Error: ${action}]`, err.message);
      return { success: false, error: err.message };
    }
  },

  // Auth
  async verifyUser(username: string, password: string, captchaId?: string, captchaText?: string) {
    return apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, captchaId, captchaText })
    });
  },

  // Check server-side lockout status for account/IP
  async getLockStatus(username?: string) {
    const q = username ? `?username=${encodeURIComponent(username)}` : '';
    return apiFetch(`/auth/lock-status${q}`);
  },

  // Numeric captcha for the sign-in screen (server-generated SVG + opaque id)
  async getCaptcha() {
    return apiFetch('/auth/captcha');
  },

  // Developer Tools Detection Security Shield
  async getShieldStatus() {
    return apiFetch('/security/shield-status');
  },
  async toggleShield(enabled: boolean) {
    return apiFetch('/security/shield-toggle', {
      method: 'POST',
      body: JSON.stringify({ enabled })
    });
  },
  async getSecurityEvents(limit: number = 50) {
    return apiFetch(`/security/events?limit=${limit}`);
  },
  async clearSecurityEvents() {
    return apiFetch('/security/clear-events', { method: 'POST' });
  },
  async logSecurityEvent(event: string, details?: any) {
    return apiFetch('/security/log-event', {
      method: 'POST',
      body: JSON.stringify({ event, details })
    });
  },

  // System Administrator endpoints
  async getSystemLogs(params?: { limit?: number; offset?: number; module?: string; action?: string }) {
    const q = params ? new URLSearchParams(params as any).toString() : '';
    return apiFetch(`/security/system-logs${q ? `?${q}` : ''}`);
  },
  async getLiveActivity(limit?: number) {
    return apiFetch(`/security/live-activity${limit ? `?limit=${limit}` : ''}`);
  },
  async getDashboardStats() {
    return apiFetch('/security/dashboard-stats');
  },

  // Candidates
  async uploadDocuments(formData: FormData, candName?: string, appNo?: string) {
    const session = Auth.get();
    const headers: Record<string, string> = {};
    if (session && session.token) {
      headers['Authorization'] = `Bearer ${session.token}`;
      headers['x-auth-token'] = session.token;
    }
    if (candName) {
      headers['x-candidate-name'] = encodeURIComponent(candName);
    }
    if (appNo) {
      headers['x-app-no'] = appNo;
    }
    const apiBase = getApiBase();
    const url = `${apiBase}/candidates/upload-documents`;
    const res = await fetch(url, { method: 'POST', headers, body: formData });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },
  async getCandidates(filters: any = {}) {
    const query = new URLSearchParams(filters).toString();
    return apiFetch(`/candidates?${query}`);
  },
  async getEmployees() {
    return apiFetch('/employees');
  },
  async addCandidate(data: any) {
    // Legacy route uses /add or we just map it in our generic call
    return apiFetch('/candidates', {
      method: 'POST',
      body: JSON.stringify({ data })
    });
  },
  async deleteCandidate(appNo: string) {
    return apiFetch(`/candidates/${appNo}`, {
      method: 'DELETE'
    });
  },
  async updateCandidate(appNo: string, updates: any, candName?: string, doneBy?: string) {
    return apiFetch(`/candidates/${appNo}`, {
      method: 'PUT',
      body: JSON.stringify({ appNo, updates, candName, doneBy })
    });
  },
  async checkDuplicate(phone: string) {
    return apiFetch(`/candidates/check-duplicate?phone=${encodeURIComponent(phone)}`);
  },
  async getNextAppNo() {
    return apiFetch('/candidates/next-app-no');
  },
  async getKPIs(dateRange?: string, fromDate?: string, toDate?: string) {
    const params = new URLSearchParams();
    if (dateRange) params.append('range', dateRange);
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    const qs = params.toString();
    return apiFetch(`/candidates/kpis${qs ? `?${qs}` : ''}`);
  },
  async getPendingActions() {
    return apiFetch('/candidates/pending-actions');
  },
  async getSourceBreakdown() {
    return apiFetch('/candidates/source-breakdown');
  },
  async getActivityFull(appNo: string) {
    return apiFetch(`/candidates/activity-full?appNo=${encodeURIComponent(appNo)}`);
  },
  async getActivity(params: { limit?: number } = {}) {
    return apiFetch(`/candidates/activity?limit=${params.limit || 10}`);
  },

  // Interviews
  async getInterviews() {
    return apiFetch('/interviews');
  },
  async getInterviewQuestions(desig?: string, round?: string) {
    const query = new URLSearchParams({ desig: desig || '', round: round || 'HR' }).toString();
    return apiFetch(`/interviews/questions?${query}`);
  },
  async saveCallStep(p: any) {
    return apiFetch('/interviews/save-call-step', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async getCallStatus(appNo: string) {
    return apiFetch(`/interviews/call-status?appNo=${encodeURIComponent(appNo)}`);
  },
  async saveScore(appNo: string, round: string, scores: any, offeredSalary?: string, offeredDoj?: string) {
    return apiFetch('/interviews/save-score', {
      method: 'POST',
      body: JSON.stringify({ appNo, round, scores, offeredSalary, offeredDoj })
    });
  },
  async generateInterviewToken(p: any) {
    return apiFetch('/interviews/generate-token', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async approveSelection(p: any) {
    return apiFetch('/interviews/approve-selection', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async rejectCandidate(p: any) {
    return apiFetch('/interviews/reject-candidate', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async getSelectedCandidates() {
    return apiFetch('/interviews/selected');
  },
  async getRejectedCandidates() {
    return apiFetch('/interviews/rejected');
  },

  // Offers
  async getOffers() {
    return apiFetch('/offers');
  },
  async createDirectOffer(p: any) {
    return apiFetch('/offers/direct', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async logOfferCall(p: any) {
    return apiFetch('/offers/log-call', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async updateOfferStatus(p: any) {
    return apiFetch('/offers/update-status', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async updateOfferDetails(p: any) {
    return apiFetch('/offers/update-details', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async acceptOffer(p: any) {
    return apiFetch('/offers/accept', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async rejectOffer(p: any) {
    return apiFetch('/offers/reject', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },
  async markJoined(p: any) {
    return apiFetch('/offers/mark-joined', {
      method: 'POST',
      body: JSON.stringify(p)
    });
  },

  // Settings
  async getUsers() { return apiFetch('/settings/users'); },
  async addUser(p: any) { return apiFetch('/settings/users/add', { method: 'POST', body: JSON.stringify(p) }); },
  async updateUser(p: any) { return apiFetch('/settings/users/update', { method: 'POST', body: JSON.stringify(p) }); },
  async deleteUser(identifier: number | string | { id?: number | string; username?: string }) {
    const payload = typeof identifier === 'object' ? identifier : (!isNaN(Number(identifier)) ? { id: identifier } : { username: identifier });
    return apiFetch('/settings/users/delete', { method: 'POST', body: JSON.stringify(payload) });
  },
  async getPageSettings() { 
    try {
      return await apiFetch('/settings/page-visibility'); 
    } catch (e) {
      return {};
    }
  },
  async savePageSettings(settings: any) { return apiFetch('/settings/page-visibility', { method: 'POST', body: JSON.stringify({ settings }) }); },
  async getDesignations() { return apiFetch('/settings/designations'); },
  async getPublicDesignations() { return API.call('getPublicDesignations'); },
  async addDesignation(name: string) { return apiFetch('/settings/designations/add', { method: 'POST', body: JSON.stringify({ name }) }); },
  async deleteDesignation(name: string) { return apiFetch('/settings/designations/delete', { method: 'POST', body: JSON.stringify({ name }) }); },

  // ── User Management (Admin) ─────────────────────────────────
  async getAdminUsers() { return apiFetch('/admin/users'); },
  async getAdminUser(id: number | string) { return apiFetch(`/admin/users/${id}`); },
  async createAdminUser(data: any) { return apiFetch('/admin/users', { method: 'POST', body: JSON.stringify(data) }); },
  async updateAdminUser(id: number | string, data: any) { return apiFetch(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  async deleteAdminUser(id: number | string) { return apiFetch(`/admin/users/${id}`, { method: 'DELETE' }); },
  async getAdminUserPermissions(id: number | string) { return apiFetch(`/admin/users/${id}/permissions`); },
  async updateAdminUserPermissions(id: number | string, permissions: any[]) { return apiFetch(`/admin/users/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) }); },
  async toggleAdminUserStatus(id: number | string) { return apiFetch(`/admin/users/${id}/toggle-status`, { method: 'POST' }); },
  async resetAdminUserPassword(id: number | string, password: string) { return apiFetch(`/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }); },
  async getAdminModules() { return apiFetch('/admin/users/modules'); },
  async getMyPermissions() { return apiFetch('/my-permissions'); },

  // Broadcasts
  async getBroadcasts() { return apiFetch('/broadcasts'); },
  async createBroadcast(payload: any) { return apiFetch('/broadcasts', { method: 'POST', body: JSON.stringify(payload) }); },
  async deleteBroadcast(id: string | number) { return apiFetch(`/broadcasts/${id}`, { method: 'DELETE' }); },

  // Department Hiring & Section Allocation
  async getHiringTargets() { return apiFetch('/dept-hiring/targets'); },
  async saveHiringTarget(payload: any) { return apiFetch('/dept-hiring/targets', { method: 'POST', body: JSON.stringify(payload) }); },
  async getSectionAllocations() { return apiFetch('/section-allocations'); },
  async saveSectionAllocation(payload: any) { return apiFetch('/section-allocations', { method: 'POST', body: JSON.stringify(payload) }); },
  async bulkSaveSectionAllocation(payload: any) { return apiFetch('/section-allocations/bulk', { method: 'POST', body: JSON.stringify(payload) }); },

  // Department Sections CRUD
  async getDepartmentSections() { return apiFetch('/dept-hiring/sections'); },
  async addDepartmentSection(payload: any) { return apiFetch('/dept-hiring/sections/add', { method: 'POST', body: JSON.stringify(payload) }); },
  async editDepartmentSection(payload: any) { return apiFetch('/dept-hiring/sections/edit', { method: 'POST', body: JSON.stringify(payload) }); },
  async deleteDepartmentSection(payload: number | string | { id?: number | string; department?: string; sectionName?: string }) { 
    const bodyObj = typeof payload === 'object' ? payload : { id: payload };
    return apiFetch('/dept-hiring/sections/delete', { method: 'POST', body: JSON.stringify(bodyObj) }); 
  },

  // CRM Store Operations
  async getCrmSettings() { return apiFetch('/crm/settings'); },
  async updateCrmSettings(payload: any) { return apiFetch('/crm/settings/update', { method: 'POST', body: JSON.stringify(payload) }); },
  async verifyPin(payload: { type: string; pin: string }) { return apiFetch('/crm/verify-pin', { method: 'POST', body: JSON.stringify(payload) }); },
  async getSections() { return apiFetch('/crm/sections'); },
  async getFootfall(date?: string) { return apiFetch(`/crm/footfall${date ? `?date=${date}` : ''}`); },
  async upsertFootfall(payload: any) { return apiFetch('/crm/footfall/upsert', { method: 'POST', body: JSON.stringify(payload) }); },
  async getFeedbackQuestions() { return apiFetch('/crm/feedback-questions'); },
  async getFeedbackStats() { return apiFetch('/crm/feedback-stats'); },
  async getFeedbacks(params?: { date?: string; startDate?: string; endDate?: string; isNegative?: string; search?: string }) {
    const q = new URLSearchParams(params as any).toString();
    return apiFetch(`/crm/feedbacks${q ? `?${q}` : ''}`);
  },
  async submitFeedback(payload: any) { return apiFetch('/crm/feedback', { method: 'POST', body: JSON.stringify(payload) }); },
  async getCallQueue(params?: { date?: string; startDate?: string; endDate?: string; status?: string; search?: string }) {
    const q = new URLSearchParams(params as any).toString();
    return apiFetch(`/crm/call-queue${q ? `?${q}` : ''}`);
  },
  async updateCallQueue(payload: any) { return apiFetch('/crm/call-queue/update', { method: 'POST', body: JSON.stringify(payload) }); },
  async getDiverts() { return apiFetch('/crm/diverts'); },
  async createDivert(payload: any) { return apiFetch('/crm/diverts/create', { method: 'POST', body: JSON.stringify(payload) }); },
  async updateDivert(payload: any) { return apiFetch('/crm/diverts/update', { method: 'POST', body: JSON.stringify(payload) }); },
  async getDivertUpdates(divertId: string) { return apiFetch(`/crm/diverts/updates?divertId=${divertId}`); },
  async getCashSettlement(date?: string) { return apiFetch(`/cash${date ? `?date=${date}` : ''}`); },
  async saveCashSettlement(payload: any) { return apiFetch('/cash/save', { method: 'POST', body: JSON.stringify(payload) }); },
  async getVmPoints() { return apiFetch('/vm/points'); },
  async getVmSubmissions() { return apiFetch('/vm/submissions'); },
  async submitVm(payload: any) { return apiFetch('/vm/submit', { method: 'POST', body: JSON.stringify(payload) }); },
  async getVmFloors() { return apiFetch('/vm/floors'); },
  async createVmFloor(payload: any) { return apiFetch('/vm/floors', { method: 'POST', body: JSON.stringify(payload) }); },
  async deleteVmFloor(payload: any) { return apiFetch('/vm/floors/delete', { method: 'POST', body: JSON.stringify(typeof payload === 'object' ? payload : { id: payload }) }); },

  // MCheck — Daily Management Checklist
  async getMCheckModules() { return apiFetch('/mcheck/modules'); },
  async getMCheckDashboard(date?: string) { return apiFetch(`/mcheck/dashboard${date ? `?date=${date}` : ''}`); },
  async getMCheckModuleDetail(moduleId: number | string, date?: string) { return apiFetch(`/mcheck/module/${moduleId}${date ? `?date=${date}` : ''}`); },
  async saveMCheckResponse(payload: any) { return apiFetch('/mcheck/response/save', { method: 'POST', body: JSON.stringify(payload) }); },
  async submitAllMCheck(payload: any) { return apiFetch('/mcheck/response/submit-all', { method: 'POST', body: JSON.stringify(payload) }); },
  async getMCheckReports(params?: { date?: string; fromDate?: string; toDate?: string; module_id?: string; status?: string; search?: string }) {
    const q = new URLSearchParams(params as any).toString();
    return apiFetch(`/mcheck/reports${q ? `?${q}` : ''}`);
  },
  async getMCheckHistory(params?: { limit?: number; offset?: number }) {
    const q = new URLSearchParams(params as any).toString();
    return apiFetch(`/mcheck/history${q ? `?${q}` : ''}`);
  },
  async getMCheckTrend(days?: number) { return apiFetch(`/mcheck/trend${days ? `?days=${days}` : ''}`); },
  async getMCheckAuditLog(checkpointId: number | string, responseDate?: string) {
    return apiFetch(`/mcheck/audit?checkpoint_id=${checkpointId}${responseDate ? `&response_date=${responseDate}` : ''}`);
  },
  async uploadMCheckPhoto(formData: FormData) {
    const session = Auth.get();
    const headers: Record<string, string> = {};
    if (session && session.token) {
      headers['Authorization'] = `Bearer ${session.token}`;
      headers['x-auth-token'] = session.token;
    }
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/mcheck/upload-photo`, { method: 'POST', headers, body: formData });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  },
  async getMCheckAdminStructure() { return apiFetch('/mcheck/admin/structure'); },
  async saveMCheckAdminModule(payload: any) { return apiFetch('/mcheck/admin/module', { method: 'POST', body: JSON.stringify(payload) }); },
  async saveMCheckAdminCheckpoint(payload: any) { return apiFetch('/mcheck/admin/checkpoint', { method: 'POST', body: JSON.stringify(payload) }); },
  async reorderMCheckCheckpoints(order: any[]) { return apiFetch('/mcheck/admin/reorder', { method: 'POST', body: JSON.stringify({ order }) }); },
  getMCheckExportUrl(type: 'pdf' | 'excel', params?: { date?: string; fromDate?: string; toDate?: string; module_id?: string; status?: string }) {
    const apiBase = getApiBase();
    const q = params ? new URLSearchParams(params as any).toString() : '';
    return `${apiBase}/mcheck/export/${type === 'pdf' ? 'pdf' : 'excel'}${q ? `?${q}` : ''}`;
  },

  // ── Locations ────────────────────────────────────────────────
  async getLocations() {
    const res = await apiFetch('/locations');
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getLocation(id: number | string) {
    const res = await apiFetch(`/locations/${id}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getGlobalStats() {
    const res = await apiFetch('/global-stats');
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // ── Wedding Customer Follow-up CRM ───────────────────────────
  async getWeddingStats(locationId?: number | string) {
    const res = await apiFetch(`/wedding-crm/stats${locationId ? `?location_id=${locationId}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingCustomers(params?: {
    date_filter?: string;
    status?: string;
    location_id?: number | string;
    telecaller_id?: number | string;
    search?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
  }) {
    const q = params ? new URLSearchParams(params as any).toString() : '';
    const res = await apiFetch(`/wedding-crm/customers${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async checkWeddingDuplicate(phone: string) {
    const res = await apiFetch('/wedding-crm/check-duplicate', {
      method: 'POST',
      body: JSON.stringify({ phone })
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async createWeddingCustomer(payload: any) {
    const res = await apiFetch('/wedding-crm/customers', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingCustomerById(id: number | string) {
    const res = await apiFetch(`/wedding-crm/customers/${id}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async updateWeddingCustomer(id: number | string, payload: any) {
    const res = await apiFetch(`/wedding-crm/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async deleteWeddingCustomer(id: number | string) {
    const res = await apiFetch(`/wedding-crm/customers/${id}`, {
      method: 'DELETE'
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async logWeddingCall(payload: any) {
    const res = await apiFetch('/wedding-crm/log-call', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingCallingDesk(params?: { queue?: string; location_id?: number | string }) {
    const q = params ? new URLSearchParams(params as any).toString() : '';
    const res = await apiFetch(`/wedding-crm/calling-desk${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingCalendar(params?: { month?: string; location_id?: number | string }) {
    const q = params ? new URLSearchParams(params as any).toString() : '';
    const res = await apiFetch(`/wedding-crm/calendar${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingAnalytics(params?: { from_date?: string; to_date?: string; location_id?: number | string }) {
    const q = params ? new URLSearchParams(params as any).toString() : '';
    const res = await apiFetch(`/wedding-crm/analytics${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingTelecallers(locationId?: number | string) {
    const res = await apiFetch(`/wedding-crm/telecallers${locationId ? `?location_id=${locationId}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },
  async getWeddingExportData(params?: any) {
    const q = params ? new URLSearchParams(params as any).toString() : '';
    const res = await apiFetch(`/wedding-crm/export${q ? `?${q}` : ''}`);
    return (res && res.data !== undefined) ? { ...res, ...res.data } : res;
  },

  // File URL Helper
  fileUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    let clean = url.trim();
    if (!clean) return null;
    if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
    if (clean.startsWith('uploads/')) clean = `/${clean}`;
    const filename = clean.split('/').pop() || clean;
    if (filename.startsWith('photo') && !clean.includes('applicants')) return `/uploads/candidate-photos/${filename}`;
    if (filename.startsWith('resume') && !clean.includes('applicants')) return `/uploads/candidate-resumes/${filename}`;
    if ((filename.startsWith('aadhar') || filename.startsWith('aadhaar') || filename.startsWith('pan') || filename.startsWith('document')) && !clean.includes('applicants')) return `/uploads/employee-documents/${filename}`;
    if (clean.startsWith('/uploads/')) return clean;
    return `/uploads/misc/${filename}`;
  }
};

