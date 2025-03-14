const Coupon = require("../../models/couponSchema");
const mongoose = require("mongoose");

const loadCoupon = async (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin/login");
  }
  try {
    const findCoupons = await Coupon.find({});

    return res.render("coupon", { activePage: "coupon", coupons: findCoupons });
  } catch (error) {
    return res.redirect("/admin/pageerror");
  }
};

const createCoupon = async (req, res) => {
  try {
    const data = {
      couponName: req.body.couponName,
      startDate: new Date(req.body.startDate + "T00:00"),
      endDate: new Date(req.body.endDate + "T00:00"),
      offerPrice: parseInt(req.body.offerPrice),
      minimumPrice: parseInt(req.body.minimumPrice),
    };
    const newCoupon = new Coupon({
      name: data.couponName,
      createdOn: data.startDate,
      expireOn: data.endDate,
      offerPrice: data.offerPrice,
      minimumPrice: data.minimumPrice,
    });
    await newCoupon.save();
    return res.redirect("/admin/coupon");
  } catch (error) {
    return res.redirect("/admin/pageerror");
  }
};

const editCoupon = async (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin/login");
  }
  try {
    const id = req.query.id;
    const findCoupon = await Coupon.findOne({ _id: id });
    res.render("edit-coupon", {
      findCoupon: findCoupon,
      activePage: "coupon",
    });
  } catch (error) {
    return res.redirect("/admin/pageerror");
  }
};

const updateCoupon = async (req, res) => {
  try {
    couponId = req.body.couponId;
    const oid = new mongoose.Types.ObjectId(couponId);
    const selectedCoupon = await Coupon.findOne({ _id: oid });
    if (selectedCoupon) {
      const startDate = new Date(req.body.startDate);
      const endDate = new Date(req.body.endDate);
      const updatedCoupon = await Coupon.updateOne(
        { _id: oid },
        {
          $set: {
            name: req.body.couponName,
            createdOn: startDate,
            expireOn: endDate,
            offerPrice: parseInt(req.body.offerPrice),
            minimumPrice: parseInt(req.body.minimumPrice),
          },
        }
      );

      if (updatedCoupon.modifiedCount > 0) {
        res.send("Coupon updated successfully");
      } else {
        res.status(500).send("Coupon update failed");
      }
    }
  } catch (error) {
    return res.redirect("/admin/pageerror");
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const id = req.query.id;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res
        .status(404)
        .send({ success: false, message: "Coupon not found" });
    }

    await Coupon.deleteOne({ _id: id });

    res
      .status(200)
      .send({ success: true, message: "Coupon deleted successfully" });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    return res.redirect("/admin/pageerror");
  }
};

module.exports = {
  loadCoupon,
  createCoupon,
  editCoupon,
  updateCoupon,
  deleteCoupon,
};
