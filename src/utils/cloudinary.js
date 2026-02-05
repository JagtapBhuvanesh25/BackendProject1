import { v2 } from "cloudinary";
import fs from "fs"

v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    //path not found
    if(!localFilePath) return null

    //upload to cloudnary
    const response = await v2.uploader.upload(localFilePath, {
      resource_type: "auto"
    })

    //upload success
    console.log("File Successfully Uploaded On Cloudinary At", response.url);
    return response

  } catch (error) {
    //on any error
    
    fs.unlinkSync(localFilePath)
    //remove locally saved file if upload operation failed
  }
}

export default uploadOnCloudinary;