const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');


const addToCart = async (req, res) => {
    try {
        const userId = req.session.user; // Get the logged-in user's ID
        const productId = req.query.id;  // Get the product ID from query params

        // Fetch the product details
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).send('Product not found');
        }

        const price = product.salePrice; // Assuming 'salePrice' exists in Product schema
        
        // Find the user's cart
        let cart = await Cart.findOne({ userId });

        if (!cart) {
            // Create a new cart for the user if it doesn't exist
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
        res.render("checkout", {
            addresses: addresses,
            cart,
            totalOriginalPrice,
            totalOfferPrice,
            totalDiscount,
            subTotal,
            shippingCharge
        });
    } catch (error) {
        console.error("Error in getCheckout:", error);
        res.redirect("/pageNotFound");
    }
};


const { v4: uuidv4 } = require('uuid'); // Import UUID for unique IDs

const getConfirmation = async (req, res) => {
    const decodeHtmlEntities = (str) => {
        return str.replace(/&#34;/g, '"');
    };
    try {
        const { addressId, totalPrice, cartItems } = req.query; 
        let rawCartItems = req.query.cartItems;
        let decodedCartItems = decodeHtmlEntities(rawCartItems); 
        let parsedCartItems = JSON.parse(decodedCartItems); 
        
        if (!addressId) {
            return res.redirect('/checkout'); 
        }

        const userId = req.session.user;
        const user = await Address.findOne({ userId });
        
        const addressData = await Address.findOneAndUpdate(
            { userId, "address._id": addressId },
            {},
            { new: true, projection: { "address.$": 1 } } 
        );

        if (!addressData || !addressData.address.length) {
            return res.redirect('/checkout'); 
        }

        const selectedAddress = addressData.address[0]; 

        let totalOriginalPrice = 0;
        let totalOfferPrice = 0;

        parsedCartItems.items.forEach(item => {
            if (item.productId && item.productId.regularPrice && item.productId.salePrice) {
                totalOriginalPrice += item.productId.regularPrice * item.quantity;
                totalOfferPrice += item.productId.salePrice * item.quantity;
            }
        });

        const totalDiscount = totalOriginalPrice - totalOfferPrice;
        const shippingCharge = 50;
        const subTotal = shippingCharge + totalOfferPrice;

        // Generate a unique order ID for the entire order
        const uniqueOrderId = uuidv4();  

        const newOrder = new Order({
            userId,
            orderId: uniqueOrderId,  // Assign unique order ID
            orderItems: parsedCartItems.items.map(item => ({
                orderItemId: uuidv4(), // Assign unique ID for each product ordered
                product: item.productId,
                quantity: item.quantity,
                price: item.productId.salePrice
            })),
            totalPrice: totalOfferPrice,
            discount: totalDiscount,
            finalAmount: subTotal,
            address: selectedAddress._id,
            status: 'Pending',
            coupenApplied: false,
        });

        await newOrder.save();

        // Reduce the product stock in the database
        await Promise.all(parsedCartItems.items.map(async (item) => {
            const product = await Product.findById(item.productId);
            if (product) {
                product.quantity -= item.quantity; 
                await product.save();
            }
        }));

        // Empty the user's cart in the database
        await Cart.deleteOne({ userId: userId });

        res.render('confirmation', {
            selectedAddress,
            totalPrice,
            cartItems: parsedCartItems,
            totalOriginalPrice,
            subTotal,
            shippingCharge
        });

    } catch (error) {
        console.error("Error in getConfirmation:", error);
        res.status(500).send("Internal Server Error");
    }
};


module.exports = { addToCart, viewCart, deleteCart,getCheckout,getConfirmation,getConfirmation };
