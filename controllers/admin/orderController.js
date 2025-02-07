const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const User = require("../../models/userSchema");
const { v4: uuidv4 } = require("uuid");

const getOrder = async (req, res) => {
  try {
    const { page = 1, limit = 5, search = "" } = req.query;

    // Sanitize input to prevent regex injection
    const sanitizedSearch = search.trim().replace(/[^a-zA-Z0-9 ]/g, "");

    // Fetch all orders and populate necessary fields
    let orders = await Order.find({})
      .populate("userId")
      .populate({
        path: "productId",
        populate: { path: "category", select: "name" },
      });

    // Manual filtering based on search term
    if (sanitizedSearch) {
      orders = orders.filter((order) => {
        const userName = order.userId?.name || "";
        const productName = order.productId?.productName || "";

        return (
          userName.toLowerCase().includes(sanitizedSearch.toLowerCase()) ||
          productName.toLowerCase().includes(sanitizedSearch.toLowerCase())
        );
      });
    }

    // Apply pagination to the filtered results
    const totalOrders = orders.length; // Total filtered orders
    const totalPages = Math.ceil(totalOrders / limit);

    const paginatedOrders = orders.slice(
      (Number(page) - 1) * Number(limit),
      Number(page) * Number(limit)
    );

    // Fetching Address for Each Order
    for (let order of paginatedOrders) {
      const addressDetails = await Address.findOne({ userId: order.userId }).exec();

      if (addressDetails) {
        const address = addressDetails.address.find(
          (addr) => addr._id.toString() === order.address.toString()
        );

        order.shippingAddress = address || null;
      } else {
        order.shippingAddress = null;
      }
    }

    // Render the Admin Orders Page
    res.render("admin-order", {
      activePage: "order",
      orders: paginatedOrders,
      currentPage: Number(page),
      totalPages,
      searchQuery: sanitizedSearch,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.redirect("/pageerror");
  }
};




const updateOrderStatus = async (req, res) => {
  try {
    console.log("Received request to update order status:", req.body);

    const { orderId, status } = req.body;
    if (!orderId || !status) {
      return res.json({ success: false, message: "Invalid request data" });
    }

    const order = await Order.findById(orderId).populate("productId");

    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    
    if (order.status === "Delivered" || order.status === "Cancelled") {
      return res.json({
        success: false,
        message: "Cannot modify Delivered or Cancelled orders",
      });
    }

    if (status === "Cancelled" && order.productId) {
      order.productId.quantity += order.quantity;
      await order.productId.save();
    }

    
    if (status === "Delivered" && order.productId) {
      if (order.productId.quantity >= order.quantity) {
        order.productId.quantity -= order.quantity;
        await order.productId.save();
      } else {
        return res.json({
          success: false,
          message: `Not enough stock for ${order.productId.productName}`,
        });
      }
    }

    order.status = status;
    await order.save();

    res.json({ success: true, message: "Order status updated successfully" });
  } catch (error) {
    console.error("Error updating order:", error);
    res.json({ success: false, message: "Internal server error" });
  }
};



const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order) return res.status(404).json({ message: "Order not found" });

    
    if (order.status === "Delivered" || order.status === "Cancelled") {
      return res.status(400).json({ message: "Order cannot be deleted" });
    }

    await Order.findByIdAndDelete(orderId);
    res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


const viewOrder = async (req, res) => {
  try {
      const { orderId } = req.params;  
      console.log("Fetching order details for:", orderId);

      const order = await Order.findOne({ _id: orderId })
          .populate("userId", "name email phone")  
          .populate({
            path: 'productId',
            populate: { path: 'category', select: 'name' }
        })
          .exec();
      if (!order) {
          return res.redirect("/pageNotFound");
      }
    
    const addressDetails = await Address.findOne({ userId: order.userId }).exec();
   clg(addressDetails)
    const address = addressDetails.address.find(
      (addr) => addr._id.toString() === order.address.toString()
    );
    console.log(address);
   
    if (!address) {
      console.error("Address not found for the given addressId");
      return res.redirect("/pageerror");
    }

      order.trackingHistory = [
        { date: '2025-01-01', status: 'Order Placed' },
        { date: '2025-01-03', status: 'Processing' },
        { date: '2025-01-05', status: 'Shipped' },
        { date: '2025-01-07', status: 'Out for Delivery' },
        { date: '2025-01-08', status: 'Delivered' }
      ];

      console.log("Order details:", order);
      
      res.render("orderDetails", { order, activePage: "order" ,address});

  } catch (error) {
      console.error("Error fetching order details:", error);
      res.redirect("/pageerror");
  }
};  



module.exports = {
  getOrder,
  updateOrderStatus,
  deleteOrder,
  viewOrder
};
