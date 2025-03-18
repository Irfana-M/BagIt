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
    return res.redirect("/admin");
  }
  const message = req.session.message || null;
  req.session.message = null; 
  res.render("admin-login", { message: message }); 
};



const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(req.body)
    const admin = await User.findOne({ email, isAdmin: true });
console.log(admin)
    if (!admin) {
      req.session.message = "Invalid email. Please try again.";
      return res.redirect("/admin/login");
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);

    if (!passwordMatch) {
      req.session.message = "Incorrect password. Please try again.";
      return res.redirect("/admin/login");
    }

    
    req.session.admin = true;
    return res.redirect("/admin");

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

    res.render("dashboard", {
      activePage: "dashboard",
      totalUsers,
      totalProducts,
      totalOrders,
      salesCount,
      overallRevenue,
      overallDiscount,
    });
  } catch (error) {
    console.error("Error loading dashboard:", error);
    res.redirect("/admin/pageerror");
  }
};


const loadSalesReport = async (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin/login");
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

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
      { $sort: { orderDate: -1 } },
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
      { $sort: { orderDate: -1 } },
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
    let query = {};
    const now = new Date();

    
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

    const salesData = await Order.aggregate([
      { $match: query },
      { $unwind: "$orderItems" },
      { $match: { "orderItems.status": { $nin: ["Cancelled", "Returned"] } } }, // Double-check status
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
    ]);

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

    const { totalUsers, totalProducts, totalOrders, salesCount, overallRevenue, overallDiscount } = await loadDashboardData();

    const doc = new PDFDocument({ margin: 50 });
    let buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      let pdfData = Buffer.concat(buffers);
      res.setHeader("Content-disposition", "attachment; filename=sales-report.pdf");
      res.setHeader("Content-type", "application/pdf");
      res.end(pdfData);
    });

    const drawTableHeaders = (doc, headers, columnWidths, startX, startY) => {
      doc.font("Helvetica-Bold").fontSize(8);
      headers.forEach((header, i) => {
        doc.text(header, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), startY, {
          width: columnWidths[i],
          align: "center",
        });
      });
      doc.moveDown(0.5);
      doc.moveTo(startX, doc.y).lineTo(550, doc.y).stroke();
    };

    doc.fontSize(22).text("Sales Report", { align: "center", underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`, { align: "left" });
    doc.moveDown(1);

    const headers = [
      "Order ID",
      "Customer",
      "Product",
      "Category",
      "Qty",
      "Price",
      "Discount",
      "Status",
      "Date",
    ];
    const columnWidths = [60, 80, 80, 60, 40, 50, 50, 50, 80];
    const startX = 50;
    let startY = doc.y + 20;

    drawTableHeaders(doc, headers, columnWidths, startX, startY);

    doc.font("Helvetica").fontSize(8);
    formattedSalesData.forEach((data) => {
      if (doc.y > 700) {
        doc.addPage();
        startY = 50;
        drawTableHeaders(doc, headers, columnWidths, startX, startY);
        doc.moveDown(1);
      }

      startY = doc.y + 5;
      const row = [
        data.orderId,
        data.customerName,
        data.productName,
        data.categoryName,
        data.quantitySold.toString(),
        `₹${data.unitPrice.toFixed(2)}`,
        `₹${data.discountApplied.toFixed(2)}`,
        data.orderStatus,
        data.orderDate,
      ];
      row.forEach((text, i) => {
        doc.text(text, startX + columnWidths.slice(0, i).reduce((a, b) => a + b, 0), startY, {
          width: columnWidths[i],
          align: "center",
        });
      });
      doc.moveDown(0.5);
    });

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(1);

    doc.fontSize(12).text("Summary", { underline: true });
    doc.fontSize(10);
    doc.text(`Total Users: ${totalUsers}`);
    doc.text(`Total Products: ${totalProducts}`);
    doc.text(`Total Orders: ${totalOrders}`);
    doc.text(`Total Sales Count: ${salesCount}`);
    doc.text(`Total Revenue: ₹${overallRevenue}`);
    doc.text(`Total Discount: ₹${overallDiscount}`);
    doc.moveDown(2);

    doc.fontSize(10).text("Generated by BAG IT", 50, doc.y + 20, { align: "left", italic: true });
    doc.text(`Page 1 of 1`, 500, doc.y + 20, { align: "right" });

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
    let query = {};
    const now = new Date();

    
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

    const salesData = await Order.aggregate([
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
    ]);

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

    const { totalUsers, totalProducts, totalOrders, salesCount, overallRevenue, overallDiscount } = await loadDashboardData();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");

    worksheet.columns = [
      { header: "Order ID", key: "orderId", width: 15 },
      { header: "Customer Name", key: "customerName", width: 20 },
      { header: "Product Name", key: "productName", width: 25 },
      { header: "Category", key: "categoryName", width: 20 },
      { header: "Quantity", key: "quantitySold", width: 10 },
      { header: "Unit Price", key: "unitPrice", width: 15 },
      { header: "Discount", key: "discountApplied", width: 15 },
      { header: "Status", key: "orderStatus", width: 15 },
      { header: "Order Date", key: "orderDate", width: 25 },
    ];

    formattedSalesData.forEach((data) => {
      worksheet.addRow({
        orderId: data.orderId,
        customerName: data.customerName,
        productName: data.productName,
        categoryName: data.categoryName,
        quantitySold: data.quantitySold,
        unitPrice: `₹${data.unitPrice.toFixed(2)}`,
        discountApplied: `₹${data.discountApplied.toFixed(2)}`,
        orderStatus: data.orderStatus,
        orderDate: data.orderDate,
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

    res.setHeader("Content-disposition", "attachment; filename=sales-report.xlsx");
    res.setHeader("Content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

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
    let dateRange = {};

    // Define date ranges (UTC midnight)
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    if (filter === "daily") {
      dateRange = { start: todayStart, end: todayEnd };
    } else if (filter === "weekly") {
      dateRange = {
        start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6)),
        end: todayEnd,
      };
    } else if (filter === "monthly") {
      dateRange = {
        start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
        end: todayEnd,
      };
    } else if (filter === "yearly") {
      dateRange = {
        start: new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1)),
        end: todayEnd,
      };
    } else if (filter === "custom") {
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Start and end dates required for custom filter" });
      }
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end || start > todayEnd) {
        return res.status(400).json({ error: "Invalid date range: Start must be before end and not in the future" });
      }
      dateRange = {
        start: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0, 0, 0, 0)),
        end: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23, 59, 59, 999)),
      };
    } else {
      return res.status(400).json({ error: "Invalid filter type. Use: daily, weekly, monthly, yearly, custom" });
    }

    matchStage.createdAt = { $gte: dateRange.start, $lte: dateRange.end };

    // Define group stage
    let groupStage;
    if (filter === "yearly") {
      groupStage = { $dateToString: { format: "%Y", date: "$createdAt" } };
    } else if (filter === "monthly") {
      groupStage = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
    } else if (filter === "daily" || filter === "weekly" || filter === "custom") {
      groupStage = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
    }

    const salesData = await Order.aggregate([
      { $match: matchStage },
      { $unwind: "$orderItems" },
      { $group: { _id: groupStage, totalSales: { $sum: "$finalAmount" } } },
      { $sort: { _id: 1 } },
    ]);

    console.log("Filter:", filter, "Date Range:", dateRange);
    console.log("Match Stage:", matchStage);
    console.log("Sales Data (Before Filling):", salesData);

    // Fill missing periods
    let filledData;
    if (filter === "daily" || filter === "weekly" || filter === "custom") {
      filledData = fillMissingDays(salesData, dateRange);
    } else if (filter === "monthly") {
      filledData = fillMissingMonths(salesData, dateRange);
    } else if (filter === "yearly") {
      filledData = fillMissingYears(salesData, dateRange);
    }

    console.log("Filled Data (After Filling):", filledData);
    res.json(filledData);
  } catch (error) {
    console.error("Error fetching sales data:", error);
    res.status(500).send("Internal Server Error");
  }
};

// Filling Functions
function fillMissingDays(salesData, dateRange) {
  const filledData = [];
  let currentDate = new Date(dateRange.start);

  while (currentDate <= dateRange.end) {
    const periodId = currentDate.toISOString().slice(0, 10);
    const existingData = salesData.find(data => data._id === periodId);
    filledData.push({
      _id: periodId,
      totalSales: existingData ? existingData.totalSales : 0,
    });
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }
  return filledData;
}

function fillMissingMonths(salesData, dateRange) {
  const filledData = [];
  let currentDate = new Date(dateRange.start);

  while (currentDate <= dateRange.end) {
    const periodId = currentDate.toISOString().slice(0, 7);
    const existingData = salesData.find(data => data._id === periodId);
    filledData.push({
      _id: periodId,
      totalSales: existingData ? existingData.totalSales : 0,
    });
    currentDate.setUTCMonth(currentDate.getUTCMonth() + 1);
  }
  return filledData;
}

function fillMissingYears(salesData, dateRange) {
  const filledData = [];
  let currentDate = new Date(dateRange.start);

  while (currentDate <= dateRange.end) {
    const periodId = currentDate.toISOString().slice(0, 4);
    const existingData = salesData.find(data => data._id === periodId);
    filledData.push({
      _id: periodId,
      totalSales: existingData ? existingData.totalSales : 0,
    });
    currentDate.setUTCFullYear(currentDate.getUTCFullYear() + 1);
  }
  return filledData;
}




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
                  stock: "$product.quantity" 
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
