const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema')
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const env = require("dotenv").config();

const  pageNotFound = async (req,res)=>{
    try{
        res.render('page-404');
    }catch(error){
        res.redirect('/pageNotFound')
    }
};

const loadLogin = async (req,res)=>{
    try{
            return res.render('login');
       
    }catch(error){
        console.log('login page not loading:',error);
        res.status(500).send('Server error');
    }
};

const login = async(req,res)=>{
    try {
        const {email,password} = req.body;
        
        const  findUser = await User.findOne({isAdmin:0,email:email})
        
        if(!findUser){
            
            return res.render("login",{message:"User not found"})
        }
        if(findUser.isBlocked){
           
            return res.render("login",{message:"User is blocked by admin"})
        }
        const passwordMatch = await bcrypt.compare(password,findUser.password)

        if(!passwordMatch){
           
            return res.render("login",{message:"Incorrect Password"});
        }
        req.session.user = findUser._id;
        req.session.name=findUser.name || false;

        if(findUser){
        req.session.name = findUser.name ;
        }
      
        res.redirect("/");
       

    } catch (error) {
        console.error("login error",)
        res.render("login",{message:"Login failed,Please try again later"});
    }
}

const loadSignUp = async (req,res)=>{
    try{
       return res.render('signup');

    }catch(error){
        console.log('Signup page not loading:',error);
        res.status(500).send('Server error');
    }
};

function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString();
}

async function sendVerificationEmail(email,otp){
    try{
        const transporter = nodemailer.createTransport({

            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Verify your account",
            text:`Your OTP is ${otp}`,
            html:`<b>Your OTP:${otp}</b>`
        }) 
        return info.accepted.length >0

    }catch(error){
        console.error("Error sending email",error);
    }
}

const signUp = async (req,res)=>{
    try{
        const{name,email,phone,password,confirmPassword} = req.body;
        if(password!==confirmPassword){
            return res.render("signup",{message:"Passwords do not match"});
        }

        const findUser = await User.findOne({email});
        if(findUser){
            return res.render("signup",{message:"User with this email already exist"});
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email,otp);

        if(!emailSent){
            return res.json("email-error")
        }
        req.session.userOtp = otp;
        req.session.userData = {name,email,phone,password};

        res.render("verify_otp");
        console.log("OTP sent",otp);
        
        

    }catch(error){
        console.error("Signup Error",error);
        res.redirect("/pageNotFound")
    }
}

const securePassword = async (password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10)
        return passwordHash;
    } catch (error) {
        
    }
}
const verifyOtp = async(req,res)=>{
    
    try {
        const {otp} = req.body;
        console.log(req.body);
        
        if(otp===req.session.userOtp){
            const user = req.session.userData
            const passwordHash = await securePassword(user.password);
            const saveUserData = new User({
                name:user.name,
                email:user.email,
                phone:user.phone,
                password:passwordHash,
                // googleId:user.googleId || undefined
            });
         
            
            await saveUserData.save();
             req.session.user = saveUserData._id;
             
              res.json({ success: true, redirectUrl: "/" });
            

        } else { res.status(400).json({ success: false, message: "Invalid OTP, please try again" });
             } 

    } catch (error)
             { 
                 console.log("Error verifying OTP", error);
                 res.status(500).json({ success: false, message: "An error occurred" }); 
                } 
                };

const resendOtp = async(req,res)=>{
    try {
        const {email} = req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"});
        }
            const otp = generateOtp();
            req.session.userOtp = otp;
            const emailSent = await sendVerificationEmail(email,otp);
            if(emailSent){
                console.log("Resend OTP:",otp);
                res.status(200).json({succes:true,message:"OTP resend successfully"})
            }else{
                res.status(500).json({succes:false,message:"Failed to resend OTP.Please try again"})
            }
        }
     catch (error) {
        console.error("Error resend OTP",error);
        res.status(500).json({success:false,message:"Internal server error.Please try again"})
    }
}


const loadHomepage = async (req, res) => {
    try {
        const userId = req.session.user;

        const categories = await Category.find({ isListed: true });
        let productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 }
        });

        productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        productData = productData.slice(0, 4);

        if (userId) {
            const userData = await User.findOne({ _id: userId });
            res.render('home', { user: userData, products: productData });
        } else {
            res.render('home', { user: { name: req.session.name }, products: productData });
        }
    } catch (error) {
        console.error('Home page not found', error);
        res.status(500).send('Server error');
    }
};


const loadShoppingPage = async (req, res) => {
    try {
        console.log("success");
        res.render('shop');
    } catch (error) {
        console.error("Error while loading shop page:", error);
        res.redirect("/pageNotFound");
    }
};

module.exports = {
    loadShoppingPage,
};


const logout = async (req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destruction error");
                return res.redirect("/pageNotFound");
            }
            return res.redirect("/login");
        })
    } catch (error) {
        console.log("Logout error",error);
        res.redirect("/pageNotFound");
    }
}

module.exports = {loadHomepage,pageNotFound,loadLogin,loadSignUp,signUp,verifyOtp,resendOtp,login,logout,
    loadShoppingPage
};