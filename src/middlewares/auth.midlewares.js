import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandeler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"

export const verifyJWT = asyncHandeler(async (req,_,next)=>{
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Brearer ","")
        if(!token){
            throw new ApiError(401,"Unauthorized Activity");
        }
        const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
        
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
        if(!user){
            throw new  ApiError(401,"Invalid Access Token")
        }
    
        req.user = user
        
        next()
    } catch (error) {
        throw new ApiError(401,error.message || "Invalid Aceess Tocken")
    }
})