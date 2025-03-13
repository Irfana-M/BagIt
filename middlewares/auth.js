const User = require("../models/userSchema");

const noCache = (req, res, next) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    next();
  };


const isAdminAuthenticated = (req, res, next) => {
    if (!req.session.admin) {
      return res.redirect("/admin/login"); 
    }
    next(); 
  };


  const redirectIfAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return res.redirect("/"); 
    }
    next();
};

  
  

const userAuth = async (req, res, next) => {
    
    try {
        if (req.session.user) {
            const data = await User.findById(req.session.user);
            if (data && !data.isBlocked) {
                return next();
            } else {
                console.log("User blocked or not found");
                return res.redirect("/login");
            }
        } 

        const sendJsonResponse = req.query.jsonResponse === "true"; 

        if (sendJsonResponse) {
            return res.status(401).json({ 
                status: false, 
                message: "User not logged in", 
                redirect: "/login" 
            });
        } else {
            return res.redirect("/login");
        }
    } catch (error) {
        console.error("Error in user auth middleware:", error);
        return res.status(500).send("Internal server error");
    }
};


const adminAuth = (req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data=>{
        if(data){
            next();
        }else{
            res.redirect("/admin/login")
        }
        
    })
    .catch(error=>{
        console.log("Error in adminauth middleware",error);
        res.status(500).send("Internal Server Error")
    })
}

module.exports = {userAuth,adminAuth,noCache,isAdminAuthenticated,redirectIfAuthenticated}