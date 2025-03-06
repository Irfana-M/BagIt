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


const loadDashboard = async(req,res)=>{
  if(req.session.admin){
    try {
    res.render("dashboard",{ activePage: 'dashboard' });
}catch (error) {
    res.redirect('/admin/pageerror');
}
} 
}



const loadSalesReport = async (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin/login");
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch basic stats
    const [totalUsers, totalProducts, totalOrders] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(),
    ]);

    const salesMetrics = await Order.aggregate([
      { $unwind: "$orderItems" },
      { $match: { "orderItems.status": { $nin: ["Cancelled", "Returned"] } } },
      {
        $group: {
          _id: null,
          salesCount: { $sum: 1 },
          overallRevenue: { $sum: "$finalAmount" },
          overallDiscount: { $sum: "$discount" },
        },
      },
    ]);

    const {
      salesCount = 0,
      overallRevenue = 0,
      overallDiscount = 0,
    } = salesMetrics.length > 0 ? salesMetrics[0] : {};

    // Initial Sales Report Data (default: today's data) with pagination
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const salesDataQuery = Order.aggregate([
      { $match: { createdAt: { $gte: today, $lte: todayEnd } } },
      { $unwind: "$orderItems" },
      { $match: { "orderItems.status": { $nin: ["Cancelled", "Returned"] } } },
      {
        $lookup: {
          from: "products",
          localField: "orderItems.product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $lookup: {
          from: "categories",
          localField: "productInfo.category",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: { path: "$categoryInfo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },
      {
        $project: {
          orderId: "$orderId",
          customerName: "$userInfo.name",
          productName: "$orderItems.productName",
          categoryName: { $ifNull: ["$categoryInfo.name", "Uncategorized"] },
          quantitySold: "$orderItems.quantity",
          unitPrice: "$orderItems.price",
          discountApplied: "$discount",
          orderStatus: "$orderItems.status",
          orderDate: "$createdAt",
        },
      },
      { $skip: skip },
      { $limit: limit },
    ]);

    const totalSalesData = await Order.aggregate([
      { $match: { createdAt: { $gte: today, $lte: todayEnd } } },
      { $unwind: "$orderItems" },
      { $match: { "orderItems.status": { $nin: ["Cancelled", "Returned"] } } },
      { $count: "total" },
    ]);

    const salesData = await salesDataQuery;
    const totalItems = totalSalesData.length > 0 ? totalSalesData[0].total : 0;
    const totalPages = Math.ceil(totalItems / limit);

    const formattedSalesData = salesData.map((data) => ({
      orderId: data.orderId,
      customerName: data.customerName,
      productName: data.productName,
      categoryName: data.categoryName,
      quantitySold: data.quantitySold,
      unitPrice: data.unitPrice,
      discountApplied: data.discountApplied,
      orderStatus: data.orderStatus,
      orderDate: new Date(data.orderDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    }));

    res.render("salesReport", {
      activePage: "salesReport",
      totalUsers,
      totalProducts,
      totalOrders,
      salesCount,
      overallRevenue,
      overallDiscount,
      salesData: formattedSalesData,
      currentPage: page,
      totalPages,
      limit,
    });
  } catch (error) {
    console.error("Error loading sales report:", error);
    res.redirect("/admin/pageerror");
  }
};


const generateReport = async (req, res) => {
  try {
    const { filter, start, end, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    const now = new Date();

    // Filters for Sales Report table
    if (filter === "today") {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(now);
      todayEnd.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: todayStart, $lte: todayEnd };
    } else if (filter === "week") {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(now);
      weekEnd.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: weekStart, $lte: weekEnd };
    } else if (filter === "month") {
      const monthStart = new Date(now);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(now);
      monthEnd.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: monthStart, $lte: monthEnd };
    } else if (filter === "custom" && start && end) {
      const customStart = new Date(start);
      const customEnd = new Date(end);
      customEnd.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: customStart, $lte: customEnd };
    }

    query["orderItems.status"] = { $nin: ["Cancelled", "Returned"] };

    const salesDataQuery = Order.aggregate([
      { $match: query },
      { $unwind: "$orderItems" },
      { $match: { "orderItems.status": { $nin: ["Cancelled", "Returned"] } } },
      {
        $lookup: {
          from: "products",
          localField: "orderItems.product",
          foreignField: "_id",
          as: "productInfo",
        },
      },
      { $unwind: "$productInfo" },
      {
        $lookup: {
          from: "categories",
          localField: "productInfo.category",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: { path: "$categoryInfo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: "$userInfo" },
      {
        $project: {
          orderId: "$orderId",
          customerName: "$userInfo.name",
          productName: "$orderItems.productName",
          categoryName: { $ifNull: ["$categoryInfo.name", "Uncategorized"] },
          quantitySold: "$orderItems.quantity",
          unitPrice: "$orderItems.price",
          discountApplied: "$discount",
          orderStatus: "$orderItems.status",
          orderDate: "$createdAt",
        },
      },
      { $skip: skip },
      { $limit: parseInt(limit) },
    ]);

    const totalSalesData = await Order.aggregate([
      { $match: query },
      { $unwind: "$orderItems" },
      { $match: { "orderItems.status": { $nin: ["Cancelled", "Returned"] } } },
      { $count: "total" },
    ]);

    const salesData = await salesDataQuery;
    const totalItems = totalSalesData.length > 0 ? totalSalesData[0].total : 0;
    const totalPages = Math.ceil(totalItems / limit);

    const formattedSalesData = salesData.map((data) => ({
      orderId: data.orderId,
      customerName: data.customerName,
      productName: data.productName,
      categoryName: data.categoryName,
      quantitySold: data.quantitySold,
      unitPrice: data.unitPrice,
      discountApplied: data.discountApplied,
      orderStatus: data.orderStatus,
      orderDate: new Date(data.orderDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    }));

    res.json({
      salesData: formattedSalesData,
      currentPage: parseInt(page),
      totalPages,
      totalItems,
    });
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

      const { totalUsers, totalProducts, totalOrders, salesCount, overallRevenue, overallDiscount } = await loadDashboardData();

      const doc = new PDFDocument({ margin: 50 });
      let buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
          let pdfData = Buffer.concat(buffers);
          res.setHeader('Content-disposition', 'attachment; filename=sales-report.pdf');
          res.setHeader('Content-type', 'application/pdf');
          res.end(pdfData);
      });

      const drawTableHeaders = (doc, headers, columnWidths, startX, startY) => {
          doc.font("Helvetica-Bold").fontSize(10);
          headers.forEach((header, i) => {
              doc.text(header, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), startY, {
                  width: columnWidths[i],
                  align: 'center'
              });
          });
          doc.moveDown(0.5);
          doc.moveTo(startX, doc.y).lineTo(550, doc.y).stroke();
      };

      doc.fontSize(22).text('Sales Report', { align: 'center', underline: true });
      doc.moveDown();
      doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`, { align: 'left' });
      doc.moveDown(1);

      const headers = ['Order ID', 'Customer', 'Total Price', 'Discount', 'Final Amount'];
      const columnWidths = [120, 120, 80, 80, 80];
      const startX = 50;
      let startY = doc.y + 20;

      drawTableHeaders(doc, headers, columnWidths, startX, startY);

      doc.font("Helvetica").fontSize(10);
      salesData.forEach((data) => {
          if (doc.y > 700) { 
              doc.addPage();
              startY = 50; 
              drawTableHeaders(doc, headers, columnWidths, startX, startY); 
              doc.moveDown(1);
          }

          startY = doc.y + 5;
          const row = [
              data.orderId,
              data.user.name,
              `₹${data.totalPrice}`,
              `₹${data.discount}`,
              `₹${data.finalAmount}`
          ];
          row.forEach((text, i) => {
              doc.text(text, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), startY, {
                  width: columnWidths[i],
                  align: 'center'
              });
          });
          doc.moveDown(0.5);
      });

      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(1);

      doc.fontSize(12).text('Summary', { underline: true });
      doc.fontSize(10);
      doc.text(`Total Users: ${totalUsers}`);
      doc.text(`Total Products: ${totalProducts}`);
      doc.text(`Total Orders: ${totalOrders}`);
      doc.text(`Total Sales Count: ${salesCount}`);
      doc.text(`Total Revenue: ₹${overallRevenue}`);
      doc.text(`Total Discount: ₹${overallDiscount}`);
      doc.moveDown(2);

      doc.fontSize(10).text('Generated by BAG IT', 50, doc.y + 20, { align: 'left', italic: true });
      doc.text(`Page 1 of 1`, 500, doc.y + 20, { align: 'right' });

      doc.end();
  } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).send("Error generating PDF");
  }
};

const loadDashboardData = async () => {
  const [totalUsers, totalProducts, totalOrders] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments()
  ]);
  const salesMetrics = await Order.aggregate([
      { $unwind: "$orderItems" },
      { $match: { "orderItems.status": { $nin: ["Cancelled", "Returned"] } } },
      {
          $group: {
              _id: null,
              salesCount: { $sum: 1 },
              overallRevenue: { $sum: "$finalAmount" },
              overallDiscount: { $sum: "$discount" }
          }
      }
  ]);
  return {
      totalUsers,
      totalProducts,
      totalOrders,
      salesCount: salesMetrics[0]?.salesCount || 0,
      overallRevenue: salesMetrics[0]?.overallRevenue || 0,
      overallDiscount: salesMetrics[0]?.overallDiscount || 0
  };
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

      const [salesData, totalUsers, totalProducts, totalOrders, salesMetrics] = await Promise.all([
          Order.find(query)
              .select("orderId totalPrice discount couponApplied finalAmount")
              .populate("user", "name"),
          User.countDocuments(),
          Product.countDocuments(),
          Order.countDocuments(),
          Order.aggregate([
              { $unwind: "$orderItems" },
              { $match: { "orderItems.status": { $nin: ["Cancelled", "Returned"] } } },
              {
                  $group: {
                      _id: null,
                      salesCount: { $sum: 1 },
                      overallRevenue: { $sum: "$finalAmount" },
                      overallDiscount: { $sum: "$discount" },
                  },
              },
          ]),
      ]);

      const { salesCount = 0, overallRevenue = 0, overallDiscount = 0 } = salesMetrics.length > 0 ? salesMetrics[0] : {};

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

      worksheet.addRow([]);
      worksheet.addRow(["Summary"]);
      worksheet.addRow(["Total Users", totalUsers]);
      worksheet.addRow(["Total Products", totalProducts]);
      worksheet.addRow(["Total Orders", totalOrders]);
      worksheet.addRow(["Sales Count", salesCount]);
      worksheet.addRow(["Total Revenue", `₹${overallRevenue}`]);
      worksheet.addRow(["Total Discount", `₹${overallDiscount}`]);

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
    const { filter, startDate, endDate } = req.query;
    let matchStage = { "orderItems.status": { $nin: ["Cancelled", "Returned"] } };

    // Filters for Sales Overview chart
    if (filter === "daily") {
      matchStage.createdAt = {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lte: new Date(new Date().setHours(23, 59, 59, 999)),
      };
    } else if (filter === "weekly") {
      matchStage.createdAt = {
        $gte: new Date(new Date().setDate(new Date().getDate() - 7)),
      };
    } else if (filter === "monthly") {
      matchStage.createdAt = {
        $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
      };
    } else if (filter === "yearly") {
      matchStage.createdAt = {
        $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)),
      };
    } else if (filter === "custom" && startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
    }

    const salesData = await Order.aggregate([
      { $match: matchStage },
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: {
            $dateToString: {
              format: filter === "yearly" ? "%Y" : filter === "monthly" ? "%Y-%m" : "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          totalSales: { $sum: "$finalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

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
  loadSalesReport,
  pageerror,
  logout,
  generateReport,
  downloadPDF,
  downloadExcel,
  salesReport,
  bestSellingProducts,
  getTopSellingCategories

};
