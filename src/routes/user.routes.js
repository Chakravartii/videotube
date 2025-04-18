import { Router } from "express";
import { registerUser } from "../controller/user.contoller.js";
import { upload } from "../middlewares/multer.midlewares.js";
const userRouter = Router()

userRouter.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxcount:1
        },
        {
            name:"coverImage",
            maxcount:1
        }
    ]),
    registerUser
)

export default userRouter