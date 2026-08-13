const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const upload = require('../middleware/upload');
const c = require('../controllers/eventController');

// Accept one file per request: "image" — event banner
const uploadFields = upload.fields([{ name: 'image', maxCount: 1 }]);

function handleMulterError(err, req, res, next) {
  if (err && err.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ msg: 'File too large. Maximum size is 5 MB.' });
  if (err) return res.status(400).json({ msg: err.message || 'File upload error' });
  next();
}

router.post('/', auth, role(['admin']), uploadFields, handleMulterError, c.createEvent);
router.get('/', c.getEvents);
router.get('/:id', c.getEventById);
router.put('/:id', auth, role(['admin']), uploadFields, handleMulterError, c.updateEvent);
router.delete('/:id', auth, role(['admin']), c.deleteEvent);

module.exports = router;
