const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const { v4: uuidv4 } = require("uuid");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


const getOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 5; 
        const skip = (page - 1) * limit; 
        const totalOrders = await Order.countDocuments({ userId });

        const orders = await Order.find({ userId })
            .populate('userId')
            .populate('productId') 
            .sort({ createdOn: -1 }) 
            .skip(skip)
            .limit(limit);

        const deliveryDays = 5; 

        
        const ordersWithDeliveryDate = orders.map(order => {
            const deliveryDate = new Date(order.createdOn);
            deliveryDate.setDate(deliveryDate.getDate() + deliveryDays);
            return {
                ...order.toObject(), 
                deliveryDate: deliveryDate.toISOString().split('T')[0] 
            };
        });

        res.render('order', {
            orders: ordersWithDeliveryDate,
            currentPage: page,
            totalPages: Math.ceil(totalOrders / limit)
        });

    } catch (error) {
        console.error("Error fetching order details:", error);
        res.redirect("/pageNotFound");
    }
};




const cancelOrderItem = async (req, res) => {
    try {
        const { orderId } = req.params; 
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ success: false, message: "Cancellation reason is required" });
        }

        // Find the order with populated product details
        const order = await Order.findOne({ orderId }).populate("productId");

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Check if the order is cancellable
        if (order.status === "Shipped" || order.status === "Delivered") {
            return res.status(400).json({ success: false, message: "Order cannot be cancelled after shipment or delivery" });
        }

        // Update the product stock
        if (order.productId) {
            order.productId.quantity += order.quantity; 
            await order.productId.save(); 
            console.log(`Stock updated: ${order.productId.productName} now has ${order.productId.quantity} items.`);
        }

        
        order.status = "Cancelled";
        order.cancellationReason = reason;

        await order.save();

        res.json({ success: true, message: "Order cancelled and stock updated successfully" });
    } catch (error) {
        console.error("Error cancelling order item:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};


const orderDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId } = req.params; 

        // Find the current order
        const order = await Order.findOne({ orderId: orderId })
            .populate("userId") 
            .populate({
                path: 'productId',
                populate: { path: 'category', select: 'name' }
            })
            .exec();

        if (!order) {
            return res.redirect("/pageNotFound");
        }

        // Fetch related products with the same orderGroupId but exclude the current order
        const relatedProducts = await Order.find({
            orderGroupId: order.orderGroupId,
            _id: { $ne: order._id } // Exclude current order
        })
        .populate({
            path: 'productId',
            select: 'productName productImage', 
        })
        .exec();

        // Map otherItems with filtered products
        const otherItems = relatedProducts.map(item => ({
            name: item.productId.productName,
            image: item.productId.productImage,
            status: item.status
        }));

        // Fetch the user's address
        const addressDetails = await Address.findOne({ userId: order.userId }).exec();
        const address = addressDetails?.address.find(
            (addr) => addr._id.toString() === order.address.toString()
        );

        // Add tracking history (example data)
        order.trackingHistory = [
            { date: '2025-01-01', status: 'Order Placed' },
            { date: '2025-01-03', status: 'Processing' },
            { date: '2025-01-05', status: 'Shipped' },
            { date: '2025-01-07', status: 'Out for Delivery' },
            { date: '2025-01-08', status: 'Delivered' }
        ];
          
        res.render("order-details", { order, address, otherItems });

    } catch (error) {
        console.error("Error fetching order details:", error);
        res.redirect("/pageNotFound");
    }
};




const cancelOrder = async (req,res)=>{
    try {
        const { orderGroupId } = req.params;

        
        const result = await Order.updateMany(
            { orderGroupId },
            { $set: { status: "Cancelled" } }
        );

        if (result.modifiedCount > 0) {
            res.status(200).json({ message: "Order cancelled successfully" });
        } else {
            res.status(404).json({ message: "No orders found with this Order Group ID" });
        }
    } catch (error) {
        res.status(500).json({ message: "Error cancelling order", error });
    }
};



const razorpayPayment = async (req, res) => {
    try {
        
       
        const { addressId, totalPrice, cartItems } = req.body;
        console.log("the data came are:",req.body);
        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !addressId || !totalPrice || !cartItems) {
            return res.status(400).json({ success: false, message: "Invalid input data." });
        }

        const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generatedSignature = hmac.digest("hex");

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: "Payment verification failed!" });
        }

        // Ensure cartItems is an array
        if (!Array.isArray(cartItems)) {
            return res.status(400).json({ success: false, message: "cartItems must be an array" });
        }

        const newOrder = new Order({
            userId: req.user.id,
            address: addressId,
            totalPrice,
            cartItems,
            paymentMethod: "Razorpay",
            paymentStatus: "Paid",
            orderStatus: "Processing",
            transactionId: razorpay_payment_id,
        });

        await newOrder.save();

        res.status(200).json({
            success: true,
            message: "Payment verified and order placed!",
            order: newOrder,
        });
    } catch (error) {
        console.error("Error verifying Razorpay payment:", error);
        res.status(500).json({ success: false, message: "Server error. Please try again later." });
    }
};



const verifyRazorpay = async (req, res) => {
    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, addressId, totalPrice, cartItems } = req.body;

        if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !addressId || !totalPrice || !cartItems) {
            return res.status(400).json({ success: false, message: "Invalid input data." });
        }

        const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const generatedSignature = hmac.digest("hex");

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: "Payment verification failed!" });
        }

        // Ensure cartItems is an array
        if (!Array.isArray(cartItems)) {
            return res.status(400).json({ success: false, message: "cartItems must be an array" });
        }

        const newOrder = new Order({
            userId: req.user.id,
            address: addressId,
            totalPrice,
            cartItems,
            paymentMethod: "Razorpay",
            paymentStatus: "Paid",
            orderStatus: "Processing",
            transactionId: razorpay_payment_id,
        });

        await newOrder.save();
        res.status(200).json({
            success: true,
            message: "Payment verified and order placed!",
            order: newOrder,
        });
    } catch (error) {
        console.error("Error verifying Razorpay payment:", error);
        res.status(500).json({ success: false, message: "Server error. Please try again later." });
    }
};



const walletPayment = async (req, res) => {
    try {
        const { addressId, totalPrice, cartItems } = req.body;

        if (!addressId || !totalPrice || !cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid input data." });
        }

        const userWallet = await Wallet.findOne({ userId: req.user.id });
        if (!userWallet || userWallet.balance < totalPrice) {
            return res.status(400).json({ success: false, message: "Insufficient wallet balance." });
        }

        userWallet.balance -= totalPrice;
        await userWallet.save();

        const newOrder = new Order({
            userId: req.user.id,
            address: addressId,
            totalPrice,
            cartItems,
            paymentMethod: "Wallet",
            paymentStatus: "Paid",
            orderStatus: "Processing",
        });

        await newOrder.save();

        res.status(201).json({
            success: true,
            message: "Order placed successfully using Wallet!",
            order: newOrder,
        });
    } catch (error) {
        console.error("Error processing wallet payment:", error);
        res.status(500).json({ success: false, message: "Server error. Please try again later." });
    }
};


const codPayment = async (req, res) => {
    try {
        const { addressId, totalPrice, cartItems } = req.body;
        console.log("Raw cartItems:", cartItems);

        // Ensure cartItems is an array
        if (!Array.isArray(cartItems)) {
            return res.status(400).json({ success: false, message: "cartItems must be an array" });
        }

        const userId = req.session.user;

        // Fetch the selected address
        const addressData = await Address.findOne(
            { userId, "address._id": addressId },
            { "address.$": 1 }
        );

        if (!addressData || !addressData.address.length) {
            return res.status(400).json({ success: false, message: "Address not found." });
        }

        const selectedAddress = addressData.address[0];

        // Calculate Total Price Before and After Discounts
        let totalOriginalPrice = 0;
        let totalOfferPrice = 0;

        cartItems.forEach((item) => {
            if (item.productId && item.productId.regularPrice && item.productId.salePrice) {
                totalOriginalPrice += item.productId.regularPrice * item.quantity;
                totalOfferPrice += item.productId.salePrice * item.quantity;
            }
        });

        const totalDiscount = totalOriginalPrice - totalOfferPrice;
        const shippingCharge = 50;

        // Fetch applied coupon (if any)
        const appliedCoupon = req.session.cart?.appliedCoupon?.discount || { discount: 0 };
        const couponDiscount = appliedCoupon.discount || 0;

        // Final amount after applying coupon discount
        let finalAmount = totalOfferPrice - couponDiscount + shippingCharge;
        finalAmount = Math.max(finalAmount, 0); // Ensure final amount is not negative

        const currentDate = new Date();
        const invoiceDate = currentDate.toISOString();

        // Expiry Date (e.g., 30 days from order date)
        const expireDate = new Date();
        expireDate.setDate(currentDate.getDate() + 30);
        const formattedExpireDate = expireDate.toISOString();
        const orderGroupId = uuidv4();

        // Save Order Details for all items in the cart
        const orderPromises = cartItems.map(async (item) => {
            const newOrder = new Order({
                userId,
                productId: item.productId._id,
                quantity: item.quantity,
                price: item.productId.salePrice,
                status: "Order Placed", // Ensure this matches a valid enum value
                totalPrice: totalOfferPrice,
                discount: totalDiscount + couponDiscount, // Include both product and coupon discounts
                finalAmount: finalAmount,
                address: selectedAddress._id,
                createdOn: invoiceDate,
                orderId: uuidv4(),
                paymentMethod: "Cash on Delivery",
                orderGroupId: orderGroupId, // Assign orderGroupId
                totalDiscount,
                couponApplied: couponDiscount > 0,
            });
            await newOrder.save();
        });

        await Promise.all(orderPromises);
        req.session.cartItems = cartItems;
        // Clear cart after placing order
        await Cart.deleteOne({ userId });

        // Return success response
        res.json({ success: true, message: "Payment successful" });
    } catch (e) {
        console.error("COD Payment Error:", e);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};




module.exports = {getOrder,cancelOrderItem,orderDetails,cancelOrder,razorpayPayment,verifyRazorpay,walletPayment,codPayment}