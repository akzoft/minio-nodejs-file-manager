
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import path from "path";
import { readFileSync, unlinkSync, writeFileSync } from "fs";
import { PDFDocument } from 'pdf-lib';

class FileSettingProcess {


    private ImageCompressor(file: Express.Multer.File): Promise<Buffer | null> {
        return new Promise((resolve, reject) => {
            if (file.size > 5000000) { reject({ message: "Taille de l'image ne doit pas dépasser 5Mo" }); return; }

            sharp(file.buffer)
                .resize({ width: 800 }) // Redimensionne l'image à une largeur de 800 pixels, par exemple
                .jpeg({ quality: 60 })  // Réduction de la qualité JPEG à 60%
                .toBuffer()
                .then(compressedBuffer => {
                    resolve(compressedBuffer);
                })
                .catch(error => {
                    console.error(`Erreur lors de la compression de l'image: ${file.originalname}`, error);
                    resolve(null);
                });
        });
    }

    private async AudioCompressor(file: Express.Multer.File): Promise<Buffer | null> {
        const inputPath = path.join('/tmp', file.originalname);
        const outputPath = path.join('/tmp', `compressed-${file.originalname}`);

        writeFileSync(inputPath, file.buffer);

        return new Promise((resolve, reject) => {
            if (file.size > 3000000) reject({ message: "Taille de l'audio ne doit pas depassé 3Mo" })

            ffmpeg(inputPath)
                .output(outputPath)
                .outputOptions([
                    '-b:a', '64k',            // Réduction du bitrate audio à 64 kbps
                    '-acodec', 'libmp3lame'   // Choix du codec MP3 pour la sortie
                ])
                .on('end', () => {
                    const compressedBuffer = readFileSync(outputPath);
                    unlinkSync(inputPath);    // Supprime le fichier d'entrée
                    unlinkSync(outputPath);    // Supprime le fichier de sortie
                    resolve(compressedBuffer);
                })
                .on('error', (error) => {
                    console.error(`Erreur lors de la compression de l'audio: ${file.originalname}`, error);
                    unlinkSync(inputPath);    // Supprime le fichier d'entrée en cas d'erreur
                    reject(error);
                })
                .run();
        });
    }

    private async VideoCompressor(file: Express.Multer.File): Promise<Buffer | null> {
        const inputPath = path.join('/tmp', file.originalname);
        const outputPath = path.join('/tmp', `compressed-${file.originalname}`);

        writeFileSync(inputPath, file.buffer);

        return new Promise((resolve, reject) => {
            if (file.size > 15000000) reject({ message: "Taille de la video ne doit pas depassé 15Mo" })

            ffmpeg(inputPath)
                .output(outputPath)
                .outputOptions([
                    '-preset', 'veryfast',  // Choix d'un preset pour un traitement plus rapide
                    '-crf', '30',           // Valeur CRF élevée pour une compression importante
                    '-vf', 'scale=640:-1',  // Réduction de la résolution à 640px de large
                    '-b:v', '600k',         // Réduction du bitrate vidéo à 600 kbps
                    '-b:a', '64k'           // Réduction du bitrate audio à 64 kbps
                ])
                .on('end', () => {
                    const compressedBuffer = readFileSync(outputPath);
                    unlinkSync(inputPath);  // Supprime le fichier d'entrée
                    unlinkSync(outputPath);  // Supprime le fichier de sortie
                    resolve(compressedBuffer);
                })
                .on('error', (error) => {
                    console.error(`Erreur lors de la compression de la vidéo: ${file.originalname}`, error);
                    reject(error);
                })
                .run();
        });

    }

    private PdfCompressor(file: Express.Multer.File): Promise<Buffer | null> {
        return new Promise(async (resolve, reject) => {
            if (file.size > 2000000) { reject(new Error("Taille du fichier ne doit pas dépasser 2Mo")); return; }

            // Charger le document PDF
            const pdfDoc = await PDFDocument.load(file.buffer as any);

            // Créer un nouveau document PDF
            const compressedPdfDoc = await PDFDocument.create();

            // Copier chaque page du PDF d'origine dans le nouveau PDF
            const pages = await compressedPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
            pages.forEach((page) => compressedPdfDoc.addPage(page));

            // Enregistrer le document compressé et obtenir le buffer
            const compressedPdfBytes = await compressedPdfDoc.save({
                useObjectStreams: false, // Cela peut aider à réduire la taille du fichier
            });

            resolve(Buffer.from(compressedPdfBytes));
        });
    }

    public async Compress(file: Express.Multer.File): Promise<Buffer | null> {
        const mimeType = file.mimetype;

        if (mimeType.startsWith('image/')) {
            return await this.ImageCompressor(file);
        } else if (mimeType === 'application/pdf') {
            return await this.PdfCompressor(file);
        } else if (mimeType.startsWith('audio/')) {
            return await this.AudioCompressor(file);
        } else if (mimeType.startsWith('video/')) {
            return await this.VideoCompressor(file);
        } else {
            console.error(`Type de fichier non pris en charge: ${mimeType}`);
            return null;
        }
    }
}

export const compressor = new FileSettingProcess()