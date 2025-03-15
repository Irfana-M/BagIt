const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema')
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const env = require("dotenv").config();
const mongoose = require("mongoose");
const { google } = require('googleapis');

const  pageNotFound = async (req,res)=>{
    try{
        res.render('page-404');
    }catch(error){
        res.redirect('/pageNotFound')
    }
};

const loadLogin = async (req,res)=>{
    try{
            if (req.session.user || req.session.googleId) {
                return res.redirect('/');
            }
            const status = req.query.status || null;
        
        
        return res.render('login',{status});
       
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
            
            return res.render("login",{message:"User not found",status:null})
        }
        if(findUser.isBlocked){
           
            return res.render("login",{message:"User is blocked by admin",status:null})
        }
        const passwordMatch = await bcrypt.compare(password,findUser.password)

        if(!passwordMatch){
           
            return res.render("login",{message:"Incorrect Password",status:null});
        }
        req.session.user = findUser._id;
        console.log( req.session.user)
        req.session.name=findUser.name || false;

        if(findUser){
        req.session.name = findUser.name ;
        }
      
        req.session.user = findUser._id.toString(); 
        res.redirect('/');
       

    } catch (error) {
        console.error("login error",)
        res.render("login",{message:"Login failed,Please try again later"});
    }
}

const loadSignUp = async (req,res)=>{
    try{
       return res.render('signup', { referralCode: req.query.ref || "" });

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
        const{name,email,phone,password,confirmPassword, referralCode} = req.body;
        if(password!==confirmPassword){
            return res.render("signup",{message:"Passwords do not match"});
        }

        const findUser = await User.findOne({email});
        if(findUser){
            return res.render("signup",{message:"User with this email already exist"});
        }

        let inviter = null;
        if (referralCode) {
            inviter = await User.findOne({ referralCode });
            if (!inviter) return res.status(400).send("Invalid referral code");
        }

        const otp = generateOtp();
        const emailSent = await sendVerificationEmail(email,otp);

        if(!emailSent){
            return res.json("email-error")
        }
       
        req.session.userData = {name,email,phone,password,inviter: inviter ? inviter.referralCode : null};
        req.session.userOtp = otp;
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


const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        console.log(req.body);

        if (otp === req.session.userOtp) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            let inviter = null;
            if (user.inviter) {  
                inviter = await User.findOne({ referralCode: user.inviter });
            }

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash,
                referredBy: inviter ? inviter._id : null
            });

            await saveUserData.save();

            if (inviter) {
                inviter.redeemedUsers.push(saveUserData._id);
                await inviter.save();

                
                await User.findByIdAndUpdate(inviter._id, {
                    $inc: { wallet: 50 }  
                });

                console.log(`Referrer ${inviter._id} rewarded with 50 credits`);
            }

            
            req.session.user = saveUserData;

            res.json({ success: true, redirectUrl: "/login" });

        } else { 
            res.status(400).json({ success: false, message: "Invalid OTP, please try again" });
        }

    } catch (error) { 
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
                res.status(200).json({success:true,message:"OTP resend successfully"})
            }else{
                res.status(500).json({success:false,message:"Failed to resend OTP.Please try again"})
            }
        }
     catch (error) {
        console.error("Error resend OTP",error);
        res.status(500).json({success:false,message:"Internal server error.Please try again"})
    }
}


const loadHomepage = async (req, res) => {
    try {
        // const userId = req.session.user;  
        const googleId = req.session.googleId;  

        const categories = await Category.find({ isListed: true });
        let productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 }
        });

        productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        productData = productData.slice(0, 8);

        const userData = req.user;

        // if (userId) {
        //     userData = await User.findOne({ _id: userId });
        // } else if (googleId) {
        //     console.log(userData)
        //     userData = await User.findOne({ googleId: googleId });
        // }

        
        res.render('home', { user: userData, products: productData,googleId });
    } catch (error) {
        console.error('Home page not found', error);
        res.status(500).send('Server error');
    }
};




const loadShoppingPage = async (req, res) => {
    try {
    //   const user = req.session.user;
    //   const userData = await User.findOne({ _id: user });
      const message = req.session.message || null;
      req.session.message = null;
      const categories = await Category.find({ isListed: true });
      const categoryIds = categories.map((category) => category._id.toString());
      const page = parseInt(req.query.page) || 1;
      const limit = 9;
      const skip = (page - 1) * limit;
  
      
      const gt = req.query.gt || null;
      const lt = req.query.lt || null;
  
      const products = await Product.find({
        isBlocked: false,
        category: { $in: categoryIds },
        quantity: { $gt: 0 },
      })
        .sort({ createdOn: -1 })
        .skip(skip)
        .limit(limit);
  
      const totalProducts = await Product.countDocuments({
        isBlocked: false,
        category: { $in: categoryIds },
        quantity: { $gt: 0 },
      });
  
      const totalPages = Math.ceil(totalProducts / limit);
      const categoriesWithIds = categories.map(category => ({
        _id: category._id,
        name: category.name,
      }));
    
      const sort = req.query.sort || ""; 
      const userData = req.user;

      res.render("shop", {
        user: userData,
        products: products,
        category: categoriesWithIds,
        selectedCategory: null,
        totalProducts: totalProducts,
        currentPage: page,
        totalPages: totalPages,
        message: message,
        sort,
        gt, 
        lt, 
      });
    } catch (error) {
      console.error("Error while loading shop page:", error);
      res.redirect("/pageNotFound");
    }
  };


  const filterProduct = async (req, res) => {
    try {
      const { category, gt, lt, sort, query, page = 1 } = req.query;
      const itemsPerPage = 9; 
  
      const filterQuery = {
        isBlocked: false,
        quantity: { $gt: 0 },
        salePrice: {
          $gte: parseFloat(gt) || 0,
          $lte: parseFloat(lt) || Infinity,
        },
      };
  
      if (category) {
        filterQuery.category = category;
      }
  
      if (query) {
        filterQuery.productName = { $regex: query, $options: "i" };
      }
  
      const sortQuery = {};
      if (sort === "price_asc") sortQuery.salePrice = 1;
      else if (sort === "price_desc") sortQuery.salePrice = -1;
      else if (sort === "name_asc") sortQuery.productName = 1;
      else if (sort === "name_desc") sortQuery.productName = -1;
      else sortQuery.createdOn = -1;
  
      
      const totalProducts = await Product.countDocuments(filterQuery);
      const totalPages = Math.ceil(totalProducts / itemsPerPage);
      console.log(totalPages)
  
      
      const products = await Product.find(filterQuery)
        .sort(sortQuery)
        .skip((page - 1) * itemsPerPage)
        .limit(itemsPerPage)
        .lean();
  
      res.json({
        success: true,
        products,
        totalProducts,
        totalPages,
        currentPage: parseInt(page),
      });
    } catch (error) {
      console.error("Error in filterProducts:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  };



const getContact = async (req, res) => {
    try {
        const user = req.session.user;
        if (!user) {
            // Handle case where user is not logged in
            return res.render("contact", { user: null });
        }
        
        const userData = await User.findOne({ _id: user });
        res.render("contact", {
            user: userData,
        });
    } catch (error) {
        console.error('Error in getContact:', error);
        res.redirect("/pageNotFound");
    }
};

const contactProcess = async (req, res) => {
    try {
        // Since userAuth middleware is present, req.user should be available
        const { name, email, subject, message } = req.body;

        // Input validation
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Configure nodemailer
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });

        let mailOptions = {
            from: `"${name}" <${email}>`,
            to: process.env.NODEMAILER_EMAIL,
            subject: subject,
            text: message,
            replyTo: email
        };

        const info = await transporter.sendMail(mailOptions);
        res.status(200).json({ 
            message: 'Message sent successfully', 
            response: info.response 
        });

    } catch (error) {
        console.error('Error in contactProcess:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};
const checkStatus = async (req,res)=>{
    const userId = req.session.user;
  if (!userId) {
    return res.json({ status: 'not_signed_in' });
  }

  User.findById(userId)
    .then(user => {
      if (!user) {
        delete req.session.user;
        delete req.session.name;
        return res.json({ status: 'not_found', redirect: '/login' });
      }
      if (user.isBlocked) {
        delete req.session.user;
        delete req.session.name;
        return res.json({ status: 'blocked', redirect: '/login?status=blocked' });
      }
      return res.json({ status: 'active' });
    })
    .catch(err => {
      console.error('Error checking status:', err);
      res.status(500).json({ status: 'error', message: 'Server error' });
    });
};




const logout = (req, res) => {
    if (req.session.user) {
        delete req.session.user;  
        delete req.session.name;  
        res.redirect("/login");   
    } else {
        res.redirect("/login");
    }
};











module.exports = {loadHomepage,pageNotFound,loadLogin,loadSignUp,signUp,verifyOtp,resendOtp,login,logout,
    loadShoppingPage,filterProduct,getContact,contactProcess,checkStatus
};