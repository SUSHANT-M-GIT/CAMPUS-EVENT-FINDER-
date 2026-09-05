const Event = require('../models/Event');
const Team = require('../models/Team');
const Registration = require('../models/Registration');

describe('Team event data contracts', () => {
  it('defaults new and legacy-compatible events to individual', () => {
    const event = new Event({ title: 'Legacy event' });

    expect(event.eventType).toBe('individual');
    expect(event.minTeamSize).toBeNull();
    expect(event.maxTeamSize).toBeNull();
  });

  it('rejects About text over 30 words', async () => {
    const event = new Event({
      title: 'Word limit event',
      about: Array.from({ length: 31 }, (_, index) => `word${index}`).join(' '),
    });

    await expect(event.validate()).rejects.toThrow('About must be 30 words or fewer');
  });

  it('keeps team members and registrations linked independently', () => {
    const team = new Team({
      event: '507f1f77bcf86cd799439011',
      teamName: 'Code Warriors',
      teamCode: 'CW-4821',
      leader: '507f1f77bcf86cd799439012',
      members: ['507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013'],
      minTeamSize: 2,
      maxTeamSize: 4,
      status: 'ready',
    });
    const firstRegistration = new Registration({
      userId: '507f1f77bcf86cd799439012',
      eventId: team.event,
      team: team._id,
    });
    const secondRegistration = new Registration({
      userId: '507f1f77bcf86cd799439013',
      eventId: team.event,
      team: team._id,
    });

    expect(team.members).toHaveLength(2);
    expect(firstRegistration.team.toString()).toBe(team._id.toString());
    expect(secondRegistration.team.toString()).toBe(team._id.toString());
    expect(firstRegistration.userId.toString()).not.toBe(secondRegistration.userId.toString());
  });

  it('rejects a team whose maximum size is below its minimum', async () => {
    const team = new Team({
      event: '507f1f77bcf86cd799439011',
      teamName: 'Invalid team',
      teamCode: 'IT-4821',
      leader: '507f1f77bcf86cd799439012',
      members: ['507f1f77bcf86cd799439012'],
      minTeamSize: 4,
      maxTeamSize: 2,
    });

    await expect(team.validate()).rejects.toThrow();
  });
});
