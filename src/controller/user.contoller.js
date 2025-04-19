import { asyncHandeler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudnary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

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



export {
    registerUser,
    userLogin,
    logoutUser,
    refreshAccessToken
}