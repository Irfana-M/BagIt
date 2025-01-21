const User = require("../models/userSchema");

const userAuth = (req,res,next)=>{
   
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                console.log("User authenticated");
                next();
            }else{
                console.log("User blocked or not found");
                res.redirect("/login")
            }
        })
        .catch(error=>{
            console.log("Error in user auth middleware");
            res.status(500).send("Internet server error")
        })
    }else{
        res.redirect("/login");
    }
}


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

module.exports = {userAuth,adminAuth}