import api from './api';

export interface AdminRequest {
  _id: string;
  name: string;
  email?: string;
  clubName?: string;
  designation?: string;
  officialEmail?: string;
  instagramHandle?: string;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
}

export interface ManagedAccount extends AdminRequest {
  role: 'admin' | 'student' | 'professional';
  isVerified?: boolean;
  accountStatus: 'active' | 'flagged' | 'suspended' | 'deactivated';
  updatedAt?: string;
}

export interface ControlCenterData {
  counts: Record<string, number>;
  users: ManagedAccount[];
  auditLogs: Array<{ _id: string; action: string; details?: string; createdAt?: string; actorId?: { name?: string; email?: string } }>;
}

export async function getControlCenter() {
  const { data } = await api.get<ControlCenterData>('/admin/control-center');
  return data;
}

export async function updateAccountStatus(id: string, status: ManagedAccount['accountStatus']) {
  const { data } = await api.put<{ msg: string }>(`/admin/accounts/${id}/status`, { status });
  return data;
}

export async function deleteAccount(id: string) {
  const { data } = await api.delete<{ msg: string }>(`/admin/accounts/${id}`);
  return data;
}

export async function getPendingAdminRequests() {
  const { data } = await api.get<AdminRequest[]>('/admin/requests');
  return data;
}

export async function approveAdminRequest(id: string) {
  const { data } = await api.put<{ msg: string }>(`/admin/approve/${id}`);
  return data;
}

export async function rejectAdminRequest(id: string) {
  const { data } = await api.put<{ msg: string }>(`/admin/reject/${id}`);
  return data;
}
