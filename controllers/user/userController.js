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
    const sort = req.query.sort || ""; // Get sorting value from query params


    res.render("shop", {
        user: userData,
        products: products,
        category: categoriesWithIds,
        totalProducts: totalProducts,
        currentPage: page,
        totalPages: totalPages,
        message: message ,
        sort
    });
} catch (error) {
    console.error("Error while loading shop page:", error);
    res.redirect("/pageNotFound");
}
};



const filterProduct = async (req, res) => {
  
    try {
        const user = req.session.user;
        const message = req.session.message || null;
        req.session.message = null;
        
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
        const sort = req.query.sort || ""; // Get sorting value from query params
        
        
        req.session.filteredProducts = currentProduct;
        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categories,
            totalPages,
            currentPage,
            selectedCategory: category || null,
            message: message ,
            sort
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
        let message = req.session.message || null;
        req.session.message = null;  
        const gtPrice = parseFloat(req.query.gt) || 0; 
        const ltPrice = parseFloat(req.query.lt) || Infinity; 
        let findProducts = await Product.find({
            salePrice: { $gt: gtPrice, $lt: ltPrice }, 
            quantity: { $gt: 0 } 
        }).lean();

        
        findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

        
        const itemsPerPage = 6;
        const currentPage = Math.max(parseInt(req.query.page) || 1, 1);
        const totalPages = Math.ceil(findProducts.length / itemsPerPage);

        
        const validPage = Math.min(currentPage, totalPages);
        const startIndex = (validPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;

        const currentProducts = findProducts.slice(startIndex, endIndex);

        
        req.session.filteredProducts = findProducts;

        const sort = req.query.sort || ""; 

        res.render("shop", {
            user: userData,
            products: currentProducts,
            category: categories,
            totalPages,
            currentPage: validPage,
            message,sort
        });

        
    } catch (error) {
        console.error("Error in filterByPrice:", error);
        res.redirect("/pageNotFound");
    }
};


const searchProducts = async (req, res) => {
    try {
        const user = req.session.user;
        const message = req.session.message || null;
        req.session.message = null;

        const userData = await User.findOne({ _id: user });

        let search = (req.body.query || req.query.query || "").toString().trim();
        let gt = parseInt(req.query.gt) || 0;
        let lt = parseInt(req.query.lt) || Number.MAX_SAFE_INTEGER;
        let sortOption = req.query.sort || "";
        let selectedCategory = req.query.category || "";

        const categories = await Category.find({ isListed: true }).lean();
        const categoryIds = categories.map(category => category._id);

        let query = {
            isBlocked: false,
            quantity: { $gt: 0 },
            salePrice: { $gte: gt, $lte: lt }
        };

        console.log("selectedCategory:", selectedCategory);

        // Handle Category Filtering using conditional array
        if (selectedCategory) {
            if (mongoose.Types.ObjectId.isValid(selectedCategory)) {
                query.category = new mongoose.Types.ObjectId(selectedCategory);
            } else {
                query.category = { $in: categoryIds };
            }
            console.log("Category Filter (selectedCategory):", query.category);
        } else if (categoryIds.length > 0) {
            query.category = { $in: categoryIds };
            console.log("Category Filter (all categories):", query.category);
        }

        // Apply search filter for product name if search term exists
        if (search) {
            query.productName = { $regex: search, $options: "i" };
        }

        console.log("Final Query Object:", JSON.stringify(query, null, 2));

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let skip = (currentPage - 1) * itemsPerPage;

        // Sorting Logic
        let sortCriteria = {};
        if (sortOption === "price_asc") {
            sortCriteria.price = 1;
        } else if (sortOption === "price_desc") {
            sortCriteria.price = -1;
        } else {
            sortCriteria.createdOn = -1;
        }

        console.log("Sorting Criteria:", sortCriteria);
        console.log("Pagination - Skip:", skip, " Items Per Page:", itemsPerPage);

        let searchResult = await Product.find(query)
            .sort(sortCriteria)
            .skip(skip)
            .limit(itemsPerPage)
            .lean();

        console.log("Search Result:", searchResult);

        let totalProducts = await Product.countDocuments(query);
        let totalPages = Math.ceil(totalProducts / itemsPerPage);

        res.render("shop", {
            user: userData,
            products: searchResult,
            category: categories,
            totalPages,
            currentPage,
            count: totalProducts,
            message,
            sort: sortOption,
            selectedCategory
        });

    } catch (error) {
        console.error("Search Error:", error);
        res.redirect("/pageNotFound");
    }
};





const sortProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });
        const categories = await Category.find({ isListed: true }).lean();
        let message = req.session.message || null;
        req.session.message = null;

        const { category, gt, lt, sort, page } = req.query;

        // Set default price range
        const gtPrice = parseFloat(gt) || 0;
        const ltPrice = parseFloat(lt) || Infinity;

        // Build query
        let query = {
            salePrice: { $gt: gtPrice, $lt: ltPrice }, 
            quantity: { $gt: 0 } // Only products in stock
        };

        // Apply category filter if selected
        let selectedCategory = null;
        if (category) {
            const findCategory = await Category.findById(category);
            if (findCategory) {
                query.category = findCategory._id; 
                selectedCategory = findCategory._id; 
            }
        }

        // Sorting logic
        let sortQuery = {};
        if (sort === "price_asc") {
            sortQuery = { salePrice: 1 }; // Price Low to High
        } else if (sort === "price_desc") {
            sortQuery = { salePrice: -1 }; // Price High to Low
        } else if (sort === "name_asc") {
            sortQuery = { productName: 1 }; // A-Z
        } else if (sort === "name_desc") {
            sortQuery = { productName: -1 }; // Z-A
        } else {
            sortQuery = { createdOn: -1 }; // Default: Newest first
        }

        // Pagination setup
        const itemsPerPage = 6;
        const currentPage = Math.max(parseInt(page) || 1, 1);
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.max(Math.ceil(totalProducts / itemsPerPage), 1);
        const validPage = Math.min(currentPage, totalPages);
        const startIndex = (validPage - 1) * itemsPerPage;

        // Fetch products with filtering, sorting, and pagination
        const currentProducts = await Product.find(query)
            .sort(sortQuery)
            .skip(startIndex)
            .limit(itemsPerPage)
            .lean();

        // Render shop page
        res.render("shop", {
            user: userData,
            products: currentProducts,
            category: categories,
            selectedCategory,
            totalPages,
            currentPage: validPage,
            message,
            sort,
            gt: gt || "",
            lt: lt || "",
        });

    } catch (error) {
        console.error("Error in filterByPrice:", error);
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
    loadShoppingPage,filterProduct,filterByPrice,searchProducts,sortProduct
};