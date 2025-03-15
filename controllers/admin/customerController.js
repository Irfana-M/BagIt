const User = require("../../models/userSchema");

const customerInfo = async (req, res) => {
  if (!req.session.admin) {
    return res.redirect("/admin/login");
  }
  try {
    let search = "";
    if (req.query.search) {
      search = req.query.search;
    }
    let page = 1;
    if (req.query.page) {
      page = req.query.page;
    }
    const limit = 3;
    const userData = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    const count = await User.find({
      isAdmin: false,
      $or: [
        { name: { $regex: ".*" + search + ".*", $options: "i" } },
        { email: { $regex: ".*" + search + ".*", $options: "i" } },
      ],
    }).countDocuments();

    res.render("customers", {
      data: userData,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      activePage: "customers",
    });
  } catch (error) {
    console.error(error);
    return res.redirect("/admin/pageerror");
  }
};

const customerBlocked = async (req, res) => {
  try {
    let id = req.query.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: true } });

    res.status(200).json({ success: true, message: "User blocked successfully!" });
  } catch (error) {
    console.log("User blocking error", error);
    res.status(500).json({ success: false, message: "Error blocking user" });
  }
};

const customerunBlocked = async (req, res) => {
  try {
    let id = req.query.id;
    await User.updateOne({ _id: id }, { $set: { isBlocked: false } });

    res.status(200).json({ success: true, message: "User unblocked successfully!" });
  } catch (error) {
    console.log("User unblocking error", error);
    res.status(500).json({ success: false, message: "Error unblocking user" });
  }
};


module.exports = { customerInfo, customerBlocked, customerunBlocked };
