const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const { v4: uuidv4 } = require("uuid");


const getOrder = async (req, res) => {
  try {
    const { page = 1, limit = 5, search = "" } = req.query; 
    
    const sanitizedSearch = search.replace(/[^a-zA-Z0-9 ]/g, "");

   
    console.log("Sanitized Search Term:", sanitizedSearch);
    if (!sanitizedSearch) {
      console.log("No search term provided, fetching all orders.");
    }

    const searchQuery = sanitizedSearch
      ? {
          $or: [
            { "userId.name": { $regex: sanitizedSearch, $options: "i" } }, 
            { "productId.productName": { $regex: sanitizedSearch, $options: "i" } } 
          ]
        }
      : {}; 
    console.log("Search Query:", JSON.stringify(searchQuery, null, 2));

    const orders = await Order.find(searchQuery)
      .populate("userId") 
      .populate({
        path: 'productId', // Fetch product details
        populate: { path: 'category', select: 'name' } // Fetch category name
      }) 
      .populate({
        path: "address",
        select: "address", 
    })
      .skip((page - 1) * limit)  
      .limit(Number(limit));   
    console.log("Orders Found:", orders);

    
    const totalOrders = await Order.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalOrders / limit);

    
    res.render("admin-order", {
      activePage: "order",
      orders,
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

    // Prevent modification if the order is already delivered or cancelled
    if (order.status === "Delivered" || order.status === "Cancelled") {
      return res.json({
        success: false,
        message: "Cannot modify Delivered or Cancelled orders",
      });
    }

    // Handle "Cancelled" status - Restocking the product
    if (status === "Cancelled" && order.productId) {
      order.productId.quantity += order.quantity;
      await order.productId.save();
    }

    // Handle "Delivered" status - Deducting stock
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

    // Prevent deletion of delivered or cancelled orders
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

module.exports = {
  getOrder,
  updateOrderStatus,
  deleteOrder,
};
