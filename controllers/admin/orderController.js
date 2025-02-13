const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const User = require("../../models/userSchema");
const { v4: uuidv4 } = require("uuid");

const getOrder = async (req, res) => {
  try {
    const { page = 1, limit = 5, search = "" } = req.query;

    const sanitizedSearch = search.trim().replace(/[^a-zA-Z0-9 ]/g, "");
    let orders = await Order.find({})
      .populate("userId")
      .populate({
        path: "productId",
        populate: { path: "category", select: "name" },
      })
      .sort({ createdOn: -1 });
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

    const totalOrders = orders.length;
    const totalPages = Math.ceil(totalOrders / limit);

    const paginatedOrders = orders.slice(
      (Number(page) - 1) * Number(limit),
      Number(page) * Number(limit)
    );

    for (let order of paginatedOrders) {
      order.formattedCreatedOn = new Date(order.createdOn).toLocaleDateString("en-GB"); 
      order.formattedExpireDate = new Date(order.expireDate).toLocaleDateString("en-GB"); 
      const addressDetails = await Address.findOne({
        userId: order.userId,
      }).exec();

      if (addressDetails) {
        const address = addressDetails.address.find(
          (addr) => addr._id.toString() === order.address.toString()
        );

        order.shippingAddress = address || null;
      } else {
        order.shippingAddress = null;
      }
    }

    res.render("admin-order", {
      activePage: "order",
      orders: paginatedOrders,
      currentPage: Number(page),
      totalPages,
      searchQuery: sanitizedSearch,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return res.redirect("/admin/pageerror");;
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
   //
   //  res.json({ success: false, message: "Internal server error" });
   return res.redirect("/admin/pageerror");
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
    //res.status(500).json({ message: "Internal server error" });
    return res.redirect("/admin/pageerror");
  }
};

const viewOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    console.log("Fetching order details for:", orderId);

    const order = await Order.findOne({ _id: orderId })
      .populate("userId", "name email phone")
      .populate({
        path: "productId",
        populate: { path: "category", select: "name" },
      })
      .exec();

    if (!order) {
      return res.redirect("/pageNotFound");
    }

    const addressDetails = await Address.findOne({
      userId: order.userId,
    }).exec();

    const address = addressDetails?.address.find(
      (addr) => addr._id.toString() === order.address.toString()
    );

    if (!address) {
      console.error("Address not found for the given addressId");
      return res.redirect("/pageerror");
    }

    // Get the invoice date or default to today
    const invoiceDate = order.invoiceDate ? new Date(order.invoiceDate) : new Date();

    // Function to add days and format date as DD/MM/YYYY
    const addDays = (date, days) => {
      let newDate = new Date(date);
      newDate.setDate(newDate.getDate() + days);
      return newDate.toLocaleDateString("en-GB"); // Format: DD/MM/YYYY
    };

    // Generate tracking history dynamically
    order.trackingHistory = [
      { date: addDays(invoiceDate, 0), status: "Order Placed" },
      { date: addDays(invoiceDate, 1), status: "Processing" },
      { date: addDays(invoiceDate, 2), status: "Shipped" },
      { date: addDays(invoiceDate, 3), status: "Out for Delivery" },
      { date: addDays(invoiceDate, 4), status: "Delivered" },
    ];

    console.log("Order details:", order);

    res.render("orderDetails", { order, activePage: "order", address });
  } catch (error) {
    console.error("Error fetching order details:", error);
    
    return res.redirect("/admin/pageerror");
  }
};


module.exports = {
  getOrder,
  updateOrderStatus,
  deleteOrder,
  viewOrder,
};
