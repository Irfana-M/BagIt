const express = require('express');
const router = express.Router();
const passport = require("passport");
const userController = require('../controllers/user/userController');
const productController = require("../controllers/user/productController");
const profileController = require("../controllers/user/profileController");
const cartController = require("../controllers/user/cartController");
const {userAuth,adminAuth} = require("../middlewares/auth");
//const google = require('google');

//home page
router.get('/pageNotFound',userController.pageNotFound);
router.get('/',userController.loadHomepage);
//Product management
router.get("/shop",userController.loadShoppingPage);
router.get('/filter',userController.filterProduct);
router.get('/filterPrice',userController.filterByPrice);
router.post('/search',userController.searchProducts);
router.get("/productDetails",productController.productDetails);
router.get("/sortProduct",userController.getSortProduct);
//user management
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
//profile management
router.get("/forgot-password", profileController.getForgotPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid);
router.post('/verify-passForgot-otp',profileController.verifyForgotPassOtp);
router.get('/reset-password',profileController.getResetPassPage);
router.post('/reset-password',profileController.postNewPassword)
router.post('/resend-forgot-otp',profileController.resendOtp);
router.get("/userProfile",userAuth,profileController.userProfile);
router.get("/change-email",userAuth,profileController.changeEmail);
router.post("/change-email",userAuth,profileController.changeEmailValid);
router.post("/verify-email-otp",userAuth,profileController.verifyEmailOtp);
router.post("/update-email",userAuth,profileController.updateEmail);
router.get("/change-password",userAuth,profileController.changePassword);
router.post("/change-password",userAuth,profileController.changePasswordValid);
router.post("/verify-changepassword-otp",userAuth,profileController.verifyChangePassOtp);
//address management
router.get("/myAddress",userAuth,profileController.getMyAddress);
router.get("/add-address",userAuth,profileController.addAddress);
router.post("/add-address",userAuth,profileController.postAddAddress);
router.get("/editAddress",userAuth,profileController.editAddress)
router.post("/editAddress",userAuth,profileController.postEditAddress);
router.get("/deleteAddress",userAuth,profileController.deleteAddress);
//cart management
router.get("/add-To-cart",userAuth,cartController.addToCart);
router.get("/view-cart",userAuth,cartController.viewCart);
router.get("/deleteCart",userAuth,cartController.deleteCart);

//logout
router.get('/logout',userController.logout);





module.exports=router;
