const { scanAttendance, getAttendance, enableCertificates } = require('../controllers/attendanceController');
const role = require('../middleware/role');
const Registration = require('../models/Registration');
const Event = require('../models/Event');

jest.mock('../models/Registration');
jest.mock('../models/Event');
jest.mock('../models/User');

function createMockRes() {
  return {
    statusCode: 200,
    result: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.result = payload;
      return this;
    },
  };
}

describe('QR Attendance Authorization and Scanning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Role Middleware Normalization', () => {
    it('allows user with role "admin"', () => {
      const req = { user: { id: 'admin1', role: 'admin' } };
      const res = createMockRes();
      const next = jest.fn();

      role(['admin'])(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it('allows user with role "Admin / Organizer" and "Organizer"', () => {
      const req1 = { user: { id: 'admin1', role: 'Admin / Organizer' } };
      const req2 = { user: { id: 'admin2', role: 'organizer' } };
      const res = createMockRes();
      const next1 = jest.fn();
      const next2 = jest.fn();

      role(['admin'])(req1, res, next1);
      role(['admin'])(req2, res, next2);

      expect(next1).toHaveBeenCalled();
      expect(next2).toHaveBeenCalled();
    });

    it('blocks student and professional users with 403', () => {
      const reqStudent = { user: { id: 'student1', role: 'student' } };
      const reqPro = { user: { id: 'pro1', role: 'professional' } };
      const resStudent = createMockRes();
      const resPro = createMockRes();
      const next = jest.fn();

      role(['admin'])(reqStudent, resStudent, next);
      role(['admin'])(reqPro, resPro, next);

      expect(next).not.toHaveBeenCalled();
      expect(resStudent.statusCode).toBe(403);
      expect(resStudent.result.message).toMatch(/access denied/i);
      expect(resPro.statusCode).toBe(403);
      expect(resPro.result.message).toMatch(/access denied/i);
    });
  });

  describe('Attendance Controller', () => {
    it('allows admin to fetch attendance list for an event', async () => {
      const eventMock = {
        _id: 'event1',
        title: 'Tech Fest',
        createdBy: 'admin1',
      };
      Event.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(eventMock),
      });
      Registration.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            {
              _id: 'reg1',
              userId: { name: 'John Student', email: 'john@student.edu', collegeName: 'State Tech' },
              attendanceStatus: 'present',
              certificateId: 'CERT-123',
            },
          ]),
        }),
      });

      const req = {
        params: { eventId: 'event1' },
        user: { id: 'admin1', role: 'admin' },
      };
      const res = createMockRes();

      await getAttendance(req, res);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.result)).toBe(true);
      expect(res.result[0].studentName).toBe('John Student');
    });

    it('allows admin to mark attendance for a registration', async () => {
      const regMock = {
        _id: 'reg1',
        eventId: { _id: 'event1', title: 'Tech Fest', createdBy: 'admin1' },
        userId: { _id: 'student1', name: 'John Student' },
        attendanceStatus: 'absent',
        save: jest.fn().mockResolvedValue(true),
      };

      Registration.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(regMock),
        }),
      });

      const req = {
        body: { registrationId: 'REG-123456', eventId: 'event1' },
        user: { id: 'admin1', role: 'admin' },
      };
      const res = createMockRes();

      await scanAttendance(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.result.msg).toMatch(/attendance marked/i);
      expect(regMock.attendanceStatus).toBe('present');
    });
  });
});
