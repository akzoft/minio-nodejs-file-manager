import * as minio from "minio";
import multer from 'multer';
import { compressor } from "./files-settings-manager";
import path from "path";


class FileManager {
    private upload: multer.Multer;
    private static config: minio.Client
    private enable_compressions: boolean;


    constructor(enable?: { enable_compression: boolean }) {
        const storage = multer.memoryStorage();
        this.upload = multer({ storage: storage });
        this.enable_compressions = enable?.enable_compression || true
    }

    public static configure(data: { endpoint: string, port: number, useSSL: boolean, accessKey: string, secretKey: string }) {
        this.config = new minio.Client({
            endPoint: data?.endpoint || "localhost",
            port: data?.port || 9000,
            useSSL: data?.useSSL || false,
            accessKey: data?.accessKey || "",
            secretKey: data?.secretKey || "",
        })

    }

    private async MinioStatus(): Promise<boolean> {
        try { await FileManager.config.listBuckets(); console.log("+ Serveur minio allumé"); return true }
        catch (error: any) {
            console.log(error)
            if (error?.code === "ECONNREFUSED")
                console.log("   + Impossible de se connecter au serveur MinIO. Vérifiez que le serveur est en cours d'exécution et que les informations d'identification sont correctes.");
            else console.log("Serveur minio eteint ou n'est pas configurer.")
            return false
        }
    }

    private async BucketManager(bucket: string) {
        return new Promise(async (resolve, reject) => {
            const isOk = await this.MinioStatus()
            if (!isOk) reject(new Error("Le serveur minio est eteint ou n'est pas configurer."));

            const bucketExist = await FileManager.config.bucketExists(bucket);
            if (!bucketExist) FileManager.config.makeBucket(bucket, "us-east-1")

            let policy = this.PolicyManager(bucket)

            await FileManager.config.setBucketPolicy(bucket, JSON.stringify(policy))
            resolve(true)

        })
    }

    public async Upload<T extends object>(files: Express.Multer.File[], bucket: string, data?: T): Promise<Record<string, string> | null> {
        const result: Record<string, string> = {};
        const bucketManage = await this.BucketManager(bucket);
        if (!bucketManage) return null;

        const uploadedFiles: Record<string, string>[] = [];
        const filesToDelete: string[] = [];

        try {

            // Upload des nouveaux fichiers
            for (let file of files) {
                if (!file) return null;

                const filename = 'goolibeeb' + '-' + Date.now() + path.extname(file?.originalname);

                // Traiter et compresser le fichier
                if (this.enable_compressions) {
                    const buffer = await compressor.Compress(file);
                    if (!buffer) return null;

                    await FileManager.config.putObject(bucket, filename, buffer, (buffer as any)?.byteLength);

                } else {
                    await FileManager.config.putObject(bucket, filename, file.buffer, file.size);
                }



                const fieldName = file.fieldname;
                if (!result[fieldName]) result[fieldName] = filename;

                uploadedFiles.push({ [fieldName]: filename });
            }

            // retourner une erreur si le nombre de fichier uploader est inferieur au nombre de fichier a uploader
            if (uploadedFiles && uploadedFiles?.length < files?.length) return null;


            if (data) {
                const olds = this.pick_attributs_list_from_object_by_files_fieldname(files, data)

                if (olds) {
                    for (const oldFile of olds) {
                        const fieldname = this.get_keys_or_values_from_object_or_object_array(oldFile, "KEYS") as string;
                        const filename = this.get_keys_or_values_from_object_or_object_array(oldFile, "VALUES") as string;

                        const matchingFile = files.find(file => file.fieldname === fieldname);
                        if (matchingFile) filesToDelete.push(filename);

                    }
                }
            }

            // Supprimer les anciens fichiers si nécessaire
            for (const filename of filesToDelete)
                await FileManager.config.removeObject(bucket, filename);


            if (Object.keys(result).length === 0) return null;


            return result;

        } catch (error: any) {
            this.Delete(uploadedFiles, bucket);
            throw new Error(error?.message)
        }
    }

    public async Delete<T extends object>(files: T[], bucket: string) {
        try {
            const filesValues = this.get_keys_or_values_from_object_or_object_array(files, "VALUES") as string[]
            const bucketManage = await this.BucketManager(bucket)
            if (!bucketManage) return false

            if (filesValues?.length > 0)
                for (let file of filesValues) {
                    let isFileExist = await FileManager.config.statObject(bucket, file)
                    if (!isFileExist?.etag) return false

                    await FileManager.config.removeObject(bucket, file);
                }
            return true
        } catch (error) {
            return false
        }
    }


    // FILE MANAGEMENT UTILS FUNCTIONS---------------------------------
    public Capture(keys: string[]) {
        const fields = keys.map(key => ({ name: key, maxCount: 1 }));
        return this.upload.fields(fields);
    }

    public get_files_from_route_middleware(req: Express.Request): Express.Multer.File[] {
        const result: Record<string, Express.Multer.File | undefined> = {};
        const files = req.files as Record<string, Express.Multer.File[]>;
        const fileKeys = Object.keys(files);

        fileKeys?.forEach((key) => { result[key] = files[key] ? files[key][0] : undefined; });

        const reponse: Express.Multer.File[] = Object.values(result).filter(Boolean) as Express.Multer.File[];
        return reponse;
    };

    public pick_attribut_list_from_object_by_keys<T, K extends keyof T>(obj: T, keys: K[]): { [x: string]: T[K] }[] {
        return keys.map(key => ({ [key]: obj[key] }));
    }

    private PolicyManager(bucket: string) {
        let policy = {
            Version: "2012-10-17",
            Statement: [
                {
                    Effect: "Allow",
                    Principal: "*",
                    Action: [
                        "s3:GetObject",  // Lire les objets
                        "s3:PutObject",  // Ecrire des objets
                    ],
                    Resource: [`arn:aws:s3:::${bucket}/*`]
                }
            ]
        }

        return policy
    }

    private get_keys_or_values_from_object_or_object_array<T extends object>(input: T | T[], type: 'KEYS' | 'VALUES'): string[] | string | undefined {
        // Vérifiez si l'entrée est un tableau
        const arr = Array.isArray(input) ? input : [input]; // Si ce n'est pas un tableau, le transformer en tableau

        // Vérifier si le tableau contient des objets vides
        if (arr.length === 0) {
            return []; // Retourne un tableau vide si l'entrée est un tableau vide
        }

        if (type === 'KEYS') {
            const keys = arr.flatMap(obj => Object.keys(obj));
            return keys.length === 1 ? keys[0] : keys; // Retourne une seule clé si elle existe ou un tableau de clés
        } else if (type === 'VALUES') {
            const values = arr.flatMap(obj => Object.values(obj));
            return values.length === 1 ? values[0] : values; // Retourne une seule valeur si elle existe ou un tableau de valeurs
        } else {
            throw new Error("Type must be 'KEYS' or 'VALUES'");
        }
    }

    private pick_attributs_list_from_object_by_files_fieldname<T extends object>(files: Express.Multer.File[], obj: T) {
        const fieldNames = files.map(file => file.fieldname);

        return Object.keys(obj)
            .filter(key => fieldNames.includes(key))
            .map(key => ({ [key]: obj[key as keyof T] }));
    }



}

type config_type = { endpoint: string; port: number; useSSL: boolean; accessKey: string; secretKey: string; }
const config: config_type = {
    endpoint: String(process.env.MINIO_ENDPOINT) || "localhost",
    port: 9000,
    useSSL: false,
    accessKey: String(process.env.MINIO_ACCESS_KEY),
    secretKey: String(process.env.MINIO_SECRET_KEY),
}


// FileManager.configure(config)
// export const FileService = new FileManager({ enable_compression: false })



export { FileManager };








