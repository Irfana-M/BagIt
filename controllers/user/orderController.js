const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');

const getOrder = async (req, res) => {
    try {
        const userId = req.session.user; // Get the user ID from the session
//console.log(userId)
        // Fetch the most recent order for the user (or you can use a different logic to find the order)
        const orders = await Order.find({ userId: userId }) // Assuming user is authenticated
            .populate('orderItems.product'); // Populate the product details

        //console.log("Fetched Orders:", orders);

        if (!orders || orders.length === 0) {
            return res.render('user/order', { orders: [], error: 'No orders found' });
        }

        // res.render('user/order', { orders, error: null });
//console.log(orders.map(i=> console.log(i) ));
        const arr = []
        for (const item of orders) {
           if( item.orderItems.length > 0){
                for(const i of item.orderItems){
                    arr.push({...i._doc,orderId:item.orderId,status:item.status})
                }
           }
        }
        

        res.render('order', {
            orders: orders, 
            products:arr
        });

    } catch (error) {
        console.error("Error fetching order details:", error);
        res.redirect("/pageNotFound"); // Redirect to a 404 page in case of an error
    }
};


// const cancelOrder = async (req,res)=>{
//     try{
//         const { orderId } = req.params;
//         const { reason } = req.body;

        
//         const order = await Order.findById(orderId).populate('orderItems.product'); 
// console.log(order);
//         if (!order) {
//             return res.status(404).json({ success: false, message: "Order not found" });
//         }

        
//         if (order.status === 'Shipped' || order.status === 'Delivered') {
//             return res.status(400).json({ success: false, message: "Order cannot be cancelled after shipment" });
//         }

//         // Restore stock for each product in the order
//         for (let item of order.orderItems) {
//             let product = item.product; // Get the product object
//             if (product) {
//                 product.stock += item.quantity; // Increment stock by the quantity ordered
//                 await product.save(); // Save the updated product stock
//             }
//         }

//         // Update order status and add cancellation reason
//         order.status = "Cancelled";
//         order.cancellationReason = reason;
//         await order.save();

//         res.json({ success: true, message: "Order cancelled and stock updated successfully" });
//     } catch (error) {
//         console.error("Error cancelling order:", error);
//         res.status(500).json({ success: false, message: "Internal Server Error" });
//     }
// };

const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;
        console.log("orderId",orderId)
        // Ensure reason is provided for cancellation
        if (!reason) {
            return res.status(400).json({ success: false, message: "Cancellation reason is required" });
        }

        // Find the order with populated orderItems.product
        const order = await Order.findOne({ orderId: orderId })  // Find by orderId field
        .populate('orderItems.product');  // Populate product details

        console.log("order", order);  // Log to verify the order structure

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Check if the order can be cancelled based on its status
        if (order.status === 'Shipped' || order.status === 'Delivered') {
            return res.status(400).json({ success: false, message: "Order cannot be cancelled after shipment" });
        }

        // Restore stock for each product in the order
        for (let item of order.orderItems) {
            let product = item.product;  // Ensure that the product is populated
            if (product) {
                product.stock += item.quantity;  // Increment stock by the quantity ordered
                console.log(`Restoring ${item.quantity} stock for product: ${product.productName}`);  // Debug log
                await product.save();  // Save the updated product stock
            } else {
                console.error('Product not found in orderItem:', item);
            }
        }

        // Update order status and add cancellation reason
        order.status = "Cancelled";
        order.cancellationReason = reason;
        await order.save();  // Save the order with updated status and reason

        // Respond with success
        res.json({ success: true, message: "Order cancelled and stock updated successfully" });
    } catch (error) {
        console.error("Error cancelling order:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

module.exports = {getOrder,cancelOrder}