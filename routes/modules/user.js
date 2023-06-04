const express = require('express')
const passport = require('../../config/passport')
const router = express.Router()
const userController = require('../../controllers/userController')
const { adminRole } = require('../../middleware/auth')

router.post('/signin', passport.authenticate('local', { session: false }), adminRole, userController.signIn)
router.post('/', userController.signUp)
module.exports = router
