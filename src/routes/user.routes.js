import { Router } from "express";
import { logoutUser, refreshAccessToken, registerUser, userLogin } from "../controller/user.contoller.js";
import { upload } from "../middlewares/multer.midlewares.js";
import { verifyJWT } from "../middlewares/auth.midlewares.js";

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount:1
        },
        {
            name:"coverImage",
            maxCount:1
        }
    ]),
    registerUser
)

router.route("/login").post(userLogin)

//secured routed
router.route("/logout").post(verifyJWT,logoutUser)

router.route("/refresh-tocken").post(refreshAccessToken)
export default router