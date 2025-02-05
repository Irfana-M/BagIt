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
    res.render("shop", {
        user: userData,
        products: products,
        category: categoriesWithIds,
        totalProducts: totalProducts,
        currentPage: page,
        totalPages: totalPages,
        message: message ,
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

        req.session.filteredProducts = currentProduct;
        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categories,
            totalPages,
            currentPage,
            selectedCategory: category || null,
            message: message 
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
        req.session.message = null;  // Clear the message after retrieving it

        // Parse query parameters for price filtering
        const gtPrice = parseFloat(req.query.gt) || 0; // Default to 0 if not provided
        const ltPrice = parseFloat(req.query.lt) || Infinity; // Default to Infinity if not provided

        let findProducts = await Product.find({
            salePrice: { $gt: gtPrice, $lt: ltPrice }, // Filter products based on price range
            isBlocked: false,
            quantity: { $gt: 0 } // Ensure products are available in stock
        }).lean();

        // Sort products by creation date (newest first)
        findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

        // // Check if no products are found in the filtered price range
        // if (findProducts.length === 0) {
        //     // If no products found, set a message
        //     req.session.message = "No products found in this price range.";
        // }

        // Pagination logic
        const itemsPerPage = 6;
        const currentPage = Math.max(parseInt(req.query.page) || 1, 1);
        const totalPages = Math.ceil(findProducts.length / itemsPerPage);

        
        const validPage = Math.min(currentPage, totalPages);
        const startIndex = (validPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;

        const currentProducts = findProducts.slice(startIndex, endIndex);

        
        req.session.filteredProducts = findProducts;

        
        res.render("shop", {
            user: userData,
            products: currentProducts,
            category: categories,
            totalPages,
            currentPage: validPage,
        });

        
        //req.session.message = null;
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

        // Get search query from GET or POST request
        let search = (req.body.query || req.query.query || "").toString().trim();

        // Fetch listed categories
        const categories = await Category.find({ isListed: true }).lean();
        const categoryIds = categories.map(category => category._id.toString());

        let searchResult = [];

        if (req.session.filteredProducts && Array.isArray(req.session.filteredProducts)) {
            // If filtered products exist in session, search within them
            searchResult = req.session.filteredProducts.filter(product => 
                product.productName.toLowerCase().includes(search.toLowerCase())
            );
        } else {
            // Fetch from database if no session-stored products
            searchResult = await Product.find({
                productName: { $regex: ".*" + search + ".*", $options: "i" },
                isBlocked: false,
                quantity: { $gt: 0 },
                category: { $in: categoryIds }
            }).lean();
        }

        // Sort by latest created products
        searchResult.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

        // Pagination setup
        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage;
        let totalPages = Math.ceil(searchResult.length / itemsPerPage);
        const currentProduct = searchResult.slice(startIndex, startIndex + itemsPerPage);

        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categories,
            totalPages,
            currentPage,
            count: searchResult.length, // Total count of search results
            message
        });
    } catch (error) {
        console.error("Search Error:", error);
        res.redirect("/pageNotFound");
    }
};





const getSortProduct = async (req, res) => {
    try {
        const { category, gt, lt, sort, page } = req.query;

        // Reset category and price filters if sorting is applied
        const filterQuery = {
            isBlocked: false,
            quantity: { $gt: 0 }, // Ensure the product is in stock
        };

        // Apply sorting logic
        let sortOptions = {};
        switch (sort) {
            case 'price-asc': sortOptions = { salePrice: 1 }; break;
            case 'price-desc': sortOptions = { salePrice: -1 }; break;
            case 'name-asc': sortOptions = { productName: 1 }; break;
            case 'name-desc': sortOptions = { productName: -1 }; break;
            default: sortOptions = { createdOn: -1 }; // Default sorting by creation date
        }

        // Fetch products
        const products = await Product.find(filterQuery).sort(sortOptions).lean();

        // Pagination
        const itemsPerPage = 6;
        const currentPage = Math.max(parseInt(page) || 1, 1);
        const totalPages = Math.ceil(products.length / itemsPerPage);
        const validPage = Math.min(currentPage, totalPages);
        const startIndex = (validPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const currentProducts = products.slice(startIndex, endIndex);

        // Fetch categories for the sidebar
        const categories = await Category.find({ isListed: true }).lean();

        // Render the shop page
        res.render('shop', {
            products: currentProducts,
            category: categories,
            totalPages,
            currentPage: validPage,
            sort, // Pass the sort parameter to the view
        });
    } catch (error) {
        console.error("Error in getSortProduct:", error);
        res.redirect('/pageNotFound');
    }
};


const SortProduct = async (req, res) => {
    try {
        let sortQuery = {};
        const { sort, page } = req.query;
        console.log(sort,page);
        const message = req.session.message || null;
        req.session.message = null;


        // Apply sorting based on query parameter
        if (sort === "price_asc") {
            sortQuery = { salePrice: 1 };  // Sort price from low to high
        } else if (sort === "price_desc") {
            sortQuery = { salePrice: -1 }; // Sort price from high to low
        } else if (sort === "name_asc") {
            sortQuery = { productName: 1 };  // Sort alphabetically A-Z
        } else if (sort === "name_desc") {
            sortQuery = { productName: -1 }; // Sort alphabetically Z-A
        }

        // Fetch categories for the sidebar
        const categories = await Category.find({ isListed: true }).lean();

        // Fetch all products with sorting applied
        const products = await Product.find().sort(sortQuery).lean();
        console.log(products);

        // Pagination logic
        const itemsPerPage = 6;  // Number of products per page
        const currentPage = Math.max(parseInt(page) || 1, 1);  // Get the current page from query, default to 1
        const totalPages = Math.ceil(products.length / itemsPerPage);  // Calculate total pages
        const validPage = Math.min(currentPage, totalPages);  // Ensure the current page is not out of bounds
        const startIndex = (validPage - 1) * itemsPerPage;  // Calculate start index for products on current page
        const endIndex = startIndex + itemsPerPage;  // Calculate end index for products on current page
        const currentProducts = products.slice(startIndex, endIndex);  // Get the products for the current page

        // Render the shop page with products, categories, and pagination details
        res.render("shop", {
            products: currentProducts,
            totalPages,
            currentPage: validPage,
            sort,  // Pass the sort parameter to maintain sorting on page reload
            category: categories,
            message  // Pass the categories to the view
        });
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ message: "Internal Server Error" });
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
    loadShoppingPage,filterProduct,filterByPrice,searchProducts,getSortProduct,SortProduct
};