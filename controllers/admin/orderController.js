const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Wallet = require("../../models/walletSchema");
const User = require("../../models/userSchema");
const { v4: uuidv4 } = require("uuid");

const getOrder = async (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin/login");
  }
  try {
    const { page = 1, limit = 5, search = "" } = req.query;
    const sanitizedSearch = search.trim().replace(/[^a-zA-Z0-9 ]/g, "");
    const limitNum = Number(limit) || 5;
    let orders = await Order.find({})
      .populate("user", "name email")
      .populate({
        path: "orderItems.product",
        select: "productName productImage salePrice",
        populate: { path: "category", select: "name" },
      })
      .sort({ createdAt: -1 });

    if (sanitizedSearch) {
      orders = orders.filter((order) => {
        const userName = order.user?.name || "Unknown User";
        const productNames = order.orderItems
          .map((item) => item.product?.productName || "Unknown Product")
          .join(" ");
        return (
          userName.toLowerCase().includes(sanitizedSearch.toLowerCase()) ||
          productNames.toLowerCase().includes(sanitizedSearch.toLowerCase())
        );
      });
    }

    const ordersWithAddresses = await Promise.all(
      orders.map(async (order) => {
        if (order.shippingAddress) {
          const addressDetails = await Address.findOne({
            userId: order.user._id,
          }).exec();

          if (addressDetails) {
            const address = addressDetails.address.find(
              (addr) => addr._id.toString() === order.shippingAddress.toString()
            );

            if (address) {
              return { ...order.toObject(), shippingAddress: address };
            } else {
              return { ...order.toObject(), shippingAddress: null };
            }
          } else {
            return { ...order.toObject(), shippingAddress: null };
          }
        }
        return order.toObject();
      })
    );

    const totalOrders = ordersWithAddresses.length;
    const totalPages = Math.ceil(totalOrders / limitNum);
    const paginatedOrders = ordersWithAddresses.slice(
      (Number(page) - 1) * limitNum,
      Number(page) * limitNum
    );

    for (let order of paginatedOrders) {
      order.formattedCreatedAt = new Date(order.createdAt).toLocaleDateString(
        "en-GB"
      );
      order.formattedInvoiceDate = new Date(
        order.invoiceDate
      ).toLocaleDateString("en-GB");
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
    return res.redirect("/admin/pageerror");
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, productId, status } = req.body;

    
    const isAdmin = req.session.user.role === 'admin'; 

    
    const STATUS_HIERARCHY = [
      'Order Placed',
      'Processing',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
      'Returned',
      'Return Rejected'
    ];

    
    if (!orderId || !productId || !status) {
      return res.json({ success: false, message: "Invalid request data" });
    }

    if (!STATUS_HIERARCHY.includes(status)) {
      return res.json({ success: false, message: "Invalid status value" });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.json({ success: false, message: "Order not found" });
    }

    const orderItem = order.orderItems.find(
      (item) => item.product.toString() === productId
    );

    if (!orderItem) {
      return res.json({
        success: false,
        message: "Product not found in the order",
      });
    }

    const currentStatusIndex = STATUS_HIERARCHY.indexOf(orderItem.status);
    const newStatusIndex = STATUS_HIERARCHY.indexOf(status);

    
    const terminalStates = ['Cancelled', 'Returned', 'Return Rejected'];
    
    
    if (terminalStates.includes(orderItem.status) && !isAdmin) {
      return res.json({
        success: false,
        message: `Cannot modify order in ${orderItem.status} state`,
      });
    }

    
    if (!isAdmin && !['Cancelled', 'Return Requested'].includes(status)) {
      if (newStatusIndex <= currentStatusIndex && 
          currentStatusIndex < STATUS_HIERARCHY.indexOf('Delivered')) {
        return res.json({
          success: false,
          message: `Cannot move from ${orderItem.status} to ${status} - status can only progress forward`
        });
      }
    }

    
    if (status === 'Return Requested') {
      if (!isAdmin && orderItem.status !== 'Delivered') {
        return res.json({
          success: false,
          message: "Can only request return for delivered items"
        });
      }
      
      if (isAdmin && terminalStates.includes(orderItem.status)) {
        return res.json({
          success: false,
          message: "Admin cannot request return for terminal states"
        });
      }
    }

    if (['Returned', 'Return Rejected'].includes(status) && 
        orderItem.status !== 'Return Requested') {
      return res.json({
        success: false,
        message: "Can only return or reject after return is requested"
      });
    }

    
    const product = await Product.findById(productId);
    if (!product) {
      return res.json({
        success: false,
        message: "Product not found"
      });
    }

    if (status === "Cancelled" && currentStatusIndex < STATUS_HIERARCHY.indexOf('Delivered')) {
      product.quantity += orderItem.quantity;
      await product.save();
    }

    if (status === "Delivered") {
      if (product.quantity >= orderItem.quantity) {
        product.quantity -= orderItem.quantity;
        await product.save();
      } else {
        return res.json({
          success: false,
          message: `Not enough stock for ${product.productName}`,
        });
      }
    }

    if (status === "Returned") {
      product.quantity += orderItem.quantity;
      await product.save();
    }

    
    if (isAdmin && terminalStates.includes(orderItem.status) && !terminalStates.includes(status)) {
      if (orderItem.status === 'Cancelled' || orderItem.status === 'Returned') {
        product.quantity -= orderItem.quantity;
        await product.save();
      }
    }

    orderItem.status = status;
    await order.save();

    res.json({ 
      success: true, 
      message: "Product status updated successfully",
      updatedItem: {
        productId,
        status: orderItem.status
      }
    });

  } catch (error) {
    console.error("Error updating order:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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

    return res.redirect("/admin/pageerror");
  }
};

const viewOrder = async (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin/login");
  }
  try {
    const { orderId, productId } = req.params;

    const order = await Order.findOne({ orderId: orderId })
      .populate("user")
      .populate({
        path: "orderItems.product",
        populate: { path: "category", select: "name" },
      })
      .exec();

    if (!order) {
      return res.redirect("/pageNotFound");
    }

    const productDetails = order.orderItems.find(
      (item) => item.product._id.toString() === productId
    );

    if (!productDetails) {
      return res.redirect("/pageNotFound");
    }
    console.log("Order's shippingAddress:", order.shippingAddress);

    let address = null;
          if (order.shippingAddress) {

            const addressDoc = await Address.findOne({
              "address._id": order.shippingAddress,  
            });

            if (addressDoc) {
              address = addressDoc.address.find(addr => addr._id.toString() === order.shippingAddress.toString());
            }

          }

    const invoiceDate = order.invoiceDate
      ? new Date(order.invoiceDate)
      : new Date();

    const addDays = (date, days) => {
      let newDate = new Date(date);
      newDate.setDate(newDate.getDate() + days);
      return newDate.toLocaleDateString("en-GB");
    };

    order.trackingHistory = [
      { date: addDays(invoiceDate, 0), status: "Order Placed" },
      { date: addDays(invoiceDate, 1), status: "Processing" },
      { date: addDays(invoiceDate, 2), status: "Cancelled" },
      { date: addDays(invoiceDate, 3), status: "Shipped" },
      { date: addDays(invoiceDate, 4), status: "Out for Delivery" },
      { date: addDays(invoiceDate, 5), status: "Delivered" },
      { date: addDays(invoiceDate, 6), status: "Return Requested" },
      { date: addDays(invoiceDate, 7), status: "Returned" },
    ];

   console.log(address)

    res.render("orderDetails", {
      order,
      productDetails,
      activePage: "order",
      address,
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    return res.redirect("/admin/pageerror");
  }
};

const updateReturnStatus = async (req, res) => {
  const { orderId, productId, status } = req.body;

  try {
    const order = await Order.findOne({ orderId }).populate("orderItems.product");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const item = order.orderItems.find((item) => item.product._id.toString() === productId);
    if (!item) {
      return res.status(404).json({ success: false, message: "Product not found in order" });
    }

    // Updating return status
    item.returnStatus = status;
    if (status === "Approved") {
      item.status = "Returned";
    } else {
      item.status = "Return Rejected";
    }

    await order.save();

    if (status === "Approved") {
      let refundAmount = 0;

      if (order.orderItems.length === 1) {
        // If only one product, refund = finalAmount - shipping charge
        refundAmount = order.finalAmount - order.shippingCharge;
      } else {
        // If multiple products, calculate proportionate refund
        const totalOrderPrice = order.orderItems.reduce(
          (acc, item) => acc + item.product.salePrice * item.quantity,
          0
        );

        const productShare = (item.price * item.quantity) / totalOrderPrice;
        const proportionalDiscount = order.discount * productShare;
        const proportionalGST = (item.price * 0.18) * item.quantity; // Assuming 18% GST on product price

        refundAmount = (item.price * item.quantity) - proportionalDiscount + proportionalGST;
      }

      item.refundAmount = refundAmount;

      await order.save();

      // Updating user wallet
      const userId = order.user;
      let wallet = await Wallet.findOne({ userId });

      if (!wallet) {
        wallet = new Wallet({ userId, balance: 0, transactions: [] });
      }

      wallet.balance += refundAmount;
      wallet.transactions.push({
        amount: refundAmount,
        type: "refund",
        description: `Refund for order ${orderId}, product ${productId}`,
      });

      await wallet.save();

      // Updating product stock
      const product = await Product.findById(productId);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
        console.log("Product quantity updated successfully");
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error updating return status:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};




module.exports = {
  getOrder,
  updateOrderStatus,
  deleteOrder,
  viewOrder,
  updateReturnStatus,
};
