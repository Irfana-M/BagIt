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
            res.render('home', { user: null, products: productData });
        }
    } catch (error) {
        console.error('Home page not found', error);
        res.status(500).send('Server error');
    }
};


const loadShoppingPage = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });
        const categories = await Category.find({ isListed: true });
        const categoryIds = categories.map((category) => category._id.toString());
        const page = parseInt(req.query.page) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

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
        //console.log(categoriesWithIds);
        // Render the shop page with the appropriate data
        res.render("shop", {
            user: userData,
            products: products,
            category: categoriesWithIds,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: totalPages,
        });
    } catch (error) {
        console.error("Error while loading shop page:", error);
        res.redirect("/pageNotFound");
    }
};


const filterProduct = async (req, res) => {
  console.log("success");
    try {
        const user = req.session.user;
       
        
        const category = req.query.category;
        
        const findCategory = category ? await Category.findOne({_id: category}) : null;
        const query = {
            isBlocked: false,
            quantity: { $gt: 0 }
        };
        
        if (findCategory) {
            query.category = findCategory._id;
        }

        let findProducts = await Product.find(query).lean();
        findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        const categories = await Category.find({ isListed: true });

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage);
        const currentProduct = findProducts.slice(startIndex, endIndex);

        let userData = null;
        if (user) {
            userData = await User.findOne({_id: user});
            if (userData) {
                const searchEntry = {
                    category: findCategory ? findCategory._id : null,
                    searchedOn: new Date()
                };
                userData.searchHistory.push(searchEntry);
                await userData.save();
            }
        }

        req.session.filteredProducts = currentProduct;
        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categories,
            totalPages,
            currentPage,
            selectedCategory: category || null,
        });

    } catch (error) {
        console.error("Error in filterProduct:", error);
        res.redirect("/pageNotFound");
    }
};


const filterByPrice = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });
        const categories = await Category.find({ isListed: true }).lean();

        // Parse query parameters for price filtering
        const gtPrice = parseFloat(req.query.gt) || 0;
        const ltPrice = parseFloat(req.query.lt) || Infinity;

        let findProducts = await Product.find({
            salePrice: { $gt: gtPrice, $lt: ltPrice },
            isBlocked: false,
            quantity: { $gt: 0 }
        }).lean();

        // Sort products by creation date (newest first)
        findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

        // Pagination logic
        const itemsPerPage = 6;
        const currentPage = Math.max(parseInt(req.query.page) || 1, 1);
        const totalPages = Math.ceil(findProducts.length / itemsPerPage);

        // Ensure currentPage is within valid range
        const validPage = Math.min(currentPage, totalPages);
        const startIndex = (validPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;

        const currentProducts = findProducts.slice(startIndex, endIndex);

        // Store filtered products in session
        req.session.filteredProducts = findProducts;

        // Render the shop page
        res.render("shop", {
            user: userData,
            products: currentProducts,
            category: categories,
            totalPages,
            currentPage: validPage,
        });
    } catch (error) {
        console.error("Error in filterByPrice:", error);
        res.redirect("/pageNotFound");
    }
};


const searchProducts = async (req, res) => {
    try {
        const user = req.session.user;
       

        const userData = await User.findOne({ _id: user });
        let search = req.body.query;
       

        const categories = await Category.find({ isListed: true }).lean();
        const categoryIds = categories.map(category => category._id.toString());
        let searchResult = [];

        // If filtered products are available in session
        if (req.session.filteredProducts && req.session.filteredProducts.length > 0) {
            searchResult = req.session.filteredProducts.filter(product => {
                return product.productName.toLowerCase().includes(search.toLowerCase());
            });
        } else {
            // If no filtered products in session, fetch from database
            searchResult = await Product.find({
                productName: { $regex: ".*" + search + ".*", $options: "i" },
                isBlocked: false,
                quantity: { $gt: 0 },
                category: { $in: categoryIds }
            });
        }
        

        // Sorting search results by creation date
        searchResult.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(searchResult.length / itemsPerPage);
        const currentProduct = searchResult.slice(startIndex, endIndex);

        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categories,
            totalPages,
            currentPage,
            count: searchResult.length // Total count of search results
        });
    } catch (error) {
        console.log("Error:", error);
        res.redirect("/pageNotFound");
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
    loadShoppingPage,filterProduct,filterByPrice,searchProducts
};