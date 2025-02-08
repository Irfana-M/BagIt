const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const Coupon = require('../../models/couponSchema');
const { v4: uuidv4 } = require('uuid');
const { session } = require('passport');



const addToCart = async (req, res) => {
    try {
        const userId = req.session.user; 
        const productId = req.query.id;  
        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).send('Product not found');
        }
//let cartFromSession = req.session.cart || { items: [] };;
        const price = product.salePrice; 
        let cart = await Cart.findOne({ userId });
       

        if (!cart) {
            
            cart = new Cart({
                userId,
                items: [{
                    productId: product._id,
                    quantity: 1,
                    price,
                    totalPrice: price,
                }],
            });
        } else {
            const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

            if (itemIndex > -1) {
                cart.items[itemIndex].quantity += 1;
                cart.items[itemIndex].totalPrice = cart.items[itemIndex].price * cart.items[itemIndex].quantity;
            } else {
                cart.items.push({
                    productId: product._id,
                    quantity: 1,
                    price,
                    totalPrice: price,
                });
            }
        }
        product.quantity -= 1;
        await product.save(); 
        await cart.save();
       // req.session.cart = cart;
        req.session.message = { status: 'success', message: 'Item added to cart' };
        return res.redirect('/shop'); 
    } catch (error) {
        console.error('Error adding item to cart:', error);
        req.session.message = { status: 'failure', message: 'Server Error' };
        return res.redirect('/shop');
    }
};


// const viewCart = async (req, res) => {
//     try {
//         const userId = req.session.user;
//         if (!userId) {
//             return res.redirect('/login'); 
//         }

//         const cart = await Cart.findOne({ userId }).populate('items.productId');

//         if (!cart || cart.items.length === 0) {
//             return res.render('cart', { cart: null, message: 'Your cart is empty' });
//         }

//         let totalPriceWithoutOffer = cart.items.reduce((acc, item) => acc + item.productId.regularPrice * item.quantity, 0);

//         let totalPriceWithOffer = cart.items.reduce((acc, item) => acc + item.productId.salePrice * item.quantity, 0);

//         let totalDiscount = totalPriceWithoutOffer - totalPriceWithOffer;

//         let shippingCharge = 50; 
//         let couponDiscount = req.session.couponDiscount || 0; 
//         let finalTotal = totalPriceWithOffer - shippingCharge - couponDiscount;

//         res.render('cart', { 
//             cart, 
//             totalPriceWithoutOffer, 
//             totalPriceWithOffer, 
//             totalDiscount,
//             shippingCharge,
//             couponDiscount,
//             finalTotal 
//         });

//     } catch (error) {
//         console.error('Error viewing cart:', error);
//         res.render('shop', { message: 'Server Error, please try again!', status: 'failure' });
//     }
// };



const viewCart = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect('/login');
        }

        
        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart || cart.items.length === 0) {
            return res.render('cart', { cart: null, message: 'Your cart is empty' });
        }

        let totalPriceWithoutOffer = cart.items.reduce((acc, item) => acc + item.productId.regularPrice * item.quantity, 0);
        let totalPriceWithOffer = cart.items.reduce((acc, item) => acc + item.productId.salePrice * item.quantity, 0);
        let totalDiscount = totalPriceWithoutOffer - totalPriceWithOffer;

        let shippingCharge = 50;

        
        const today = new Date(); // Get today's date
const coupons = await Coupon.find({ 
    isList: true, 
    expireOn: { $gt: today }  // Filters coupons with expiryDate greater than today
});


        let appliedCoupon = req.session.appliedCoupon; 
console.log("Applied Coupon:", appliedCoupon);
let couponDiscount = 0;

// Ensure appliedCoupon exists before accessing properties
if (appliedCoupon) {
    console.log("Total Price with Offer:", totalPriceWithOffer);
    console.log("Coupon Minimum Price:", appliedCoupon.minimumPrice);

    if (totalPriceWithOffer >= appliedCoupon.minimumPrice) {
        couponDiscount = appliedCoupon.discount; // Use the stored discount value
        console.log("Coupon Discount Applied:", couponDiscount);
    } else {
        console.log("Coupon not applicable as totalPriceWithOffer is less than minimumPrice.");
        req.session.appliedCoupon = null; // Reset coupon if conditions not met
    }
}

// Ensure discount doesn't exceed total price
couponDiscount = Math.min(couponDiscount, totalPriceWithOffer);
console.log("Final Coupon Discount:", couponDiscount);

        
        let finalTotal = totalPriceWithOffer - couponDiscount + shippingCharge;

        res.render('cart', {
            errorMessage: req.flash("error"),
            successMessage: req.flash("success"),
            cart,
            totalPriceWithoutOffer,
            totalPriceWithOffer,
            totalDiscount,
            shippingCharge,
            coupons, 
            appliedCoupon: req.session.appliedCoupon || null, 
            couponDiscount,
            finalTotal,
        });

    } catch (error) {
        console.error('Error viewing cart:', error);
        res.render('shop', { message: 'Server Error, please try again!', status: 'failure' });
    }
};




const deleteCart = async (req, res) => {
    try {
        const productId = req.query.id;
        const cart = await Cart.findOne({ "items.productId": productId });
        if (!cart) {
            return res.status(404).send("Cart not found");
        }

        const item = cart.items.find(item => item.productId.toString() === productId);
        if (!item) {
            return res.status(404).send("Product not found in cart");
        }

        const removedQuantity = item.quantity; 
        await Product.findByIdAndUpdate(productId, { $inc: { quantity: removedQuantity } });

        await Cart.updateOne(
            { "items.productId": productId },
            {
                $pull: {
                    items: {
                        productId: productId,
                    }
                }
            }
        );

        res.redirect("/view-cart");

    } catch (error) {
        console.error("Error in delete product", error);
        res.redirect("/pageNotFound");
    }
};



const getCheckout = async (req, res) => {
    try {
        const userId = req.session.user; 
        const user = await Address.findOne({ userId });
        const addresses = user ? user : []; 
        const cart = await Cart.findOne({ userId }).populate("items.productId");

        if (!cart || cart.items.length === 0) {
            return res.render("checkout", {
                addresses: addresses,
                cart: null,
                message: "Your cart is empty"
            });
        }
        
        let totalOriginalPrice = 0;
        let totalOfferPrice = 0;

        cart.items.forEach(item => {
            totalOriginalPrice += item.productId.regularPrice * item.quantity;
            totalOfferPrice += item.productId.salePrice * item.quantity;
        });
        
        const totalDiscount = totalOriginalPrice - totalOfferPrice;
        const shippingCharge = 50;
        const subTotal = shippingCharge + totalOfferPrice;
        console.log(subTotal);
        res.render("checkout", {
            addresses: addresses,
            cart,
            totalOriginalPrice,
            totalOfferPrice,
            totalDiscount,
            subTotal,
            shippingCharge,
           
        });
    } catch (error) {
        console.error("Error in getCheckout:", error);
        res.redirect("/pageNotFound");
    }
};


const getConfirmation = async (req, res) => {
    try {
        const { addressId, totalPrice, cartItems,status,paymentMethod } = req.query;

        // Ensure cartItems exist
        if (!cartItems) {
            return res.redirect('/checkout');
        }

        let rawCartItems = JSON.parse(decodeURIComponent(cartItems));

        if (!addressId) {
            return res.redirect('/checkout');
        }

        const userId = req.session.user;

        const addressData = await Address.findOne(
            { userId, "address._id": addressId },
            { "address.$": 1 }
        );

        if (!addressData || !addressData.address.length) {
            return res.redirect('/checkout');
        }

        const selectedAddress = addressData.address[0];

        let totalOriginalPrice = 0;
        let totalOfferPrice = 0;

        rawCartItems.forEach(item => {
            if (item.productId && item.productId.regularPrice && item.productId.salePrice) {
                totalOriginalPrice += item.productId.regularPrice * item.quantity;
                totalOfferPrice += item.productId.salePrice * item.quantity;
            }
        });

        const totalDiscount = totalOriginalPrice - totalOfferPrice;
        const shippingCharge = 50;
        const subTotal = shippingCharge + totalOfferPrice;
        const orderStatus = status || "Order Placed"; 
        
        for (const item of rawCartItems) {
            try {
                const newOrder = new Order({
                    userId,
                    productId: item.productId._id,
                    quantity: item.quantity,
                    price: item.productId.salePrice,
                    status: orderStatus,
                    totalPrice: totalOfferPrice,
                    discount: totalDiscount,
                    finalAmount: subTotal,
                    address: selectedAddress._id,
                    invoiceDate: new Date(), 
                    createdOn: new Date(),
                    orderId: uuidv4(),
                    orderMethod: paymentMethod  
                });
                await newOrder.save();
                console.log(" Order Saved Successfully");
            } catch (error) {
                console.error(" Error saving order:", error);
            }
        }
        
        

        
        await Promise.all(rawCartItems.map(async (item) => {
            const product = await Product.findById(item.productId._id);
            if (product) {
                product.quantity -= item.quantity;
                await product.save();
            }
        }));

        
        await Cart.deleteOne({ userId });

        
        console.log('Rendering confirmation page with the following data:', {
            selectedAddress,
            totalPrice: totalOfferPrice,
            cartItems: rawCartItems,
            totalOriginalPrice,
            subTotal,
            shippingCharge,
            paymentMethod
        });

        res.render('confirmation', {
            selectedAddress,
            totalPrice: totalOfferPrice,
            cartItems: rawCartItems,
            totalOriginalPrice,
            subTotal,
            shippingCharge,
            paymentMethod
        });

    } catch (e) {
        console.error('An error occurred:', e.message); 
        return res.status(500).send("Something went wrong!");
    }
};



// const applyCoupon = async (req, res) => {
//     try {
//         const { couponCode } = req.body;

//         const coupon = await Coupon.findOne({ name: couponCode });
//         console.log(coupon)


//         if (!coupon) {
//             req.flash("error", "Invalid Coupon");
//             return res.redirect("/view-cart")
//         }

//         const today = new Date();
//         const expiryDate = new Date(coupon.expireOn);
//         const startDate = new Date(coupon.createdON);

//         if (today < startDate || today > expiryDate) {
//             req.flash("error", "Coupon Expired or Not Yet Valid");
//             return res.redirect("/view-cart");
//         }

//         const cart = req.session.cart || { items: [] };

//         if (!cart.items.length) {
//             req.flash("error", "Cart is Empty");
//             return res.redirect("/view-cart");
//         }

//         const totalPrice = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);

//         if (totalPrice < coupon.minimumPrice) {
//             req.flash("error", `Minimum purchase should be ₹${coupon.minimumPrice}`);
//             return res.redirect("/view-cart");
//         }

//         const discountAmount = coupon.offerPrice;

//         req.session.appliedCoupon = {
//             name: coupon.name,
//             discount: discountAmount,
//         };
//         req.session.finalTotal = totalPrice - discountAmount;

//         req.flash("success", "Coupon Applied Successfully!");
//         res.redirect("/view-cart");
//     } catch (error) {
//         console.error("Error applying coupon:", error);
//         req.flash("error", "Something went wrong");
//         res.redirect("/view-cart");
//     }
// };

// const applyCoupon = async (req, res) => {
//     try {
//         const { couponCode, cartItems } = req.body;

//         // Find the coupon
//         const coupon = await Coupon.findOne({ name: couponCode });
//         if (!coupon) {
//             return res.status(400).json({ message: "Invalid Coupon" });
//         }

//         // Check coupon validity
//         const today = new Date();
//         if (today < new Date(coupon.createdON) || today > new Date(coupon.expireOn)) {
//             return res.status(400).json({ message: "Coupon Expired or Not Yet Valid" });
//         }

//         // Ensure cart is not empty
//         if (!cartItems || cartItems.length === 0) {
//             return res.status(400).json({ message: "Cart is Empty" });
//         }

//         // Calculate total price from received cart items
//         const totalPrice = cartItems.reduce((acc, item) => acc + item.totalPrice, 0);

//         // Check if total price meets coupon conditions
//         if (totalPrice < coupon.minimumPrice) {
//             return res.status(400).json({ message: `Minimum purchase should be ₹${coupon.minimumPrice}` });
//         }

//         // Apply discount
//         const discountAmount = coupon.offerPrice;
//         req.session.appliedCoupon = {
//             name: coupon.name,
//             discount: discountAmount
//         };
//         req.session.finalTotal = totalPrice - discountAmount;

//         return res.status(200).json({ message: "Coupon Applied Successfully!", finalTotal: req.session.finalTotal });
//     } catch (error) {
//         console.error("Error applying coupon:", error);
//         return res.status(500).json({ message: "Something went wrong" });
//     }
// };

const applyCoupon = async (req, res) => {
    try {
        const { couponCode, cartItems } = req.body;

        // Find the coupon
        const coupon = await Coupon.findOne({ name: couponCode });
        if (!coupon) {
            req.flash("error", "Invalid Coupon");
            return res.redirect("/view-cart");
        }

        // Check coupon validity
        const today = new Date();
        if (today < new Date(coupon.createdON) || today > new Date(coupon.expireOn)) {
            req.flash("error", "Coupon Expired or Not Yet Valid");
            return res.redirect("/view-cart");
        }

        // Ensure cart is not empty
        if (!cartItems || cartItems.length === 0) {
            req.flash("error", "Cart is Empty");
            return res.redirect("/view-cart");
        }

        // Calculate total price from received cart items
        const totalPrice = cartItems.reduce((acc, item) => acc + Number(item.totalPrice), 0);

        // Check if total price meets coupon conditions
        if (totalPrice < coupon.minimumPrice) {
            req.flash("error", `Minimum purchase should be ₹${coupon.minimumPrice}`);
            return res.redirect("/view-cart");
        }

        // Apply discount
        const discountAmount = coupon.offerPrice;
        req.session.appliedCoupon = {
            name: coupon.name,
            discount: coupon.offerPrice,  // Assuming offerPrice is the correct field
            minimumPrice: coupon.minimumPrice, // Add this line
        };
        
        req.session.finalTotal = totalPrice - discountAmount;

        req.flash("success", "Coupon Applied Successfully!");
        return res.redirect("/view-cart"); // Redirect to render updated price
    } catch (error) {
        console.error("Error applying coupon:", error);
        req.flash("error", "Something went wrong");
        return res.redirect("/view-cart");
    }
};




module.exports = { addToCart, viewCart, deleteCart,getCheckout,getConfirmation,applyCoupon};
