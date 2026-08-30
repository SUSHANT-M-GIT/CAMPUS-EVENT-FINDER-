const router = require('express').Router();
const auth = require('../middleware/auth');
const c = require('../controllers/adminController');
const role = require('../middleware/role');

router.get('/control-center', auth, role(['admin']), c.getControlCenter);
router.put('/accounts/:id/status', auth, role(['admin']), c.updateAccountStatus);
router.delete('/accounts/:id', auth, role(['admin']), c.deleteAccount);
router.get('/requests', auth, role(['admin']), c.listRequests);
router.put('/approve/:id', auth, role(['admin']), c.approveAdmin);
router.put('/reject/:id', auth, role(['admin']), c.rejectAdmin);

module.exports = router;
