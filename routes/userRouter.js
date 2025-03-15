const express = require('express');
const router = express.Router();
const passport = require("passport");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const userController = require('../controllers/user/userController');
const productController = require("../controllers/user/productController");
const profileController = require("../controllers/user/profileController");
const cartController = require("../controllers/user/cartController");
const orderController = require("../controllers/user/orderController");
const wishlistController = require("../controllers/user/wishlistController");
const walletController = require("../controllers/user/walletController");
const {userAuth,adminAuth,noCache,redirectIfAuthenticated,checkUserStatus} = require("../middlewares/auth");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

//home page
router.get('/pageNotFound',userController.pageNotFound);
router.get('/',checkUserStatus,userController.loadHomepage);
//Product management
router.get("/shop",checkUserStatus,userController.loadShoppingPage);
router.get('/filter',userController.filterProduct);

router.get("/productDetails",productController.productDetails);
//Wishlist Management
router.get("/wishlist",userAuth,wishlistController.loadWishlist);
router.post("/addToWishlist",userAuth,wishlistController.addToWishlist);
router.get("/removeFromWishlist",userAuth,wishlistController.removeProducts);

//user management
router.get('/signup',noCache,userController.loadSignUp);
router.get('/login',noCache,redirectIfAuthenticated,userController.loadLogin);
router.post('/login',userController.login);
router.post('/signup',userController.signUp);
router.post('/verify_otp',userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);
router.get('/auth/google',passport.authenticate('google'))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/login'}),(req,res)=>{  
console.log('object');req.session.user = req.user._id;
        req.session.name=req.user.name || false;
        res.redirect('/')
    })
 router.get('/check-status',userController.checkStatus);

    
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
router.post("/add-address", userAuth,profileController.postAddAddress);
router.get("/editAddress",userAuth,profileController.editAddress)
router.post("/editAddress",userAuth,profileController.postEditAddress);
router.get("/deleteAddress",userAuth,profileController.deleteAddress);
//cart management
router.post("/addToCart",userAuth,cartController.addToCart);
router.get("/view-cart",userAuth,cartController.viewCart);
router.get("/deleteCart",userAuth,cartController.deleteCart);
router.get("/checkout",userAuth,cartController.getCheckout);
router.get("/confirmation",userAuth,cartController.getConfirmation);
router.post("/update-cart",userAuth,cartController.updateCart);
//coupen management
router.post("/apply-coupon",userAuth,cartController.applyCoupon);
router.post("/remove-coupon",userAuth,cartController.removeCoupon );


//order management
router.get("/orders",userAuth,orderController.getOrder);
router.post("/cancelOrder/:orderId/:productId",userAuth,orderController.cancelOrderItem);
router.get("/orderDetails/:orderId/:productId",userAuth,orderController.orderDetails);
router.put("/cancel-order/:orderId",userAuth,orderController.cancelOrder);
router.get("/getCheckout",userAuth,cartController.getSingleProductCheckout);

//payment management
router.post('/razorpay-payment',userAuth,orderController.razorpayPayment);
router.post('/razorpay-verify',userAuth,orderController.verifyRazorpay);
router.post('/cod-payment',userAuth,orderController.codPayment);
router.post('/wallet-payment',userAuth,orderController.walletPayment);
router.get('/payment-failure',userAuth,orderController.paymentFailure);
router.post('/retry-razorpay-payment',userAuth,orderController.retryRazorpayPayment);
router.post('/create-order',userAuth,orderController.createOrder)

//return management
router.post('/returnOrderItem',userAuth,orderController.returnOrder);

//Wallet MAnagement
router.get('/wallet',userAuth,walletController.getUserWallet);
router.post('/withdraw-money',userAuth,walletController.withdrawfromWallet);
router.post("/create-wallet-order", userAuth,walletController.createWalletOrder);
router.post("/verify-payment",userAuth, walletController.verifyPayment);

//referral management
router.get('/referral',userAuth,profileController.getReferral);
router.post('/send-referral',userAuth,profileController.sendReferral);


router.get('/download-invoice/:orderId',userAuth,orderController.downloadInvoice);

//Contact Management
router.get('/contact',userController.getContact);
router.post('/contactProcess',userAuth,userController.contactProcess);

//logout
router.get('/logout',userController.logout);





module.exports=router;
