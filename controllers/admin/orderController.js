const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const { v4: uuidv4 } = require("uuid");
const placeOrder = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("userId") // Populate the whole user object
      .populate("orderItems.product")
      .populate("address"); // Populate products

    console.log(orders, "orders");
    //console.log(orders.address);
    res.render("admin-order", { activePage: "order", orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.redirect("/pageerror");
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    console.log("Received request to update order status:", req.body); // Debugging

    const { orderId, status } = req.body;
    if (!orderId || !status) {
      return res.json({ success: false, message: "Invalid request data" });
    }

    const order = await Order.findById(orderId).populate("orderItems.product");

    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    // Prevent updates for Delivered or Cancelled orders
    if (order.status === "Delivered" || order.status === "Cancelled") {
      return res.json({
        success: false,
        message: "Cannot modify Delivered or Cancelled orders",
      });
    }

    // Restock items if order is cancelled
    if (status === "Cancelled") {
      for (let item of order.orderItems) {
        if (item.product) {
          item.product.quantity += item.quantity;
          await item.product.save();
        }
      }
    }

    // Deduct stock if order is delivered
    if (status === "Delivered") {
      for (let item of order.orderItems) {
        if (item.product && item.product.quantity >= item.quantity) {
          item.product.quantity -= item.quantity;
          await item.product.save();
        } else {
          return res.json({
            success: false,
            message: `Not enough stock for ${item.product.name}`,
          });
        }
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

    if (order.status === "Delivered") {
      return res
        .status(400)
        .json({ message: "Delivered orders cannot be deleted" });
    }

    await Order.findByIdAndDelete(orderId);
    res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
module.exports = {
  placeOrder,
  updateOrderStatus,
  deleteOrder,
};
