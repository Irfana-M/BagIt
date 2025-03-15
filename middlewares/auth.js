const User = require("../models/userSchema");


function checkUserStatus(req, res, next) {
    const userId = req.session.user;
    
  
    if (!userId) {
      req.user = null;
      return next();
    }
  
    User.findById(userId)
      .then(user => {
        console.log('User found:', user ? { id: user._id, isBlocked: user.isBlocked, name: user.name } : 'No user');
        if (!user) {
          delete req.session.user;  
          delete req.session.name;  
          return res.redirect('/login');
        }
  
        if (user.isBlocked) {
          console.log('User is blocked, clearing session data');
          delete req.session.user;  
          delete req.session.name;  
          return res.redirect('/login?status=blocked');
        } else {
          console.log('User is active, proceeding');
          req.user = { status: 'active', name: user.name };
          next();
        }
      })
      .catch(err => {
        console.error('Error finding user:', err);
        res.redirect('/login');
      });
  }

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
                message: "User blocked or not found", 
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

module.exports = {userAuth,adminAuth,noCache,isAdminAuthenticated,redirectIfAuthenticated,checkUserStatus}