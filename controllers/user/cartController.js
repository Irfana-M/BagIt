const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');


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
            // Check if the product already exists in the cart
            const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

            if (itemIndex > -1) {
                // If the product is already in the cart, update its quantity and total price
                cart.items[itemIndex].quantity += 1;
                cart.items[itemIndex].totalPrice = cart.items[itemIndex].price * cart.items[itemIndex].quantity;
            } else {
                // If the product is not in the cart, add it as a new item
                cart.items.push({
                    productId: product._id,
                    quantity: 1,
                    price,
                    totalPrice: price,
                });
            }
        }

        // Save the updated cart
        await cart.save();

        req.session.message = { status: 'success', message: 'Item added to cart' };
        return res.redirect('/shop'); // Redirect back to the shop page

    } catch (error) {
        console.error('Error adding item to cart:', error);
        req.session.message = { status: 'failure', message: 'Server Error' };
        return res.redirect('/shop');
    }
};


const viewCart = async (req, res) => {
    try {
        const userId = req.session.user;
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        
        if (!cart) {
            return res.render('cart', { cart: null, message: 'Your cart is empty' });
        }
        res.render('cart', { cart }); // Render the cart page with cart data
    } catch (error) {
        console.error('Error viewing cart:', error);
        res.render('/shop', { message: 'Server Error, please try again!', status: 'failure' });
    }
};


const deleteCart = async (req, res) => {
    try {
        const productId = req.query.id;
        const findProduct = await Cart.findOne({"items.productId": productId});
        
        if (!findProduct) {
            return res.status(404).send("Product not found");
        }

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


module.exports = { addToCart, viewCart, deleteCart };
