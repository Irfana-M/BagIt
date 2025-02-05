const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');

const getOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const page = parseInt(req.query.page) || 1; // Get current page, default is 1
        const limit = 5; // Orders per page
        const skip = (page - 1) * limit; // Calculate items to skip

        // Fetch total order count for pagination
        const totalOrders = await Order.countDocuments({ userId });

        // Fetch paginated orders and populate product details
        const orders = await Order.find({ userId })
            .populate('userId')
            .populate('productId') // Ensure 'product' is populated
            .sort({ createdOn: -1 }) // Sort orders by latest
            .skip(skip)
            .limit(limit);
           

        // if (!orders.length) {
        //     return res.render('order', { 
        //         orders: [], 
        //         products: [], 
        //         currentPage: page, 
        //         totalPages: Math.ceil(totalOrders / limit),
        //         error: 'No orders found' 
        //     });
        // }

        
        // const arr = [];
        // for (const order of orders) {
        //     for (const item of order.orderItems) {
        //         arr.push({ 
        //             orderItemId: item.orderItemId, // Extracting orderItemId
        //             productName: item.product.name, 
        //             price: item.price, 
        //             quantity: item.quantity, 
        //             orderId: order.orderId,
        //             status: order.status
        //         });
        //     }
        // }

        res.render('order', {
            orders,
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

        
        const order = await Order.findOne({ "order.orderId": orderItemId }).populate("order.productId");

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        
        const orderItem = order.orderItems.find(item => item.orderItemId === orderId);

        if (!orderItem) {
            return res.status(404).json({ success: false, message: "Order item not found" });
        }

        
        if (order.status === "Shipped" || order.status === "Delivered") {
            return res.status(400).json({ success: false, message: "Order cannot be cancelled after shipment" });
        }

        
        if (orderItem.product) {
            const product = orderItem.product; 
            product.stock += orderItem.quantity; 
            await product.save(); 
            console.log(`Stock updated: ${product.productName} now has ${product.stock} items.`);
        }

        orderItem.status = "Cancelled";
        orderItem.cancellationReason = reason;

        
        const allCancelled = order.orderItems.every(item => item.status === "Cancelled");
        if (allCancelled) {
            order.status = "Cancelled";
        }

        await order.save();

        res.json({ success: true, message: "Order item cancelled and stock updated successfully" });
    } catch (error) {
        console.error("Error cancelling order item:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};


const orderDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId } = req.params; 
        console.log("User ID:", userId, "Order ID:", orderId);

        const order = await Order.findOne({ orderId: orderId })
            .populate("userId") 
            .populate({
                path: 'productId',
                populate: { path: 'category', select: 'name' }
            })
            .populate({
                path: "address",
                select: "address", 
            })
            .exec();

        console.log(order);

        if (!order) {
            return res.redirect("/pageNotFound");
        }

        // Example of adding a mock tracking history to the order
        order.trackingHistory = order.trackingHistory || ['Order Received', 'Shipped', 'Out for Delivery'];

        res.render("order-details", { order });

    } catch (error) {
        console.error("Error fetching order details:", error);
        res.redirect("/pageNotFound");
    }
};






module.exports = {getOrder,cancelOrderItem,orderDetails}