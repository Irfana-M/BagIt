const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const { v4: uuidv4 } = require('uuid');



const addToCart = async (req, res) => {
    try {
        const userId = req.session.user; 
        const productId = req.query.id;  
        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).send('Product not found');
        }

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

        req.session.message = { status: 'success', message: 'Item added to cart' };
        return res.redirect('/shop'); 
    } catch (error) {
        console.error('Error adding item to cart:', error);
        req.session.message = { status: 'failure', message: 'Server Error' };
        return res.redirect('/shop');
    }
};


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
        let couponDiscount = req.session.couponDiscount || 0; 
        let finalTotal = totalPriceWithOffer + shippingCharge - couponDiscount;

        res.render('cart', { 
            cart, 
            totalPriceWithoutOffer, 
            totalPriceWithOffer, 
            totalDiscount,
            shippingCharge,
            couponDiscount,
            finalTotal 
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
        const { addressId, totalPrice, cartItems,status } = req.query;

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
                    orderId: uuidv4(),  // Ensure UUID is generated properly
                });
        
                console.log("Saving Order:", newOrder);
        
                await newOrder.save();
                console.log(" Order Saved Successfully");
            } catch (error) {
                console.error(" Error saving order:", error);
            }
        }
        
        

        // Reduce stock quantity for each purchased item
        await Promise.all(rawCartItems.map(async (item) => {
            const product = await Product.findById(item.productId._id);
            if (product) {
                product.quantity -= item.quantity;
                await product.save();
            }
        }));

        // Clear user's cart after order placement
        await Cart.deleteOne({ userId });

        // Render confirmation page
        console.log('Rendering confirmation page with the following data:', {
            selectedAddress,
            totalPrice: totalOfferPrice,
            cartItems: rawCartItems,
            totalOriginalPrice,
            subTotal,
            shippingCharge
        });

        res.render('confirmation', {
            selectedAddress,
            totalPrice: totalOfferPrice,
            cartItems: rawCartItems,
            totalOriginalPrice,
            subTotal,
            shippingCharge
        });

    } catch (e) {
        console.error('An error occurred:', e.message); 
        return res.status(500).send("Something went wrong!");
    }
};




module.exports = { addToCart, viewCart, deleteCart,getCheckout,getConfirmation};
