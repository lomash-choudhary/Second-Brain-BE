import * as dotenv from "dotenv"
dotenv.config()
import {v2 as cloudinary} from "cloudinary"
import fs from "fs"

// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUD_NAME_KEY!, 
    api_key: process.env.API_KEY, 
    api_secret: process.env.API_SECRET
});


export const uploadOnCloudinary = async (localFilPath:any) => {
    try {
        if(!localFilPath) return 'Unable to find the path'
        
        //upload file on cloudinary
        const response = await cloudinary.uploader.upload(localFilPath, {
            resource_type: "auto",
            folder:"uploads",
        })
        //file has been uloaded successfully
        fs.unlinkSync(localFilPath)
        return response.url

    } catch (error) {
        fs.unlinkSync(localFilPath)
        return ('Unable to upload the file')
    }
}

interface deleteFromCloudinaryInterface{
    fileToBeDeleted: string,
    resourceType: string, 
    type: string
}

export const deleteFromCloudinary = async({fileToBeDeleted, resourceType, type} : deleteFromCloudinaryInterface) => {
    try{
        const deleteData = await cloudinary.api
        .delete_resources([fileToBeDeleted],
            {
                type:type,
                resource_type:resourceType
            }
        )
        if(!deleteData){
            console.log("unable to delete the file")
            return false
        }
        return true
    }
    catch(err){
        console.log(`error occured while deleting the file ${err}`)
    }
}