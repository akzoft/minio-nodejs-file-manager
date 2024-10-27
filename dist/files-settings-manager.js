"use strict";
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
exports.compressor = void 0;
const sharp_1 = __importDefault(require("sharp"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const pdf_lib_1 = require("pdf-lib");
class FileSettingProcess {
    ImageCompressor(file) {
        return new Promise((resolve, reject) => {
            if (file.size > 5000000) {
                reject({ message: "Taille de l'image ne doit pas dépasser 5Mo" });
                return;
            }
            (0, sharp_1.default)(file.buffer)
                .resize({ width: 800 })
                .jpeg({ quality: 60 })
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
    AudioCompressor(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const inputPath = path_1.default.join('/tmp', file.originalname);
            const outputPath = path_1.default.join('/tmp', `compressed-${file.originalname}`);
            (0, fs_1.writeFileSync)(inputPath, file.buffer);
            return new Promise((resolve, reject) => {
                if (file.size > 3000000)
                    reject({ message: "Taille de l'audio ne doit pas depassé 3Mo" });
                (0, fluent_ffmpeg_1.default)(inputPath)
                    .output(outputPath)
                    .outputOptions([
                    '-b:a', '64k',
                    '-acodec', 'libmp3lame'
                ])
                    .on('end', () => {
                    const compressedBuffer = (0, fs_1.readFileSync)(outputPath);
                    (0, fs_1.unlinkSync)(inputPath);
                    (0, fs_1.unlinkSync)(outputPath);
                    resolve(compressedBuffer);
                })
                    .on('error', (error) => {
                    console.error(`Erreur lors de la compression de l'audio: ${file.originalname}`, error);
                    (0, fs_1.unlinkSync)(inputPath);
                    reject(error);
                })
                    .run();
            });
        });
    }
    VideoCompressor(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const inputPath = path_1.default.join('/tmp', file.originalname);
            const outputPath = path_1.default.join('/tmp', `compressed-${file.originalname}`);
            (0, fs_1.writeFileSync)(inputPath, file.buffer);
            return new Promise((resolve, reject) => {
                if (file.size > 15000000)
                    reject({ message: "Taille de la video ne doit pas depassé 15Mo" });
                (0, fluent_ffmpeg_1.default)(inputPath)
                    .output(outputPath)
                    .outputOptions([
                    '-preset', 'veryfast',
                    '-crf', '30',
                    '-vf', 'scale=640:-1',
                    '-b:v', '600k',
                    '-b:a', '64k'
                ])
                    .on('end', () => {
                    const compressedBuffer = (0, fs_1.readFileSync)(outputPath);
                    (0, fs_1.unlinkSync)(inputPath);
                    (0, fs_1.unlinkSync)(outputPath);
                    resolve(compressedBuffer);
                })
                    .on('error', (error) => {
                    console.error(`Erreur lors de la compression de la vidéo: ${file.originalname}`, error);
                    reject(error);
                })
                    .run();
            });
        });
    }
    PdfCompressor(file) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            if (file.size > 2000000) {
                reject(new Error("Taille du fichier ne doit pas dépasser 2Mo"));
                return;
            }
            const pdfDoc = yield pdf_lib_1.PDFDocument.load(file.buffer);
            const compressedPdfDoc = yield pdf_lib_1.PDFDocument.create();
            const pages = yield compressedPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
            pages.forEach((page) => compressedPdfDoc.addPage(page));
            const compressedPdfBytes = yield compressedPdfDoc.save({
                useObjectStreams: false,
            });
            resolve(Buffer.from(compressedPdfBytes));
        }));
    }
    Compress(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const mimeType = file.mimetype;
            if (mimeType.startsWith('image/')) {
                return yield this.ImageCompressor(file);
            }
            else if (mimeType === 'application/pdf') {
                return yield this.PdfCompressor(file);
            }
            else if (mimeType.startsWith('audio/')) {
                return yield this.AudioCompressor(file);
            }
            else if (mimeType.startsWith('video/')) {
                return yield this.VideoCompressor(file);
            }
            else {
                console.error(`Type de fichier non pris en charge: ${mimeType}`);
                return null;
            }
        });
    }
}
exports.compressor = new FileSettingProcess();
//# sourceMappingURL=files-settings-manager.js.map