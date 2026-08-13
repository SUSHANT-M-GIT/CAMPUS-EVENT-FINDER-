const Event = require('../models/Event');
const Registration = require('../models/Registration');
const User = require('../models/User');
const controller = require('../controllers/registrationController');

describe('RegistrationController', () => {
  beforeEach(() => {
    Event.findById = jest.fn();
    Registration.findOne = jest.fn();
    User.findById = jest.fn();
  });

  it('should block registration when the event date has already passed', async () => {
    Event.findById.mockResolvedValue({
      _id: 'event1',
      registrationDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      date: new Date(Date.now() - 24 * 60 * 60 * 1000),
      eligibility: 'all',
      createdBy: 'admin',
    });

    const req = {
      params: { eventId: 'event1' },
      body: { name: 'Test User', collegeId: 'C123', department: 'CS' },
      user: { id: 'user1' },
    };

    const res = {
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

    await controller.registerEvent(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.result.msg).toBe('Closed');
  });
});
