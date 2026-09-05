const crypto = require('crypto');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const Team = require('../models/Team');
const User = require('../models/User');
const { generateAndSaveQr } = require('./registrationController');
const {
  sendConfirmationEmail,
  sendAdminRegistrationAlert,
} = require('../services/emailService');

function getRegistrationData(req, user) {
  return {
    name: req.body.name || user.name || '',
    collegeId: req.body.collegeId || user.collegeId || '',
    collegeName: user.collegeName || '',
    department: req.body.department || user.department || '',
  };
}

async function ensureCanJoin(event, userId) {
  if (!event) throw new Error('Event not found.');
  if ((event.eventType || 'individual') !== 'team') throw new Error('This is not a team event.');
  const now = new Date();
  if (!event.registrationDeadline || new Date(event.registrationDeadline) < now || new Date(event.date) < now)
    throw new Error('Registration is closed.');
  const existingRegistration = await Registration.findOne({ userId, eventId: event._id });
  if (existingRegistration) throw new Error('You are already registered for this event.');
  const existingTeam = await Team.findOne({ event: event._id, members: userId });
  if (existingTeam) throw new Error('You are already part of a team for this event.');
  if (event.eligibility === 'own_college') {
    const [admin, user] = await Promise.all([
      User.findById(event.createdBy).lean(),
      User.findById(userId).lean(),
    ]);
    if ((admin?.collegeName || '').trim().toLowerCase() !== (user?.collegeName || '').trim().toLowerCase())
      throw new Error('This event is only open to students from the organising college.');
  }
}

async function makeTeamCode(teamName) {
  const prefix = teamName.replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/).filter(Boolean).map((word) => word[0]).join('').slice(0, 3).toUpperCase() || 'TEAM';
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `${prefix}-${crypto.randomInt(1000, 10000)}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await Team.exists({ teamCode: code }))) return code;
  }
  throw new Error('Unable to generate a unique team code.');
}

async function createMemberRegistration(event, req, team) {
  if (event.maxRegistrations && event.registrationCount >= event.maxRegistrations)
    throw new Error('Event registration capacity is full.');
  const user = await User.findById(req.user.id).lean();
  const data = getRegistrationData(req, user || {});
  const registration = await new Registration({
    ...data,
    userId: req.user.id,
    eventId: event._id,
    team: team._id,
    registrationCode: `REG-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
  }).save();
  const qr = await generateAndSaveQr(registration, { eventId: event._id.toString(), studentName: data.name });
  if (qr) await registration.save();
  await Event.findByIdAndUpdate(event._id, { $inc: { registrationCount: 1 } });
  return registration;
}

function getBackendBaseUrl(req) {
  const reqProto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  return process.env.BACKEND_URL
    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '')
    || (process.env.RENDER_EXTERNAL_URL || '')
    || `${reqProto}://${req.get('host')}`;
}

async function sendRegistrationNotifications(event, req, registration) {
  try {
    const [student, admin, updatedEvent] = await Promise.all([
      User.findById(req.user.id).lean(),
      User.findById(event.createdBy).lean(),
      Event.findById(event._id).lean(),
    ]);
    if (!student) return;
    const registrationDetails = {
      _id: registration._id.toString(),
      name: registration.name || student.name || 'there',
      attendanceQr: registration.attendanceQr || '',
      attendanceQrBase64: registration.attendanceQrBase64 || '',
      registrationCode: registration.registrationCode || '',
    };
    if (student.email) {
      await sendConfirmationEmail(student.email, updatedEvent || event, registrationDetails, getBackendBaseUrl(req));
    }
    if (admin?.email) {
      await sendAdminRegistrationAlert(admin.email, updatedEvent || event, {
        name: student.name || registration.name || '',
        email: student.email || '',
        collegeName: student.collegeName || registration.collegeName || '',
        department: registration.department || '',
        collegeId: registration.collegeId || '',
      });
    }
  } catch (error) {
    console.error('[Team registration] Notification error:', error.message);
  }
}

function teamResponse(team, registration) {
  return Team.findById(team._id)
    .populate('leader', 'name email collegeName')
    .populate('members', 'name email collegeName')
    .lean()
    .then((data) => ({
      ...data,
      memberRegistration: registration
        ? {
            _id: registration._id,
            registrationCode: registration.registrationCode,
            attendanceQr: registration.attendanceQr,
            attendanceQrBase64: registration.attendanceQrBase64,
          }
        : null,
    }));
}

exports.createTeam = async (req, res) => {
  let team;
  try {
    const event = await Event.findById(req.params.eventId);
    await ensureCanJoin(event, req.user.id);
    const teamName = req.body.teamName?.trim();
    if (!teamName) return res.status(400).json({ msg: 'Team name is required.' });
    const minTeamSize = event.minTeamSize || 2;
    const maxTeamSize = event.maxTeamSize || 4;
    team = await new Team({
      event: event._id,
      teamName,
      teamCode: await makeTeamCode(teamName),
      leader: req.user.id,
      members: [req.user.id],
      minTeamSize,
      maxTeamSize,
      status: minTeamSize <= 1 ? 'ready' : 'forming',
    }).save();
    const registration = await createMemberRegistration(event, req, team);
    void sendRegistrationNotifications(event, req, registration);
    res.status(201).json(await teamResponse(team, registration));
  } catch (error) {
    if (team) await Team.findByIdAndDelete(team._id);
    res.status(400).json({ msg: error.message || 'Unable to create team.' });
  }
};

exports.joinTeam = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);
    await ensureCanJoin(event, req.user.id);
    const team = await Team.findOne({ event: event._id, teamCode: req.body.teamCode?.trim().toUpperCase() });
    if (!team) return res.status(404).json({ msg: 'Team not found for this event.' });
    if (team.members.length >= team.maxTeamSize) return res.status(400).json({ msg: 'Team Full' });
    const registration = await createMemberRegistration(event, req, team);
    try {
      team.members.push(req.user.id);
      team.status = team.members.length >= team.minTeamSize ? 'ready' : 'forming';
      await team.save();
    } catch (saveError) {
      await Registration.findByIdAndDelete(registration._id);
      await Event.findByIdAndUpdate(event._id, { $inc: { registrationCount: -1 } });
      throw saveError;
    }
    void sendRegistrationNotifications(event, req, registration);
    res.json(await teamResponse(team, registration));
  } catch (error) {
    res.status(400).json({ msg: error.message || 'Unable to join team.' });
  }
};

exports.myTeam = async (req, res) => {
  try {
    const team = await Team.findOne({ event: req.params.eventId, members: req.user.id });
    if (!team) return res.status(404).json({ msg: 'You are not part of a team for this event.' });
    res.json(await teamResponse(team));
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

exports.leaveTeam = async (req, res) => {
  try {
    const team = await Team.findOne({ event: req.params.eventId, members: req.user.id });
    if (!team) return res.status(404).json({ msg: 'You are not part of a team for this event.' });
    if (String(team.leader) === String(req.user.id) && team.members.length > 1)
      return res.status(400).json({ msg: 'The team leader cannot leave while other members remain.' });
    await Registration.deleteOne({ userId: req.user.id, eventId: req.params.eventId, team: team._id });
    await Event.findByIdAndUpdate(req.params.eventId, { $inc: { registrationCount: -1 } });
    if (team.members.length === 1) await Team.findByIdAndDelete(team._id);
    else {
      team.members = team.members.filter((member) => String(member) !== String(req.user.id));
      team.status = team.members.length >= team.minTeamSize ? 'ready' : 'forming';
      await team.save();
    }
    res.json({ msg: 'You left the team.' });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};