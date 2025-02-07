const User = require("../models/userSchema");

// const userAuth = (req,res,next)=>{
   
//     if(req.session.user){
//         User.findById(req.session.user)
//         .then(data=>{
//             if(data && !data.isBlocked){
                
//                 next();
//             }else{
//                 console.log("User blocked or not found");
//                 res.redirect("/login")
//             }
//         })
//         .catch(error=>{
//             console.log("Error in user auth middleware");
//             res.status(500).send("Internet server error")
//         })
//     }else{
//         const sendJsonResponse = req.query.jsonResponse || false;

//         if (sendJsonResponse) {
//             return res.status(401).json({ 
//                 status: false, 
//                 message: "User not logged in", 
//                 redirect: "/login" 
//             });
//         } else {
//             return res.redirect("/login");
//         }

//     }
// }

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

        const sendJsonResponse = req.query.jsonResponse === "true"; // Ensure it's a boolean

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

module.exports = {userAuth,adminAuth}