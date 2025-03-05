const User = require("../../models/userSchema");
const Order = require("../../models/orderSchema");
const Product = require("../../models/productSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const moment = require('moment');

const pageerror = async (req, res) => {
  res.render("pageerror", { activePage: "dashboard" });
};

const loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }

  res.render("admin-login", { message: null });
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, isAdmin: true });
    if (admin) {
      const passwordMatch = await bcrypt.compare(password, admin.password);

      if (passwordMatch) {
        req.session.admin = true;
        return res.redirect("/admin");
      } else {
        return res.redirect("/admin");
      }
    } else {
      return res.redirect("/");
    }
  } catch (error) {
    console.log("Login error", error);
    return res.redirect("/admin/pageerror");
  }
};

const loadDashboard = async (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin/login");
  }

  try {
    // 1. Get total counts for Users, Products, and Orders
    const [totalUsers, totalProducts, totalOrders] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(),
    ]);

    // 2. Aggregate sales metrics for items that are not Cancelled or Returned
    const salesMetrics = await Order.aggregate([
      // Unwind orderItems to process each item individually
      { $unwind: "$orderItems" },
      // Exclude Cancelled or Returned items
      { $match: { "orderItems.status": { $nin: ["Cancelled", "Returned"] } } },
      // Group to calculate all metrics
      {
        $group: {
          _id: null,
          salesCount: { $sum: 1 }, // Count of non-cancelled/non-returned items
          overallRevenue: { $sum: "$finalAmount" }, // Sum of finalAmount (adjusted below)
          overallDiscount: { $sum: "$discount" }, // Sum of discount (adjusted below)
          overallOrderAmount: {
            $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] }, // Sum of price * quantity
          },
        },
      },
    ]);

    // Extract values from aggregation, default to 0 if no data
    const {
      salesCount = 0,
      overallRevenue = 0,
      overallDiscount = 0,
      overallOrderAmount = 0,
    } = salesMetrics.length > 0 ? salesMetrics[0] : {};

    // 3. Fetch sales data for the table (all orders, not filtered here)
    const salesData = await Order.find()
      .select("orderId totalPrice discount couponApplied finalAmount")
      .populate("user", "name");

    // 4. Render the dashboard
    res.render("dashboard", {
      activePage: "dashboard",
      totalUsers,
      totalProducts,
      totalOrders,
      salesCount,
      overallRevenue,
      overallDiscount,
      overallOrderAmount,
      salesData,
    });
  } catch (error) {
    console.error("Error loading dashboard:", error);
    res.redirect("/admin/pageerror");
  }
};


const generateReport = async (req, res) => {
    try {
        const { filter, start, end } = req.query;

        let query = { "orderItems.status": { $nin: ["Delivered", "Cancelled"] } };


        if (filter === "today") {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            query.createdAt = { $gte: today };
        } else if (filter === "week") {
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);
            query.createdAt = { $gte: lastWeek };
        } else if (filter === "month") {
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            query.createdAt = { $gte: lastMonth };
        } else if (filter === "custom" && start && end) {
            query.createdAt = { 
                $gte: new Date(start), 
                $lte: new Date(end) 
            };
        }

        
        const salesData = await Order.find(query)
            .select("orderId totalPrice discount couponApplied finalAmount")
            .populate("user", "name");

        
        const result = await Order.aggregate([
            { $unwind: "$orderItems" },
            { $match: query },
            { $count: "totalSales" },
        ]);
        const salesCount = result.length > 0 ? result[0].totalSales : 0;

        const overallRevenueResult = await Order.aggregate([
            { $match: query },
            { $group: { _id: null, total: { $sum: "$finalAmount" } } },
        ]);
        const overallRevenue = overallRevenueResult.length > 0 ? overallRevenueResult[0].total : 0;

        const overallDiscountResult = await Order.aggregate([
            { $match: query },
            { $group: { _id: null, discount: { $sum: "$discount" } } },
        ]);
        const overallDiscount = overallDiscountResult.length > 0 ? overallDiscountResult[0].discount : 0;

        const overallOrderAmountResult = await Order.aggregate([
            { $unwind: "$orderItems" },
            { $match: query },
            { $group: { _id: null, totalOrderAmount: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } } } },
        ]);
        const overallOrderAmount = overallOrderAmountResult.length > 0 ? overallOrderAmountResult[0].totalOrderAmount : 0;

        
        const formattedSalesData = salesData.map(data => ({
            orderId: data.orderId,
            user: { name: data.user.name },
            totalPrice: data.totalPrice,
            discount: data.discount,
            salesCount: salesCount,
            overallOrderAmount: overallOrderAmount,
            overallDiscount: overallDiscount
        }));

        res.json(formattedSalesData);
    } catch (error) {
        console.error("Error fetching sales data:", error);
        res.status(500).json({ message: "Server error" });
    }
};



const downloadPDF = async (req, res) => {
    try {
        const { filter, start, end } = req.query;
        let query = { "orderItems.status": { $nin: ["Delivered", "Cancelled"] } };
        if (filter === "today") {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            query.createdAt = { $gte: today };
        } else if (filter === "week") {
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);
            query.createdAt = { $gte: lastWeek };
        } else if (filter === "month") {
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            query.createdAt = { $gte: lastMonth };
        } else if (filter === "custom" && start && end) {
            query.createdAt = { $gte: new Date(start), $lte: new Date(end) };
        }

        const salesData = await Order.find(query)
            .select("orderId totalPrice discount couponApplied finalAmount")
            .populate("user", "name");

        const doc = new PDFDocument({ margin: 50 });

        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            let pdfData = Buffer.concat(buffers);
            res.setHeader('Content-disposition', 'attachment; filename=sales-report.pdf');
            res.setHeader('Content-type', 'application/pdf');
            res.end(pdfData);
        });

        
        doc.fontSize(22).text('Sales Report', { align: 'center', underline: true });
        doc.moveDown();
        doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`, { align: 'left' });
        doc.moveDown(1);

        
       
        const columnWidths = {
            orderId: 200,  
            customer: 100, 
            total: 80,
            discount: 80,
            final: 80
        };

        const tableStartX = 50; 
        const tableTop = doc.y + 20; 
        
        
        doc.fontSize(10).font("Helvetica-Bold");
        doc.text("Order ID", tableStartX, tableTop, { width: columnWidths.orderId });
        doc.text("Customer Name", tableStartX + columnWidths.orderId, tableTop, { width: columnWidths.customer });
        doc.text("Total Price", tableStartX + columnWidths.orderId + columnWidths.customer, tableTop, { width: columnWidths.total });
        doc.text("Discount", tableStartX + columnWidths.orderId + columnWidths.customer + columnWidths.total, tableTop, { width: columnWidths.discount });
        doc.text("Order Amount", tableStartX + columnWidths.orderId + columnWidths.customer + columnWidths.total + columnWidths.discount, tableTop, { width: columnWidths.final });
        
        doc.moveDown(1);
        
        
        doc.font("Helvetica").fontSize(10);
        salesData.forEach(data => {
            let y = doc.y; 
            doc.text(data.orderId, tableStartX, y, { width: columnWidths.orderId, ellipsis: true });
            doc.text(data.user.name, tableStartX + columnWidths.orderId, y, { width: columnWidths.customer, ellipsis: true });
            doc.text(`₹${data.totalPrice}`, tableStartX + columnWidths.orderId + columnWidths.customer, y, { width: columnWidths.total });
            doc.text(`₹${data.discount}`, tableStartX + columnWidths.orderId + columnWidths.customer + columnWidths.total, y, { width: columnWidths.discount });
            doc.text(`₹${data.finalAmount}`, tableStartX + columnWidths.orderId + columnWidths.customer + columnWidths.total + columnWidths.discount, y, { width: columnWidths.final });
        
            doc.moveDown(0.5); 
        });
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke(); 

        
        doc.fontSize(10).text('Generated by BAG IT', 50, doc.y + 20, { align: 'left', italic: true });
        doc.text(`Page 1 of 1`, 500, doc.y + 20, { align: 'right' });

        doc.end();
    } catch (error) {
        console.error("Error generating PDF:", error);
        res.status(500).send("Error generating PDF");
    }
};


const downloadExcel = async (req, res) => {
    try {
        const { filter, start, end } = req.query;
        let query = { "orderItems.status": { $nin: ["Delivered", "Cancelled"] } };

        if (filter === "today") {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            query.createdAt = { $gte: today };
        } else if (filter === "week") {
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);
            query.createdAt = { $gte: lastWeek };
        } else if (filter === "month") {
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            query.createdAt = { $gte: lastMonth };
        } else if (filter === "custom" && start && end) {
            query.createdAt = { $gte: new Date(start), $lte: new Date(end) };
        }

        const salesData = await Order.find(query)
            .select("orderId totalPrice discount couponApplied finalAmount")
            .populate("user", "name");

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        
        worksheet.columns = [
            { header: 'Order ID', key: 'orderId', width: 15 },
            { header: 'Customer Name', key: 'customerName', width: 20 },
            { header: 'Total Price', key: 'totalPrice', width: 15 },
            { header: 'Discount', key: 'discount', width: 15 },
            { header: 'Order Amount', key: 'orderAmount', width: 15 },
        ];

        
        salesData.forEach(data => {
            worksheet.addRow({
                orderId: data.orderId,
                customerName: data.user.name,
                totalPrice: `₹${data.totalPrice}`,
                discount: `₹${data.discount}`,
                orderAmount: `₹${data.finalAmount}`,
            });
        });

        
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { horizontal: 'center' };

        
        res.setHeader('Content-disposition', 'attachment; filename=sales-report.xlsx');
        res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error generating Excel:", error);
        res.status(500).send("Error generating Excel");
    }
};




const salesReport = async (req, res) => {
    try {
        const { filter } = req.query;
        console.log("filter reached",filter)
        let matchStage = { "orderItems.status": { $nin: ["Cancelled", "Returned"] } };

        if (filter === "yearly") {
            matchStage.createdAt = { $gte: moment().startOf("year").toDate() };
        } else if (filter === "monthly") {
            matchStage.createdAt = { $gte: moment().startOf("month").toDate() };
        } else if (filter === "weekly") {
            matchStage.createdAt = { $gte: moment().startOf("week").toDate() };
        }

        const salesData = await Order.aggregate([
            { $match: matchStage },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, totalSales: { $sum: "$finalAmount" } } },
            { $sort: { _id: 1 } }
        ]);
        console.log("sales report",salesData)

        res.json(salesData);
    } catch (error) {
        console.error("Error fetching sales data:", error);
        res.status(500).send("Internal Server Error");
    }
};



const bestSellingProducts = async (req, res) => {
  try {
      const bestProducts = await Order.aggregate([
          { $unwind: "$orderItems" },
          { $match: { "orderItems.status": { $nin: ["Cancelled", "Returned"] } } },
          {
              $group: {
                  _id: "$orderItems.product",
                  totalSales: { $sum: "$orderItems.quantity" },
                  revenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } }
              }
          },
          { $sort: { totalSales: -1 } },
          { $limit: 10 },
          { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "product" } },
          { $unwind: "$product" },
          {
              $project: {
                  name: "$product.productName",
                  totalSales: 1,
                  revenue: 1,
                  stock: "$product.quantity" // Assuming 'stock' is a field in your Product model
              }
          }
      ]);

      res.json(bestProducts);
  } catch (error) {
      console.error("Error fetching best-selling products:", error);
      res.status(500).send("Internal Server Error");
  }
};


const getTopSellingCategories = async (req, res) => {
  try {
    const topCategories = await Order.aggregate([
      { $unwind: "$orderItems" },

      
      { $match: { "orderItems.status": { $nin: ["Cancelled", "Returned"] } } },

      
      {
        $lookup: {
          from: "products", 
          localField: "orderItems.product",
          foreignField: "_id",
          as: "productDetails"
        }
      },

      { $unwind: "$productDetails" },

      
      {
        $group: {
          _id: "$productDetails.category", 
          totalSales: { $sum: "$orderItems.quantity" },
          revenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } }
        }
      },

      
      {
        $lookup: {
          from: "categories", 
          localField: "_id",
          foreignField: "_id",
          as: "categoryDetails"
        }
      },

      
      { $unwind: "$categoryDetails" },

      
      { $sort: { totalSales: -1 } },

      
      { $limit: 10 },

      
      {
        $project: {
          name: "$categoryDetails.name", 
          totalSales: 1,
          revenue: 1
        }
      }
    ]);
    console.log(topCategories)

    res.json(topCategories);
  } catch (error) {
    console.error("Error fetching top categories:", error);
    res.status(500).send("Server Error");
  }
};






const logout = async (req, res) => {
  try {
    delete req.session.admin; 
    req.session.save((err) => {
      if (err) {
        console.log("Error saving session", err);
        return res.redirect("/admin/pageerror");
      }
      res.redirect("/admin/login");
    });
  } catch (error) {
    console.log("Unexpected error during logout", error);
    res.redirect("/admin/pageerror");
  }
};



module.exports = {
  loadLogin,
  login,
  loadDashboard,
  pageerror,
  logout,
  generateReport,
  downloadPDF,
  downloadExcel,
  salesReport,
  bestSellingProducts,
  getTopSellingCategories

};
