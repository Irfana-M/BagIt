const User = require("../../models/userSchema");
const Wishlist = require("../../models/wishlistSchema");
const Product = require("../../models/productSchema");


const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            return res.redirect("/login"); // Redirect to login if not logged in
        }

        const user = await User.findById(userId);

        // Pagination setup
        let page = parseInt(req.query.page) || 1; // Default page = 1
        let limit = 5; // Wishlist items per page
        let skip = (page - 1) * limit;

        // Fetch paginated wishlist products
        const totalItems = await Product.countDocuments({ _id: { $in: user.wishlist } });
        const products = await Product.find({ _id: { $in: user.wishlist } })
            .populate('category')
            .skip(skip)
            .limit(limit);

        // Calculate total pages
        const totalPages = Math.ceil(totalItems / limit);

        // Render wishlist page with pagination data
        res.render("wishlist", {
            user,
            wishlist: products,
            currentPage: page,
            totalPages: totalPages
        });

    } catch (error) {
        console.error(error);
        res.redirect("/pageNotFound");
    }
};





const addToWishlist = async (req, res) => {
    try {
        const productId = req.body.productId;
        const userId = req.session.user;

        console.log("Add to wishlist request received. Product ID:", productId);

       
        if (!userId) {
            console.log("User not logged in.");
            return res.status(401).json({ status: false, message: "User not logged in" });
        }
        const user = await User.findById(userId);
        if (!user) {
            console.log(" User not found. ID:", userId);
            return res.status(400).json({ status: false, message: "User not found" });
        }

        if (user.wishlist.some(id => id.equals(productId))) {
            console.log("Product already in wishlist. User ID:", userId);
            return res.status(200).json({ status: false, message: "Product already in wishlist" });
        }
        
        user.wishlist.push(productId);
        await user.save();

        console.log(" Product added to wishlist. User ID:", userId);
        return res.status(200).json({ status: true, message: "Product added to wishlist" });

    } catch (error) {
        console.error(" Server Error:", error);
        return res.status(500).json({ status: false, message: "Server error" });
    }
};


const removeProducts = async (req,res)=>{
    try {
        const productId = req.query.productId;
        const userId = req.session.user;
        const user = await User.findById(userId);
        const index = user.wishlist.indexOf(productId);
        user.wishlist.splice(index,1);
        await user.save();
        return res.redirect('/wishlist');
    } catch (error) {
        console.error(error);
        return res.status(500).json({status:false,message:'Server error'})
    }
}

module.exports = {loadWishlist,addToWishlist,removeProducts}