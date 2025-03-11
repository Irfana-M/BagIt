const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const PDFDocument = require("pdfkit");
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

       
        const orders = await Order.find({ user: userId })
            .populate('user')
            .populate('orderItems.product')
            .sort({ createdAt: -1 });

        
        const totalOrderItems = orders.reduce((total, order) => {
            return total + order.orderItems.length;
        }, 0);

        console.log("Total Order Items:", totalOrderItems);
        console.log("Total Pages:", Math.ceil(totalOrderItems / limit));

        
        const allOrderItems = orders.flatMap(order => order.orderItems);
        const paginatedOrderItems = allOrderItems.slice(skip, skip + limit);

        
        const deliveryDays = 5;
        const ordersWithDeliveryDate = paginatedOrderItems.map((item, index) => {
            
            const parentOrder = orders.find(order => 
                order.orderItems.some(orderItem => orderItem._id.equals(item._id))
            );

            const deliveryDate = new Date(parentOrder.createdAt);
            deliveryDate.setDate(deliveryDate.getDate() + deliveryDays);

            const day = String(deliveryDate.getDate()).padStart(2, '0');
            const month = String(deliveryDate.getMonth() + 1).padStart(2, '0');
            const year = deliveryDate.getFullYear();

            const formattedDeliveryDate = `${day}/${month}/${year}`;

           
                return {
                    ...item.toObject(),
                    orderId: parentOrder.orderId,
                    createdAt: parentOrder.createdAt,
                    deliveryDate: formattedDeliveryDate,
                    paymentInfo: parentOrder.paymentInfo, 
                    product: item.product 
                };
          
        });

  
        const  userData= await User.findById(userId);
        
        res.render('order', {
            orders: ordersWithDeliveryDate,
            currentPage: page,
            totalPages: Math.ceil(totalOrderItems / limit),
            user:userData,
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

       
        const order = await Order.findOne({orderId:orderId}).populate('orderItems.product', 'price quantity');
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        console.log("User ID:", order.user);

        
        const productItem = order.orderItems.find(item => item.product._id.toString() === productId);

        console.log("Product Item:", productItem);
        if (!productItem) {
            return res.status(404).json({ success: false, message: "Product not found in order" });
        }

        
        if (productItem.status === "Shipped" || productItem.status === "Delivered") {
            return res.status(400).json({ success: false, message: "Order cannot be cancelled after shipment or delivery" });
        }

        
        const product = await Product.findById(productId);
        if (product) {
            product.quantity += productItem.quantity;
            await product.save();
        }
        let refundAmount = productItem.price * productItem.quantity;
        console.log("Initial Refund Amount:", refundAmount);

        
        if (order.couponApplied && order.discount > 0) {
            const totalOrderPrice = order.totalPrice;
            const productContribution = (productItem.price * productItem.quantity) / totalOrderPrice;
            const discountToDeduct = order.discount * productContribution;
            refundAmount -= discountToDeduct;
            console.log("Discount Deducted:", discountToDeduct);
        }

        
        refundAmount = Math.max(refundAmount, 0);
        console.log("Final Refund Amount:", refundAmount);

        
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
            { new: true, upsert: true } 
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

     
        const order = await Order.findOne({ orderId: orderId, user: userId })
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

        const relatedOrders = await Order.find({ orderId: orderId })
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

        const { addressId, totalPrice, cartItems, withPayment = true, initiateOnly = false } = req.body;
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

        const orderItems = await Promise.all(cartItems.map(async (item) => {
            const product = await Product.findById(item.productId._id);
            if (!product) {
                throw new Error(`Product not found: ${item.productId._id}`);
            }
            totalOriginalPrice += item.productId.regularPrice * item.quantity;
            totalOfferPrice += item.productId.salePrice * item.quantity;

            return {
                product: item.productId._id,
                productName: product.productName || null, 
                productImage: product.productImage?.[0] || null,
                quantity: item.quantity,
                price: item.productId.salePrice,
            };
        }));

        const totalDiscount = totalOriginalPrice - totalOfferPrice;
        const shippingCharge = totalOfferPrice < 1000 ? 50 : 0;
        const appliedCoupon = req.session.cart?.appliedCoupon || { discount: 0 };
        const couponDiscount = appliedCoupon.discount || 0;

        let finalAmount = totalOfferPrice - couponDiscount + shippingCharge;
        finalAmount = Math.max(finalAmount, 0);

        const orderId = uuidv4();

        let razorpayOrder = null;
        if (withPayment && initiateOnly) {
            console.log("Creating Razorpay order with amount:", finalAmount, "Order ID:", orderId);
            razorpayOrder = await createRazoPayOrder(finalAmount, orderId);

            if (!razorpayOrder || !razorpayOrder.id) {
                return res.status(500).json({ success: false, message: "Failed to create Razorpay order" });
            }

            
            req.session.cartItems = cartItems;

            return res.status(200).json({
                success: true,
                message: "Razorpay payment initiated successfully!",
                razorpayOrderId: razorpayOrder.id,
                amount: razorpayOrder.amount,
                key: process.env.RAZORPAY_KEY_ID || "rzp_test_eABMAUgay8KJLF",
            });
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
                transactionId: null,
                status: "Pending",
            },
            invoiceDate: new Date(),
        });

        await newOrder.save();

        req.session.cartItems = cartItems;

        res.status(200).json({
            success: true,
            message: "Order created successfully!",
            orderId: newOrder._id,
        });

    } catch (error) {
        console.error("Error in Razorpay payment:", error);
        res.status(500).json({ success: false, message: "Server error. Please try again later." });
    }
};



const verifyRazorpay = async (req, res) => {
    try {
        console.log("Verifying payment:", req.body);

        const { payment_id, order_id, signature, orderId, addressId, cartItems, totalPrice } = req.body;

        if (!payment_id || !order_id || !signature) {
            return res.status(400).json({ success: false, message: "Missing payment details" });
        }

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${order_id}|${payment_id}`)
            .digest("hex");

        console.log("Generated Signature:", expectedSignature);
        console.log("Received Signature:", signature);

        if (expectedSignature !== signature) {
            console.error("Payment signature mismatch!");
            return res.status(400).json({ success: false, message: "Payment verification failed: Signature mismatch" });
        }

        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: User not found" });
        }

        let order;

        
        if (orderId) {
            console.log("Retry payment mode: Updating existing order...");
            order = await Order.findById(orderId);
            if (!order) {
                return res.status(404).json({ success: false, message: "Order not found" });
            }
            if (order.user.toString() !== userId) {
                return res.status(403).json({ success: false, message: "Unauthorized: Order does not belong to this user" });
            }
            if (order.paymentInfo.isPaid) {
                return res.status(400).json({ success: false, message: "Order is already paid" });
            }

            
            order.paymentInfo = {
                method: order.paymentInfo.method,
                isPaid: true,
                transactionId: payment_id,
                status: "Success",
                paidAt: new Date(),
            };
            order.orderItems.forEach(item => {
                if (item.status === "Order Placed") {
                    item.status = "Processing"; 
                }
            });
        }
        
        else if (addressId && cartItems && totalPrice) {
            console.log("Initial payment mode: Creating new order...");

            const addressData = await Address.findOne(
                { userId, "address._id": addressId },
                { "address.$": 1 }
            );
            if (!addressData || !addressData.address.length) {
                return res.status(400).json({ success: false, message: "Address not found" });
            }

            const selectedAddress = addressData.address[0];
            let totalOriginalPrice = 0;
            let totalOfferPrice = 0;

            const orderItems = await Promise.all(cartItems.map(async (item) => {
                const product = await Product.findById(item.productId._id);
                if (!product) {
                    throw new Error(`Product not found: ${item.productId._id}`);
                }
                totalOriginalPrice += item.productId.regularPrice * item.quantity;
                totalOfferPrice += item.productId.salePrice * item.quantity;
    
                return {
                    product: item.productId._id,
                    productName: product.productName || null, 
                    productImage: product.productImage?.[0] || null,
                    quantity: item.quantity,
                    price: item.productId.salePrice,
                    status: "Processing"
                };
            }));

            const totalDiscount = totalOriginalPrice - totalOfferPrice;
            const shippingCharge = totalOfferPrice < 1000 ? 50 : 0;
            const appliedCoupon = req.session.cart?.appliedCoupon || { discount: 0 };
            const couponDiscount = appliedCoupon.discount || 0;
            let finalAmount = totalOfferPrice - couponDiscount + shippingCharge;
            finalAmount = Math.max(finalAmount, 0);

            order = new Order({
                user: userId,
                orderId: uuidv4(),
                orderItems,
                totalPrice: totalOfferPrice,
                discount: totalDiscount + couponDiscount,
                finalAmount,
                shippingAddress: selectedAddress._id,
                couponApplied: couponDiscount > 0,
                paymentInfo: {
                    method: "Online Payment",
                    isPaid: true,
                    transactionId: payment_id,
                    status: "Success",
                    paidAt: new Date(),
                },
                invoiceDate: new Date(),
            });
        } else {
            return res.status(400).json({ success: false, message: "Insufficient data: Provide either orderId or addressId, cartItems, and totalPrice" });
        }

        await order.save();

        
        const orderedProductIds = order.orderItems.map((item) => item.product);
        console.log("Removing products from cart:", orderedProductIds);

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
            console.log("Cart is empty, deleting cart for user:", userId);
            await Cart.deleteOne({ userId });
        }

        if (req.session.cart) {
            console.log("Clearing session cart...");
            delete req.session.cart;
        }

        console.log("Order processed and cart updated successfully for user:", userId);

        res.status(200).json({
            success: true,
            message: "Payment successful",
            orderId: order._id,
             
        });

    } catch (error) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ success: false, message: "Server error occurred." });
    }
};



const createOrder = async (req, res) => {
    try {
        const { addressId, totalPrice, cartItems, paymentMethod, paymentStatus } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: User not found" });
        }

        if (!addressId || !totalPrice || !cartItems || !paymentMethod || !paymentStatus) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
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

        const orderItems = await Promise.all(cartItems.map(async (item) => {
            const product = await Product.findById(item.productId._id);
            if (!product) {
                throw new Error(`Product not found: ${item.productId._id}`);
            }
            totalOriginalPrice += item.productId.regularPrice * item.quantity;
            totalOfferPrice += item.productId.salePrice * item.quantity;

            return {
                product: item.productId._id,
                productName : product.productName || null,
                productImage : product.productImage?.[0] || null,
                quantity: item.quantity,
                price: item.productId.salePrice,
            };
        }));

        const totalDiscount = totalOriginalPrice - totalOfferPrice;
        const shippingCharge = 50;
        const appliedCoupon = req.session.cart?.appliedCoupon || { discount: 0 };
        const couponDiscount = appliedCoupon.discount || 0;

        let finalAmount = totalOfferPrice - couponDiscount + shippingCharge;
        finalAmount = Math.max(finalAmount, 0);

        const orderId = uuidv4();

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
                method: paymentMethod,
                isPaid: false, 
                transactionId: null,
                status: paymentStatus, 
            },
            invoiceDate: new Date(),
        });

        
        await newOrder.save();

        res.status(200).json({
            success: true,
            message: "Order created successfully!",
            orderId: newOrder._id,
            
        });

    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ success: false, message: "Server error. Please try again later." });
    }
};



const retryRazorpayPayment = async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "Order ID is required." });
        }

        const order = await Order.findOne({ _id: orderId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        const razorpayOrder = await createRazoPayOrder(order.finalAmount, order.orderId);

        if (!razorpayOrder || !razorpayOrder.id) {
            return res.status(500).json({ success: false, message: "Failed to create Razorpay order" });
        }

        order.paymentInfo.transactionId = razorpayOrder.id;
        await order.save();

        res.status(200).json({
            success: true,
            message: "Payment retry initiated successfully!",
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            key: process.env.RAZORPAY_KEY_ID || "rzp_test_eABMAUgay8KJLF",
        });

    } catch (error) {
        console.error("Error in retrying Razorpay payment:", error);
        res.status(500).json({ success: false, message: "Server error. Please try again later." });
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

        const orderItems = await Promise.all(cartItems.map(async (item) => {
            const product = await Product.findById(item.productId._id);
            if (!product) {
                throw new Error(`Product not found: ${item.productId._id}`);
            }

            totalOriginalPrice += item.productId.regularPrice * item.quantity;
            totalOfferPrice += item.productId.salePrice * item.quantity;

            return {
                product: item.productId._id,
                productName: product.productName || null, 
                productImage: product.productImage?.[0] || null,
                quantity: item.quantity,
                price: item.productId.salePrice,
                status: "Processing",
            };
        }));

        const totalDiscount = totalOriginalPrice - totalOfferPrice;

        const appliedCoupon = req.session.cart?.appliedCoupon?.discount || { discount: 0 };
        const couponDiscount = appliedCoupon.discount || 0;

        const shippingCharge = totalOfferPrice < 1000 ? 50 : 0;

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
            orderItems,
            totalPrice: totalOfferPrice,
            discount: totalDiscount + couponDiscount,
            finalAmount: finalAmount, 
            paymentInfo: {
                method: "Wallet",
                isPaid: true,
                status: "Success"
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
        res.status(500).json({ success: false, message: "Server error. Please try again later." });
    }
};





const codPayment = async (req, res) => {
    try {
        const { addressId, totalPrice, cartItems } = req.body;
        console.log("Raw cartItems:", cartItems);
        if (totalPrice > 1000) {
            return res.status(400).json({ success: false, message: "COD is only available for orders below 1000." });
        }
        

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

        const orderItems = await Promise.all(cartItems.map(async (item) => {
            const product = await Product.findById(item.productId._id);
            if (!product) {
                throw new Error(`Product not found: ${item.productId._id}`);
            }

            totalOriginalPrice += item.productId.regularPrice * item.quantity;
            totalOfferPrice += item.productId.salePrice * item.quantity;

            return {
                product: item.productId._id,
                productName: product.productName || null, 
                productImage: product.productImage?.[0] || null, 
                quantity: item.quantity,
                price: item.productId.salePrice,
                status: "Order Placed",
            };
        }));

        const totalDiscount = totalOriginalPrice - totalOfferPrice;
       

        const appliedCoupon = req.session.cart?.appliedCoupon?.discount || { discount: 0 };
        const couponDiscount = appliedCoupon.discount || 0;

        const shippingCharge = totalOfferPrice < 1000 ? 50 : 0;

        let finalAmount = totalOfferPrice - couponDiscount + shippingCharge;
        finalAmount = Math.max(finalAmount, 0); 
        const currentDate = new Date();
        const invoiceDate = currentDate.toISOString();

        const expireDate = new Date();
        expireDate.setDate(currentDate.getDate() + 30);
        const formattedExpireDate = expireDate.toISOString();
     

        
        const newOrder = new Order({
            user: userId,
            orderItems,
            
            totalPrice: totalOfferPrice,
            discount: totalDiscount + couponDiscount,
            finalAmount: finalAmount,
            paymentInfo: {
                method: "Cash on Delivery",
                isPaid: false,
                status: "Pending"
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

const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        const order = await Order.findOne({ orderId: orderId }).populate('orderItems.product');
        console.log(order);

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const fileName = `invoice-${orderId}.pdf`;
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.setHeader('Content-Type', 'application/pdf');

        doc.pipe(res);

        
        doc.fillColor('#333333')
            .fontSize(24)
            .text('Invoice', { align: 'center', underline: true })
            .moveDown(1);

        
        doc.fillColor('#555555')
            .fontSize(14)
            .text(`Order ID: ${orderId}`, { align: 'left' })
            .text(`Invoice Date: ${order.invoiceDate.toDateString()}`, { align: 'left' })
            .text(`Payment Method: ${order.paymentInfo.method}`, { align: 'left' })
            .text(`Final Amount: ₹${order.finalAmount}`, { align: 'left' })
            .moveDown(2);

        
        doc.fillColor('#FFFFFF')
            .rect(50, doc.y, 500, 25)
            .fill('#27ae60')
            .fontSize(14)
            .fillColor('#FFFFFF')
            .text('Product Name', 60, doc.y + 5, { width: 100 })
            .text('Price', 160, doc.y + 5, { width: 100 })
            .text('Quantity', 260, doc.y + 5, { width: 100 })
            .text('Total', 360, doc.y + 5, { width: 100 });

        doc.moveDown(1);

        
        order.orderItems.forEach((item, index) => {
            const y = doc.y;
            doc.fillColor('#333333')
                .fontSize(12)
                .text(item.product.productName, 60, y + 5, { width: 200 })
                .text(`₹${item.price}`, 260, y + 5, { width: 100 })
                .text(item.quantity, 360, y + 5, { width: 100 })
                .text(`₹${item.price * item.quantity}`, 460, y + 5, { width: 100 });

            
            doc.strokeColor('#cccccc')
                .lineWidth(1)
                .moveTo(50, doc.y + 10)
                .lineTo(550, doc.y + 10)
                .stroke();

            doc.moveDown(1);
        });

        
        doc.moveDown(2)
            .fillColor('#333333')
            .fontSize(12)
            .text(`Total Amount: ₹${order.finalAmount}`, { align: 'right' });

        
        doc.moveDown(4)
            .fillColor('#777777')
            .fontSize(10)
            .text('Thank you for your purchase!', { align: 'center' })
            .text('For any queries, contact bagit@shopping.com', { align: 'center' });

        doc.end();
    } catch (error) {
        console.error(error);
        res.status(500).send("Error generating invoice");
    }
};




module.exports = {getOrder,cancelOrderItem,orderDetails,cancelOrder,razorpayPayment,verifyRazorpay,walletPayment,codPayment,
    paymentFailure,returnOrder,downloadInvoice,retryRazorpayPayment,createOrder}