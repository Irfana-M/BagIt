const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema')
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const env = require("dotenv").config();
const mongoose = require("mongoose");

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
        console.log( req.session.user)
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
            if (user.inviter) {  // `user.inviter` now stores referralCode
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

                // Reward referrer by adding 50 to wallet (if wallet field exists)
                await User.findByIdAndUpdate(inviter._id, {
                    $inc: { wallet: 50 }  
                });

                console.log(`Referrer ${inviter._id} rewarded with 50 credits`);
            }

            // Store full user session
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
        const userId = req.session.user;  // Normal login
        const googleId = req.session.googleId;  // Google login

        const categories = await Category.find({ isListed: true });
        let productData = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 }
        });

        productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        productData = productData.slice(0, 8);

        let userData = null;

        if (userId) {
            userData = await User.findOne({ _id: userId });
        } else if (googleId) {
            console.log(userData)
            userData = await User.findOne({ googleId: googleId });
        }

        res.render('home', { user: userData, products: productData,googleId });
    } catch (error) {
        console.error('Home page not found', error);
        res.status(500).send('Server error');
    }
};




const loadShoppingPage = async (req, res) => {
    try {
      const user = req.session.user;
      const userData = await User.findOne({ _id: user });
      const message = req.session.message || null;
      req.session.message = null;
      const categories = await Category.find({ isListed: true });
      const categoryIds = categories.map((category) => category._id.toString());
      const page = parseInt(req.query.page) || 1;
      const limit = 9;
      const skip = (page - 1) * limit;
  
      // Extract gt and lt from query parameters (default to null if not provided)
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
    
      const sort = req.query.sort || ""; // Get sorting value from query params
  
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
        gt, // Pass gt to the template
        lt, // Pass lt to the template
      });
    } catch (error) {
      console.error("Error while loading shop page:", error);
      res.redirect("/pageNotFound");
    }
  };


  const filterProduct = async (req, res) => {
    try {
      const { category, gt, lt, sort, query, page } = req.query;
  
      // Build filter query
      const filterQuery = {
        isBlocked: false,
        quantity: { $gt: 0 },
        salePrice: { $gte: parseFloat(gt) || 0, $lte: parseFloat(lt) || Infinity },
      };
  
      // Apply category filter
      if (category) {
        filterQuery.category = category;
      }
  
      // Apply search filter
      if (query) {
        filterQuery.productName = { $regex: query, $options: "i" };
      }
  
      // Sorting logic
      const sortQuery = {};
      if (sort === "price_asc") sortQuery.salePrice = 1;
      else if (sort === "price_desc") sortQuery.salePrice = -1;
      else if (sort === "name_asc") sortQuery.productName = 1;
      else if (sort === "name_desc") sortQuery.productName = -1;
      else sortQuery.createdOn = -1; // Default sorting
  
      // Pagination
      const itemsPerPage = 6;
      const currentPage = parseInt(page) || 1;
      const totalProducts = await Product.countDocuments(filterQuery);
      const totalPages = Math.ceil(totalProducts / itemsPerPage);
      const skip = (currentPage - 1) * itemsPerPage;
  
      // Fetch products
      const products = await Product.find(filterQuery)
        .sort(sortQuery)
        .skip(skip)
        .limit(itemsPerPage)
        .lean();
  
      // Send JSON response
      res.json({
        success: true,
        products,
        totalPages,
        currentPage,
      });
    } catch (error) {
      console.error("Error in filterProducts:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  };








const logout = async (req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destruction error",err);
                return res.redirect("/");
            }
            return res.redirect("/login");
        })
    } catch (error) {
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.redirect('/login'); // Redirect to the login page after logout
    }
}









module.exports = {loadHomepage,pageNotFound,loadLogin,loadSignUp,signUp,verifyOtp,resendOtp,login,logout,
    loadShoppingPage,filterProduct,
};