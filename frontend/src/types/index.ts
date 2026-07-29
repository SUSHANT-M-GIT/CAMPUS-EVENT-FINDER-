export type UserRole = "admin" | "student" | "professional";

export interface AuthUser {
  id: string;
  role: UserRole;
  name?: string;
  collegeName?: string;
  company?: string;
  designation?: string;
}

export interface EventItem {
  _id: string;
  title: string;
  description: string;
  type: "hackathon" | "tech" | "seminar" | "games" | "movie" | "other";
  date: string;
  time: string;
  registrationDeadline: string;
  location: string;
  createdBy?: string;
  maxRegistrations?: number;
  registrationCount?: number;
  eligibility?: "all" | "own_college";
  tags?: string[];
  avgRating?: number;
  feedbackCount?: number;
  bannerImage?: string;
  bannerSource?: "local" | "gdrive" | "";
  createdAt?: string;
  updatedAt?: string;
  // Payment fields
  isPaid?: boolean;
  price?: number;
  upiId?: string;
  qrImage?: string;
  // Refund policy
  refundAllowed?: boolean;
  refundPercentage?: number;
  refundCutoffHours?: number;
  // Certificate
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
  userId: string | { _id: string; name: string; email: string; };
  eventId: string | EventItem;
  registeredAt: string;
  name?: string;
  collegeId?: string;
  collegeName?: string;
  department?: string;
  status?: "confirmed" | "waitlisted";
  waitlistPosition?: number | null;
  // Payment fields
  paymentStatus?: "free" | "pending" | "approved" | "rejected";
  transactionId?: string;
  paymentScreenshot?: string;
  paymentNote?: string;
  // QR Attendance
  attendanceQr?: string;
  attendanceStatus?: "absent" | "present";
  // Refund
  refundStatus?: "none" | "requested" | "approved" | "rejected";
  refundAmount?: number;
  refundNote?: string;
  // Certificate
  certificateId?: string;
  // Cancellation request
  cancellationStatus?: "none" | "requested" | "approved" | "rejected";
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
