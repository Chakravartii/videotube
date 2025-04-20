import { asyncHandeler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudnary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import { response } from "express";

const registerUser = asyncHandeler( async(req, res) =>{
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
});

const generateAcessAndRefreshToken = async (userId)=>{
    try{
        const user=await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshTocken = refreshToken
        await user.save({validateBeforeSave:false})

        return {accessToken,refreshToken}
    }catch(err){
        throw new ApiError (501, "something went wrong during access & refresh tocken generation")
    }
}

const userLogin = asyncHandeler( async (req, res) =>{

        const {username,password,email} = req.body;
        // console.log(req.body)
        if(!email && !password){
            throw new ApiError(400,"provide atleast one username or email")
        }

        const user = await User.findOne({
            $or:[{username},{email}]
        })

        if(!user){
            throw new ApiError(400,"User not found !!")
        }

        const isPasswordValid = await user.isPasswordCorrect(password);
        // console.log("valid password :",isPasswordValid);
        
        if(!isPasswordValid){
            throw new ApiError(401,"Invalid User credential");
        }
        const {accessToken,refreshToken} = await generateAcessAndRefreshToken(user._id)
        // console.log("tockens :", accessToken,"\n\n", refreshToken);
        
        const loggedInUser =await User.findById(user._id).select("-password -refreshTocken")
        // console.log("finally user is loggedIn \n\n\n",loggedInUser);
        
        const options ={
            httpOnly:true,
            secure:true
        }

        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken
                },
                "User logged In Successfully"
            )
        );

    })

    const logoutUser = asyncHandeler( async (req,res) =>{
        await User.findByIdAndUpdate(
            req.user._id,
            {
                $set:{
                    refreshToken:undefined
                }
            },
            {
                new: true
            }
        )

        const options = {
            httpOnly:true,
            secure: true
        };

        return res
        .status(200)
        .clearCookie("accessToken",options)
        .clearCookie("refreshToken",options)
        .json(new ApiResponse(200,{},"User Logged Out"))

    })

    const refreshAccessToken = asyncHandeler( async(req,res) =>{
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

        if(!incomingRefreshToken){
            throw new ApiError(401,"unathorized request")
        }

        // try {
            const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
            // console.log("decoded User Id-",decodedToken?._id);
            const user=await User.findById(decodedToken?._id)
            if(!user){
                throw new ApiError(401,"Invalid Refresh Token")
            }
            // console.log("user token :",user,"\n incoming -- ",incomingRefreshToken)
            if(incomingRefreshToken !== user.refreshTocken){
                throw new ApiError(401,"Refresh tocken is expired or used")
            }
    
            const options ={
                httpOnly:true,
                secure:true
            }
            

            const {accessToken,newRefreshToken}=await generateAcessAndRefreshToken(user._id)
            return res
            .status(200)
            .cookie("accessToken",accessToken)
            .cookie("refreshToken",newRefreshToken)
            .json(
                new ApiResponse(
                    200,
                    {accessToken,newRefreshToken},
                    "Access token refreshed successfully"
                )
            )
        // } catch (error) {
        //     throw new ApiError("401","Invalid Refresh Token from catch");
        // }
    })

    const changeCurrentPassword = asyncHandeler(async(req,res)=>{
        const {oldPassword,newPassword} =req.body

        const user = await User.findById(req.user?._id)

        const isPasswordCorrect = user.isPasswordCorrect(oldPassword)

        if(!isPasswordCorrect){
            throw new ApiError(400,"Invalid old Password")
        }

        user.password = newPassword
        await user.save({validateBeforeSave:false})

        return res.status(200).json(
            new ApiResponse(200,{},"Password Changed Successfully")
        )
    })

    const getCurrentUser = asyncHandeler(async (req,res)=>{
        return res.status(200).json(
            200,
            req.user,
            "current user fetched successfully"
        )
    })

    const updateAccountDetails = asyncHandeler  ( async(req,res)=>{
        const { fullname,email} = req.body

        if(!fullname || !email){
            throw new ApiError(401,"All fields are required")
        }

        const user = User.findByIdAndUpdate(
            req.user?._id,
            {
                $set:{
                    fullName:fullname,
                    email: email
                }
            },
            {new:true}
        ).select("-password")

        return res.status(200).json(
            new ApiResponse(
                200,
                user,
                "Account Details Updated Successfully"
            )
        )
    })

    const updateUserAvatar = asyncHandeler (async (req,res)=>{
        const avatarLocalPath = req.file?.path

        if(!avatarLocalPath){
            throw new ApiError(400,"Avatar file is missing")
        }

        const avatar = await uploadOnCloudinary(avatarLocalPath)

        if(!avatar.url){
            throw new ApiError(400,"Error while uploading on avatar")
        }

        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set:{
                    avatar:avatar.url
                }
            },
            {new:true}
        ).select("-password")

        return response
        .status(200)
        .json(
            new ApiResponse(
                200,
                user,
                "successfully updated avatar"
            )
        )
    })

    const updateUserCoverImage = asyncHandeler (async (req,res)=>{
        const coverLocalPath = req.file?.path

        if(!coverLocalPath){
            throw new ApiError(400,"Cover Image file is missing")
        }

        const coverImage = await uploadOnCloudinary(coverImage)

        if(!coverImage.url){
            throw new ApiError(400,"Error while uploading on cover Image")
        }

        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set:{
                    coverImage:coverImage.url
                }
            },
            {new:true}
        ).select("-password")

        return response
        .status(200)
        .json(
            new ApiResponse(
                200,
                user,
                "successfully updated coverImage"
            )
        )
    })

    const getUserChannelProfile = asyncHandeler(async(req,res)=>{
        const{username}=req.params
        if(!username?.trim){
            throw new ApiError(400,"username is missing.")
        }
        const channel = await User.aggregate([
            {
                $match:{
                    username:username?.toLowerCase
                }
            },
            {
                $lookup:{
                    from:"subscriptions",
                    localField: "_id",
                    foreignField:"channel",
                    as :"subscribers"
                }
            },
            {
                $lookup:{
                    from:"subscriptions",
                    localField: "_id",
                    foreignField:"subscriber",
                    as :"subscribedTo"
                }
            },
            {
                $addField:{
                    subscribersCount:{
                        $size:"$subscribers"
                    },
                    channelSubscribedToCount:{
                        $size:"$subsribedTo"
                    },
                    isSubscribed:{
                        $cond:{
                            if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $project:{
                    fullName:1,
                    username:1,
                    subscribersCount:1,
                    channelSubscribedToCount:1,
                    isSubscribed:1,
                    avatar:1,
                    coverImage:1,
                    avatar:1,
                    email:1
                }
            }
        ])

        if(!channel?.length){
            throw new ApiError(404,"channel doesn't exist");
        }

        return res.status(200).json(
            new ApiResponse(200, channel[0],"Channel fetched successfully")
        )
    })

    const getWatchHistory =  asyncHandeler(async()=>{
        const user = await User.aggregate([
            {
                $match:{
                    _id: new mongoose.Types.ObjectId(req.user._id)
                }
            },
            {
                $lookup:{
                    from: "videoes",
                    localField:"watchHistory",
                    foreignField:"_id",
                    as: "watchHistory",
                    pipeline: [
                        {
                            $lookup:{
                                from:"users",
                                localField:"owner",
                                foreignField:"_id",
                                as:"owner",
                                pipeline:[
                                    {
                                        $project:{
                                            fullName:1,
                                            username:1,
                                            avatar:1
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            $addField:{
                                owner:{
                                    $first:"$owner"
                                }
                            }
                        }
                    ]
                }
            }
        ])

        return res.status(200),json(
            new ApiResponse(
                200,
                user[0].watchHistory,
                "watch history fetched successful"
            )
        )
    })

export {
    registerUser,
    userLogin,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,
}