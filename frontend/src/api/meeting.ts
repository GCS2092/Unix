import { apiClient } from "./client"

export interface MeetingSettings {
  meeting_mode: boolean
  require_admission: boolean
  invite_token: string | null
}

export interface Invitee {
  id: number
  name: string
  email: string
  courses: { id: number; title: string }[]
}

export interface JoinRequest {
  id: number
  name: string
  created_at: string
}

export interface GuestRequestCreds {
  id: number
  secret: string
}

export const meetingApi = {
  guestStatus: (invite: string) =>
    apiClient.get<{ data: { is_live: boolean; title: string; require_admission: boolean } }>("/livekit/guest-status", { params: { invite } }),
  guestRequest: (invite: string, name: string) =>
    apiClient.post<{ data: { id: number | null; secret: string | null; status: string } }>("/livekit/guest-request", { invite, name }),
  guestRequestStatus: (id: number, secret: string) =>
    apiClient.get<{ data: { status: "pending" | "admitted" | "denied" } }>(`/livekit/guest-request/${id}`, { params: { secret } }),
  guestToken: (invite: string, name: string, request?: GuestRequestCreds) =>
    apiClient.post<{ data: unknown }>("/livekit/guest-token", { invite, name, request_id: request?.id, secret: request?.secret }),
  show: (courseId: number) =>
    apiClient.get<{ data: MeetingSettings }>(`/admin/courses/${courseId}/meeting`),
  update: (courseId: number, meetingMode: boolean) =>
    apiClient.put<{ data: MeetingSettings }>(`/admin/courses/${courseId}/meeting`, { meeting_mode: meetingMode }),
  patch: (courseId: number, body: Partial<{ meeting_mode: boolean; require_admission: boolean }>) =>
    apiClient.put<{ data: MeetingSettings }>(`/admin/courses/${courseId}/meeting`, body),
  regenerate: (courseId: number) =>
    apiClient.post<{ data: MeetingSettings }>(`/admin/courses/${courseId}/meeting/invite`),
  invitees: (params: { course_id?: number; q?: string }) =>
    apiClient.get<{ data: Invitee[] }>("/admin/meeting/invitees", { params }),
  sendInvites: (courseId: number, body: { user_ids: number[]; extra_emails: string[]; message?: string }) =>
    apiClient.post<{ data: { sent: number; failed: number; skipped?: number; mail_ready?: boolean } }>(`/admin/courses/${courseId}/meeting/send-invitations`, body),
  joinRequests: (courseId: number) =>
    apiClient.get<{ data: JoinRequest[] }>(`/admin/courses/${courseId}/join-requests`),
  decide: (courseId: number, id: number, admit: boolean) =>
    apiClient.post(`/admin/courses/${courseId}/join-requests/${id}/decide`, { admit }),
  admitAll: (courseId: number) =>
    apiClient.post(`/admin/courses/${courseId}/join-requests/admit-all`),
}