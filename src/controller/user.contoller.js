import { asyncHandeler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudnary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
const registerUser = asyncHandeler( async(req, res) =>{
    // res.status(200).json({
    //     message: "han ji aa gye ham"
    // });
    //get user details from frontend
    //validation - not empty
    //check if user already exists ://email,username
    //check for images, check for avatar
    //upload them to cloudinary,avatarac
    //create user object - create entry in DB
    //remove passward and refresh tocken from responce
    //check for user creation
    // return response

    const{fullname,email,username,password}=req.body
    // console.log("printing request body",req.body)
    // if(fullname==""){
    //     throw new ApiError(400,"full name is required")
    // }
    if(
        [fullname,email,username,password].some((field)=> field?.trim()===""
    )
    ){
        throw new ApiError(400,"All fields are necessary")
    }

    const existedUser = await User.findOne({
        $or:[{username},{email}]
    })

    if(existedUser){
        throw new ApiError(409, "User with email or username existed")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path
    const coverImageLocalPath = req.files?.coverImage[0]?.path
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar is required")
    }

    const user = await User.create(
        {
            fullname,
            avatar:avatar.url,
            coverImage:coverImage?.url || "",
            email,
            password,
            username:username.toLowerCase()
        }
    )

    const createdUser = await User.findById(user._id).select(
        " -password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500,"something went wrong during creation")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"user registered successfully")
    )
})

export {registerUser}