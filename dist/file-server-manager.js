"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileManager = void 0;
const minio = __importStar(require("minio"));
const multer_1 = __importDefault(require("multer"));
const files_settings_manager_1 = require("./files-settings-manager");
const path_1 = __importDefault(require("path"));
class FileManager {
    constructor(enable) {
        const storage = multer_1.default.memoryStorage();
        this.upload = (0, multer_1.default)({ storage: storage });
        this.enable_compressions = (enable === null || enable === void 0 ? void 0 : enable.enable_compression) || true;
    }
    static configure(data) {
        this.config = new minio.Client({
            endPoint: (data === null || data === void 0 ? void 0 : data.endpoint) || "localhost",
            port: (data === null || data === void 0 ? void 0 : data.port) || 9000,
            useSSL: (data === null || data === void 0 ? void 0 : data.useSSL) || false,
            accessKey: (data === null || data === void 0 ? void 0 : data.accessKey) || "",
            secretKey: (data === null || data === void 0 ? void 0 : data.secretKey) || "",
        });
    }
    MinioStatus() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield FileManager.config.listBuckets();
                console.log("+ Serveur minio allumé");
                return true;
            }
            catch (error) {
                console.log(error);
                if ((error === null || error === void 0 ? void 0 : error.code) === "ECONNREFUSED")
                    console.log("   + Impossible de se connecter au serveur MinIO. Vérifiez que le serveur est en cours d'exécution et que les informations d'identification sont correctes.");
                else
                    console.log("Serveur minio eteint ou n'est pas configurer.");
                return false;
            }
        });
    }
    BucketManager(bucket) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                const isOk = yield this.MinioStatus();
                if (!isOk)
                    reject(new Error("Le serveur minio est eteint ou n'est pas configurer."));
                const bucketExist = yield FileManager.config.bucketExists(bucket);
                if (!bucketExist)
                    FileManager.config.makeBucket(bucket, "us-east-1");
                let policy = this.PolicyManager(bucket);
                yield FileManager.config.setBucketPolicy(bucket, JSON.stringify(policy));
                resolve(true);
            }));
        });
    }
    Upload(files, bucket, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = {};
            const bucketManage = yield this.BucketManager(bucket);
            if (!bucketManage)
                return null;
            const uploadedFiles = [];
            const filesToDelete = [];
            try {
                for (let file of files) {
                    if (!file)
                        return null;
                    const filename = 'goolibeeb' + '-' + Date.now() + path_1.default.extname(file === null || file === void 0 ? void 0 : file.originalname);
                    if (this.enable_compressions) {
                        const buffer = yield files_settings_manager_1.compressor.Compress(file);
                        if (!buffer)
                            return null;
                        yield FileManager.config.putObject(bucket, filename, buffer, buffer === null || buffer === void 0 ? void 0 : buffer.byteLength);
                    }
                    else {
                        yield FileManager.config.putObject(bucket, filename, file.buffer, file.size);
                    }
                    const fieldName = file.fieldname;
                    if (!result[fieldName])
                        result[fieldName] = filename;
                    uploadedFiles.push({ [fieldName]: filename });
                }
                if (uploadedFiles && (uploadedFiles === null || uploadedFiles === void 0 ? void 0 : uploadedFiles.length) < (files === null || files === void 0 ? void 0 : files.length))
                    return null;
                if (data) {
                    const olds = this.pick_attributs_list_from_object_by_files_fieldname(files, data);
                    if (olds) {
                        for (const oldFile of olds) {
                            const fieldname = this.get_keys_or_values_from_object_or_object_array(oldFile, "KEYS");
                            const filename = this.get_keys_or_values_from_object_or_object_array(oldFile, "VALUES");
                            const matchingFile = files.find(file => file.fieldname === fieldname);
                            if (matchingFile)
                                filesToDelete.push(filename);
                        }
                    }
                }
                for (const filename of filesToDelete)
                    yield FileManager.config.removeObject(bucket, filename);
                if (Object.keys(result).length === 0)
                    return null;
                return result;
            }
            catch (error) {
                this.Delete(uploadedFiles, bucket);
                throw new Error(error === null || error === void 0 ? void 0 : error.message);
            }
        });
    }
    Delete(files, bucket) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const filesValues = this.get_keys_or_values_from_object_or_object_array(files, "VALUES");
                const bucketManage = yield this.BucketManager(bucket);
                if (!bucketManage)
                    return false;
                if ((filesValues === null || filesValues === void 0 ? void 0 : filesValues.length) > 0)
                    for (let file of filesValues) {
                        let isFileExist = yield FileManager.config.statObject(bucket, file);
                        if (!(isFileExist === null || isFileExist === void 0 ? void 0 : isFileExist.etag))
                            return false;
                        yield FileManager.config.removeObject(bucket, file);
                    }
                return true;
            }
            catch (error) {
                return false;
            }
        });
    }
    Capture(keys) {
        const fields = keys.map(key => ({ name: key, maxCount: 1 }));
        return this.upload.fields(fields);
    }
    get_files_from_route_middleware(req) {
        const result = {};
        const files = req.files;
        const fileKeys = Object.keys(files);
        fileKeys === null || fileKeys === void 0 ? void 0 : fileKeys.forEach((key) => { result[key] = files[key] ? files[key][0] : undefined; });
        const reponse = Object.values(result).filter(Boolean);
        return reponse;
    }
    ;
    pick_attribut_list_from_object_by_keys(obj, keys) {
        return keys.map(key => ({ [key]: obj[key] }));
    }
    PolicyManager(bucket) {
        let policy = {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: "*",
                    Action: [
                        "s3:GetObject",
                        "s3:PutObject",
                    ],
                    Resource: [`arn:aws:s3:::${bucket}/*`]
                }
            ]
        };
        return policy;
    }
    get_keys_or_values_from_object_or_object_array(input, type) {
        const arr = Array.isArray(input) ? input : [input];
        if (arr.length === 0) {
            return [];
        }
        if (type === 'KEYS') {
            const keys = arr.flatMap(obj => Object.keys(obj));
            return keys.length === 1 ? keys[0] : keys;
        }
        else if (type === 'VALUES') {
            const values = arr.flatMap(obj => Object.values(obj));
            return values.length === 1 ? values[0] : values;
        }
        else {
            throw new Error("Type must be 'KEYS' or 'VALUES'");
        }
    }
    pick_attributs_list_from_object_by_files_fieldname(files, obj) {
        const fieldNames = files.map(file => file.fieldname);
        return Object.keys(obj)
            .filter(key => fieldNames.includes(key))
            .map(key => ({ [key]: obj[key] }));
    }
}
exports.FileManager = FileManager;
const config = {
    endpoint: String(process.env.MINIO_ENDPOINT) || "localhost",
    port: 9000,
    useSSL: false,
    accessKey: String(process.env.MINIO_ACCESS_KEY),
    secretKey: String(process.env.MINIO_SECRET_KEY),
};
//# sourceMappingURL=file-server-manager.js.map