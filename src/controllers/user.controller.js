import { subscription } from "../models/subscription.model.js"
import { User } from "../models/user.model.js"
import apiError from "../utils/apiError.js"
import apiResponse from "../utils/apiResponse.js"
import asyncHandeler from "../utils/asyncHandler.js"
import uploadOnCloudinary from "../utils/cloudinary.js"
import jwt from "jsonwebtoken"

const options = {
  httpOnly: true,
  secure: true,
  sameSite: "strict"
}

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken,  refreshToken}
    } catch (error) {
        throw new apiError(500, "Something Went Wrong While Generating Refresh And Access Token")
    }
}

const registerUser = asyncHandeler( async (req,res) => {
    try {
        // get details from front end
        const {fullname, username, email, password} = req.body
    
        // validation (email,username) must cheack not empty
        if([fullname, username, email, password].some((item) => item?.trim() === "")){
            throw new apiError(400, "All Fields Are Required")
        }
        
        // check if exist by unique (here both email,username)
        const userExist = await User.findOne({
            $or: [{username}, {email}]
        })
    
        if(userExist) throw new apiError(409, "User Already Exist")
    
        // cheack for images, required avatar
        let avatarLocalPath
        let coverImageLocalPath
        if (req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0) avatarLocalPath = req.files.avatar[0].path
        if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) coverImageLocalPath = req.files.coverImage[0].path
    
        if(!avatarLocalPath) throw new apiError(400, "Avatar Is Required")
        
        // upload to cloudinary
        const avatar = await uploadOnCloudinary(avatarLocalPath)
        const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    
        if(!avatar) throw new apiError(400, "Avatar Iss Required")
    
        // create user object - create entry in db
        const user = await User.create({
            fullname,
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
            email,
            username: username.toLowerCase(),
            password
        })
    
        // remove password and refresh token field
        const userCreated = await User.findById(user._id).select(
            "-password -refreshToken"
        )
    
        // check user created
        if(!userCreated) throw new apiError(500, "Something Went Wrong While Registering The User")
    
        // return res
        return res.status(201).json(
            new apiResponse(200, userCreated, "User Registered Successfully")
        )
    } catch (error) {
        throw new apiError(500, `User Registered Failed || ${error.message}`)
    }
})

const loginUser = asyncHandeler(async (req,res) =>{
    try {
        // req.body se data lo
        const {username, email, password} = req.body
    
        if(!(username || email)) throw new apiError(400, "Username Or Email Is Required")
        
        // find user
        // const user = (email) ? await User.findOne(email) : await User.findOne(username)
        const user = await User.findOne({
            $or: [{username},{email}]
        })
        if(!user) throw new apiError(404, "User Not Found")
    
        // password check
        const isPasswordValid = await user.isPasswordCorrect(password)
        if(!isPasswordValid) throw new apiError(401, "Invalid Password")
        
        // access and refresh token generation
        const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

        // send to cookies
        const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

        // sucess response
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new apiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User Logged In Successfully"
            )
        )
    } catch (error) {
        throw new apiError(500, `User Login Failed || ${error.message}`)
    }
})

const logoutUser = asyncHandeler(async (req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )
    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new apiResponse(
            200,
            {},
            "USer Logged Out"
        )
    )
})

const refreshAccessToken = asyncHandeler(async (req, res) => {
  try {
    const incomingRefreshToken =
      req.cookies?.refreshToken || req.body?.refreshToken

    if (!incomingRefreshToken) {
      throw new apiError(401, "Unauthorized request")
    }

    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET // ✅ correct secret
    )

    const user = await User.findById(decodedToken._id)
    if (!user) {
      throw new apiError(401, "Invalid refresh token")
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new apiError(401, "Refresh token expired")
    }

    const {
      accessToken,
      refreshToken: newRefreshToken
    } = await generateAccessAndRefreshTokens(user._id)

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new apiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      )
  } catch (error) {
    throw new apiError(
      401,
      error?.message || "Invalid refresh token"
    )
  }
})

const changeCurrentPassword = asyncHandeler(async (req, res) => {
    try {
        const {oldPassword, newPassword, confirmPassword} = req.body
        const user = await User.findById(req.user?._id)
        if (!user) throw new apiError(404, "User not found")
    
        if(!oldPassword) throw new apiError(401, "Old Password is Required")
        if(!newPassword) throw new apiError(401, "New Password is Required")
        if(!confirmPassword) throw new apiError(401, "Confirm Password is Required")
        
        if(newPassword !== confirmPassword) throw new apiError(400, "New Password Does Not Match")
    
        const validatePassword = await user.isPasswordCorrect(oldPassword)
        if (!validatePassword) throw new apiError(400, "Invalid Old Password")

        user.password = newPassword
        await user.save({ validateBeforeSave: false })


        return res
        .status(200)
        .json(
            new apiResponse(
                200,
                user,
                "Password Changed Successfully"
            )
        )
    } catch (error) {
        throw new apiError(500,`Password Changing Failed || ${error?.message}`)
    }
})

const getCurrentUser = asyncHandeler( async(req, res) => {
    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            req.user,
            "Current User Fetched Sucessfully"
        )
    )
})

const updateAccountDetails = asyncHandeler( async(req,res) => {
    try {
        const {fullname, email, username} = req.body
        if(!(fullname && email && username)) throw new apiError(401, "All Feilds Are Required")
        
        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    username: username.toLowerCase(), 
                    fullname,
                    email
                }
            },
            {new: true}
        ).select("-password -refreshToken")

        return res
        .status(200)
        .json(
            new apiResponse(
                200,
                user,
                "Given Feilds Updated Successfully"
            )
        )
    } catch (error) {
        throw new apiError(500,`Error While Changing Account Details || ${error?.message}`)
    }
})

const updateUserAvatar = asyncHandeler(async(req, res) => {
    try {
        const avatarLocalPath = req.file?.path
        if(!avatarLocalPath) throw new apiError(400,"Avatar File Is Missing")
    
        const avatar = await uploadOnCloudinary(avatarLocalPath)
        if(!avatar.url) throw new apiError(400,"Error While Uploading Avatar On Cloudinary")
            
        const user =  await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    avatar: avatar.url
                }
            },
            {new: true}
        ).select("-password -refreshToken")
        
        return res
        .status(200)
        .json(
            new apiResponse(
                200,
                user,
                "Avatar Updated Successfully"
            )
        )
    } catch (error) {
        throw new apiError(500,`Error While Updating Avatar || ${error?.message}`)
    }
})


const updateUserCoverImage = asyncHandeler(async(req, res) => {
    try {
        const coverImageLocalPath = req.file?.path
        if(!coverImageLocalPath) throw new apiError(400,"Cover Image File Is Missing")
    
        const coverImage = await uploadOnCloudinary(coverImageLocalPath)
        if(!coverImage.url) throw new apiError(400,"Error While Uploading Cover Image On Cloudinary")
            
        const user =  await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set: {
                    coverImage: coverImage.url
                }
            },
            {new: true}
        ).select("-password -refreshToken")
        
        return res
        .status(200)
        .json(
            new apiResponse(
                200,
                user,
                "Cover Image Updated Successfully"
            )
        )
    } catch (error) {
        throw new apiError(500,`Error While Updating Cover Image || ${error?.message}`)
    }
})

const getUserChannelProfile = asyncHandeler( async(req,res) => {
    const { username } = req.params
    if(!username?.trim()) throw new apiError(400, "Username Missing")

    const channel = await User.aggregate([
        {
            $match: {
                username: username.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "channelsSubscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$channelsSubscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$subscribers.subscriber"]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                username: 1,
                fullname: 1,
                email: 1,
                isSubscribed: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                avatar: 1,
                coverImage: 1,
            }
        }
    ])
    if(!channel?.length) throw apiError(404, "Channel Does Not Exist")
    return res
        .status(200)
        .json(
            new apiResponse(
                200,
                channel[0],
                "User Channel Fetched Successfully"
            )
        )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
}