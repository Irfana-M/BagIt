const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const { v4: uuidv4 } = require("uuid");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const Wallet = require("../../models/walletSchema");
const fs = require('fs');


const getOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const page = parseInt(req.query.page) || 1;
        const limit = 5; 
        const skip = (page - 1) * limit; 
        const totalOrders = await Order.countDocuments({ user: userId }); 

        const orders = await Order.find({ user: userId })
            .populate('user') 
            .populate('orderItems.product') 
            .sort({ createdAt: -1 }) 
            .limit(limit);

        const deliveryDays = 5; 

        
        const ordersWithDeliveryDate = orders.map(order => {
            const deliveryDate = new Date(order.createdAt); 
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
        console.log("cancel order1")
        const { orderId, productId } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ success: false, message: "Cancellation reason is required" });
        }

        // Find the order
        const order = await Order.findById(orderId).populate('orderItems.product', 'price quantity');
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        console.log("User ID:", order.user);

        // Find the product in the order
        const productItem = order.orderItems.find(item => item.product._id.toString() === productId);

        console.log("Product Item:", productItem);
        if (!productItem) {
            return res.status(404).json({ success: false, message: "Product not found in order" });
        }

        // Check if the item is already shipped or delivered
        if (productItem.status === "Shipped" || productItem.status === "Delivered") {
            return res.status(400).json({ success: false, message: "Order cannot be cancelled after shipment or delivery" });
        }

        // Restore stock for the canceled item
        const product = await Product.findById(productId);
        if (product) {
            product.quantity += productItem.quantity;
            await product.save();
        }

        

        // Calculate refund amount for Online Payment orders
        let refundAmount = productItem.price * productItem.quantity;
        console.log("Initial Refund Amount:", refundAmount);

        // Check if a coupon was applied and deduct a proportional amount
        if (order.couponApplied && order.discount > 0) {
            const totalOrderPrice = order.totalPrice;
            const productContribution = (productItem.price * productItem.quantity) / totalOrderPrice;
            const discountToDeduct = order.discount * productContribution;
            refundAmount -= discountToDeduct;
            console.log("Discount Deducted:", discountToDeduct);
        }

        // Ensure refundAmount is not negative
        refundAmount = Math.max(refundAmount, 0);
        console.log("Final Refund Amount:", refundAmount);

        // Update order item status
        if (order.paymentInfo.method === "Cash on Delivery") {
            productItem.status = 'Cancelled';
            productItem.cancellationReason = reason;
            await order.save();

            return res.json({ 
                success: true, 
                message: "Order item cancelled successfully. No refund for Cash on Delivery orders."
            });
        }else{
        productItem.status = 'Cancelled';
        productItem.cancellationReason = reason;
        productItem.refundAmount = refundAmount;
        console.log("ProductItem after refund",productItem.refundAmount)
        await order.save();
        


        // Find and update user's wallet
        const updatedWallet = await Wallet.findOneAndUpdate(
            { userId: order.user }, 
            {
                $inc: { balance: refundAmount },
                $push: { 
                    transactions: { 
                        amount: refundAmount, 
                        type: 'refund', 
                        description: `Refund for cancelled order ${orderId}, product ${productId}`,
                        date: new Date() 
                    } 
                }
            },
            { new: true, upsert: true } // Creates a new wallet if it doesn't exist
        );

        console.log("Updated Wallet:", updatedWallet);

        res.json({ 
            success: true, 
            message: "Order item cancelled successfully and amount refunded to wallet",
            refundAmount: refundAmount,
            walletBalance: updatedWallet.balance
        });
    }

    } catch (error) {
        console.error("Error cancelling order item:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};



const orderDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId, productId } = req.params;

     
        const order = await Order.findOne({ _id: orderId, user: userId })
            .populate("user")
            .populate({
                path: 'orderItems.product',
                populate: { path: 'category', select: 'name' }
            })
            .exec();

        if (!order) {
            return res.redirect("/pageNotFound");
        }

       
        const productItem = order.orderItems.find(item => item.product._id.toString() === productId);
        if (!productItem) {
            return res.redirect("/pageNotFound");
        }

        const relatedOrders = await Order.find({ _id: orderId })
    .populate({
        path: 'orderItems.product',
        select: 'productName productImage'
    })
    .exec();


        
        const otherItems = relatedOrders.flatMap(order =>
            order.orderItems
                .filter(item => item.product._id.toString() !== productId) 
                .map(item => ({
                    name: item.product.productName,
                    image: item.product.productImage,
                    status: item.status 
                }))
        );
        
        const addressDetails = await Address.findOne({ userId: order.user }).exec();
        const address = addressDetails ? addressDetails.address.find(addr => addr._id.toString() === order.shippingAddress.toString()) : null;

        order.trackingHistory = [
            { date: '2025-01-01', status: 'Order Placed' },
            { date: '2025-01-03', status: 'Processing' },
            { date: '2025-01-03', status: 'Cancelled' },
            { date: '2025-01-05', status: 'Shipped' },
            { date: '2025-01-07', status: 'Out for Delivery' },
            { date: '2025-01-08', status: 'Delivered' },
            { date: '2025-01-09', status: 'Return Requested' },
            { date: '2025-01-10', status: 'Returned' }
        ];

        
        res.render("order-details", { order, productItem, address, otherItems ,refundAmount:  null});

    } catch (error) {
        console.error("Error fetching order details:", error);
        res.redirect("/pageNotFound");
    }
};


const cancelOrder = async (req, res) => {
    try {
        console.log("cancelOrder2")
        const { orderId } = req.params;
        console.log(orderId)
        console.log("orderId", orderId);

        
        const order = await Order.findOne({ orderId: orderId })
            .populate({
                path: 'orderItems.product',
                select: 'price quantity'
            })
            .exec();
        if (!order) {
            return res.status(404).json({ message: "No order found with this Order ID" });
        }

        const alreadyCancelledProducts = [];
        const cancelledProducts = [];
        let totalRefundAmount = 0;

        
        const isCOD = order.paymentInfo.method === "Cash on Delivery";

        for (const item of order.orderItems) {
            
            if (item.status === "Cancelled") {
                alreadyCancelledProducts.push(item.product._id.toString());
                continue;
            }

            
            if (item.status === "Delivered" || item.status === "Shipped") {
                const product = await Product.findById(item.product._id);
                if (product) {
                    product.quantity += item.quantity;
                    await product.save();
                }
            }

           
            item.status = "Cancelled";
            cancelledProducts.push(item.product._id.toString());

            
            if (!isCOD) {
                
                const totalOrderPrice = order.totalPrice; 
                const productContribution = (item.price * item.quantity) / totalOrderPrice;

               
                const discountToDeduct = order.discount * productContribution;

                
                let refundAmount = (item.price * item.quantity) - discountToDeduct;

                
                refundAmount = Math.max(refundAmount, 0);

                
                totalRefundAmount += refundAmount;
                console.log(totalOrderPrice,productContribution,discountToDeduct,refundAmount)
            }
        }
        

        
        await order.save();

        let updatedWallet = null;

        
        if (totalRefundAmount > 0 && !isCOD) {
            updatedWallet = await Wallet.findOneAndUpdate(
                { userId: order.user },
                {
                    $inc: { balance: totalRefundAmount },
                    $push: {
                        transactions: {
                            amount: totalRefundAmount,
                            type: 'refund',
                            description: `Refund for cancelled order ${orderId}`,
                            date: new Date()
                        }
                    }
                },
                { new: true, upsert: true } 
            );
        }

        
        const response = {
            message: "Order cancellation processed",
            cancelledProducts,
            alreadyCancelledProducts,
            refundAmount: isCOD ? "No refund for Cash on Delivery orders" : totalRefundAmount,
            walletBalance: updatedWallet ? updatedWallet.balance : "No wallet update for COD orders"
        };

        if (cancelledProducts.length === 0) {
            console.log("No products were cancelled because they were already cancelled or not eligible for cancellation.");
        }

        res.status(200).json(response);
    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({ message: "Error cancelling order", error });
    }
};



const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createRazoPayOrder = async (amount, receipt) => {
    try {
        console.log("a - Creating Razorpay order for:", amount, receipt);
        
        return  razorpay.orders.create({
            amount: amount * 100, 
            currency: "INR",
            receipt: receipt,
            payment_capture: 1,
        });
    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        throw new Error("Failed to create Razorpay order");
    }
};




const razorpayPayment = async (req, res) => {
    try {
        console.log("Incoming Request User:", req.session.user);

        const { addressId, totalPrice, cartItems } = req.body;
        console.log("Received data:", req.body);

        if (!addressId || !totalPrice || !cartItems.length) {
            return res.status(400).json({ success: false, message: "Invalid input data." });
        }

        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: User not found" });
        }

        
        const addressData = await Address.findOne(
            { userId, "address._id": addressId },
            { "address.$": 1 }
        );

        if (!addressData || !addressData.address.length) {
            return res.status(400).json({ success: false, message: "Address not found." });
        }

        const selectedAddress = addressData.address[0];
        console.log("Selected Address is", selectedAddress);

        
        let totalOriginalPrice = 0;
        let totalOfferPrice = 0;

        const orderItems = cartItems.map((item) => {
            totalOriginalPrice += item.productId.regularPrice * item.quantity;
            totalOfferPrice += item.productId.salePrice * item.quantity;

            return {
                product: item.productId._id,
                quantity: item.quantity,
                price: item.productId.salePrice
            };
        });

        const totalDiscount = totalOriginalPrice - totalOfferPrice;
        const shippingCharge = 50;
        const appliedCoupon = req.session.cart?.appliedCoupon || { discount: 0 };
        const couponDiscount = appliedCoupon.discount || 0;

        let finalAmount = totalOfferPrice - couponDiscount + shippingCharge;
        finalAmount = Math.max(finalAmount, 0); 

        const orderId = uuidv4();

        console.log("Creating Razorpay order with amount:", finalAmount, "Order ID:", orderId);
        const razorpayOrder = await createRazoPayOrder(finalAmount, orderId);

        if (!razorpayOrder || !razorpayOrder.id) {
            return res.status(500).json({ success: false, message: "Failed to create Razorpay order" });
        }

        
        const newOrder = new Order({
            user: userId,
            orderId,
            orderItems,
            totalPrice: totalOfferPrice,
            discount: totalDiscount + couponDiscount,
            finalAmount,
            shippingAddress: selectedAddress._id,
            couponApplied: couponDiscount > 0,
            paymentInfo: {
                method: "Online Payment",
                isPaid: false,  
                transactionId: razorpayOrder.id
            },
            invoiceDate: new Date()
        });

        await newOrder.save();

        req.session.cartItems = cartItems;

        res.status(200).json({
            success: true,
            message: "Payment initiated successfully!",
            orderId: newOrder._id,
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            key: process.env.RAZORPAY_KEY_ID || "rzp_test_eABMAUgay8KJLF",
        });

    } catch (error) {
        console.error("Error in Razorpay payment:", error);
        res.status(500).json({ success: false, message: "Server error. Please try again later." });
    }
};


const verifyRazorpay = async (req, res) => {
    try {
        console.log("Verifying payment:", req.body);

        const { payment_id, order_id, signature,addressId } = req.body;
        if (!payment_id || !order_id || !signature || !addressId) {
            return res.status(400).json({ success: false, message: "Invalid payment details" });
        }

        console.log("Validating payment signature...");
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(order_id + "|" + payment_id)
            .digest("hex");

        if (generatedSignature !== signature) {
            console.error("Payment signature mismatch!");
            return res.status(400).json({ success: false, message: "Payment verification failed" });
        }

        console.log("Payment verified. Updating order status...");

        
        const updatedOrder = await Order.findOneAndUpdate(
            { "paymentInfo.transactionId": order_id },
            { 
                $set: { 
                    "paymentInfo.isPaid": true, 
                    "paymentInfo.paidAt": new Date(), 
                    status: "Processing" 
                } 
            },
            { new: true }
        );
        console.log(updatedOrder);
        if (!updatedOrder) {
            console.error("Order not found for transaction ID:", order_id);
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        
        
        const userId = req.session.user;
        
        if (userId) {
            const orderedProductIds = updatedOrder.orderItems?.map(item => item.product) || [];
        
            
            if (orderedProductIds.length === 1) {
                
                await Cart.updateOne(
                    { userId },
                    { $pull: { items: { productId: orderedProductIds[0] } } }
                );
            } else {
             
                await Cart.updateOne(
                    { userId },
                    { $pull: { items: { productId: { $in: orderedProductIds } } } }
                );
            }
        
           
            const userCart = await Cart.findOne({ userId });
            if (userCart?.items?.length === 0) {
                await Cart.deleteOne({ userId });
            }
        }
        if (req.session.cart) {
            delete req.session.cart;
        }

        console.log("Cart cleared successfully for user:", userId);


        
        res.status(200).json({ success: true, message: "Payment successful" });

    } catch (error) {
        console.error("Error verifying payment:", error);
return res.status(500).json({ success: false, message: "Server error occurred." });

    }
};



const walletPayment = async (req, res) => {
    try {
        const { addressId, totalPrice, cartItems } = req.body;

        if (!addressId || !totalPrice || !Array.isArray(cartItems) || cartItems.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid input data." });
        }

        const userId = req.session.user;  

        
        const userWallet = await Wallet.findOne({ userId });
        if (!userWallet || userWallet.balance < totalPrice) {
            return res.status(400).json({ success: false, message: "Insufficient wallet balance." });
        }

        
        const addressData = await Address.findOne(
            { userId, "address._id": addressId },
            { "address.$": 1 }
        );
        if (!addressData || !addressData.address.length) {
            return res.status(400).json({ success: false, message: "Address not found." });
        }
        const selectedAddress = addressData.address[0];
        
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

        const appliedCoupon = req.session.cart?.appliedCoupon?.discount || { discount: 0 };
        const couponDiscount = appliedCoupon.discount || 0;

        let finalAmount = totalOfferPrice - couponDiscount + shippingCharge;
        finalAmount = Math.max(finalAmount, 0); 
        const currentDate = new Date();

        const expireDate = new Date();
        expireDate.setDate(currentDate.getDate() + 30);
        const formattedExpireDate = expireDate.toISOString();
        const orderGroupId = uuidv4();

        
        userWallet.balance -= finalAmount;
        await userWallet.save();

        
        const invoiceDate = new Date().toISOString();

        
        const newOrder = new Order({
            user: userId,
            orderItems: cartItems.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.productId.salePrice,
                status: "Processing"
            })),
            totalPrice: totalOfferPrice,
            discount: totalDiscount + couponDiscount,
            finalAmount: finalAmount, 
            paymentInfo: {
                method: "Wallet",
                isPaid: true
            },
            shippingAddress: selectedAddress._id,
            couponApplied: couponDiscount > 0,
            invoiceDate: currentDate
        });

        await newOrder.save();

       
        await Cart.deleteOne({ userId });
        if (req.session.cart) {
            delete req.session.cart;
        }

        res.status(201).json({
            success: true,
            message: "Order placed successfully using Wallet!",
            order: newOrder
        });
    } catch (error) {
        console.error("Error processing wallet payment:", error);
        res.redirect("/payment-failure");
        res.status(500).json({ success: false, message: "Server error. Please try again later." });
    }
};





const codPayment = async (req, res) => {
    try {
        const { addressId, totalPrice, cartItems } = req.body;
        console.log("Raw cartItems:", cartItems);

        if (!Array.isArray(cartItems)) {
            return res.status(400).json({ success: false, message: "cartItems must be an array" });
        }

        const userId = req.session.user;

        const addressData = await Address.findOne(
            { userId, "address._id": addressId },
            { "address.$": 1 }
        );

        if (!addressData || !addressData.address.length) {
            return res.status(400).json({ success: false, message: "Address not found." });
        }

        const selectedAddress = addressData.address[0];

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

        const appliedCoupon = req.session.cart?.appliedCoupon?.discount || { discount: 0 };
        const couponDiscount = appliedCoupon.discount || 0;

        let finalAmount = totalOfferPrice - couponDiscount + shippingCharge;
        finalAmount = Math.max(finalAmount, 0); 
        const currentDate = new Date();
        const invoiceDate = currentDate.toISOString();

        const expireDate = new Date();
        expireDate.setDate(currentDate.getDate() + 30);
        const formattedExpireDate = expireDate.toISOString();
     

        
        const newOrder = new Order({
            user: userId,
            orderItems: cartItems.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.productId.salePrice,
                status: "Order Placed"
            })),
            
            totalPrice: totalOfferPrice,
            discount: totalDiscount + couponDiscount,
            finalAmount: finalAmount,
            paymentInfo: {
                method: "Cash on Delivery",
                isPaid: false
            },
            shippingAddress: selectedAddress._id,
            couponApplied: couponDiscount > 0,
            invoiceDate: currentDate
        });

        await newOrder.save();

        req.session.cartItems = cartItems;
        
        await Cart.deleteOne({ userId });
        if (req.session.cart) {
            delete req.session.cart;
        }

        console.log("Cart cleared successfully for user:", userId);

        res.json({ success: true, message: "Payment successful" });
    } catch (e) {
        console.error("COD Payment Error:", e);
        res.redirect("/payment-failure");
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};


const paymentFailure = async(req,res)=>{
    
       res.render("payment-failure") 
    
}




const returnOrder = async (req, res) => {
    try {
        const { orderId, productId, returnReason } = req.body;

        if (!orderId || !productId || !returnReason) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

       
        const order = await Order.findOne({ orderId }).populate('user'); 

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        
        const productItem = order.orderItems.find(item => item.product.toString() === productId);

        if (!productItem) {
            return res.status(404).json({ success: false, message: 'Product not found in the order' });
        }

        if (productItem.status === 'Return Requested' || productItem.status === 'Returned') {
            return res.status(400).json({ success: false, message: 'Return already requested or completed' });
        }
        productItem.status = 'Return Requested';
        productItem.returnReason = returnReason;

        
        await order.save();

        res.status(200).json({ 
            success: true, 
            message: 'Return request submitted for admin approval', 
           
        });

    } catch (error) {
        console.error('Error processing return:', error);
        res.status(500).json({ success: false, message: 'Could not process return request' });
    }
};


const downloadInvoice = async (req,res)=>{
    try {
        const orderId = req.params.id;

        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).send("Order not found");
        }

        
        const invoicePath = path.join(__dirname, `../invoices/invoice-${orderId}.pdf`);
        
        
        
        const doc = new PDFDocument();
        const stream = fs.createWriteStream(invoicePath);
        doc.pipe(stream);

        
        doc.fontSize(18).text("Invoice", { align: "center" });
        doc.moveDown();
        doc.fontSize(14).text(`Order ID: ${order._id}`);
        doc.text(`Date: ${order.createdAt.toDateString()}`);
        doc.moveDown();

        
        doc.fontSize(12).text(`Customer: ${order.customerName}`);
        doc.text(`Email: ${order.customerEmail}`);
        doc.text(`Address: ${order.shippingAddress}`);
        doc.moveDown();

        
        doc.text("Order Items:");
        order.items.forEach((item, index) => {
            doc.text(`${index + 1}. ${item.name} - ₹${item.price} x ${item.quantity}`);
        });
        doc.moveDown();

        
        doc.fontSize(14).text(`Total Amount: ₹${order.totalAmount}`, { bold: true });

        
        doc.end();

        
        stream.on("finish", () => {
            res.download(invoicePath, `invoice-${orderId}.pdf`);
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
};



module.exports = {getOrder,cancelOrderItem,orderDetails,cancelOrder,razorpayPayment,verifyRazorpay,walletPayment,codPayment,
    paymentFailure,returnOrder,downloadInvoice}