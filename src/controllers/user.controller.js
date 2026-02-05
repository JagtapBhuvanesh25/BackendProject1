import { User } from "../models/user.model.js"
import apiError from "../utils/apiError.js"
import apiResponse from "../utils/apiResponse.js"
import asyncHandeler from "../utils/asyncHandler.js"
import uploadOnCloudinary from "../utils/cloudinary.js"

const registerUser = asyncHandeler( async (req,res) => {
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
})

export {
    registerUser
}