const express = require('express');
const router = express.Router();
const passport = require("passport");
const userController = require('../controllers/user/userController');
const {userAuth,adminAuth} = require("../middlewares/auth");
//const google = require('google');


router.get('/pageNotFound',userController.pageNotFound);
router.get('/',userController.loadHomepage);
router.get('/signup',userController.loadSignUp);
router.get('/login',userController.loadLogin);
router.post('/login',userController.login);
router.post('/signup',userController.signUp);
router.post('/verify_otp',userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/')
});

router.get("/shop",userAuth,userController.loadShoppingPage);
router.get('/logout',userController.logout);





module.exports=router;
