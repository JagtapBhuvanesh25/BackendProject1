import { User } from "../models/user.model.js";
import apiError from "../utils/apiError.js";
import asyncHandeler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"

export const verifyJWT = asyncHandeler(async (req, _, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Autherization")?.replace("Bearer ", "")
        
        if(!token) throw new apiError(401, "Unauthorized Request")
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")

        if(!user) throw new apiError(401, "Invalid Access")
        req.user = user
        next()
    } catch (error) {
        throw new apiError(500, "JWT Verification Failed")
    }
})