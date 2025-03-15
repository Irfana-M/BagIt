const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const env = require('dotenv').config();
const session = require('express-session');


function generateOtp() {
    const digits = "1234567890";
    let otp = "";
    for(let i=0;i<6;i++){
        otp += digits[Math.floor(Math.random()* 10)];
    }
    return otp;
}

const sendVerificationEmail = async (email,otp)=>{
    try {
        const transporter = nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD,
            }
        })
        const mailOptions = {
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Your OTP for password reset",
            text:`Your OTP is ${otp}`,
            html:`<b><h4>Your OTP:${otp}<h4><br></b>`
        }
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent:",info.messageId);
        return true;
        
    } catch (error) {
        console.error("Error sending email",error);
        return false;
    }
}


const securePassword  = async (password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10);
        return passwordHash
    } catch (error) {
        console.error("Error in securePassword:", error);
        throw error;
    }
}

const getForgotPassPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        res.render("forgot-password",{user:userData,}); // Ensure 'forgot-password.ejs' exists in your views folder
    } catch (error) {
        console.error("Error rendering Forgot Password page:", error);
        res.redirect("/pageNotFound"); // Handle cases where the view or other logic fails
    }
};


const forgotEmailValid = async(req,res)=>{
    try {
       
        const {email} = req.body;
        const findUser = await User.findOne({email:email});
        if(findUser){
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email,otp);
            if(emailSent){
                req.session.userOtp = otp;
                req.session.email = email;
                res.render("forgotPass-otp");
                console.log("OTP",otp);
            }else{
                res.json({success:false,message:"Failed to send OTP.Please try again"});
            }
        }else{
            res.render("forgot-password",{
                message:"User with this email does not exist",
                user:req.user
            });
        }
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}


const verifyForgotPassOtp = async (req,res)=>{
    try {
        const enteredOtp = req.body.otp;
        if(enteredOtp === req.session.userOtp){
            res.json({success:true,redirectUrl:'/reset-password'});
        }else{
            res.json({success:false,message:'OTP not matching'});
        }
    } catch (error) {
        res.status(500).json({success:false,message:'An error occured,Please try again'});
    }
}


const getResetPassPage = async (req,res)=>{
    try {
       res.render('reset-password'); 
    } catch (error) {
       res.redirect('/pageNotFound'); 
    }
}


const resendOtp = async (req,res)=>{
    try {
        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        console.log("Resending OTP to email:",email);
        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("Resend OTP:",otp);
            res.status(200).json({success:true,message:"Resend OTP successful"});
        }
    } catch (error) {
        console.error("Error in resend otp",error);
        res.status(500).json({success:false,message:"Internal Server Error"})
    }
}


const postNewPassword = async (req,res)=>{
    try {
        const {newPass1,newPass2} = req.body;
        const email = req.session.email;
        if(newPass1 === newPass2){
            const passwordHash = await securePassword(newPass1);
            await User.updateOne({email:email},
                {$set:{password:passwordHash}}
            )
            res.redirect("/login");
        }else{
            res.render("reset-password",{message:"Passwords do not match"});
        }
    } catch (error) {
        console.error("Error in postNewPassword:", error);
        res.redirect("/pageNotFound");
    }
}


const userProfile = async (req,res)=>{
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const addressData = await Address.findOne({userId : userId});
        res.render('profile',{
            user:userData,
            userAddress:addressData
        })
    } catch (error) {
        console.error('Error for retrieving profile data',error);
        res.redirect("/pageNotFound");
    }
}

const changeEmailValid = async (req,res)=>{
    try {
        
        const {email} = req.body;
        const userExists = await User.findOne({email});
        if(userExists){
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email,otp);
            if(emailSent){
                req.session.userOtp = otp;
                req.session.userData = req.body;
                req.session.email = email;
                res.render("change-email-otp");
                console.log("Email Sent",email);
                console.log("OTP:",otp)
            }else{
                res.json("email-error");
            }
        }else{
            res.render("change-email",{
                message:"User with this email does not exist",
                user:req.user,
            });
        }
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}


const changeEmail = async (req,res)=>{
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        res.render("change-email",{
            user:userData,
        });
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}


const verifyEmailOtp = async (req,res)=>{
    try {
        const enteredOtp = req.body.otp;
        if(enteredOtp === req.session.userOtp){
            req.session.userData = req.body.userData;
            res.render("new-email",{
                userData:req.session.userData,
            })
        }else{
            res.render("change-email-otp",{
                message:"OTP not matching",
                userData:req.session.userData
            })
        }
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const updateEmail = async (req, res) => {
    try {
        console.log("success");
        const { newEmail } = req.body;  
        const userId = req.session.user;

        
        if (!newEmail || !validateEmail(newEmail)) {
            return res.render("userProfile", { message: "Please provide a valid email address." });
        }

        
        const updatedUser = await User.findByIdAndUpdate(userId, { email: newEmail }, { new: true });

        if (updatedUser) {
            
            res.redirect("/userProfile");  
        } else {
            
            res.render("userProfile", { message: "User not found." });
        }
    } catch (error) {
        console.error("Error in updateEmail:", error);
        res.render("userProfile", { message: "An error occurred while updating the email. Please try again later." });
    }
};


const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
};


const changePassword = async (req,res)=>{
    try {
        res.render("change-password");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}

const changePasswordValid = async(req,res)=>{
    try {
        const {email} = req.body;
        const userExists = await User.findOne({email});
        if(userExists){
            const otp = generateOtp();
            const emailSent = await sendVerificationEmail(email,otp);
            if(emailSent){
                req.session.userOtp = otp;
                req.session.userData = req.body;
                req.session.email = email;
                res.render("change-password-otp");
                console.log('OTP:',otp);
            }else{
                res.json({
                    success:false,
                    message:"Failed to send OTP,Please try again",
                })
            }
        }else{
            res.render("change-password",{
                message:"User with this email already exist"
            })
        }
    } catch (error) {
        console.log("Error in change password validation",error);
        res.redirect("/pageNotFound");
    }
}


const verifyChangePassOtp = async(req,res)=>{
    try {
        const enteredOtp = req.body.otp;
        if(enteredOtp === req.session.userOtp){
            res.json({success:true,redirectUrl:"/reset-password"});
        }else{
            res.json({success:false,message:"OTP not matching"});
        }
    } catch (error) {
        res.status(500).json({success:false,message:"An error occured, Please try agin later"});
    }
}


const getMyAddress = async(req,res)=>{
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const addressData = await Address.findOne({userId : userId});
        
            res.render("myAddress", {
                user: userData, 
                userAddress: addressData 
              });
              
        
    } catch (error) {
        console.error("Error to find addresses",error)
        res.redirect("/pageNotFound");
    }
}


const addAddress = async (req,res)=>{
    try {
        const redirectTo = req.query.redirectTo || "userProfile";
        console.log(redirectTo)
        const user = req.session.user;
        res.render('add-address',{user: user, redirectTo: redirectTo });
    } catch (error) {
        res.redirect('/pageNotFound');
    }
}

const postAddAddress = async (req,res)=>{
    try {
        const { redirectTo } = req.body;
        console.log(redirectTo);
        const userId = req.session.user;
        const userData = await User.findOne({_id:userId});
        const {addressType,name,city,landMark,state,pincode,phone,altPhone} = req.body;

        const userAddress = await Address.findOne({userId:userData._id});
        if(!userAddress){
            const newAddress = new Address({
                userId : userData._id,
                address : [{addressType,name,city,landMark,state,pincode,phone,altPhone}]
            });
            await newAddress.save();
        }else{
            userAddress.address.push({addressType,name,city,landMark,state,pincode,phone,altPhone});
            await userAddress.save();
        }
        if (redirectTo === "checkout") {
            res.redirect("/checkout");
        } else {
            res.redirect("/userProfile");
        }
    } catch (error) {
        console.error("Error adding address",error);
        res.redirect("/pageNotFound");
    }
}


const editAddress = async (req,res)=>{
    try {
        const addressId = req.query.id;
        const user = req.session.user;
        const currAddress = await Address.findOne({
            "address._id" : addressId
        })
        if(!currAddress){
            return res.redirect("/pageNotFound");
        }
        const addressData = currAddress.address.find((item)=>{
            return item._id.toString()===addressId.toString();
        })
        if(!addressData){
            return res.redirect("/pageNotFound");
        }
        res.render("edit-address",{address:addressData,user:user});
    } catch (error) {
        console.error('Error in edit address',error);
        res.redirect("/pageNotFound");
    }
}


const postEditAddress = async (req,res)=>{
    try {
        const data = req.body;
        const addressId = req.query.id;
        const user = req.session.user;
        const findAddress = await Address.findOne({"address._id":addressId});
        if(!findAddress){
            res.redirect("/pageNotFound");
        }
        await Address.updateOne(
            {"address._id" : addressId},
            {$set:{
                "address.$" : {
                    _id: addressId,
                    addressType: data.addressType,
                    name: data.name,
                    city: data.city,
                    landMark: data.landMark,
                    state: data.state,
                    pincode: data.pincode,
                    phone:data.phone,
                    altPhone:data.altPhone
                }

            }}
        )
        res.redirect("/myAddress")
    } catch (error) {
        console.error("Error in edit addresses",error);
        res.redirect("/pageNotFound");
    }
}


const deleteAddress = async (req,res)=>{
    try {
        const addressId = req.query.id;
        const findAddress = await Address.findOne({"address._id":addressId});
        if(!findAddress){
            return res.status(404).send("Address not found");
        }
        await Address.updateOne({
            "address._id":addressId
        },
        {
            $pull : {
                address : {
                    _id : addressId,
                }
            }
        }
    )
    res.redirect("/myAddress");

    } catch (error) {
        console.error("Error in delete address",error);
        res.redirect("/pageNotFound");
    }
}

const getReferral = async (req, res) => {
    const userId = req.session.user;
    console.log(userId)
    try {
        const user = await User.findById(userId);
        console.log("user",user);

        if (!user) {
            return res.redirect('/login'); 
        }

        const referralLink = `https://localhost:3005/signup?ref=${user.referralCode}`;

       
        const referrals = await User.find({ referredBy: user._id }) || null;

        res.render('referral', { referralLink, referrals ,user});

    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading referrals");
    }
};



const sendReferral = async (req, res) => {
    try {
        const { friendEmail } = req.body;

        if (!req.session.user) {
            return res.redirect('/login'); 
        }

       
        const user = await User.findById(req.session.user._id);

        if (!user || !user.referralCode) {
            return res.redirect('/referral?error=Invalid Referral Code');
        }

        
        await sendReferralEmail(friendEmail, user.referralCode);

        res.redirect('/referral?success=Email Sent!');
    } catch (err) {
        console.error("Error sending referral email:", err);
        res.redirect('/referral?error=Failed to send email');
    }
};




module.exports = {userProfile,getForgotPassPage,forgotEmailValid,changeEmail,changeEmailValid,
    verifyForgotPassOtp,getResetPassPage,resendOtp,postNewPassword,verifyEmailOtp,updateEmail,
    changePassword,changePasswordValid,verifyChangePassOtp,getMyAddress,addAddress,postAddAddress,
    editAddress,postEditAddress,deleteAddress,getReferral,sendReferral
}