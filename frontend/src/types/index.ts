export type UserRole = 'admin' | 'student' | 'professional';

// UI-facing role labels (general maps internally to 'professional')
export type UIRole = 'student' | 'professional' | 'general' | 'admin';

export interface AuthUser {
  id: string;
  role: UserRole;
  name?: string;
  email?: string;
  collegeName?: string;
  collegeId?: string;
  department?: string;
  company?: string;
  designation?: string;
  phone?: string;
  isVerified?: boolean;
  clubName?: string;
  officialEmail?: string;
  instagramHandle?: string;
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  accountStatus?: 'active' | 'flagged' | 'suspended' | 'deactivated';
  createdAt?: string;
  updatedAt?: string;
}

export interface EventItem {
  _id: string;
  title: string;
  description: string;
  type: 'hackathon' | 'tech' | 'seminar' | 'games' | 'movie' | 'other';
  date: string;
  time: string;
  registrationDeadline: string;
  location: string;
  createdBy?: string;
  administrationName?: string;
  adminName?: string;
  maxRegistrations?: number;
  registrationCount?: number;
  eligibility?: 'all' | 'own_college';
  tags?: string[];
  avgRating?: number;
  feedbackCount?: number;
  bannerImage?: string;
  bannerSource?: 'local' | 'gdrive' | '';
  createdAt?: string;
  updatedAt?: string;
  // Certificate
  attendanceEnabled?: boolean;
  certificatesEnabled?: boolean;
}

export interface FeedbackItem {
  _id: string;
  eventId: string;
  userId: { _id: string; name: string; email: string; collegeName: string } | string;
  rating: number;
  comment: string;
  submittedAt: string;
}

export interface RegistrationItem {
  _id: string;
  userId: string | { _id: string; name: string; email: string };
  eventId: string | EventItem;
  registeredAt: string;
  name?: string;
  collegeId?: string;
  collegeName?: string;
  department?: string;
  status?: 'confirmed' | 'waitlisted';
  waitlistPosition?: number | null;
  // QR Attendance
  attendanceQr?: string;
  attendanceQrBase64?: string;
  attendanceStatus?: 'absent' | 'present';
  // Certificate
  certificateId?: string;
  // Cancellation request
  cancellationStatus?: 'none' | 'requested' | 'approved' | 'rejected';
  cancellationNote?: string;
  // Unique registration code
  registrationCode?: string;
}

export interface ApiMessage {
  msg: string;
}

export interface CommentUser {
  _id: string;
  name: string;
  role: string;
  collegeName?: string;
}

export interface CommentItem {
  _id: string;
  eventId: string;
  userId: CommentUser | string;
  text: string;
  parentId: string | null;
  createdAt: string;
  replies: CommentItem[];
}
